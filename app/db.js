
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // mysql2's `charset` accepts the MySQL character set name (not only a collation).
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;
