const { pool } = require('../config/mysql');
const { queryApi, influxBucket } = require('../config/influx');
const coachDataService = require('./coachDataService');
const pagexrayDataService = require('./pagexrayDataService');
const performanceDataService = require('./performanceDataService');

async function getTests() {
    // Query from MySQL test_runs table joined with performance_metrics
    try {
        const [rows] = await pool.query(`
            SELECT 
                tr.test_id,
                MAX(tr.browser) AS browser,
                MAX(tr.created_at) AS created_at,
                MAX(pm.url) AS url
            FROM test_runs tr
            LEFT JOIN performance_metrics pm 
                ON tr.test_id = pm.test_id
            GROUP BY tr.test_id
            ORDER BY created_at DESC
            LIMIT 100
        `);
        return rows.map(row => ({
            id: row.test_id,
            url: row.url,
            timestamp: row.created_at,
            browser: row.browser
        }));
    } catch (err) {
        console.error('Error querying MySQL for tests:', err.message);
        throw err;
    }
}

async function getTestMetadata(testId) {
    try {
        const [rows] = await pool.query('SELECT * FROM test_runs WHERE test_id = ?', [testId]);
        return rows[0] || null;
    } catch (err) {
        console.error('Error fetching test metadata:', err.message);
        throw err;
    }
}

async function getTest(testId) {
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["test_id"] == "${testId}")
        |> filter(fn: (r) => r["_measurement"] == "media_assets")
    `;

    const data = [];
    await new Promise((resolve, reject) => {
        queryApi.queryRows(fluxQuery, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                data.push(o);
            },
            error(error) {
                console.error('Error querying InfluxDB:', error);
                reject(error);
            },
            complete() {
                resolve();
            },
        });
    });
    return data;
}

async function getCoachData(testId, filters) {
    try {
        const mysqlData = await coachDataService.getCoachDataStructuredByTestId(testId, filters);
        if (mysqlData) {
            return mysqlData;
        }
        return null;
    } catch (err) {
        console.error('Error querying MySQL for coach data:', err.message);
        throw err;
    }
}

async function getCoachScores(testId, filters) {
    try {
        return await coachDataService.getCoachScores(testId, filters);
    } catch (err) {
        console.error('Error querying MySQL for coach scores:', err.message);
        throw err;
    }
}

async function getPagexrayData(testId, filters) {
    // Read from MySQL only (InfluxDB deprecated for PageXray)
    try {
        const mysqlData = await pagexrayDataService.getPageXrayDataByTestId(testId, filters);
        if (mysqlData && mysqlData.length) {
            return mysqlData;
        }
        return [];
    } catch (err) {
        console.error('Error querying MySQL for PageXray data:', err.message);
        throw err;
    }
}

async function getPerformanceData(testId, filters) {
    // Read from MySQL only (InfluxDB deprecated for performance metrics)
    try {
        const mysqlData = await performanceDataService.getPerformanceMetricsByTestId(testId, filters);
        if (mysqlData && mysqlData.length) {
            return mysqlData;
        }
        return [];
    } catch (err) {
        console.error('Error querying MySQL for performance data:', err.message);
        throw err;
    }
}

async function getComparison(testIds) {
    // Query performance metrics from MySQL for comparison across multiple tests
    // InfluxDB deprecated for visualMetrics (migrated to MySQL 10 Feb 2026)
    try {
        const placeholders = testIds.map(() => '?').join(',');
        const connection = await pool.getConnection();
        
        const [rows] = await connection.execute(
            `SELECT 
                test_id, 
                url, 
                browser, 
                metric_name, 
                metric_value,
                created_at
            FROM performance_metrics 
            WHERE test_id IN (${placeholders})
            ORDER BY created_at DESC`,
            testIds
        );
        
        connection.release();
        
        // Transform MySQL format to match InfluxDB-compatible format for frontend
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
        console.error('Error querying MySQL for comparison metrics:', err.message);
        throw err;
    }
}

module.exports = {
    getTests,
    getTest,
    getTestMetadata,
    getCoachData,
    getPagexrayData,
    getPerformanceData,
    getComparison,
    getCoachScores
};
