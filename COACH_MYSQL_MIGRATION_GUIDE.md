# Coach Data MySQL Migration - Complete Documentation

**Project:** sitespeeddocker  
**Objective:** Migrate coach advice data from InfluxDB to MySQL  
**Current Status:** Phase 6.5 Complete (Coach Data + Test Runs Tracking)  
**Date Created:** 19 January 2026  
**Last Updated:** 21 January 2026

---

## **PHASE-BY-PHASE CHANGES**

### **PHASE 1: Add MySQL Docker Service**

**File:** `docker-compose.yml`

**Changes Made:**

1. **Added MySQL service** (after grafana service, before web service):
```yaml
mysql:
  image: mysql:8.0
  container_name: mysql-db
  ports:
    - "3306:3306"
  environment:
    MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root_password_123}
    MYSQL_DATABASE: ${MYSQL_DATABASE:-sitespeed}
    MYSQL_USER: ${MYSQL_USER:-sitespeed_user}
    MYSQL_PASSWORD: ${MYSQL_PASSWORD:-sitespeed_pass_123}
  volumes:
    - mysql-data:/var/lib/mysql
    - ./config/mysql-init.sql:/docker-entrypoint-initdb.d/init.sql
  networks:
    - sitespeed-net
  healthcheck:
    test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
    timeout: 20s
    retries: 10
```

2. **Updated web service depends_on:**
```yaml
# Before:
depends_on:
  - influxdb

# After:
depends_on:
  - influxdb
  - mysql
```

3. **Added MySQL env vars to web service** (after INFLUX_BUCKET vars):
```yaml
# MySQL Configuration
- MYSQL_HOST=${MYSQL_HOST:-mysql}
- MYSQL_USER=${MYSQL_USER:-sitespeed_user}
- MYSQL_PASSWORD=${MYSQL_PASSWORD:-sitespeed_pass_123}
- MYSQL_DATABASE=${MYSQL_DATABASE:-sitespeed}
```

4. **Added mysql-data volume** (in volumes section):
```yaml
volumes:
  influxdb-data:
  grafana-data:
  mysql-data:  # Added this line
```

---

### **PHASE 2: Create MySQL Configuration**

**File:** `config/mysql-init.sql` (NEW FILE)

**Created with:**
```sql
-- Coach Advice Table
CREATE TABLE IF NOT EXISTS coach_advice (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id VARCHAR(100) NOT NULL,
    url VARCHAR(500),
    group_name VARCHAR(100),
    advice_id VARCHAR(100),
    category_name VARCHAR(100),
    score INT,
    title TEXT,
    description LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_test_id (test_id),
    INDEX idx_created_at (created_at),
    INDEX idx_advice_id (advice_id),
    UNIQUE KEY unique_record (test_id, advice_id, category_name)
);

-- Test runs reference table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS test_runs (
    test_id VARCHAR(100) PRIMARY KEY,
    browser VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### **PHASE 3: Update Dependencies**

**File:** `package.json`

**Changes Made:**

1. **Added mysql2 dependency** (in dependencies object):
```json
// Before:
"dependencies": {
    "body-parser": "^1.20.2",
    "dotenv": "^16.5.0",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.2"
}

// After:
"dependencies": {
    "body-parser": "^1.20.2",
    "dotenv": "^16.5.0",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.2",
    "mysql2": "^3.6.0"
}
```

2. **Command to run:**
```bash
npm install
```

---

### **PHASE 4: Create MySQL Connection Module**

**File:** `src/config/mysql.js` (NEW FILE)

**Created with:**
```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'mysql',
    user: process.env.MYSQL_USER || 'sitespeed_user',
    password: process.env.MYSQL_PASSWORD || 'sitespeed_pass_123',
    database: process.env.MYSQL_DATABASE || 'sitespeed',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelayMs: 0
});

// Test connection on startup
pool.getConnection().then(conn => {
    console.log(`✓ MySQL connected successfully to ${process.env.MYSQL_DATABASE}`);
    conn.release();
}).catch(err => {
    console.error('✗ MySQL connection failed:', err.message);
});

module.exports = {
    pool
};
```

---

### **PHASE 5: Create Coach Data Service**

**File:** `src/services/coachDataService.js` (NEW FILE)

**Created with three functions:**

1. **saveCoachData()** - Inserts/updates coach data
2. **getCoachDataByTestId()** - Retrieves coach data (transforms to InfluxDB format)
3. **deleteCoachDataByTestId()** - COMMENTED OUT (for future use)

**Module exports:**
```javascript
module.exports = {
    saveCoachData,
    getCoachDataByTestId
    // deleteCoachDataByTestId  // UNCOMMENT WHEN READY TO USE
};
```

---

### **PHASE 6: Update Results Processor**

**File:** `src/services/resultsProcessor.js`

**Changes Made:**

1. **Added import** (line 4):
```javascript
const coachDataService = require('./coachDataService');
```

2. **Updated individual advice writing** (around line 140-165):

**Before:**
```javascript
if (score !== undefined) {
    try {
        const point = new Point('coach_advice')
            .tag('test_id', testRunId)
            .tag('url', url)
            .tag('group', pageFolder)
            .tag('adviceId', adviceId)
            .intField('score', score)
            .stringField('title', title || adviceId)
            .stringField('description', description || '');
        writeApi.writePoint(point);
    } catch (err) {
        logDebug(`Error writing coach point ${adviceId}: ${err.message}`);
    }
}
```

**After (writes to BOTH InfluxDB and MySQL):**
```javascript
if (score !== undefined) {
    try {
        // Write to InfluxDB (original)
        const point = new Point('coach_advice')
            .tag('test_id', testRunId)
            .tag('url', url)
            .tag('group', pageFolder)
            .tag('adviceId', adviceId)
            .intField('score', score)
            .stringField('title', title || adviceId)
            .stringField('description', description || '');
        writeApi.writePoint(point);
        
        // Write to MySQL (new - parallel)
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
        logDebug(`Error writing coach point ${adviceId}: ${err.message}`);
    }
}
```

3. **Updated category score writing** (around line 168-193):

**Before:**
```javascript
if (category.score !== undefined) {
    try {
        const point = new Point('coach_advice')
            .tag('test_id', testRunId)
            .tag('url', url)
            .tag('group', pageFolder)
            .tag('adviceId', categoryName)
            .intField('score', category.score);
        writeApi.writePoint(point);
    } catch (err) {
        logDebug(`Error writing coach category score ${categoryName}: ${err.message}`);
    }
}
```

**After (writes to BOTH InfluxDB and MySQL):**
```javascript
if (category.score !== undefined) {
    try {
        // Write to InfluxDB (original)
        const point = new Point('coach_advice')
            .tag('test_id', testRunId)
            .tag('url', url)
            .tag('group', pageFolder)
            .tag('adviceId', categoryName)
            .intField('score', category.score);
        writeApi.writePoint(point);
        
        // Write to MySQL (new - parallel)
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
        logDebug(`Error writing coach category score ${categoryName}: ${err.message}`);
    }
}
```

---

### **PHASE 6.5: Add Test Runs Tracking**

**Files:** `src/services/coachDataService.js`, `src/services/resultsProcessor.js`

**Changes Made:**

1. **Added to coachDataService.js** (new functions):

```javascript
// Save test run metadata
async function saveTestRun(testRunId, url, browser)

// Retrieve all test runs
async function getAllTestRuns()

// Retrieve specific test run by ID
async function getTestRunById(testId)
```

2. **Updated module.exports** in coachDataService.js:
```javascript
module.exports = {
    saveCoachData,
    getCoachDataByTestId,
    saveTestRun,           // NEW
    getAllTestRuns,        // NEW
    getTestRunById         // NEW
    // deleteCoachDataByTestId
};
```

3. **Updated resultsProcessor.js** (line 17-22):

**Added at the start of processAndStoreDetailedResults():**
```javascript
// Save test run metadata to MySQL (audit trail)
try {
    await coachDataService.saveTestRun(testRunId, url, browser);
    logDebug(`Saved test run metadata: ${testRunId}`);
} catch (err) {
    logDebug(`Error saving test run metadata: ${err.message}`);
}
```

**What this does:**
- ✅ Records every test execution in `test_runs` table
- ✅ Captures: test_id, browser, created_at timestamp
- ✅ Provides audit trail of when tests were run
- ✅ Separate from coach advice data

---

### **MODIFICATION: Remove URL Column from test_runs Table**

**Date:** 21 January 2026  
**Files Modified:**
- `config/mysql-init.sql` 
- `src/services/coachDataService.js`

**Changes Made:**

1. **Updated SQL Schema** - Removed `url` column:
```sql
-- BEFORE:
CREATE TABLE IF NOT EXISTS test_runs (
    test_id VARCHAR(100) PRIMARY KEY,
    url VARCHAR(500),           -- REMOVED
    browser VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AFTER:
CREATE TABLE IF NOT EXISTS test_runs (
    test_id VARCHAR(100) PRIMARY KEY,
    browser VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

2. **Updated coachDataService.js** - Removed unused url parameter:
```javascript
// BEFORE:
async function saveTestRun(testRunId, url, browser)

// AFTER:
async function saveTestRun(testRunId, browser)
```

3. **Updated SQL INSERT Statement**:
```javascript
// BEFORE:
INSERT INTO test_runs (test_id, url, browser)
VALUES (?, ?, ?)

// AFTER:
INSERT INTO test_runs (test_id, browser)
VALUES (?, ?)
```

**Reason:** The `url` was redundant since it's already stored in `coach_advice` table with full context. `test_runs` now serves as a lightweight audit trail with only test_id, browser, and timestamp.

**Note:** To apply changes to existing database, volume must be deleted and MySQL reinitialized:
```bash
sudo docker-compose down
sudo docker volume rm sitespeeddocker_mysql-data
sudo docker-compose up -d
```

---

### **PHASE 7: Update Test Service** [OPTIONAL - Currently Reverted]

**File:** `src/services/testService.js`

**Changes to make (when ready):**

1. **Add import** (after line 1):
```javascript
const coachDataService = require('./coachDataService');
```

2. **Update getCoachData() function** (around line 76-103):

**Replace the entire function with:**
```javascript
async function getCoachData(testId) {
    // Try MySQL first for faster reads
    try {
        const mysqlData = await coachDataService.getCoachDataByTestId(testId);
        if (mysqlData && mysqlData.length) {
            return mysqlData;
        }
    } catch (err) {
        console.error('MySQL coach fetch failed, falling back to Influx:', err.message);
    }

    // Fallback to InfluxDB if MySQL has no data or errors
    const fluxQuery = `
      from(bucket: "${influxBucket}")
        |> range(start: -30d)
        |> filter(fn: (r) => r["test_id"] == "${testId}")
        |> filter(fn: (r) => r["_measurement"] == "coach_advice")
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

---

### **PHASE 8: Testing & Verification** [NOT STARTED]

**Steps to execute:**

1. **Build and start containers:**
```bash
sudo docker compose down
sudo docker compose up --build -d
```

2. **Verify MySQL is running:**
```bash
sudo docker exec mysql-db mysql -u sitespeed_user -p sitespeed_pass_123 sitespeed -e "SHOW TABLES;"
```

3. **Run a test:**
- Use frontend at http://localhost:8081
- Or use API: `curl -X POST http://localhost:8081/api/tests/run ...`

4. **Verify data in MySQL:**
```bash
sudo docker exec mysql-db mysql -u sitespeed_user -p sitespeed_pass_123 sitespeed -e "SELECT * FROM coach_advice LIMIT 5;"
```

5. **Verify API endpoint:**
```bash
curl http://localhost:8081/api/tests/:testId/coach
```

---

## **REVERTING ALL CHANGES**

To revert the entire migration back to original state:

### **1. Remove new files:**
```bash
rm config/mysql-init.sql
rm src/config/mysql.js
rm src/services/coachDataService.js
```

### **2. Restore docker-compose.yml:**
- Remove entire `mysql` service block
- Remove `- mysql` from web service `depends_on`
- Remove MySQL env vars from web service
- Remove `mysql-data:` from volumes section

### **3. Restore package.json:**
- Remove `"mysql2": "^3.6.0"` from dependencies
- Run `npm install` to update node_modules

### **4. Restore resultsProcessor.js:**
- Remove import: `const coachDataService = require('./coachDataService');`
- Restore both coach writing sections to original InfluxDB-only code (remove MySQL writes)

### **5. Restore testService.js:**
- Remove import: `const coachDataService = require('./coachDataService');` (if added)
- Restore `getCoachData()` to original InfluxDB-only Flux query

### **6. Restart containers:**
```bash
sudo docker compose down
sudo docker compose up --build -d
```

---

## **KNOWN ISSUES (Not Fixed)**

### **Issue 1: Missing Comma in coachDataService.js**
- **Location:** Line 78
- **Problem:** Missing comma after `getCoachDataByTestId` in module.exports
- **Status:** User requested not to fix (can be fixed later)

### **Issue 2: Duplicate useDefaultTags in resultsProcessor.js**
- **Location:** Line 16
- **Problem:** `writeApi.useDefaultTags()` called twice consecutively
- **Status:** User requested not to fix (can be fixed later)

---

## **CURRENT SYSTEM STATE**

**Phase 6.5 Status (Current):**
```
Sitespeed → resultsProcessor
  ├─ Test Run Meta: Writes to MySQL test_runs table ✓
  ├─ Coach Data: Writes to InfluxDB + MySQL ✓
  ├─ Visual Metrics: Writes to InfluxDB ✓
  ├─ PageXray: Writes to InfluxDB ✓
  └─ Media Assets: Writes to InfluxDB ✓

MySQL Tables:
  ├─ test_runs: Audit trail of all tests ✓
  └─ coach_advice: All coach metrics ✓

testService.getCoachData()
  └─ Reads from InfluxDB only (Flux query)
```

**Phase 7 would add:**
```
testService.getCoachData()
  ├─ Try MySQL first ⏸
  └─ Fallback to InfluxDB ⏸
```

---

## **FILES SUMMARY**

| File | Status | Type |
|------|--------|------|
| `docker-compose.yml` | Modified | Existing |
| `package.json` | Modified | Existing |
| `config/mysql-init.sql` | **NEW** | Created |
| `src/config/mysql.js` | **NEW** | Created |
| `src/services/coachDataService.js` | **ENHANCED** | Modified |
| `src/services/resultsProcessor.js` | Modified | Existing |
| `src/services/testService.js` | Not Modified | Existing |

---

## **ENVIRONMENT VARIABLES**

### **MySQL (Docker env vars):**
```
MYSQL_ROOT_PASSWORD=root_password_123
MYSQL_DATABASE=sitespeed
MYSQL_USER=sitespeed_user
MYSQL_PASSWORD=sitespeed_pass_123
```

### **Node.js env vars (passed to web container):**
```
MYSQL_HOST=mysql
MYSQL_USER=sitespeed_user
MYSQL_PASSWORD=sitespeed_pass_123
MYSQL_DATABASE=sitespeed
```

---

## **ROLLBACK CHECKLIST**

- [ ] Delete `config/mysql-init.sql`
- [ ] Delete `src/config/mysql.js`
- [ ] Delete `src/services/coachDataService.js`
- [ ] Update `docker-compose.yml` (remove mysql service, update web config)
- [ ] Update `package.json` (remove mysql2, run npm install)
- [ ] Update `src/services/resultsProcessor.js` (remove MySQL writes, revert to InfluxDB only)
- [ ] Update `src/services/testService.js` (remove MySQL reads if added)
- [ ] Rebuild Docker: `sudo docker compose down && sudo docker compose up --build -d`

---

**Document Version:** 1.0  
**Last Updated:** 19 January 2026  
**Status:** Ready for Phase 7-8 or Rollback
