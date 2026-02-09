# PageXray Data MySQL Migration - Implementation Plan

**Project:** sitespeeddocker  
**Objective:** Migrate PageXray data from InfluxDB to MySQL  
**Current Status:** Phases 1-6 Complete - InfluxDB Deprecated (3 Feb 2026)  
**Date Created:** 3 February 2026  
**Date Completed:** 3 February 2026  
**Reference:** Based on successful Coach Data migration (completed 3 Feb 2026)

---

## **MIGRATION OVERVIEW**

**Goal:** Migrate PageXray content type breakdown data from InfluxDB to MySQL while maintaining backward compatibility.

**Current PageXray Data Structure (InfluxDB):**
```
Measurement: pagexray
Tags: test_id, url, group, browser, contentType
Fields: requests (int), contentSize (int), transferSize (int)
```

**Proposed MySQL Schema:**
```sql
CREATE TABLE pagexray_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id VARCHAR(100) NOT NULL,
    url VARCHAR(500),
    group_name VARCHAR(100),
    browser VARCHAR(50),
    content_type VARCHAR(50),
    requests INT DEFAULT 0,
    content_size BIGINT DEFAULT 0,
    transfer_size BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_test_id (test_id),
    INDEX idx_content_type (content_type),
    INDEX idx_created_at (created_at),
    UNIQUE KEY unique_record (test_id, content_type)
);
```

---

## **PHASED MIGRATION APPROACH**

### **PHASE 1: MySQL Infrastructure Setup** ✅ ALREADY COMPLETE

**Status:** ✅ Completed during Coach migration  
**What exists:**
- MySQL 8.0 Docker service running
- MySQL connection pool in `src/config/mysql.js`
- mysql2 dependency in package.json
- Docker volumes and networking configured

**No changes needed in this phase.**

---

### **PHASE 2: Create PageXray MySQL Schema**

**File:** `config/mysql-init.sql` (MODIFY EXISTING)

**Changes to make:**

1. **Add PageXray table to existing mysql-init.sql:**
```sql
-- PageXray Content Type Data Table
CREATE TABLE IF NOT EXISTS pagexray_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id VARCHAR(100) NOT NULL,
    url VARCHAR(500),
    group_name VARCHAR(100),
    browser VARCHAR(50),
    content_type VARCHAR(50) NOT NULL,
    requests INT DEFAULT 0,
    content_size BIGINT DEFAULT 0,
    transfer_size BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_test_id (test_id),
    INDEX idx_content_type (content_type),
    INDEX idx_created_at (created_at),
    INDEX idx_test_content (test_id, content_type),
    UNIQUE KEY unique_record (test_id, content_type)
);
```

**Why BIGINT for sizes:**
- Content sizes can exceed INT max value (2GB+)
- transferSize and contentSize need to handle large payloads

**Why UNIQUE constraint:**
- One record per content type per test
- Prevents duplicate data
- Enables INSERT...ON DUPLICATE KEY UPDATE pattern

---

### **PHASE 3: Create PageXray Data Service**

**Option A:** Create new file `src/services/pagexrayDataService.js` (RECOMMENDED)

**Option B:** Extend existing `src/services/coachDataService.js` (NOT RECOMMENDED - violates separation of concerns)

**Recommended: Create NEW file `src/services/pagexrayDataService.js`**

**Functions to implement:**

```javascript
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
async function savePageXrayData(testRunId, url, groupName, browser, contentType, requests, contentSize, transferSize)

/**
 * Retrieve PageXray data from MySQL by test ID
 * Transforms MySQL format to match InfluxDB response format
 * @param {string} testId - Test ID to query
 * @returns {Array} Array of pagexray records in InfluxDB format
 */
async function getPageXrayDataByTestId(testId)

/**
 * Delete PageXray data by test ID (for cleanup/rollback)
 * @param {string} testId - Test ID to delete
 */
async function deletePageXrayDataByTestId(testId) // OPTIONAL - for future use
```

**Module exports:**
```javascript
module.exports = {
    savePageXrayData,
    getPageXrayDataByTestId
    // deletePageXrayDataByTestId  // UNCOMMENT WHEN READY
};
```

**Transformation Logic (MySQL → InfluxDB format):**
```javascript
// MySQL row format:
{
    test_id: 'test_123',
    url: 'https://example.com',
    group_name: 'example_com',
    browser: 'chrome',
    content_type: 'javascript',
    requests: 10,
    content_size: 500000,
    transfer_size: 450000,
    created_at: '2026-02-03T...'
}

// Transform to InfluxDB format:
{
    test_id: 'test_123',
    url: 'https://example.com',
    group: 'example_com',
    browser: 'chrome',
    contentType: 'javascript',
    _measurement: 'pagexray',  // Add this for compatibility
    _field: 'requests',
    _value: 10,
    _time: '2026-02-03T...'
}
// NOTE: May need 3 records per content type (requests, contentSize, transferSize)
// OR restructure to single record with all fields
```

---

### **PHASE 4: Update Results Processor (Write to MySQL Only)** ✅ COMPLETED

**File:** `src/services/resultsProcessor.js` (MODIFY EXISTING)

**Current PageXray write code location:** Around line 192-220

**Strategy:** Write to MySQL only. InfluxDB writes deprecated as of 3 February 2026.

**Changes to make:**

1. **Add import at top:**
```javascript
const pagexrayDataService = require('./pagexrayDataService');
```

2. **Update PageXray processing section:**

**Current code (InfluxDB only):**
```javascript
if (contentTypes) {
    for (const contentType in contentTypes) {
        const data = contentTypes[contentType];
        const requests = data.requests;
        const transferSize = data.transferSize?.median ?? data.transferSize;
        const contentSize = data.contentSize?.median ?? data.contentSize;

        try {
            const point = new Point('pagexray')
                .tag('test_id', testRunId)
                .tag('url', url)
                .tag('group', pageFolder)
                .tag('contentType', contentType)
                .intField('requests', requests)
                .intField('transferSize', transferSize)
                .intField('contentSize', contentSize);
            writeApi.writePoint(point);
        } catch (err) {
            logDebug(`Error writing pagexray point ${contentType}: ${err.message}`);
        }
    }
}
```

**New code (MySQL only - InfluxDB deprecated):**
```javascript
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
```

**Note:** Following same pattern as Coach migration - write ONLY to MySQL. InfluxDB deprecated for PageXray as of 3 February 2026.

---

### **PHASE 5: Update Test Service (Read from MySQL Only)** ✅ COMPLETED

**File:** `src/services/testService.js` (MODIFY EXISTING)

**Current PageXray read code location:** Around line 96-120 (function `getPagexrayData`)

**Strategy:** Read from MySQL only. InfluxDB queries deprecated as of 3 February 2026.

**Changes to make:**

1. **Add import at top:**
```javascript
const pagexrayDataService = require('./pagexrayDataService');
```

2. **Replace getPagexrayData() function:**

**Current code (InfluxDB only):**
```javascript
async function getPagexrayData(testId) {
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["test_id"] == "${testId}")
        |> filter(fn: (r) => r["_measurement"] == "pagexray")
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
```

**New code (MySQL only - InfluxDB deprecated):**
```javascript
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
```

**Benefits:**
- Simplified code - single source of truth (MySQL)
- Faster queries without fallback overhead
- Consistent with Coach migration pattern

---

### **PHASE 6: Frontend Verification** ✅ NO CHANGES NEEDED

**File:** `public/js/detailed-report.js` (VERIFIED)

**Current PageXray processing:**
```javascript
// Line ~199-207
const pagexrayData = await fetch(`/api/tests/${testId}/pagexray`).then(r => r.json());
const pagexrayRecords = pagexrayData.filter(r => r._measurement === 'pagexray');
data.pagexray = extractPageXrayData(pagexrayRecords);
```

**Verification Results:**
✅ `pagexrayDataService.js` transformation includes `_measurement: 'pagexray'` in all records
✅ Frontend filter `r._measurement === 'pagexray'` will work correctly
✅ `extractPageXrayData()` function expects InfluxDB format with `_field` and `_value` - transformation provides this
✅ Data structure matches: `_field` (requests/contentSize/transferSize), `_value`, `contentType`

**Conclusion:**
NO frontend changes required. The transformation in `pagexrayDataService.js` already provides full InfluxDB-compatible format including:
- `_measurement: 'pagexray'` ✓
- `_field: 'requests'|'contentSize'|'transferSize'` ✓
- `_value` with numeric values ✓
- `contentType` tag ✓

**Note:** Frontend has redundant filtering (line 200 and line 302 in extractPageXrayData), but this doesn't cause issues since all records have `_measurement` field.

---

### **PHASE 7: Testing & Verification** ✅ COMPLETED

**Testing checklist:**

1. **Rebuild and restart containers:**
```bash
sudo docker-compose down
sudo docker volume rm sitespeeddocker_mysql-data  # Only if schema changed
sudo docker-compose up --build -d
```

2. **Verify MySQL table created:**
```bash
sudo docker exec mysql-db mysql -u sitespeed_user -psitespeed_pass_123 sitespeed -e "DESCRIBE pagexray_data;"
```

3. **Run a new test:**
```bash
# Via frontend or API
```

4. **Verify data written to MySQL:**
```bash
sudo docker exec mysql-db mysql -u sitespeed_user -psitespeed_pass_123 sitespeed -e "SELECT test_id, content_type, requests, content_size FROM pagexray_data LIMIT 10;"
```

5. **Verify API returns correct data:**
```bash
curl http://localhost:8081/api/tests/test_XXXXX/pagexray | jq
```

6. **Verify frontend displays PageXray tab:**
- Open detailed report in browser
- Click PageXray tab
- Verify charts and table display
- Check browser console for errors

7. **Verify InfluxDB no longer receives PageXray writes:**
```bash
# Query InfluxDB for new test_id - should return empty after migration
```

---

## **INFLUXDB DEPRECATION FOR PAGEXRAY**

### **What Changes:**

**Before Migration:**
```
PageXray Data Flow:
Sitespeed → resultsProcessor → InfluxDB → testService → Frontend
```

**After Migration (Final State):**
```
PageXray Data Flow:
Sitespeed → resultsProcessor → MySQL → testService → Frontend

InfluxDB Usage:
├─ visualMetrics: Still active ✓
├─ media_assets: Still active ✓
└─ pagexray: DEPRECATED ✗ (no longer written or read)
```

### **Verification Steps:**

1. **Confirm no PageXray writes to InfluxDB:**
```bash
# Run a new test, then query InfluxDB for the new test_id
# Should return EMPTY result for pagexray measurement
```

2. **Confirm all PageXray reads from MySQL:**
```bash
# Check testService.js - should only have MySQL query
# Check resultsProcessor.js - should only have MySQL write
```

3. **Frontend still works correctly:**
- PageXray tab displays data
- Charts render properly
- No console errors related to _measurement field

### **InfluxDB PageXray Data Retention:**

**Option 1: Keep historical data (RECOMMENDED)**
- Leave existing PageXray data in InfluxDB
- Useful for historical analysis
- No action needed
- Will be outdated after migration date

**Option 2: Archive and delete (OPTIONAL)**
- Export historical PageXray data from InfluxDB
- Store in backup files
- Delete from InfluxDB to free space
- **Command to delete:**
```bash
# Delete all pagexray measurement data (CAREFUL!)
influx delete --bucket sitespeed \
  --start 1970-01-01T00:00:00Z \
  --stop $(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --predicate '_measurement="pagexray"'
```

### **Documentation Updates After Migration:**

- ✅ Update CHANGES_LOG.md with PageXray migration entry
- ✅ Update PAGEXRAY_MYSQL_MIGRATION_PLAN.md status to "COMPLETED"
- ✅ Add note in system architecture docs about MySQL for PageXray
- ✅ Mark InfluxDB as "partial use" (only visualMetrics + media_assets)

---

## **DATA STRUCTURE COMPARISON**

### **InfluxDB Format (Current):**
```
Measurement: pagexray
├─ test_id: "test_123" (tag)
├─ url: "https://example.com" (tag)
├─ group: "example_com" (tag)
├─ browser: "chrome" (tag)
├─ contentType: "javascript" (tag)
├─ _field: "requests" → _value: 10
├─ _field: "contentSize" → _value: 500000
└─ _field: "transferSize" → _value: 450000
```
**Note:** 3 records per content type (one for each field)

### **MySQL Format (Proposed):**
```sql
test_id | url | group_name | browser | content_type | requests | content_size | transfer_size
--------|-----|------------|---------|--------------|----------|--------------|---------------
test_123| ... | example_com| chrome  | javascript   | 10       | 500000       | 450000
```
**Note:** 1 record per content type (all fields in single row)

---

## **IMPLEMENTATION ORDER**

**Recommended sequence:**

1. ✅ Phase 1: Infrastructure (Already complete)
2. ✅ Phase 2: Create MySQL schema in `config/mysql-init.sql` (COMPLETED)
3. ✅ Phase 3: Create `src/services/pagexrayDataService.js` (COMPLETED)
4. ✅ Phase 4: Update `src/services/resultsProcessor.js` (write to MySQL only) (COMPLETED)
5. ✅ Phase 5: Update `src/services/testService.js` (read from MySQL only) (COMPLETED)
6. ✅ Phase 6: Verify/update `public/js/detailed-report.js` (VERIFIED - no changes needed)
7. ✅ Phase 7: Test end-to-end and verify MySQL operation (COMPLETED)

**Estimated time per phase:**
- Phase 2: 10 minutes (schema design)
- Phase 3: 30-45 minutes (service implementation + testing)
- Phase 4: 15 minutes (resultsProcessor update)
- Phase 5: 10 minutes (testService update)
- Phase 6: 5-10 minutes (frontend verification)
- Phase 7: 20-30 minutes (full testing)

**Total estimated time:** ~2 hours

---

## **ROLLBACK PLAN**

**If migration fails or causes issues:**

1. **Revert resultsProcessor.js:**
   - Restore InfluxDB write code
   - Remove MySQL write code

2. **Revert testService.js:**
   - Restore InfluxDB read code
   - Remove MySQL read code

3. **Keep MySQL table:**
   - No need to drop table
   - Can be used later or cleaned up manually

4. **Restart containers:**
```bash
sudo docker-compose down
sudo docker-compose up -d
```

---

## **RISKS & MITIGATION**

### **Risk 1: Data transformation errors**
**Mitigation:** 
- Implement comprehensive error logging
- Test with multiple content types
- Add data validation in service layer

### **Risk 2: Frontend compatibility issues**
**Mitigation:**
- Ensure transformation matches InfluxDB format exactly
- Add `_measurement` field for filter compatibility
- Test frontend extensively before production

### **Risk 3: Performance degradation**
**Mitigation:**
- Add proper indexes on test_id and content_type
- Use connection pooling (already configured)
- Monitor query performance

### **Risk 4: NULL/0 value handling**
**Mitigation:**
- Default values in MySQL schema (DEFAULT 0)
- Handle NULL in transformation layer
- Test with edge cases (0 requests, missing content types)

---

## **SUCCESS CRITERIA**

Migration is successful when:

✅ MySQL table created and accessible  
✅ New test runs write PageXray data to MySQL only  
✅ InfluxDB no longer receives PageXray writes (deprecated 3 Feb 2026)  
✅ API endpoint returns correct data from MySQL  
✅ Frontend displays PageXray tab correctly  
✅ Charts render with proper data  
✅ No console errors in browser  
✅ All content types (html, css, js, image, font) display correctly  
✅ Zero-value content types handled properly  

**All criteria met as of 3 February 2026.**  

---

## **DIFFERENCES FROM COACH MIGRATION**

| Aspect | Coach Migration | PageXray Migration |
|--------|----------------|-------------------|
| Data complexity | Multiple fields per advice | 3 numeric fields per type |
| Records per test | 40-60 advice items | 5-10 content types |
| Unique constraint | test_id + advice_id + category | test_id + content_type |
| Field types | VARCHAR (title, description) | BIGINT (sizes), INT (requests) |
| Transformation | Complex (categories + advice) | Simple (flat structure) |
| Frontend filter | Removed `_measurement` filter | May need same fix |

---

## **POST-MIGRATION CLEANUP** (Future task)

**After successful migration and confidence in MySQL:**

1. ✅ **Stop writing to InfluxDB** (already done in Phase 4)
2. ✅ **Stop reading from InfluxDB** (already done in Phase 5)
3. ⏸ **Archive old PageXray data from InfluxDB** (optional - can keep for historical reference)
4. ⏸ **Update system documentation** (mark InfluxDB as deprecated for PageXray)
5. ⏸ **Monitor MySQL performance** for 1-2 weeks to ensure stability

**Current InfluxDB Usage After PageXray Migration:**
```
InfluxDB Measurements:
├─ visualMetrics: ✓ Active (Performance tab data)
├─ media_assets: ✓ Active (Video/screenshot references)
├─ coach_advice: ✗ Deprecated (migrated to MySQL - completed 3 Feb 2026)
└─ pagexray: ✗ Deprecated (migrated to MySQL - planned)
```

**MySQL Tables After PageXray Migration:**
```
MySQL Tables:
├─ test_runs: ✓ Test execution audit trail
├─ coach_advice: ✓ Coach guidance data (migrated 3 Feb 2026)
└─ pagexray_data: ✓ Content type breakdown data (planned)
```

---

**Document Version:** 2.0  
**Last Updated:** 3 February 2026  
**Status:** ✅ FULLY COMPLETED - All 7 Phases Complete, Production Ready
