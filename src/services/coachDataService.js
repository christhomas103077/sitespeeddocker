const { pool } = require('../config/mysql');

/**
 * Save coach advice data to MySQL
 * @param {string} testRunId - Test ID
 * @param {string} url - URL tested
 * @param {string} groupName - Category group name (pageFolder)
 * @param {string} categoryName - Category name (e.g., 'performance', 'accessibility')
 * @param {string} adviceId - Advice ID
 * @param {number} score - Score value
 * @param {string} title - Advice title
 * @param {string} description - Advice description
 */
async function saveCoachData(testRunId, url, groupName, categoryName, adviceId, score, title, description) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `INSERT INTO coach_advice 
            (test_id, url, group_name, category_name, advice_id, score, title, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            title = VALUES(title),
            description = VALUES(description),
            created_at = CURRENT_TIMESTAMP`,
            [testRunId, url, groupName, categoryName, adviceId, score, title, description]
        );
        
        connection.release();
    } catch (err) {
        console.error('Error saving coach data to MySQL:', err.message);
        throw err;
    }
}

/**
 * Retrieve coach advice data from MySQL by test ID
 * Transforms MySQL format to match InfluxDB query response format
 * @param {string} testId - Test ID to query
 * @returns {Array} Array of coach advice records
 */
async function getCoachDataByTestId(testId) {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT 
                test_id, 
                url, 
                group_name, 
                category_name, 
                advice_id, 
                score, 
                title, 
                description,
                created_at
            FROM coach_advice 
            WHERE test_id = ?
            ORDER BY created_at DESC`,
            [testId]
        );
        
        connection.release();
        
        // Transform MySQL format to match InfluxDB response format
        const transformedData = rows.map(row => ({
            test_id: row.test_id,
            url: row.url,
            group: row.group_name,
            category_name: row.category_name,
            adviceId: row.advice_id,
            score: row.score,
            title: row.title,
            description: row.description,
            _time: row.created_at
        }));
        
        return transformedData;
    } catch (err) {
        console.error('Error retrieving coach data from MySQL:', err.message);
        throw err;
    }
}

// /**
//  * Delete coach data by test ID (for future use)
//  * @param {string} testId - Test ID to delete
//  */
// async function deleteCoachDataByTestId(testId) {
//     try {
//         const connection = await pool.getConnection();
        
//         await connection.execute(
//             `DELETE FROM coach_advice WHERE test_id = ?`,
//             [testId]
//         );
        
//         connection.release();
//     } catch (err) {
//         console.error('Error deleting coach data from MySQL:', err.message);
//         throw err;
//     }
// }

/**
 * Save test run metadata to MySQL
 * Records when a test was executed for audit trail and performance tracking
 * @param {string} testRunId - Test ID
 * @param {string} url - URL tested
 * @param {string} browser - Browser used (e.g., 'chrome', 'firefox')
 */
async function saveTestRun(testRunId, browser) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `INSERT INTO test_runs (test_id, browser)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
            browser = VALUES(browser),
            created_at = CURRENT_TIMESTAMP`,
            [testRunId, browser]
        );
        
        connection.release();
    } catch (err) {
        console.error('Error saving test run to MySQL:', err.message);
        throw err;
    }
}

/**
 * Retrieve all test runs from MySQL
 * @returns {Array} Array of test run records
 */
async function getAllTestRuns() {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT test_id, browser, created_at
            FROM test_runs
            ORDER BY created_at DESC`
        );
        
        connection.release();
        return rows;
    } catch (err) {
        console.error('Error retrieving test runs from MySQL:', err.message);
        throw err;
    }
}

/**
 * Retrieve a specific test run by ID
 * @param {string} testId - Test ID to query
 * @returns {Object} Test run record
 */
async function getTestRunById(testId) {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT test_id, browser, created_at
            FROM test_runs
            WHERE test_id = ?`,
            [testId]
        );
        
        connection.release();
        return rows.length > 0 ? rows[0] : null;
    } catch (err) {
        console.error('Error retrieving test run from MySQL:', err.message);
        throw err;
    }
}

/**
 * Save coach category scores to MySQL (for immediate display on Summary tab)
 * @param {string} testRunId - Test ID
 * @param {Object} scores - Object containing performance, privacy, and bestpractice scores
 */
async function saveCoachScores(testRunId, scores) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `INSERT INTO coach_scores 
            (test_id, performance_score, privacy_score, bestpractice_score)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            performance_score = VALUES(performance_score),
            privacy_score = VALUES(privacy_score),
            bestpractice_score = VALUES(bestpractice_score),
            created_at = CURRENT_TIMESTAMP`,
            [testRunId, scores.performance || null, scores.privacy || null, scores.bestpractice || null]
        );
        
        connection.release();
    } catch (err) {
        console.error('Error saving coach scores to MySQL:', err.message);
        throw err;
    }
}

/**
 * Retrieve coach scores from MySQL by test ID
 * @param {string} testId - Test ID to query
 * @returns {Object} Object with performance, privacy, and bestpractice scores
 */
async function getCoachScores(testId) {
    try {
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT 
                performance_score, 
                privacy_score, 
                bestpractice_score
            FROM coach_scores 
            WHERE test_id = ?`,
            [testId]
        );
        
        connection.release();
        
        if (rows.length > 0) {
            return {
                performanceScore: rows[0].performance_score || 'N/A',
                privacyScore: rows[0].privacy_score || 'N/A',
                bestPracticeScore: rows[0].bestpractice_score || 'N/A'
            };
        }
        
        return {
            performanceScore: 'N/A',
            privacyScore: 'N/A',
            bestPracticeScore: 'N/A'
        };
    } catch (err) {
        console.error('Error retrieving coach scores from MySQL:', err.message);
        throw err;
    }
}

module.exports = {
    saveCoachData,
    getCoachDataByTestId,
    saveTestRun,
    getAllTestRuns,
    getTestRunById,
    saveCoachScores,
    getCoachScores,
    //deleteCoachDataByTestId  // Now disabled for delete operations
};
