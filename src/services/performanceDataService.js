const { pool } = require('../config/mysql');

/**
 * Save performance metric data to MySQL
 * @param {string} testRunId - Test ID
 * @param {string} url - URL tested
 * @param {string} groupName - Group name
 * @param {string} browser - Browser used
 * @param {string} metricName - Metric name (e.g., 'SpeedIndex', 'firstPaint')
 * @param {number} metricValue - Metric value in milliseconds
 */
async function savePerformanceMetric(testRunId, url, groupName, browser, metricName, metricValue) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `INSERT INTO performance_metrics 
            (test_id, url, group_name, browser, metric_name, metric_value)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            metric_value = VALUES(metric_value),
            url = VALUES(url),
            browser = VALUES(browser),
            created_at = CURRENT_TIMESTAMP`,
            [testRunId, url, groupName, browser, metricName, metricValue]
        );
        
        connection.release();
    } catch (err) {
        console.error('Error saving performance metric to MySQL:', err.message);
        throw err;
    }
}

/**
 * Retrieve performance metrics from MySQL by test ID
 * Transforms MySQL format to match InfluxDB query response format
 * @param {string} testId - Test ID to query
 * @param {object} [filters] - Optional filters for the query
 * @param {string} [filters.url] - Filter by URL
 * @param {string} [filters.group] - Filter by group name
 * @returns {Array} Array of performance metric records in InfluxDB-compatible format
 */
async function getPerformanceMetricsByTestId(testId, filters) {
    try {
        const connection = await pool.getConnection();
        
        let query = `SELECT 
                test_id, 
                url, 
                browser, 
                metric_name, 
                metric_value,
                created_at
            FROM performance_metrics 
            WHERE test_id = ?`;
            
        const queryParams = [testId];
        
        if (filters) {
            if (filters.url) {
                // Check both raw URL and URL with trailing slash for robustness
                query += ` AND (url = ? OR url = CONCAT(?, '/'))`;
                queryParams.push(filters.url, filters.url);
            } else if (filters.group) {
                query += ` AND group_name = ?`;
                queryParams.push(filters.group);
            }
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const [rows] = await connection.execute(query, queryParams);
        
        connection.release();
        
        // Transform MySQL format to match InfluxDB response format
        // Expected by performanceTransformer.transformPerformanceRecords()
        const transformedData = rows.map(row => ({
            test_id: row.test_id,
            url: row.url,
            browser: row.browser,
            metricName: row.metric_name,
            _measurement: 'visualMetrics',
            _field: 'value',
            _value: row.metric_value,
            _time: row.created_at
        }));
        
        return transformedData;
    } catch (err) {
        console.error('Error retrieving performance metrics from MySQL:', err.message);
        throw err;
    }
}

/**
 * Delete performance metrics by test ID (for cleanup/rollback)
 * @param {string} testId - Test ID to delete
 */
async function deletePerformanceMetricsByTestId(testId) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `DELETE FROM performance_metrics WHERE test_id = ?`,
            [testId]
        );
        
        connection.release();
    } catch (err) {
        console.error('Error deleting performance metrics from MySQL:', err.message);
        throw err;
    }
}

/**
 * Get all tests from MySQL (for future getTests() migration)
 * Returns test list with metadata from performance_metrics table
 * @returns {Array} Array of test objects with id, url, timestamp, browser
 */
async function getTestsFromMySQL() {
    try {
        const connection = await pool.getConnection();
        
        // Get distinct test_ids with their first URL and browser
        const [rows] = await connection.execute(
            `SELECT 
                tr.test_id as id,
                tr.browser,
                tr.created_at as timestamp,
                pm.url
            FROM test_runs tr
            LEFT JOIN (
                SELECT test_id, url 
                FROM performance_metrics 
                GROUP BY test_id
            ) pm ON tr.test_id = pm.test_id
            ORDER BY tr.created_at DESC
            LIMIT 100`
        );
        
        connection.release();
        
        return rows.map(row => ({
            id: row.id,
            url: row.url || 'unknown',
            timestamp: row.timestamp,
            browser: row.browser
        }));
    } catch (err) {
        console.error('Error retrieving tests from MySQL:', err.message);
        throw err;
    }
}

module.exports = {
    savePerformanceMetric,
    getPerformanceMetricsByTestId,
    deletePerformanceMetricsByTestId,
    getTestsFromMySQL
};
