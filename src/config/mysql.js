const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'mysql',
    user: process.env.MYSQL_USER || 'sitespeed_user',
    password: process.env.MYSQL_PASSWORD || 'sitespeed_pass_123',
    database: process.env.MYSQL_DATABASE || 'sitespeed',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0,
    connectTimeout: 10000,        // 10 seconds to establish connection
    acquireTimeout: 10000,        // 10 seconds to acquire connection from pool
    timeout: 60000                // 60 seconds query timeout
});

// Test connection on startup
pool.getConnection().then(conn => {
    console.log(`✓ MySQL connected successfully to ${process.env.MYSQL_DATABASE}`);
    conn.release();
}).catch(err => {
    console.error('✗ MySQL connection failed:', err.message);
});

module.exports = {
    pool
};