# Function Execution Trace - Test Execution to Results & Lazy Loading

This document provides a detailed trace of function execution during a typical test run, from initial submission through results display and lazy loading of data.

---

## Table of Contents
1. [Test Submission Flow](#test-submission-flow)
2. [Test Execution & Background Processing](#test-execution--background-processing)
3. [Results List Page](#results-list-page)
4. [Detailed Report Page - Initial Load](#detailed-report-page---initial-load)
5. [Lazy Loading - Tab Switching](#lazy-loading---tab-switching)
6. [Data Transformation](#data-transformation)

---

## Test Submission Flow

### Page: `index.html` (Client Side Test Configuration)

#### 1. **DOMContentLoaded Event**
- **Function**: `Anonymous DOMContentLoaded listener`
- **File**: [public/js/script.js](public/js/script.js#L1)
- **When**: On page load
- **Purpose**: Initialize form UI, set up event listeners, populate configuration options
- **Actions**:
  - Set up form elements and state management
  - Initialize `sitespeedOptions` configuration object
  - Add event listeners for form submission, file uploads, and option management
  - Call `setIdleState()` to prepare form

#### 2. **setIdleState()**
- **Function**: `setIdleState()`
- **File**: [public/js/script.js](public/js/script.js#L80)
- **When**: On initial page load or after clicking "New Test"
- **Purpose**: Reset form to ready state
- **Actions**:
  - Enable form fieldset
  - Hide results div
  - Clear form and additional options
  - Display "Run Sitespeed.io Test" button

#### 3. **handleFormSubmit()**
- **Function**: `handleFormSubmit(e)`
- **File**: [public/js/script.js](public/js/script.js#L390)
- **When**: User submits the test form
- **Purpose**: Collect form data and send test request to backend
- **Actions**:
  - Prevent default form submission
  - Call `setRunningState()` to update UI
  - Gather form data (URL, browser, iterations, additional options)
  - Create `FormData` object with test configuration
  - Send POST request to `/api/run-test`
  - Handle response by calling `setCompletedState()` or `setFailedState()`

#### 4. **setRunningState()**
- **Function**: `setRunningState()`
- **File**: [public/js/script.js](public/js/script.js#L93)
- **When**: Test submission begins
- **Purpose**: Update UI to show test is running
- **Actions**:
  - Disable form fieldset
  - Show results div with "Running..." message
  - Replace submit button with "Stop Test" button

---

## Test Execution & Background Processing

### Backend: Express API Route Handler

#### 5. **Route: POST /api/run-test**
- **Handler**: `testController.runTest`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L19)
- **When**: Client sends POST request to run test
- **Purpose**: Route test execution request to controller
- **Actions**: Pass request to `runTest()` controller method

#### 6. **runTest() (Controller)**
- **Function**: `async function runTest(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L5)
- **When**: POST request received at `/api/run-test`
- **Purpose**: Orchestrate test execution and background processing
- **Actions**:
  - Extract test parameters from request (url, browser, iterations, script file)
  - Generate unique `testRunId` (e.g., `test_1760334761160_q4gsx`)
  - Call `sitespeedRunner.runSitespeedTest()` to execute test
  - Send immediate response to client with testId
  - Fire-and-forget call to `resultsProcessor.processAndStoreDetailedResults()` for background processing

#### 7. **runSitespeedTest() (Service)**
- **Function**: `function runSitespeedTest(url, browser, iterations, scriptPath, testRunId)`
- **File**: [src/services/sitespeedRunner.js](src/services/sitespeedRunner.js#L6)
- **When**: Called by `runTest()` controller
- **Purpose**: Execute sitespeed.io test via Docker container
- **Actions**:
  - Construct Docker command with mounted volumes and configuration
  - Execute sitespeed.io in Docker container using `exec()`
  - Return stdout/stderr output to controller
  - Results are written to `/results/{testRunId}/` directory

#### 8. **processAndStoreDetailedResults() (Service)**
- **Function**: `async function processAndStoreDetailedResults(testRunId, browser, url)`
- **File**: [src/services/resultsProcessor.js](src/services/resultsProcessor.js#L14)
- **When**: Called asynchronously after test completes (background process)
- **Purpose**: Parse sitespeed.io output files and store metrics in InfluxDB/MySQL
- **Actions**:
  - Initialize InfluxDB write API with test metadata tags
  - Call `coachDataService.saveTestRun()` to save test metadata to MySQL
  - Scan `/results/{testRunId}/pages/` directory for result files
  - Process three types of data files:
    - **browsertime.run-1.json**: Visual metrics, timings, web vitals, media paths
    - **coach.run-1.json**: Coach advice and category scores
    - **pagexray.run-1.json**: Asset breakdown by content type
  - Store parsed data:
    - Write visual metrics to InfluxDB (`visualMetrics` measurement)
    - Write media asset paths to InfluxDB (`media_assets` measurement)
    - Write coach advice to MySQL via `coachDataService.saveCoachAdvice()`
    - Write pagexray data to MySQL via `pagexrayDataService.savePageXrayData()`

#### 9. **saveCoachAdvice() (Service)**
- **Function**: `async function saveCoachAdvice(testId, url, group, adviceData, categoryScores)`
- **File**: [src/services/coachDataService.js](src/services/coachDataService.js)
- **When**: Called by `processAndStoreDetailedResults()` for each page
- **Purpose**: Store coach advice in MySQL database
- **Actions**:
  - Insert individual advice items into `coach_advice` table
  - Store category scores (performance, privacy, bestpractice)
  - Each advice has: adviceId, score, title, description

#### 10. **savePageXrayData() (Service)**
- **Function**: `async function savePageXrayData(testId, url, group, contentTypes)`
- **File**: [src/services/pagexrayDataService.js](src/services/pagexrayDataService.js)
- **When**: Called by `processAndStoreDetailedResults()` for each page
- **Purpose**: Store PageXray asset data in MySQL database
- **Actions**:
  - Insert content type breakdown into `pagexray_data` table
  - Store for each content type: requests count, content size, transfer size

---

## Results List Page

### Page: `results.html` (All Test Results)

#### 11. **DOMContentLoaded Event**
- **Function**: `Anonymous DOMContentLoaded listener`
- **File**: [public/js/results_script.js](public/js/results_script.js#L1)
- **When**: Results page loads
- **Purpose**: Initialize results list interface
- **Actions**:
  - Set up tab switching (Test List vs Comparison)
  - Call `fetchTestRuns()` to load test data

#### 12. **fetchTestRuns()**
- **Function**: `async function fetchTestRuns()`
- **File**: [public/js/results_script.js](public/js/results_script.js#L35)
- **When**: Results page loads or is refreshed
- **Purpose**: Fetch and display list of all test runs
- **Actions**:
  - Show loader
  - Send GET request to `/api/tests`
  - Render test list in table with checkboxes
  - Add event listeners for "View Details" and comparison selection
  - Call `addCheckboxListeners()` to enable comparison feature

#### 13. **Route: GET /api/tests**
- **Handler**: `testController.getTests`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L20)
- **When**: Results page requests test list
- **Purpose**: Return list of all test runs

#### 14. **getTests() (Controller)**
- **Function**: `async function getTests(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L38)
- **When**: GET request to `/api/tests`
- **Purpose**: Retrieve all test metadata
- **Actions**:
  - Call `testService.getTests()`
  - Return JSON array of test objects

#### 15. **getTests() (Service)**
- **Function**: `async function getTests()`
- **File**: [src/services/testService.js](src/services/testService.js#L4)
- **When**: Called by controller
- **Purpose**: Query InfluxDB for unique test IDs
- **Actions**:
  - Execute Flux query on `visualMetrics` measurement
  - Group by test_id, url, browser
  - Return array with: `id`, `url`, `timestamp`, `browser`

#### 16. **viewTestDetails()**
- **Function**: `function viewTestDetails(testRunId)`
- **File**: [public/js/results_script.js](public/js/results_script.js#L95)
- **When**: User clicks "View Details" button for a test
- **Purpose**: Navigate to detailed report page
- **Actions**: Redirect to `detailed-report.html?testId={testRunId}`

---

## Detailed Report Page - Initial Load

### Page: `detailed-report.html` (Individual Test Report)

#### 17. **DOMContentLoaded Event**
- **Function**: `Anonymous DOMContentLoaded listener`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L8)
- **When**: Detailed report page loads
- **Purpose**: Initialize report display
- **Actions**:
  - Extract `testId` from URL query parameter
  - Update page title with testId
  - Call `fetchData()` to load test data

#### 18. **fetchData()**
- **Function**: `const fetchData = async () => {...}`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L43)
- **When**: Report page loads
- **Purpose**: Fetch test data and initialize report display
- **Actions**:
  - Send GET request to `/api/tests/{testId}` for general data
  - Call `fetchCoachScores()` to get summary scores (lightweight ~50 bytes)
  - Call `processData()` to organize data by URL
  - Call `populateUrlSelector()` to populate URL dropdown
  - Call `displayReportForUrl()` to show initial report
  - Hide loader, show content

#### 19. **Route: GET /api/tests/:testId**
- **Handler**: `testController.getTest`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L21)
- **When**: Detailed report page loads
- **Purpose**: Return test data for specific test

#### 20. **getTest() (Controller)**
- **Function**: `async function getTest(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L47)
- **When**: GET request to `/api/tests/{testId}`
- **Purpose**: Retrieve test data
- **Actions**:
  - Extract testId from params
  - Call `testService.getTest(testId)`
  - Return JSON with test data

#### 21. **getTest() (Service)**
- **Function**: `async function getTest(testId)`
- **File**: [src/services/testService.js](src/services/testService.js#L36)
- **When**: Called by controller
- **Purpose**: Query InfluxDB for test records
- **Actions**:
  - Execute Flux query filtering by test_id
  - Exclude `coach_advice` and `pagexray` measurements (lazy loaded)
  - Return raw InfluxDB records array

#### 22. **fetchCoachScores()**
- **Function**: `const fetchCoachScores = async () => {...}`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L70)
- **When**: Called immediately after main data fetch
- **Purpose**: Get summary scores for display in Summary tab
- **Actions**:
  - Send GET request to `/api/tests/{testId}/coach/scores`
  - Store scores in `coachScores` variable
  - Update `processedDataByUrl` with scores for all URLs

#### 23. **Route: GET /api/tests/:testId/coach/scores**
- **Handler**: `testController.getCoachScores`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L23)
- **When**: Detailed report needs summary scores
- **Purpose**: Return lightweight coach scores only

#### 24. **getCoachScores() (Controller)**
- **Function**: `async function getCoachScores(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L99)
- **When**: GET request to `/api/tests/{testId}/coach/scores`
- **Purpose**: Return just the category scores
- **Actions**:
  - Call `testService.getCoachScores(testId)`
  - Return JSON: `{performanceScore, privacyScore, bestPracticeScore}`

#### 25. **getCoachScores() (Service)**
- **Function**: `async function getCoachScores(testId)`
- **File**: [src/services/testService.js](src/services/testService.js)
- **When**: Called by controller
- **Purpose**: Query MySQL for coach category scores
- **Actions**:
  - Call `coachDataService.getCoachScores(testId)`
  - Return scores object

#### 26. **processData()**
- **Function**: `const processData = () => {...}`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L89)
- **When**: After data fetch completes
- **Purpose**: Organize raw InfluxDB records by URL
- **Actions**:
  - Group data by URL or 'group' tag
  - For each URL, call:
    - `extractSummary()` to get summary info
    - `extractMedia()` to get video/screenshot paths
  - Store in `processedDataByUrl` object

#### 27. **extractSummary()**
- **Function**: `function extractSummary(records, urlKey)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L255)
- **When**: Called by `processData()` for each URL
- **Purpose**: Extract basic test info for Summary tab
- **Returns**: Object with url, browser, timestamp, and placeholder scores (updated later by `fetchCoachScores()`)

#### 28. **extractMedia()**
- **Function**: `function extractMedia(records)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L351)
- **When**: Called by `processData()` for each URL
- **Purpose**: Extract video and screenshot paths
- **Returns**: Object with `{video: path, screenshot: path}`

#### 29. **populateUrlSelector()**
- **Function**: `const populateUrlSelector = () => {...}`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L120)
- **When**: After data processing completes
- **Purpose**: Populate URL dropdown selector
- **Actions**:
  - Clear and populate select element with URLs
  - Add change event listener to call `displayReportForUrl()`

#### 30. **displayReportForUrl()**
- **Function**: `const displayReportForUrl = (url) => {...}`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L131)
- **When**: URL selected from dropdown or initial load
- **Purpose**: Display report for selected URL
- **Actions**:
  - Get data for selected URL from `processedDataByUrl`
  - Update subtitle with URL
  - Call `renderTabsAndContent(data)` to build tab UI

#### 31. **renderTabsAndContent()**
- **Function**: `const renderTabsAndContent = (data) => {...}`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L137)
- **When**: Called when displaying report for URL
- **Purpose**: Create tab structure and content
- **Actions**:
  - Clear and rebuild tabs container and content container
  - Create 5 tabs: Summary, Performance, Coach, PageXray, Media
  - Mark **Performance, Coach, PageXray** as lazy-loaded (show "Loading..." placeholder)
  - For Summary and Media tabs, immediately call tab creation functions:
    - `createSummaryTab(data, testId)` - loads immediately
    - `createMediaTab(data, testId)` - loads immediately
  - Add click event listeners to tabs for lazy loading
  - Set Summary tab as active initially

#### 32. **createSummaryTab()**
- **Function**: `function createSummaryTab(data)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L362)
- **When**: Summary tab is rendered (immediately on page load)
- **Purpose**: Display test information and category scores
- **Returns**: HTML string with test metadata and score circles

#### 33. **createMediaTab()**
- **Function**: `function createMediaTab(data, testId)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L485)
- **When**: Media tab is rendered (immediately on page load)
- **Purpose**: Display video and LCP screenshot
- **Returns**: HTML with video player and screenshot image

---

## Lazy Loading - Tab Switching

### Performance Tab Lazy Loading

#### 34. **Tab Click Event - Performance**
- **Function**: `button.addEventListener('click', async () => {...})`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L172)
- **When**: User clicks on "Performance" tab
- **Purpose**: Lazy load performance metrics on-demand
- **Actions**:
  - Check if `pane.dataset.loaded === 'false'`
  - If not loaded:
    - Send GET request to `/api/tests/{testId}/performance`
    - Store response in `data.performance`
    - Call `createPerformanceTab(data, testId)` to render
    - Set `pane.dataset.loaded = 'true'`
    - Call `renderPerformanceCharts()` to draw charts

#### 35. **Route: GET /api/tests/:testId/performance**
- **Handler**: `testController.getPerformanceMetrics`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L25)
- **When**: Performance tab clicked for first time
- **Purpose**: Return performance metrics for test

#### 36. **getPerformanceMetrics() (Controller)**
- **Function**: `async function getPerformanceMetrics(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L73)
- **When**: GET request to `/api/tests/{testId}/performance`
- **Purpose**: Retrieve and transform performance metrics
- **Actions**:
  - Call `testService.getPerformanceData(testId)` to get raw records
  - Call `performanceTransformer.transformPerformanceRecords()` to structure data
  - Return transformed metrics object

#### 37. **getPerformanceData() (Service)**
- **Function**: `async function getPerformanceData(testId)`
- **File**: [src/services/testService.js](src/services/testService.js#L92)
- **When**: Called by controller
- **Purpose**: Query InfluxDB for performance metrics
- **Actions**:
  - Execute Flux query filtering `visualMetrics` measurement
  - Return raw InfluxDB records array

#### 38. **transformPerformanceRecords() (Transformer)**
- **Function**: `function transformPerformanceRecords(records)`
- **File**: [src/services/performanceTransformer.js](src/services/performanceTransformer.js#L23)
- **When**: Called by controller after fetching records
- **Purpose**: Transform flat InfluxDB records into structured metrics object
- **Actions**:
  - Initialize metrics object with null values for all known metrics
  - Map records by `metricName` tag
  - Extract `_value` field for each metric
  - Return object like: `{firstPaint: 287, SpeedIndex: 6656, ...}`

#### 39. **createPerformanceTab()**
- **Function**: `function createPerformanceTab(data)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L393)
- **When**: Performance tab content needs to be rendered
- **Purpose**: Generate HTML for performance metrics display
- **Returns**: HTML string with chart canvas and detailed metrics list

#### 40. **renderPerformanceCharts()**
- **Function**: `function renderPerformanceCharts(performanceData)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L514)
- **When**: After performance tab content is rendered
- **Purpose**: Draw performance metrics bar chart using Chart.js
- **Actions**:
  - Get canvas context for `timingChart`
  - Destroy existing chart if present
  - Create new Chart.js bar chart with performance metrics
  - Display all non-N/A metrics

### Coach Tab Lazy Loading

#### 41. **Tab Click Event - Coach**
- **Function**: `button.addEventListener('click', async () => {...})`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L193)
- **When**: User clicks on "Coach" tab
- **Purpose**: Lazy load coach advice on-demand
- **Actions**:
  - Check if `pane.dataset.loaded === 'false'`
  - If not loaded:
    - Send GET request to `/api/tests/{testId}/coach`
    - Get `transformCoachData()` function
    - Call `transformCoachData(coachData)` to structure advice
    - Store result in `data.coach`
    - Call `createCoachTab(data, testId)` to render
    - Set `pane.dataset.loaded = 'true'`

#### 42. **Route: GET /api/tests/:testId/coach**
- **Handler**: `testController.getCoachData`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L22)
- **When**: Coach tab clicked for first time
- **Purpose**: Return coach advice data for test

#### 43. **getCoachData() (Controller)**
- **Function**: `async function getCoachData(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L56)
- **When**: GET request to `/api/tests/{testId}/coach`
- **Purpose**: Retrieve coach advice from MySQL
- **Actions**:
  - Call `testService.getCoachData(testId)`
  - Return JSON array of coach advice records

#### 44. **getCoachData() (Service)**
- **Function**: `async function getCoachData(testId)`
- **File**: [src/services/testService.js](src/services/testService.js#L53)
- **When**: Called by controller
- **Purpose**: Query MySQL for coach advice
- **Actions**:
  - Call `coachDataService.getCoachDataByTestId(testId)`
  - Return array of advice records from MySQL

#### 45. **getCoachDataByTestId() (Service)**
- **Function**: `async function getCoachDataByTestId(testId)`
- **File**: [src/services/coachDataService.js](src/services/coachDataService.js)
- **When**: Called by testService
- **Purpose**: Execute MySQL query for coach advice
- **Actions**:
  - Query `coach_advice` table filtered by test_id
  - Return rows with: adviceId, score, title, description, category

#### 46. **transformCoachData() (Transformer)**
- **Function**: `function transformCoachData(records)`
- **File**: [public/js/coachDataTransformer.js](public/js/coachDataTransformer.js#L63)
- **When**: After coach data is fetched from API
- **Purpose**: Transform flat MySQL records into hierarchical structure
- **Actions**:
  - Use `ADVICE_CATEGORY_MAP` to categorize advice by adviceId
  - Group advice by category (performance, privacy, bestpractice)
  - Build structured object: `{category: {score, adviceList: {...}}}`
  - Handle both single-record and multi-record formats
  - Return hierarchical coach data object

#### 47. **createCoachTab()**
- **Function**: `function createCoachTab(data)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L415)
- **When**: Coach tab content needs to be rendered
- **Purpose**: Generate HTML for coach advice display
- **Returns**: HTML string with advice grouped by category, showing scores, titles, and descriptions

### PageXray Tab Lazy Loading

#### 48. **Tab Click Event - PageXray**
- **Function**: `button.addEventListener('click', async () => {...})`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L204)
- **When**: User clicks on "PageXray" tab
- **Purpose**: Lazy load PageXray asset data on-demand
- **Actions**:
  - Check if `pane.dataset.loaded === 'false'`
  - If not loaded:
    - Send GET request to `/api/tests/{testId}/pagexray`
    - Call `extractPageXrayData()` to structure data
    - Store result in `data.pagexray`
    - Call `createPageXrayTab(data, testId)` to render
    - Set `pane.dataset.loaded = 'true'`
    - Call `renderPageXrayCharts()` to draw charts

#### 49. **Route: GET /api/tests/:testId/pagexray**
- **Handler**: `testController.getPagexrayData`
- **File**: [src/routes/testRoutes.js](src/routes/testRoutes.js#L24)
- **When**: PageXray tab clicked for first time
- **Purpose**: Return PageXray asset breakdown data for test

#### 50. **getPagexrayData() (Controller)**
- **Function**: `async function getPagexrayData(req, res)`
- **File**: [src/controllers/testController.js](src/controllers/testController.js#L65)
- **When**: GET request to `/api/tests/{testId}/pagexray`
- **Purpose**: Retrieve PageXray data from MySQL
- **Actions**:
  - Call `testService.getPagexrayData(testId)`
  - Return JSON array of PageXray records

#### 51. **getPagexrayData() (Service)**
- **Function**: `async function getPagexrayData(testId)`
- **File**: [src/services/testService.js](src/services/testService.js#L77)
- **When**: Called by controller
- **Purpose**: Query MySQL for PageXray data
- **Actions**:
  - Call `pagexrayDataService.getPageXrayDataByTestId(testId)`
  - Return array of PageXray records from MySQL

#### 52. **getPageXrayDataByTestId() (Service)**
- **Function**: `async function getPageXrayDataByTestId(testId)`
- **File**: [src/services/pagexrayDataService.js](src/services/pagexrayDataService.js)
- **When**: Called by testService
- **Purpose**: Execute MySQL query for PageXray data
- **Actions**:
  - Query `pagexray_data` table filtered by test_id
  - Return rows with: contentType, requests, contentSize, transferSize

#### 53. **extractPageXrayData() (Transformer)**
- **Function**: `function extractPageXrayData(records)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L321)
- **When**: After PageXray data is fetched from API
- **Purpose**: Structure PageXray records into content type breakdown
- **Actions**:
  - Filter records with `_measurement === 'pagexray'`
  - Group by contentType (html, css, javascript, image, etc.)
  - Extract requests, contentSize, transferSize for each type
  - Calculate totalRequests and totalSize
  - Return: `{contentTypes: {...}, totalRequests, totalSize}`

#### 54. **createPageXrayTab()**
- **Function**: `function createPageXrayTab(data)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L455)
- **When**: PageXray tab content needs to be rendered
- **Purpose**: Generate HTML for asset breakdown display
- **Returns**: HTML string with chart canvases and asset details table

#### 55. **renderPageXrayCharts()**
- **Function**: `function renderPageXrayCharts(pageXrayData)`
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L541)
- **When**: After PageXray tab content is rendered
- **Purpose**: Draw pie charts for requests and size breakdown using Chart.js
- **Actions**:
  - Get canvas contexts for `contentRequestsChart` and `contentSizeChart`
  - Destroy existing charts if present
  - Create two Chart.js pie charts:
    - Requests by content type
    - Size by content type

---

## Data Transformation

### Summary of Key Transformer Functions

#### 56. **performanceTransformer.js**
- **File**: [src/services/performanceTransformer.js](src/services/performanceTransformer.js)
- **Purpose**: Transform InfluxDB visualMetrics records into structured metrics object
- **Key Function**: `transformPerformanceRecords(records)`
- **Input**: Array of flat InfluxDB records with metricName tags
- **Output**: Object with metric names as keys and values as numbers

#### 57. **coachDataTransformer.js**
- **File**: [public/js/coachDataTransformer.js](public/js/coachDataTransformer.js)
- **Purpose**: Transform flat MySQL coach records into hierarchical category structure
- **Key Function**: `transformCoachData(records)`
- **Uses**: `ADVICE_CATEGORY_MAP` to map adviceIds to categories
- **Input**: Array of flat MySQL records with adviceId, score, title, description
- **Output**: Object with categories containing adviceList and scores

#### 58. **extractPageXrayData()**
- **File**: [public/js/detailed-report.js](public/js/detailed-report.js#L321)
- **Purpose**: Structure PageXray records into content type breakdown
- **Input**: Array of PageXray records from MySQL
- **Output**: Object with contentTypes breakdown and totals

---

## Summary of Lazy Loading Strategy

### Immediate Loading (On Page Load)
1. **Summary Tab**: Test metadata and category scores (~50 bytes, MySQL)
2. **Media Tab**: Video and screenshot paths (already in InfluxDB from initial load)

### Lazy Loading (On Tab Click)
1. **Performance Tab**: Visual metrics from InfluxDB (~2-5 KB)
   - Triggered by first click on Performance tab
   - API call: `GET /api/tests/{testId}/performance`
   - Transformation: `performanceTransformer.transformPerformanceRecords()`

2. **Coach Tab**: Coach advice from MySQL (~10-50 KB depending on advice count)
   - Triggered by first click on Coach tab
   - API call: `GET /api/tests/{testId}/coach`
   - Transformation: `transformCoachData()`

3. **PageXray Tab**: Asset breakdown from MySQL (~1-5 KB)
   - Triggered by first click on PageXray tab
   - API call: `GET /api/tests/{testId}/pagexray`
   - Transformation: `extractPageXrayData()`

### Caching Strategy
- Once a tab is loaded, `pane.dataset.loaded = 'true'` prevents re-fetching
- Tab switching to already-loaded tabs just shows cached content
- Charts are re-rendered on tab switch if already loaded (for proper sizing)

---

## Page-to-Function Mapping

### index.html (Test Configuration Page)
- **UI Functions**: `setIdleState()`, `setRunningState()`, `setCompletedState()`, `setFailedState()`, `setStoppedState()`
- **Form Functions**: `handleFormSubmit()`, `addOption()`, `handleFileUpload()`
- **Helper Functions**: `createCategorySelect()`, `createParameterSelect()`, `createValueInput()`, `createRemoveButton()`

### results.html (All Tests List Page)
- **List Functions**: `fetchTestRuns()`, `addCheckboxListeners()`, `updateCompareButtonState()`, `viewTestDetails()`
- **Comparison Functions**: `fetchAndDisplayComparison()`, `renderComparisonCards()`, `renderComparisonChart()`
- **Tab Functions**: Tab switching event listeners

### detailed-report.html (Individual Test Report Page)
- **Initialization**: `fetchData()`, `fetchCoachScores()`, `processData()`, `populateUrlSelector()`, `displayReportForUrl()`
- **Tab System**: `renderTabsAndContent()`, tab click event listeners
- **Tab Creators**: `createSummaryTab()`, `createPerformanceTab()`, `createCoachTab()`, `createPageXrayTab()`, `createMediaTab()`
- **Data Extractors**: `extractSummary()`, `extractMedia()`
- **Chart Renderers**: `renderPerformanceCharts()`, `renderPageXrayCharts()`
- **Transformers**: `transformCoachData()`, `extractPageXrayData()`

---

## Key Invocation Triggers

| Trigger | Functions Invoked | Page |
|---------|------------------|------|
| Page Load (index.html) | `DOMContentLoaded listener` → `setIdleState()` | index.html |
| Form Submit | `handleFormSubmit()` → API call → `runTest()` → `runSitespeedTest()` | index.html → Backend |
| Test Complete | `setCompletedState()` (client) + `processAndStoreDetailedResults()` (background) | index.html → Backend |
| Page Load (results.html) | `DOMContentLoaded listener` → `fetchTestRuns()` → `getTests()` | results.html |
| Click "View Details" | `viewTestDetails()` → Navigate to detailed-report.html | results.html |
| Page Load (detailed-report.html) | `DOMContentLoaded listener` → `fetchData()` → `renderTabsAndContent()` | detailed-report.html |
| Click "Performance" Tab (first time) | Tab click listener → API call → `getPerformanceMetrics()` → `createPerformanceTab()` → `renderPerformanceCharts()` | detailed-report.html |
| Click "Coach" Tab (first time) | Tab click listener → API call → `getCoachData()` → `transformCoachData()` → `createCoachTab()` | detailed-report.html |
| Click "PageXray" Tab (first time) | Tab click listener → API call → `getPagexrayData()` → `extractPageXrayData()` → `createPageXrayTab()` → `renderPageXrayCharts()` | detailed-report.html |

---

## End of Document

This trace provides a complete view of the function execution flow from test submission through results display and lazy loading. Each function is documented with its purpose, when it's invoked, and which page it belongs to.
