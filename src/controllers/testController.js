const sitespeedRunner = require('../services/sitespeedRunner');
const resultsProcessor = require('../services/resultsProcessor');
const testService = require('../services/testService');
const coachDataService = require('../services/coachDataService');
const performanceTransformer = require('../services/performanceTransformer');
const path = require('path');
const paths = require('../config/paths');

async function runTest(req, res) {
    let url = req.body.url;
    const { browser = 'chrome', iterations = 1 } = req.body;
    let scriptPath = req.file ? req.file.path : null;
    // If no file was uploaded in this request, but the client provided a path
    // (e.g. after using the separate upload endpoint), detect if the url
    // actually points to a local uploaded script and treat it as scriptPath.
    if (!scriptPath && url) { 
        const provided = String(url);
        const filename = path.basename(provided);
        // Heuristics: treat non-http values or paths containing 'uploads' or known extensions as scripts
        const looksLikeScript = (!/^https?:\/\//i.test(provided)) || provided.includes('/uploads') || /\.mjs$|\.js$|\.txt$/.test(provided);
        if (looksLikeScript) {
            scriptPath = path.join(paths.containerUploadDirForMulter, filename);
            // Clear url so runner uses the scriptPath branch
            url = null;
        }
    }
    if (!url && !scriptPath) {
        return res.status(400).json({ error: 'URL or script file is required' });
    }

    const testRunId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    console.log(`Starting test run: ${testRunId} for ${url || 'script'}`);
    console.log(`Parameters: browser=${browser}, iterations=${iterations}, scriptPath=${scriptPath || 'none'}, url=${url || 'none'}`);

    try {
        // 1. Immediately record entry in MySQL so the report page knows it exists
        await coachDataService.saveTestRun(testRunId, browser);
        
        // 2. Respond to the client immediately
        res.json({ message: 'Test started successfully', testId: testRunId });

        // 3. Run test and process results in background (fire and forget)
        (async () => {
            try {
                const output = await sitespeedRunner.runSitespeedTest(url, browser, iterations, scriptPath, testRunId);
                console.log(`Test ${testRunId} completed. Processing results...`);
                
                await resultsProcessor.processAndStoreDetailedResults(testRunId, browser, url, scriptPath);
                console.log(`✓ Background processing completed for ${testRunId}`);
                
                // Add a completion marker log
                console.log(`[TEST_COMPLETE]: ${testRunId}`);
            } catch (backgroundError) {
                console.error(`✗ Background task failed for ${testRunId}:`, backgroundError);
            }
        })();

    } catch (error) {
        console.error(`Failed to initiate test run ${testRunId}:`, error);
        res.status(500).json({ error: 'Failed to start test execution', details: error.message });
    }
}

async function getTests(req, res) {
    try {
        const tests = await testService.getTests();
        res.json(tests);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getTest(req, res) {
    const { testId } = req.params;
    try {
        const data = await testService.getTest(testId);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
async function getCoachData(req, res) {
    const { testId } = req.params;
    const { url, group } = req.query;
    try {
        const data = await testService.getCoachData(testId, { url, group });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getPagexrayData(req, res) {
    const { testId } = req.params;
    const { url, group } = req.query;
    try {
        const data = await testService.getPagexrayData(testId, { url, group });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getPerformanceMetrics(req, res) {
    const { testId } = req.params;
    const { url, group } = req.query;
    try {
        const performanceRecords = await testService.getPerformanceData(testId, { url, group });
        
        if (!performanceRecords || performanceRecords.length === 0) {
            return res.json({});
        }
        
        // Transform raw InfluxDB records into performance metrics object using dedicated transformer
        const metrics = performanceTransformer.transformPerformanceRecords(performanceRecords);
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getCoachScores(req, res) {
    const { testId } = req.params;
    const { url, group } = req.query;
    try {
        const scores = await testService.getCoachScores(testId, { url, group });
        res.json(scores);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getComparison(req, res) {
    const { testIds } = req.query;
    if (!testIds) {
        return res.status(400).json({ error: 'Missing testIds parameter' });
    }
    const ids = testIds.split(',');
    try {
        const data = await testService.getComparison(ids);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    runTest,
    getTests,
    getTest,
    getCoachData,
    getPagexrayData,
    getPerformanceMetrics,
    getComparison,
    getCoachScores,
};
