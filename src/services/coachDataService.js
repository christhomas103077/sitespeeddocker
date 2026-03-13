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
 * Retrieve structured coach advice data from MySQL by test ID
 * Returns metadata once with nested advice data to reduce payload size
 * @param {string} testId - Test ID to query
 * @param {object} [filters] - Optional filters for the query
 * @returns {Object} Structured object with test metadata and coaching data array
 */
async function getCoachDataStructuredByTestId(testId, filters) {
    try {
        const connection = await pool.getConnection();
        
        let query = `SELECT 
                test_id, 
                url, 
                group_name, 
                category_name, 
                advice_id, 
                score, 
                title,
                created_at
            FROM coach_advice 
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
        
        if (rows.length === 0) {
            return null;
        }
        
        // Extract common fields from first row
        const firstRow = rows[0];
        const structuredData = {
            test_id: firstRow.test_id,
            url: firstRow.url,
            group_name: firstRow.group_name,
            created_at: firstRow.created_at,
            coachdata: rows.map(row => ({
                category_name: row.category_name,
                advice_id: row.advice_id,
                score: row.score,
                title: row.title
            }))
        };
        
        return structuredData;
    } catch (err) {
        console.error('Error retrieving structured coach data from MySQL:', err.message);
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
 * @param {string} url - URL tested
 * @param {string} groupName - Group/Folder name
 * @param {Object} scores - Object containing performance, privacy, and bestpractice scores
 */
async function saveCoachScores(testRunId, url, groupName, scores) {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(
            `INSERT INTO coach_scores 
            (test_id, url, group_name, performance_score, privacy_score, bestpractice_score)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            performance_score = VALUES(performance_score),
            privacy_score = VALUES(privacy_score),
            bestpractice_score = VALUES(bestpractice_score),
            created_at = CURRENT_TIMESTAMP`,
            [testRunId, url, groupName, scores.performance || null, scores.privacy || null, scores.bestpractice || null]
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
 * @param {object} [filters] - Optional filters for the query
 * @returns {Array} Array of objects with performance, privacy, and bestpractice scores
 */
async function getCoachScores(testId, filters) {
    try {
        const connection = await pool.getConnection();
        
        let query = `SELECT 
                url,
                group_name,
                performance_score, 
                privacy_score, 
                bestpractice_score
            FROM coach_scores 
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
        
        const [rows] = await connection.execute(query, queryParams);
        
        connection.release();
        
        if (rows.length > 0) {
            return rows.map(row => ({
                url: row.url,
                groupName: row.group_name,
                performanceScore: row.performance_score || 'N/A',
                privacyScore: row.privacy_score || 'N/A',
                bestPracticeScore: row.bestpractice_score || 'N/A'
            }));
        }
        
        return [];
    } catch (err) {
        console.error('Error retrieving coach scores from MySQL:', err.message);
        throw err;
    }
}

module.exports = {
    saveCoachData,
    getCoachDataStructuredByTestId,
    saveTestRun,
    getAllTestRuns,
    getTestRunById,
    saveCoachScores,
    getCoachScores,
    //deleteCoachDataByTestId  // Now disabled for delete operations
};
