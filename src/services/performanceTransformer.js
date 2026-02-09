/**
 * Performance Data Transformer
 * Transforms raw InfluxDB visualMetrics records into structured performance metrics object
 */

/**
 * Transform raw InfluxDB visualMetrics records into performance metrics object
 * 
 * @param {Array} records - Array of raw InfluxDB records with visualMetrics measurement
 * @returns {Object} Structured metrics object with performance data
 * 
 * @example
 * Input: [
 *   { metricName: 'firstPaint', _field: 'value', _value: 287 },
 *   { metricName: 'SpeedIndex', _field: 'value', _value: 6656 },
 *   ...
 * ]
 * 
 * Output: {
 *   firstPaint: 287,
 *   SpeedIndex: 6656,
 *   ...
 * }
 */
function transformPerformanceRecords(records) {
    const metrics = {};
    
    // List of all supported performance metric names
    const metricNames = [
        'firstPaint',
        'firstContentfulPaint',
        'largestContentfulPaint',
        'SpeedIndex',
        'ttfb',
        'domInteractive',
        'pageLoadTime',
        'fullyLoaded',
        'FirstVisualChange',
        'LastVisualChange',
        'TotalBlockingTime'
    ];
    
    // Initialize all metrics with null
    // This ensures consistent object structure even if some metrics are missing
    metricNames.forEach(name => {
        metrics[name] = null;
    });
    
    // Map records by metricName and extract values
    // Only process records where _field === 'value' (the actual metric value)
    records.forEach(record => {
        const metricName = record.metricName;
        const isValidMetric = metricNames.includes(metricName);
        const isValueField = record._field === 'value';
        
        if (isValidMetric && isValueField) {
            // Store the numeric value from InfluxDB
            metrics[metricName] = record._value;
        }
    });
    
    return metrics;
}

/**
 * Validate if transformed metrics object is valid
 * 
 * @param {Object} metrics - Transformed metrics object
 * @returns {boolean} True if metrics object has at least one non-null value
 */
function isValidMetricsObject(metrics) {
    if (!metrics || typeof metrics !== 'object') {
        return false;
    }
    
    return Object.values(metrics).some(value => value !== null);
}

/**
 * Get missing metrics from a metrics object
 * Useful for debugging or logging incomplete data
 * 
 * @param {Object} metrics - Transformed metrics object
 * @returns {Array} Array of metric names that are null
 */
function getMissingMetrics(metrics) {
    return Object.entries(metrics)
        .filter(([key, value]) => value === null)
        .map(([key]) => key);
}

/**
 * Format metrics for display in logs
 * Converts numeric values to readable format with units
 * 
 * @param {Object} metrics - Transformed metrics object
 * @returns {Object} Formatted metrics with display values
 */
function formatMetricsForDisplay(metrics) {
    const formatted = {};
    
    const displayFormats = {
        'firstPaint': (v) => v !== null ? `${v} ms` : 'N/A',
        'firstContentfulPaint': (v) => v !== null ? `${v} ms` : 'N/A',
        'largestContentfulPaint': (v) => v !== null ? `${v} ms` : 'N/A',
        'SpeedIndex': (v) => v !== null ? `${v} ms` : 'N/A',
        'ttfb': (v) => v !== null ? `${v} ms` : 'N/A',
        'domInteractive': (v) => v !== null ? `${v} ms` : 'N/A',
        'pageLoadTime': (v) => v !== null ? `${v} ms` : 'N/A',
        'fullyLoaded': (v) => v !== null ? `${v} ms` : 'N/A',
        'FirstVisualChange': (v) => v !== null ? `${v} ms` : 'N/A',
        'LastVisualChange': (v) => v !== null ? `${v} ms` : 'N/A',
        'TotalBlockingTime': (v) => v !== null ? `${v} ms` : 'N/A'
    };
    
    Object.entries(metrics).forEach(([key, value]) => {
        const formatter = displayFormats[key];
        formatted[key] = formatter ? formatter(value) : value;
    });
    
    return formatted;
}

module.exports = {
    transformPerformanceRecords,
    isValidMetricsObject,
    getMissingMetrics,
    formatMetricsForDisplay
};
