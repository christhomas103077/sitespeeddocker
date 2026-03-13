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
    UNIQUE KEY unique_record (test_id, group_name, advice_id, category_name)
);

-- Test runs reference table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS test_runs (
    test_id VARCHAR(100) PRIMARY KEY,
    browser VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    UNIQUE KEY unique_record (test_id, group_name, content_type)
);

-- Coach Scores Table (for immediate display on Summary tab)
CREATE TABLE IF NOT EXISTS coach_scores (
    test_id VARCHAR(100),
    url VARCHAR(500),
    group_name VARCHAR(100) NOT NULL,
    performance_score INT,
    privacy_score INT,
    bestpractice_score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (test_id, group_name),
    INDEX idx_created_at (created_at)
);

-- Performance Metrics Table (visualMetrics from InfluxDB)
-- Migrated from InfluxDB: 10 February 2026
CREATE TABLE IF NOT EXISTS performance_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_id VARCHAR(100) NOT NULL,
    url VARCHAR(500),
    group_name VARCHAR(100),
    browser VARCHAR(50),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DOUBLE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_test_id (test_id),
    INDEX idx_metric_name (metric_name),
    INDEX idx_created_at (created_at),
    INDEX idx_test_metric (test_id, metric_name),
    UNIQUE KEY unique_record (test_id, group_name, metric_name)
);