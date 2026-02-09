const { pool } = require('../config/mysql');

/**
 * Save PageXray content type data to MySQL
 * @param {string} testRunId - Test ID
 * @param {string} url - URL tested
 * @param {string} groupName - Page folder name
 * @param {string} browser - Browser used
 * @param {string} contentType - Content type (html, css, javascript, image, font)
 * @param {number} requests - Number of requests
 * @param {number} contentSize - Content size in bytes
 * @param {number} transferSize - Transfer size in bytes
 */
async function savePageXrayData(testRunId, url, groupName, browser, contentType, requests, contentSize, transferSize) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `INSERT INTO pagexray_data 
            (test_id, url, group_name, browser, content_type, requests, content_size, transfer_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            requests = VALUES(requests),
            content_size = VALUES(content_size),
            transfer_size = VALUES(transfer_size),
            created_at = CURRENT_TIMESTAMP`,
            [testRunId, url, groupName, browser, contentType, requests || 0, contentSize || 0, transferSize || 0]
        );
        
        connection.release();
    } catch (err) {
        console.error('Error saving PageXray data to MySQL:', err.message);
        throw err;
    }
}

/**
 * Retrieve PageXray data from MySQL by test ID
 * Transforms MySQL format to match InfluxDB response format
 * @param {string} testId - Test ID to query
 * @returns {Array} Array of pagexray records in InfluxDB format
 */
async function getPageXrayDataByTestId(testId) {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT 
                test_id,
                url,
                group_name,
                browser,
                content_type,
                requests,
                content_size,
                transfer_size,
                created_at
            FROM pagexray_data
            WHERE test_id = ?
            ORDER BY content_type`,
            [testId]
        );
        
        connection.release();
        
        // Transform MySQL format to match InfluxDB response format
        // InfluxDB returns 3 separate records per content type (one for each field)
        // We need to create 3 records per row to maintain compatibility
        const transformedData = [];
        
        rows.forEach(row => {
            // Create record for requests field
            transformedData.push({
                test_id: row.test_id,
                url: row.url,
                group: row.group_name,
                browser: row.browser,
                contentType: row.content_type,
                _measurement: 'pagexray',
                _field: 'requests',
                _value: row.requests,
                _time: row.created_at
            });
            
            // Create record for contentSize field
            transformedData.push({
                test_id: row.test_id,
                url: row.url,
                group: row.group_name,
                browser: row.browser,
                contentType: row.content_type,
                _measurement: 'pagexray',
                _field: 'contentSize',
                _value: row.content_size,
                _time: row.created_at
            });
            
            // Create record for transferSize field
            transformedData.push({
                test_id: row.test_id,
                url: row.url,
                group: row.group_name,
                browser: row.browser,
                contentType: row.content_type,
                _measurement: 'pagexray',
                _field: 'transferSize',
                _value: row.transfer_size,
                _time: row.created_at
            });
        });
        
        return transformedData;
    } catch (err) {
        console.error('Error retrieving PageXray data from MySQL:', err.message);
        throw err;
    }
}

/**
 * Delete PageXray data by test ID (for cleanup/rollback)
 * @param {string} testId - Test ID to delete
 */
// async function deletePageXrayDataByTestId(testId) {
//     try {
//         const connection = await pool.getConnection();
//         
//         await connection.execute(
//             `DELETE FROM pagexray_data WHERE test_id = ?`,
//             [testId]
//         );
//         
//         connection.release();
//     } catch (err) {
//         console.error('Error deleting PageXray data from MySQL:', err.message);
//         throw err;
//     }
// }

module.exports = {
    savePageXrayData,
    getPageXrayDataByTestId
    // deletePageXrayDataByTestId  // UNCOMMENT WHEN READY TO USE
};
