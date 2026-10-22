const SEED_CATEGORIES = [
    { slug: "thoi-su", name: "Thời sự", description: "Tin tức thời sự trong nước và quốc tế." },
    { slug: "cong-nghe", name: "Công nghệ", description: "Sản phẩm, xu hướng và chuyển động công nghệ." },
    { slug: "giao-duc", name: "Giáo dục", description: "Tin tức trường học, học tập và giáo dục." },
    { slug: "doi-song", name: "Đời sống", description: "Những câu chuyện gần gũi trong cuộc sống." }
];

const SEED_POSTS = [
    {
        slug: "ngay-hoi-doc-sach-ket-noi-cong-dong",
        title: "Ngày hội đọc sách kết nối cộng đồng",
        excerpt: "Một ngày hội nhỏ khuyến khích thói quen đọc và chia sẻ sách trong khu phố.",
        body: "Sáng nay, thư viện cộng đồng tổ chức ngày hội đọc sách với nhiều hoạt động dành cho học sinh và gia đình. Người tham dự có thể đổi sách, nghe kể chuyện và cùng giới thiệu những cuốn sách yêu thích.\n\nBan tổ chức cho biết hoạt động sẽ được duy trì định kỳ để tạo thêm không gian gặp gỡ và học hỏi cho cư dân."
    },
    {
        slug: "sinh-vien-phat-trien-ung-dung-ho-tro-hoc-nhom",
        title: "Sinh viên phát triển ứng dụng hỗ trợ học nhóm",
        excerpt: "Nhóm sinh viên xây dựng công cụ đơn giản giúp lớp học sắp xếp lịch ôn tập.",
        body: "Một nhóm sinh viên ngành công nghệ thông tin vừa giới thiệu ứng dụng hỗ trợ các nhóm học tập lên lịch và chia sẻ tài liệu. Phiên bản thử nghiệm tập trung vào các chức năng cơ bản, dễ sử dụng trên điện thoại.\n\nNhóm dự kiến tiếp tục lấy ý kiến từ giảng viên và người học trước khi bổ sung tính năng mới."
    },
    {
        slug: "truong-hoc-mo-them-khong-gian-tu-hoc-buoi-toi",
        title: "Trường học mở thêm không gian tự học buổi tối",
        excerpt: "Thư viện trường kéo dài giờ mở cửa trong mùa ôn tập để đáp ứng nhu cầu của sinh viên.",
        body: "Thư viện một trường đại học sẽ mở thêm khu tự học vào buổi tối trong giai đoạn ôn tập cuối kỳ. Không gian mới có bàn nhóm, khu vực yên tĩnh và hệ thống đăng ký chỗ ngồi.\n\nNhà trường cho biết sẽ theo dõi lượng sử dụng để điều chỉnh lịch phục vụ phù hợp."
    }
];

const isMojibake = value => typeof value === "string" &&
    /(?:Ã.|Æ.|Ä.|á[»º]|â(?:‚|€|™|œ|¦))/u.test(value);

async function repairFields(connection, table, slug, current, desired, fields) {
    const damagedFields = fields.filter(field => isMojibake(current[field]));
    if (!damagedFields.length) return 0;

    const setClause = damagedFields.map(field => `\`${field}\` = ?`).join(", ");
    const whereClause = damagedFields.map(field => `\`${field}\` = ?`).join(" AND ");
    const values = [
        ...damagedFields.map(field => desired[field]),
        current.id,
        slug,
        ...damagedFields.map(field => current[field])
    ];
    const [result] = await connection.execute(
        `UPDATE \`${table}\` SET ${setClause} WHERE id = ? AND slug = ? AND ${whereClause}`,
        values
    );
    return result.affectedRows ? damagedFields.length : 0;
}

async function repairSeedEncoding(pool) {
    const [variables] = await pool.execute(
        "SELECT @@character_set_database AS database_charset, @@collation_database AS database_collation, @@character_set_connection AS connection_charset, @@collation_connection AS connection_collation"
    );
    const [tableCharsets] = await pool.execute(
        "SELECT t.TABLE_NAME AS table_name, c.CHARACTER_SET_NAME AS character_set_name, t.TABLE_COLLATION AS table_collation FROM information_schema.TABLES t JOIN information_schema.COLLATIONS c ON c.COLLATION_NAME = t.TABLE_COLLATION WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME IN ('users', 'categories', 'posts') ORDER BY t.TABLE_NAME"
    );
    console.info("MySQL charset/collation:", JSON.stringify({ ...variables[0], tables: tableCharsets }));

    const connection = await pool.getConnection();
    let repairedFields = 0;
    try {
        await connection.beginTransaction();
        for (const seed of SEED_CATEGORIES) {
            const [rows] = await connection.execute(
                "SELECT id, name, description FROM categories WHERE slug = ? FOR UPDATE",
                [seed.slug]
            );
            if (rows[0]) repairedFields += await repairFields(connection, "categories", seed.slug, rows[0], seed, ["name", "description"]);
        }
        for (const seed of SEED_POSTS) {
            const [rows] = await connection.execute(
                "SELECT id, title, excerpt, body FROM posts WHERE slug = ? FOR UPDATE",
                [seed.slug]
            );
            if (rows[0]) repairedFields += await repairFields(connection, "posts", seed.slug, rows[0], seed, ["title", "excerpt", "body"]);
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }

    return repairedFields;
}

module.exports = repairSeedEncoding;
