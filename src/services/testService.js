const { queryApi, influxBucket } = require('../config/influx');
const coachDataService = require('./coachDataService');
const pagexrayDataService = require('./pagexrayDataService');

async function getTests() {
    // Query to get unique test IDs and their metadata (URL, browser, timestamp)
    // We'll query the 'visualMetrics' measurement as it's a reliable indicator of a test run
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["_measurement"] == "visualMetrics")
        |> group(columns: ["test_id", "url", "browser"])
        |> first()
        |> keep(columns: ["test_id", "url", "browser", "_time"])
        |> sort(columns: ["_time"], desc: true)
    `;

    const tests = [];
    await new Promise((resolve, reject) => {
        queryApi.queryRows(fluxQuery, {
            next(row, tableMeta) {
                const o = tableMeta.toObject(row);
                tests.push({
                    id: o.test_id,
                    url: o.url,
                    timestamp: o._time,
                    browser: o.browser
                });
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
    return tests;
}

async function getTest(testId) {
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["test_id"] == "${testId}")
        |> filter(fn: (r) => r["_measurement"] != "coach_advice" and r["_measurement"] != "pagexray")
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

async function getCoachData(testId) {
    try {
        const mysqlData = await coachDataService.getCoachDataByTestId(testId);
        if (mysqlData && mysqlData.length) {
            return mysqlData;
        }
        return [];
    } catch (err) {
        console.error('Error querying MySQL for coach data:', err.message);
        throw err;
    }
}

async function getCoachScores(testId) {
    try {
        return await coachDataService.getCoachScores(testId);
    } catch (err) {
        console.error('Error querying MySQL for coach scores:', err.message);
        throw err;
    }
}

async function getPagexrayData(testId) {
    // Read from MySQL only (InfluxDB deprecated for PageXray)
    try {
        const mysqlData = await pagexrayDataService.getPageXrayDataByTestId(testId);
        if (mysqlData && mysqlData.length) {
            return mysqlData;
        }
        return [];
    } catch (err) {
        console.error('Error querying MySQL for PageXray data:', err.message);
        throw err;
    }
}

async function getPerformanceData(testId) {
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["test_id"] == "${testId}")
        |> filter(fn: (r) => r["_measurement"] == "visualMetrics")
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

async function getComparison(testIds) {
    const filterString = testIds.map(id => `r["test_id"] == "${id}"`).join(' or ');
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => ${filterString})
        |> filter(fn: (r) => r["_measurement"] == "visualMetrics") 
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

module.exports = {
    getTests,
    getTest,
    getCoachData,
    getPagexrayData,
    getPerformanceData,
    getComparison,
    getCoachScores
};
