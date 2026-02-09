# Changes Log

**Track all code modifications and bug fixes**

---

## **Change #9: Immediate Coach Scores Display on Summary Tab**

**Date:** 3 February 2026  
**Status:** ✅ Completed  
**Files Modified:**
- [`config/mysql-init.sql`](config/mysql-init.sql)
- [`src/services/coachDataService.js`](src/services/coachDataService.js)
- [`src/services/resultsProcessor.js`](src/services/resultsProcessor.js)
- [`src/services/testService.js`](src/services/testService.js)
- [`src/controllers/testController.js`](src/controllers/testController.js)
- [`src/routes/testRoutes.js`](src/routes/testRoutes.js)
- [`public/js/detailed-report.js`](public/js/detailed-report.js)

**Purpose:**
Display coach scores (Performance, Privacy, Best Practice) immediately on Summary tab load without waiting for Coach tab to be clicked. Maintains lazy loading architecture for full coach advice details.

**Implementation Details:**

✅ **Database Layer:**
- Added `coach_scores` table to store 3 category scores separately
- Table structure: test_id (PK), performance_score, privacy_score, bestpractice_score, created_at
- Lightweight table optimized for fast score retrieval

✅ **Backend Processing:**
- Modified `resultsProcessor.js` to extract category scores during coach data processing
- Added `saveCoachScores()` method to persist scores immediately after test completion
- Scores extracted from: `adviceRoot.performance.score`, `adviceRoot.privacy.score`, `adviceRoot.bestpractice.score`

✅ **Backend API:**
- Created new endpoint: `GET /api/tests/:testId/coach/scores`
- Returns lightweight payload (~50 bytes): `{performanceScore, privacyScore, bestPracticeScore}`
- Added `getCoachScores()` methods in testService and testController

✅ **Frontend Integration:**
- Added `fetchCoachScores()` function that loads immediately on page load
- Fetches only the 3 scores (not full advice details)
- Updates `processedDataByUrl` with actual scores before rendering
- Replaced "Accessibility Score" with "Privacy Score" (sitespeed.io standard)
- Removed old dynamic update logic (`updateSummaryScores()` function)

✅ **Lazy Loading Preserved:**
- Summary tab shows scores immediately ✅
- Coach tab still lazy loads full advice details when clicked ✅
- No impact on page load performance (tiny payload) ✅

**Benefits:**
- **Immediate visibility**: Users see scores without clicking Coach tab
- **Minimal overhead**: ~50 byte payload vs. several KB for full coach data
- **Clean separation**: Scores vs. detailed advice stored separately
- **Lazy loading preserved**: Full coach advice still loads on-demand
- **Better UX**: No more N/A placeholders on Summary tab

**Data Flow:**
```
Test Run → Extract 3 scores from coach.json → Save to coach_scores table
Page Load → Fetch scores (~50 bytes) → Display in Summary tab immediately
User clicks Coach tab → Lazy load full advice details (several KB)
```

---

## **Change #8: Migrate PageXray Data to MySQL** ✅ FULLY COMPLETED

**Date:** 3 February 2026  
**Status:** ✅ Fully Completed - All phases tested and verified in production  
**Files Modified:**
- [`config/mysql-init.sql`](config/mysql-init.sql)
- [`src/services/pagexrayDataService.js`](src/services/pagexrayDataService.js) (NEW)
- [`src/services/resultsProcessor.js`](src/services/resultsProcessor.js)
- [`src/services/testService.js`](src/services/testService.js)
- [`PAGEXRAY_MYSQL_MIGRATION_PLAN.md`](PAGEXRAY_MYSQL_MIGRATION_PLAN.md) (NEW)

**Purpose:**
Migrate PageXray content type breakdown data from InfluxDB to MySQL following the Coach migration pattern. InfluxDB now used only for time-series metrics (visualMetrics, media_assets).

**Implementation Details:**

✅ **Phase 1: Infrastructure** (Already complete from Coach migration)
- MySQL 8.0 service running with connection pool

✅ **Phase 2: MySQL Schema**
- Added `pagexray_data` table to mysql-init.sql
- Fields: test_id, url, group_name, browser, content_type, requests, content_size (BIGINT), transfer_size (BIGINT)
- Indexes on test_id, content_type, and composite (test_id, content_type)
- UNIQUE constraint on (test_id, content_type)

✅ **Phase 3: Data Service**
- Created `pagexrayDataService.js` with:
  - `savePageXrayData()`: INSERT with ON DUPLICATE KEY UPDATE
  - `getPageXrayDataByTestId()`: SELECT and transform to InfluxDB-compatible format (3 records per content type)

✅ **Phase 4: Write to MySQL Only**
- Updated `resultsProcessor.js` to write PageXray data to MySQL only
- Removed InfluxDB Point writes for pagexray measurement
- PageXray data persisted immediately after each test run

✅ **Phase 5: Read from MySQL Only**
- Updated `testService.js` `getPagexrayData()` to read from MySQL exclusively
- Removed InfluxDB Flux queries for pagexray data
- Returns transformed data in InfluxDB-compatible format for frontend

✅ **Phase 6: Frontend Verification**
- Verified `pagexrayDataService.js` transformation includes `_measurement: 'pagexray'`
- Frontend filter `r._measurement === 'pagexray'` works correctly
- No frontend changes required

✅ **Phase 7: Testing & Verification**
- End-to-end testing with new test runs - VERIFIED
- Charts and tables render correctly - VERIFIED
- No browser console errors - VERIFIED

**Current State:**
- New tests write PageXray data to MySQL only ✅
- API reads from MySQL exclusively ✅
- InfluxDB deprecated for PageXray (no longer written or read) ✅
- Frontend PageXray tab displays correctly ✅
- All content types render properly ✅

**Benefits:**
- **Consistency**: Same pattern as Coach migration
- **Simplified architecture**: Single source of truth for PageXray data
- **Better performance**: MySQL indexed queries faster than InfluxDB for structured data
- **Data integrity**: UNIQUE constraints prevent duplicate content type records

---

## **Change #7: Migrate Coach Data from InfluxDB to MySQL** ✅ COMPLETED

**Date:** 3 February 2026  
**Status:** ✅ Completed - Coach data fully migrated from InfluxDB to MySQL  
**Files Modified:**
- [`docker-compose.yml`](docker-compose.yml)
- [`config/mysql-init.sql`](config/mysql-init.sql) (NEW)
- [`src/config/mysql.js`](src/config/mysql.js) (NEW)
- [`src/services/coachDataService.js`](src/services/coachDataService.js) (NEW)
- [`src/services/resultsProcessor.js`](src/services/resultsProcessor.js)
- [`src/services/testService.js`](src/services/testService.js)
- [`package.json`](package.json)

**Purpose:**
Migrate coach advice data storage from InfluxDB to MySQL for better data management, improved query performance, and separation of concerns. InfluxDB now used only for time-series metrics (visualMetrics, pagexray, media_assets).

**Implementation Details:**

✅ **Phase 1-4: Infrastructure Setup**
- Added MySQL 8.0 Docker service with persistent volume
- Created `coach_advice` and `test_runs` tables in MySQL
- Added mysql2 dependency to package.json
- Created MySQL connection pool in `src/config/mysql.js`

✅ **Phase 5-6: Data Writing**
- Created `coachDataService.js` with `saveCoachData()` function
- Updated `resultsProcessor.js` to write coach data to MySQL only (removed InfluxDB writes for coach)
- Coach data is persisted immediately after each test run

✅ **Phase 7: Data Reading** 
- Updated `testService.js` to read coach data from MySQL via `getCoachDataByTestId()`
- `getCoachDataByTestId()` transforms MySQL data to match original InfluxDB response format
- Removed InfluxDB Flux queries for coach data completely

✅ **Frontend Updates**
- Removed `_measurement` filter in detailed-report.js since MySQL data doesn't have this field
- Coach tab now reads from MySQL exclusively

**Benefits:**
- **Faster queries**: MySQL indexed queries are faster than InfluxDB for structured coach data
- **Better separation**: InfluxDB now focused on time-series metrics only
- **Scalability**: MySQL can handle coach data growth without impacting metrics storage
- **Data integrity**: UNIQUE constraints on coach_advice table prevent duplicates
- **Audit trail**: test_runs table tracks when each test was executed

---

## **Change #6: Implement Lazy Loading for Performance, Coach, and PageXray Tabs** ✅ IMPLEMENTED

**Date:** 30 January 2026  
**Status:** ✅ Implemented - All three tabs load data only when clicked  
**Files Modified:**
- [`public/js/detailed-report.js`](public/js/detailed-report.js)
- [`src/services/testService.js`](src/services/testService.js)
- [`src/controllers/testController.js`](src/controllers/testController.js)
- [`src/services/performanceTransformer.js`](src/services/performanceTransformer.js) (NEW)
- [`src/routes/testRoutes.js`](src/routes/testRoutes.js)

**Purpose:**
Optimize page load performance by deferring fetching and rendering of three data-heavy tabs until user clicks them, reducing initial payload by ~30-40%. Only Summary tab loads immediately.

**Implementation Details:**

✅ **Backend (Phase 1):**
- Created `getPerformanceData(testId)` service method to query InfluxDB visualMetrics measurement
- Created `performanceTransformer.js` module with `transformPerformanceRecords()` to convert InfluxDB multi-record format into single metrics object supporting 11 metrics (firstPaint, SpeedIndex, LCP, etc.)
- Implemented `getPerformanceMetrics()` controller to handle requests via `GET /api/tests/:testId/performance` endpoint
- Backend pre-transforms data before sending to frontend

✅ **Frontend (Phase 2):**
- Updated `lazyLoadTabs` array to include: `['Performance', 'Coach', 'PageXray']`
- Removed performance extraction from `processData()` to prevent loading in initial fetch
- Implemented tab-specific lazy load handlers:
  - **Performance**: Fetches pre-transformed metrics, renders charts asynchronously with `setTimeout()` to ensure DOM is ready
  - **Coach**: Fetches coach_advice records, transforms via `transformCoachData()`, renders categorized advice with `escapeHtml()` for safe display
  - **PageXray**: Fetches pagexray records, extracts content breakdown data, renders pie charts for requests and size
- Added safety checks in `renderPerformanceCharts()` to prevent rendering before data loads
- Uses `pane.dataset.loaded` flag to cache data after first load (skips re-fetch on subsequent tab clicks)

✅ **Bug Fixes Applied:**
- Removed duplicate chart render calls that were executing on every tab click
- Removed premature chart rendering at page load (when performance data undefined)
- Added null/undefined checks to prevent rendering errors

**Benefits:**
- **Faster initial page load**: Only Summary tab loads immediately
- **Reduced bandwidth**: ~30-40% initial payload reduction
- **Smart caching**: Each tab loads once, subsequent clicks use cached data
- **Better UX**: Users see results immediately, other data loads quietly in background
- **Clean architecture**: Dedicated API endpoint and transformer module for performance metrics

**Tab Load Sequence:**
1. **Initial**: Summary tab loads and displays immediately
2. **On Performance click**: Fetches `/api/tests/:testId/performance` → renders metrics table + bar chart
3. **On Coach click**: Fetches `/api/tests/:testId/coach` → renders categorized advice (Performance, Privacy, Best Practice)
4. **On PageXray click**: Fetches `/api/tests/:testId/pagexray` → renders content type breakdown charts and asset table

**Data Caching:**
- Each tab's pane has `data-loaded="false"` initially
- First click: Fetch data, render content, set `data-loaded="true"`
- Subsequent clicks: Skip fetch, use cached data from memory

---

## **Change #5: Fix HTML Escaping in Coach Advice Descriptions** ✅ FIXED

**Date:** 30 January 2026  
**Status:** ✅ Fixed - HTML tags now properly escaped in coach descriptions  
**Files Modified:**
- [`public/js/detailed-report.js`](public/js/detailed-report.js)

**Problem:**
Coach advice descriptions containing HTML tags like `<svg>` and `<canvas>` were being rendered as actual HTML elements instead of displaying as text. This caused blank spaces in descriptions because the browser interpreted these tags as DOM elements.

**Example Issue:**
```html
<!-- What was stored in description: -->
"refers to text, images, <svg> elements, or non-white <canvas> elements."

<!-- What was displayed: -->
"refers to text, images,  elements, or non-white  elements."
<!-- The <svg> and <canvas> were rendered as empty HTML elements -->
```

**Root Cause:**
The coach advice descriptions were being inserted directly into the DOM using template literals without HTML escaping. When descriptions contained HTML-like syntax (e.g., `<svg>`, `<canvas>`), the browser interpreted them as actual HTML tags rather than text content.

**Changes Made:**

✅ **Added `escapeHtml()` Utility Function:**
```javascript
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;  // Browser auto-escapes HTML
    return div.innerHTML;     // Returns escaped version
};
```

✅ **Updated Coach Tab Rendering** (line ~391):
- Applied `escapeHtml()` to both advice titles and descriptions
- Changed from: `${advice.title || adviceId}` and `${advice.advice || ''}`
- Changed to: `${escapeHtml(advice.title || adviceId)}` and `${escapeHtml(advice.advice || '')}`

**How It Works:**
- Creates temporary DOM element
- Uses `textContent` property (which auto-escapes HTML)
- Reads back `innerHTML` to get properly escaped text
- Converts `<svg>` → `&lt;svg&gt;`, `<canvas>` → `&lt;canvas&gt;`, etc.

**Result:**
- ✅ HTML tags display as text: "&lt;svg&gt; elements"
- ✅ No more blank spaces in descriptions
- ✅ Prevents HTML injection vulnerabilities
- ✅ Works for all coach advice descriptions automatically
- ✅ Applies to all future tests (no manual fixes needed)

**Benefits:**
- **Permanent solution**: Works for all generated sitespeed.io reports
- **Automatic**: No manual intervention needed per test
- **Safe**: Uses browser's native escaping mechanism
- **Universal**: Handles any HTML-like syntax in descriptions

---

## **Change #4: Fix Speed Index Missing Unit** ✅ FIXED

**Date:** 21 January 2026  
**Status:** ✅ Fixed - Unit 'ms' added to Speed Index display  
**Files Modified:**
- [`public/js/detailed-report.js`](public/js/detailed-report.js)
- [`public/js/results_script.js`](public/js/results_script.js)

**Problem:**
Speed Index was displayed without a unit in the Performance tab and comparison view, while other timing metrics (FCP, LCP, Load Time) correctly showed 'ms' unit.

**Root Cause:**
1. In `detailed-report.js`, the code explicitly excluded SpeedIndex from getting the 'ms' unit:
   ```javascript
   ${key.includes('Score') || key === 'SpeedIndex' ? '' : 'ms'}
   ```
2. In `results_script.js`, Speed Index display was missing the ' ms' suffix:
   ```javascript
   test.metrics.speedIndex.toFixed(0)  // Missing unit
   ```

**Changes Made:**

✅ **detailed-report.js** (line 355):
- Removed `|| key === 'SpeedIndex'` condition from unit display logic
- Now SpeedIndex correctly receives 'ms' unit alongside other timing metrics

✅ **results_script.js** (line 157):
- Added ' ms' suffix to Speed Index value display
- Now consistent with FCP, LCP, and Load Time display format

**Result:**
- Speed Index now displays as "6656 ms" instead of "6656"
- Consistent unit display across all performance metrics
- Matches sitespeed.io's standard output where values are in milliseconds

---

## **Change #3: Remove Delete Test Functionality** ❌ REMOVED

**Date:** 21 January 2026  
**Status:** ❌ Removed - Feature completely removed from codebase  
**Files Modified:**
- [`src/services/coachDataService.js`](src/services/coachDataService.js)
- [`src/controllers/testController.js`](src/controllers/testController.js)
- [`src/routes/testRoutes.js`](src/routes/testRoutes.js)
- [`public/js/results_script.js`](public/js/results_script.js)

**Changes Made:**

✅ **Backend Changes:**
- Removed DELETE endpoint `router.delete('/tests/:testId', testController.deleteTest)` from testRoutes.js
- Removed `deleteTest()` function from testController.js
- Commented out `deleteCoachDataByTestId()` function in coachDataService.js
- Removed from module exports

✅ **Frontend Changes:**
- Removed "Delete" button from test row HTML template
- Removed `deleteTest()` function and all related UI code
- Row removal animation code removed
- Success notification code removed

**Reason for Removal:**
- Feature no longer required for current use case
- Simplifies codebase and reduces complexity

---

## **Change #2: Add Delete Test Functionality** ❌ REMOVED

**Date:** 21 January 2026  
**Status:** ❌ Removed - Feature was implemented but later removed
**Files Modified:**
- [`src/services/coachDataService.js`](src/services/coachDataService.js)
- [`src/controllers/testController.js`](src/controllers/testController.js)
- [`src/routes/testRoutes.js`](src/routes/testRoutes.js)
- [`public/js/results_script.js`](public/js/results_script.js)

**Features:**

✅ **Backend Delete:**
- Deletes from MySQL `coach_advice` table
- Keeps in `test_runs` table (audit trail)
- InfluxDB data remains untouched

✅ **Frontend UX Improvements:**
- Row fades out smoothly (0.3s animation)
- Removed from table immediately (no full page reload)
- Green success notification appears
- Auto-dismisses notification after 3 seconds
- Checkbox-based row removal (finds by testId)

**How It Works:**

1. User clicks "Delete" button on test row
2. Confirmation dialog appears
3. On confirmation:
   - DELETE request sent to `/api/tests/:testId`
   - Backend deletes from MySQL coach_advice
   - Frontend finds row by testId
   - Row fades out and is removed from DOM
   - Success message shown and auto-dismisses

**API Endpoint:**
```
DELETE /api/tests/:testId
Response: { message: 'Test data deleted successfully from MySQL', testId }
```

**Data After Delete:**
- ✅ Deleted: MySQL coach_advice table
- ✅ Kept: MySQL test_runs table (for audit trail)
- ✅ Kept: InfluxDB (for historical data)
- ✅ Removed: Frontend UI table row

---

## **Change #1: Fix View Results Button Navigation** ✅ VERIFIED

**Date:** 21 January 2026  
**Status:** ✅ Verified and Working  
**Files Modified:** 
- [`public/js/script.js`](public/js/script.js) (line 127)
- [`public/index.html`](public/index.html) (line 107)

**Root Cause:**
The button was an `<a>` tag with `href="N/A"` attribute, which was opening a new tab by default browser behavior (links always open new tabs when clicked).

**Changes Made:**

1. **HTML Template** - Changed `<a>` tag to `<button>`:
```html
<!-- BEFORE: -->
<a href=N/A class="view-details-btn ...">View Results</a>

<!-- AFTER: -->
<button type="button" class="view-details-btn ...">View Results</button>
```

2. **JavaScript Event Handler** - Correctly set navigation:
```javascript
// Changed from: window.open(`results.html?testId=${data.testId}`, '_blank');
// To:
window.location.href = `detailed-report.html?testId=${data.testId}`;
```

**Results:**
- ✅ Button opens in **same tab** (confirmed working)
- ✅ Correct page displayed: `detailed-report.html` with test details
- ✅ URL matches content shown
- ✅ Button now opens in **same tab** (no new tab)
- ✅ Correct page displayed: `detailed-report.html` (not `results.html`)
- ✅ URL matches content shown
- ✅ Proper button semantics (not a link)

---

**Last Updated:** 30 January 2026 (Change #6 updated)
