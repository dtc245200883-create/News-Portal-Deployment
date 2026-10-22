const crypto = require("node:crypto");
const express = require("express");
const session = require("express-session");
const db = require("./db");
const repairSeedEncoding = require("./repair-seed-encoding");

const app = express();
const PORT = process.env.PORT || 4000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
}
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
}

app.set("view engine", "ejs");
app.set("trust proxy", 1);
app.use(express.static("public", { maxAge: "1h", index: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(session({
    name: "news-portal.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", secure: "auto", maxAge: 8 * 60 * 60 * 1000 }
}));

const passwordMatches = (password, stored) => {
    const [scheme, salt, expectedHex] = String(stored || "").split(":");
    if (scheme !== "scrypt" || !salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const csrfToken = req => {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    return req.session.csrfToken;
};
const validCsrf = req => typeof req.body._csrf === "string" &&
    typeof req.session.csrfToken === "string" &&
    req.body._csrf.length === req.session.csrfToken.length &&
    crypto.timingSafeEqual(Buffer.from(req.body._csrf), Buffer.from(req.session.csrfToken));
const requireAdmin = (req, res, next) => req.session.admin ? next() : res.redirect("/admin/login");
const safeSlug = value => String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
const loadCategories = async () => {
    const [rows] = await db.execute("SELECT id, name, slug FROM categories ORDER BY name");
    return rows;
};

app.use((req, res, next) => {
    res.locals.admin = req.session.admin || null;
    res.locals.csrfToken = csrfToken(req);
    res.locals.categoryNav = [];
    next();
});
app.use(async (req, res, next) => {
    try { res.locals.categoryNav = await loadCategories(); next(); }
    catch (error) { next(error); }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.get("/", async (req, res, next) => {
    try {
        const categoryId = Number(req.query.category);
        const categories = res.locals.categoryNav;
        const selected = Number.isSafeInteger(categoryId) && categoryId > 0
            ? categories.find(category => category.id === categoryId) : null;
        const [posts] = selected
            ? await db.execute("SELECT p.id, p.title, p.slug, p.excerpt, p.created_at, c.name AS category_name, c.slug AS category_slug FROM posts p JOIN categories c ON c.id = p.category_id WHERE p.status = 'published' AND c.id = ? ORDER BY p.published_at DESC, p.id DESC", [selected.id])
            : await db.execute("SELECT p.id, p.title, p.slug, p.excerpt, p.created_at, c.name AS category_name, c.slug AS category_slug FROM posts p JOIN categories c ON c.id = p.category_id WHERE p.status = 'published' ORDER BY p.published_at DESC, p.id DESC");
        res.render("index", { posts, categories, selected });
    } catch (error) { next(error); }
});

app.get("/bai-viet/:slug", async (req, res, next) => {
    try {
        const [rows] = await db.execute("SELECT p.title, p.body, p.created_at, p.published_at, c.name AS category_name, c.slug AS category_slug FROM posts p JOIN categories c ON c.id = p.category_id WHERE p.slug = ? AND p.status = 'published' LIMIT 1", [req.params.slug]);
        if (!rows.length) return res.status(404).render("not-found");
        res.render("post", { post: rows[0] });
    } catch (error) { next(error); }
});

app.get("/admin/login", (req, res) => res.render("admin-login", { error: null }));
app.post("/admin/login", async (req, res, next) => {
    if (!validCsrf(req)) return res.status(403).send("Yêu cầu không hợp lệ");
    const username = String(req.body.username || "").trim().slice(0, 100);
    const password = String(req.body.password || "").slice(0, 200);
    try {
        const [users] = await db.execute("SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1", [username]);
        if (!users.length || !passwordMatches(password, users[0].password_hash)) {
            return res.status(401).render("admin-login", { error: "Tên đăng nhập hoặc mật khẩu chưa đúng." });
        }
        req.session.regenerate(error => {
            if (error) return next(error);
            req.session.admin = { id: users[0].id, username: users[0].username };
            req.session.csrfToken = crypto.randomBytes(32).toString("hex");
            res.redirect("/admin");
        });
    } catch (error) { next(error); }
});
app.post("/admin/logout", requireAdmin, (req, res) => {
    if (!validCsrf(req)) return res.status(403).send("Yêu cầu không hợp lệ");
    req.session.destroy(() => res.clearCookie("news-portal.sid").redirect("/"));
});

app.get("/admin", requireAdmin, async (req, res, next) => {
    try {
        const [posts] = await db.execute("SELECT p.id, p.title, p.status, p.created_at, c.name AS category_name FROM posts p JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC");
        res.render("admin-list", { posts });
    } catch (error) { next(error); }
});
app.get("/admin/bai-viet/moi", requireAdmin, async (req, res, next) => {
    try { res.render("admin-form", { post: null, categories: await loadCategories(), error: null }); }
    catch (error) { next(error); }
});
app.post("/admin/bai-viet", requireAdmin, async (req, res, next) => {
    if (!validCsrf(req)) return res.status(403).send("Yêu cầu không hợp lệ");
    const post = normalizePost(req.body);
    try {
        const categories = await loadCategories();
        if (!isValidPost(post, categories)) return res.status(400).render("admin-form", { post, categories, error: "Vui lòng nhập tiêu đề, nội dung và danh mục hợp lệ." });
        const slug = await uniqueSlug(post.title);
        await db.execute("INSERT INTO posts (category_id, author_id, title, slug, excerpt, body, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [post.categoryId, req.session.admin.id, post.title, slug, post.excerpt, post.body, post.status, post.status === "published" ? new Date() : null]);
        res.redirect("/admin");
    } catch (error) { next(error); }
});
app.get("/admin/bai-viet/:id/sua", requireAdmin, async (req, res, next) => {
    try {
        const [rows] = await db.execute("SELECT id, category_id AS categoryId, title, excerpt, body, status FROM posts WHERE id = ?", [Number(req.params.id)]);
        if (!rows.length) return res.status(404).render("not-found");
        res.render("admin-form", { post: { ...rows[0], originalTitle: rows[0].title }, categories: await loadCategories(), error: null });
    } catch (error) { next(error); }
});
app.post("/admin/bai-viet/:id/sua", requireAdmin, async (req, res, next) => {
    if (!validCsrf(req)) return res.status(403).send("Yêu cầu không hợp lệ");
    const post = normalizePost(req.body);
    try {
        const categories = await loadCategories();
        if (!isValidPost(post, categories)) return res.status(400).render("admin-form", { post, categories, error: "Vui lòng nhập tiêu đề, nội dung và danh mục hợp lệ." });
        const [existing] = await db.execute("SELECT id, slug FROM posts WHERE id = ?", [Number(req.params.id)]);
        if (!existing.length) return res.status(404).render("not-found");
        const slug = post.title === post.originalTitle ? existing[0].slug : await uniqueSlug(post.title, existing[0].id);
        await db.execute("UPDATE posts SET category_id = ?, title = ?, slug = ?, excerpt = ?, body = ?, status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE NULL END WHERE id = ?", [post.categoryId, post.title, slug, post.excerpt, post.body, post.status, post.status, existing[0].id]);
        res.redirect("/admin");
    } catch (error) { next(error); }
});
app.post("/admin/bai-viet/:id/xoa", requireAdmin, async (req, res, next) => {
    if (!validCsrf(req)) return res.status(403).send("Yêu cầu không hợp lệ");
    try { await db.execute("DELETE FROM posts WHERE id = ?", [Number(req.params.id)]); res.redirect("/admin"); }
    catch (error) { next(error); }
});

function normalizePost(body) {
    const title = String(body.title || "").trim().slice(0, 200);
    return { categoryId: Number(body.categoryId), title, originalTitle: String(body.originalTitle || ""), excerpt: String(body.excerpt || "").trim().slice(0, 500), body: String(body.body || "").trim().slice(0, 30000), status: body.status === "draft" ? "draft" : "published" };
}
function isValidPost(post, categories) {
    return post.title.length > 0 && post.body.length > 0 && categories.some(category => category.id === post.categoryId);
}
async function uniqueSlug(title, exceptId = 0) {
    const base = safeSlug(title) || "bai-viet";
    let slug = base;
    let suffix = 2;
    while (true) {
        const [rows] = await db.execute("SELECT id FROM posts WHERE slug = ? AND id <> ? LIMIT 1", [slug, exceptId]);
        if (!rows.length) return slug;
        slug = `${base}-${suffix++}`;
    }
}

app.use((req, res) => res.status(404).render("not-found"));
app.use((error, req, res, next) => {
    console.error("Request failed:", error.message);
    if (res.headersSent) return next(error);
    res.status(500).send("Đã có lỗi xảy ra. Vui lòng thử lại sau.");
});

async function start() {
    const repairedFields = await repairSeedEncoding(db);
    if (repairedFields) console.info(`Repaired ${repairedFields} mojibake field(s) in fixed seed records.`);
    else console.info("No damaged text found in fixed seed records.");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(ADMIN_PASSWORD, salt, 32).toString("hex");
    await db.execute(
        "UPDATE users SET password_hash = ? WHERE username = 'admin'",
        [`scrypt:${salt}:${hash}`]
    );
    app.listen(PORT, "0.0.0.0", () => console.log(`News Portal running on port ${PORT}`));
}

start().catch(error => {
    console.error("Application startup failed:", error.message);
    process.exit(1);
});
