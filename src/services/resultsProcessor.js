const fs = require('fs');
const path = require('path');
const { getWriteApi, Point } = require('../config/influx');
const paths = require('../config/paths');
const coachDataService = require('./coachDataService');
const pagexrayDataService = require('./pagexrayDataService');

// Helper for logging
function logDebug(message) {
    const logFile = path.join(paths.containerUploadDirForMulter, 'debug.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

async function processAndStoreDetailedResults(testRunId, browser, url) {
    console.log(`Starting processAndStoreDetailedResults for ${testRunId}`);
    const writeApi = getWriteApi();
    writeApi.useDefaultTags({ test_id: testRunId, browser: browser });

    writeApi.useDefaultTags({ test_id: testRunId, browser: browser });
    
    // Save test run metadata to MySQL (audit trail)
    try {
        await coachDataService.saveTestRun(testRunId, browser);
        logDebug(`Saved test run metadata: ${testRunId}`);
    } catch (err) {
        logDebug(`Error saving test run metadata: ${err.message}`);
    }

    const resultsPath = path.join(paths.containerResultsDir, testRunId);
    const pagesPath = path.join(resultsPath, 'pages');

    try {
        if (!fs.existsSync(pagesPath)) {
            console.error(`Pages directory not found: ${pagesPath}`);
            return;
        }

        const pageFolders = fs.readdirSync(pagesPath);
        logDebug(`Starting processAndStoreDetailedResults for ${testRunId}`);
        logDebug(`Found page folders: ${pageFolders.join(', ')}`);

        for (const pageFolder of pageFolders) {
            const pageFolderPath = path.join(pagesPath, pageFolder);
            const dataPath = path.join(pageFolderPath, 'data');

            if (fs.existsSync(dataPath)) {
                logDebug(`Processing data in ${dataPath}`);
                // Look for pageSummary files instead of run-1
                const browsertimePath = path.join(dataPath, 'browsertime.run-1.json');
                const coachPath = path.join(dataPath, 'coach.run-1.json');
                const pagexrayPath = path.join(dataPath, 'pagexray.run-1.json');

                // --- Process Visual Metrics & Media Assets ---
                if (fs.existsSync(browsertimePath)) {
                    const browsertimeData = JSON.parse(fs.readFileSync(browsertimePath, 'utf8'));
                    const visualMetrics = browsertimeData.visualMetrics;
                    const url = browsertimeData.pageinfo?.url || browsertimeData.info?.url || browsertimeData.url || 'unknown_url';

                    // 1. Visual Metrics (Extracting Median)
                    if (visualMetrics) {
                        for (const metricName in visualMetrics) {
                            // Check if the metric has a median value (summary format) or is a number (raw format fallback)
                            let value = null;
                            if (typeof visualMetrics[metricName] === 'object' && visualMetrics[metricName] !== null) {
                                value = visualMetrics[metricName].median;
                            } else if (typeof visualMetrics[metricName] === 'number') {
                                value = visualMetrics[metricName];
                            }

                            // Ensure value is a valid number
                            if (value === undefined || value === null || isNaN(value)) {
                                continue;
                            }

                            if (value !== null) {
                                const point = new Point('visualMetrics')
                                    .tag('test_id', testRunId)
                                    .tag('url', url)
                                    .tag('browser', browser)
                                    .tag('metricName', metricName)
                                    .floatField('value', value);
                                writeApi.writePoint(point);
                            }
                        }
                    }

                    // 1b. Additional Metrics (Timings & Web Vitals)
                    const timings = browsertimeData.timings;
                    const googleWebVitals = browsertimeData.googleWebVitals;
                    const fullyLoaded = browsertimeData.fullyLoaded;

                    const additionalMetrics = {
                        'firstPaint': timings?.firstPaint,
                        'firstContentfulPaint': googleWebVitals?.firstContentfulPaint,
                        'largestContentfulPaint': googleWebVitals?.largestContentfulPaint,
                        'ttfb': timings?.ttfb,
                        'domInteractive': timings?.pageTimings?.domInteractiveTime,
                        'pageLoadTime': timings?.pageTimings?.pageLoadTime,
                        'fullyLoaded': fullyLoaded,
                        'TotalBlockingTime': googleWebVitals?.totalBlockingTime
                    };

                    for (const [metricName, value] of Object.entries(additionalMetrics)) {
                        if (value !== undefined && value !== null && !isNaN(value)) {
                            const point = new Point('visualMetrics')
                                .tag('test_id', testRunId)
                                .tag('url', url)
                                .tag('browser', browser)
                                .tag('metricName', metricName)
                                .floatField('value', value);
                            writeApi.writePoint(point);
                        }
                    }

                    // 2. Media Assets (Video & Screenshots)
                    // We assume video/screenshot for run #1 exists even if we use summary data
                    const videoPath = path.join('pages', pageFolder, 'data', 'video', '1.mp4');
                    const lcpScreenshotPath = path.join('pages', pageFolder, 'data', 'screenshots', '1', 'largestContentfulPaint.png');

                    logDebug(`Writing media assets for ${url}`);

                    const mediaPoint = new Point('media_assets')
                        .tag('test_id', testRunId)
                        .tag('url', url)
                        .tag('group', pageFolder)
                        .stringField('video_path', videoPath)
                        .stringField('lcp_screenshot_path', lcpScreenshotPath);
                    writeApi.writePoint(mediaPoint);
                }

                // --- Process Coach Advice ---
                if (fs.existsSync(coachPath)) {
                    logDebug(`Processing Coach data from ${coachPath}`);
                    const coachData = JSON.parse(fs.readFileSync(coachPath, 'utf8'));
                    const adviceRoot = coachData.advice;
                    const url = coachData.url || 'unknown_url';

                    if (adviceRoot) {
                        // Extract category scores for immediate Summary display
                        const categoryScores = {
                            performance: adviceRoot.performance?.score,
                            privacy: adviceRoot.privacy?.score,
                            bestpractice: adviceRoot.bestpractice?.score
                        };

                        for (const categoryName in adviceRoot) {
                            const category = adviceRoot[categoryName];
                            if (category.adviceList) {
                                for (const adviceId in category.adviceList) {
                                    const adviceItem = category.adviceList[adviceId];
                                    const score = adviceItem.score;
                                    const title = adviceItem.title;
                                    const description = adviceItem.description;

                                    if (score !== undefined) {
                                        try {
                                            // Write to MySQL only
                                            await coachDataService.saveCoachData(
                                                testRunId,
                                                url,
                                                pageFolder,
                                                categoryName,
                                                adviceId,
                                                score,
                                                title || adviceId,
                                                description || ''
                                            );
                                        } catch (err) {
                                            logDebug(`Error writing coach point to MySQL ${adviceId}: ${err.message}`);
                                        }
                                    }
                                }
                            } else {
                                logDebug(`No adviceList for category ${categoryName}`);
                            }

                            // Write the overall category score
                            if (category.score !== undefined) {
                                try {
                                    // Write to MySQL only
                                    await coachDataService.saveCoachData(
                                        testRunId,
                                        url,
                                        pageFolder,
                                        categoryName,
                                        categoryName,
                                        category.score,
                                        categoryName,
                                        ''
                                    );
                                } catch (err) {
                                    logDebug(`Error writing coach category score to MySQL ${categoryName}: ${err.message}`);
                                }
                            }
                        }

                        // Save the 3 category scores to coach_scores table
                        try {
                            await coachDataService.saveCoachScores(testRunId, categoryScores);
                            logDebug(`Saved coach category scores: Performance=${categoryScores.performance}, Privacy=${categoryScores.privacy}, BestPractice=${categoryScores.bestpractice}`);
                        } catch (err) {
                            logDebug(`Error saving coach scores to MySQL: ${err.message}`);
                        }
                    }
                }

                // --- Process PageXray ---
                if (fs.existsSync(pagexrayPath)) {
                    logDebug(`Processing PageXray data from ${pagexrayPath}`);
                    const pagexrayData = JSON.parse(fs.readFileSync(pagexrayPath, 'utf8'));
                    const url = pagexrayData.url || 'unknown_url';
                    const contentTypes = pagexrayData.contentTypes;

                    if (contentTypes) {
                        for (const contentType in contentTypes) {
                            const data = contentTypes[contentType];
                            const requests = data.requests;
                            const transferSize = data.transferSize?.median ?? data.transferSize;
                            const contentSize = data.contentSize?.median ?? data.contentSize;

                            try {
                                // Write to MySQL only (InfluxDB deprecated for PageXray)
                                await pagexrayDataService.savePageXrayData(
                                    testRunId,
                                    url,
                                    pageFolder,
                                    browser,
                                    contentType,
                                    requests,
                                    contentSize,
                                    transferSize
                                );
                            } catch (err) {
                                logDebug(`Error writing pagexray data to MySQL ${contentType}: ${err.message}`);
                            }
                        }
                    }
                }

            } else {
                logDebug(`Data path not found: ${dataPath}`);
            }
        }
        await writeApi.close();
        logDebug(`Successfully processed and stored detailed results for test run: ${testRunId}`);
    } catch (error) {
        logDebug(`Error processing detailed results for test run ${testRunId}: ${error.message}`);
        console.error(`Error processing detailed results for test run ${testRunId}:`, error);
        // Ensure writeApi is closed even on error
        try { await writeApi.close(); } catch (e) { }
    }
}

module.exports = {
    processAndStoreDetailedResults
};
