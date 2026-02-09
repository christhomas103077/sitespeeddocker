/**
 * Transforms flat InfluxDB coach advice records into hierarchical structure
 * Maps adviceIds to categories and organizes by score
 */

// Category mapping: which adviceIds belong to which category
const ADVICE_CATEGORY_MAP = {
  // Performance category
  performance: [
    'assetsRedirects', 'avoidRenderBlocking', 'avoidScalingImages', 'cacheHeaders',
    'cacheHeadersLong', 'compressAssets', 'connectionKeepAlive', 'cpuTimeSpentInRendering',
    'cpuTimeSpentInScripting', 'cssPrint', 'cssSize', 'documentRedirect', 'favicon',
    'fewFonts', 'fewRequestsPerDomain', 'firstContentfulPaint', 'googleTagManager',
    'headerSize', 'imageSize', 'inlineCss', 'javascriptSize', 'jquery', 'largestContentfulPaint',
    'longHeaders', 'longTasks', 'manyHeaders', 'mimeTypes', 'optimalCssSize', 'pageSize',
    'privateAssets', 'responseOk', 'spof', 'spdy'
  ],
  
  // Privacy category
  privacy: [
    'amp', 'contentSecurityPolicyHeader', 'facebook', 'fingerprint', 'ga', 'googleReCaptcha',
    'https', 'mixedContent', 'referrerPolicyHeader', 'strictTransportSecurityHeader',
    'surveillance', 'thirdParty', 'thirdPartyCookies', 'thirdPartyPrivacy', 'youtube'
  ],
  
  // Best Practice category
  bestpractice: [
    'charset', 'cumulativeLayoutShift', 'doctype', 'language', 'metaDescription',
    'optimizely', 'pageTitle', 'unnecessaryHeaders', 'url'
  ]
};

/**
 * Gets the category for a given adviceId
 * @param {String} adviceId - The advice ID
 * @returns {String|null} Category name or null if not found
 */
function getCategoryForAdviceId(adviceId) {
  for (const [category, adviceIds] of Object.entries(ADVICE_CATEGORY_MAP)) {
    if (adviceIds.includes(adviceId)) {
      return category;
    }
  }
  return null;
}

/**
 * Transforms flat coach data into hierarchical structure
 * Handles both single-field records and multi-field records
 * @param {Array} records - Raw coach advice records from InfluxDB
 * @returns {Object} Structured coach_metrics object
 */
function transformCoachData(records) {
  console.log('transformCoachData called with', records.length, 'records');
  
  if (!Array.isArray(records) || records.length === 0) {
    return {
      bestpractice: { score: 0, adviceList: {}, fullMark: { list: [] } },
      performance: { score: 0, adviceList: {}, fullMark: { list: [] } },
      privacy: { score: 0, adviceList: {}, fullMark: { list: [] } }
    };
  }

  const adviceMap = {};
  const categoryScores = { performance: 0, privacy: 0, bestpractice: 0 };
  
  records.forEach(record => {
    const adviceId = record.adviceId;
    if (!adviceId) return;
    
    // Initialize empty object if not exists
    if (!adviceMap[adviceId]) {
      adviceMap[adviceId] = {
        score: 0,
        title: '',
        description: ''
      };
    }
    
    // Handle multi-record format (each field in separate record with _field property)
    if (record._field) {
      if (record._field === 'score') {
        adviceMap[adviceId].score = parseInt(record._value) || 0;
      } else if (record._field === 'title') {
        adviceMap[adviceId].title = record._value || adviceId;
      } else if (record._field === 'description') {
        adviceMap[adviceId].description = record._value || '';
      }
    } else {
      // Handle single-record format (all fields in one record)
      if (record.score !== undefined) adviceMap[adviceId].score = parseInt(record.score) || 0;
      if (record.title !== undefined) adviceMap[adviceId].title = record.title || adviceId;
      if (record.description !== undefined) adviceMap[adviceId].description = record.description || '';
    }
    
    // Track category scores (when adviceId equals category name)
    if (record.adviceId === 'performance') {
      const scoreVal = record._field === 'score' ? record._value : record.score;
      if (scoreVal !== undefined) categoryScores.performance = parseInt(scoreVal) || 0;
    } else if (record.adviceId === 'privacy') {
      const scoreVal = record._field === 'score' ? record._value : record.score;
      if (scoreVal !== undefined) categoryScores.privacy = parseInt(scoreVal) || 0;
    } else if (record.adviceId === 'bestpractice') {
      const scoreVal = record._field === 'score' ? record._value : record.score;
      if (scoreVal !== undefined) categoryScores.bestpractice = parseInt(scoreVal) || 0;
    }
  });
  
  console.log('Unique adviceIds found:', Object.keys(adviceMap).length);
  
  const coachMetrics = {
    bestpractice: { score: categoryScores.bestpractice || 0, adviceList: {}, fullMark: { list: [] } },
    performance: { score: categoryScores.performance || 0, adviceList: {}, fullMark: { list: [] } },
    privacy: { score: categoryScores.privacy || 0, adviceList: {}, fullMark: { list: [] } }
  };
  
  // Process individual advice items
  Object.entries(adviceMap).forEach(([adviceId, advice]) => {
    // Skip if it's a category itself (performance, privacy, bestpractice)
    if (['performance', 'privacy', 'bestpractice'].includes(adviceId)) {
      return;
    }
    
    const category = getCategoryForAdviceId(adviceId);
    if (!category) {
      console.warn('No category found for adviceId:', adviceId);
      return;
    }
    
    const score = parseInt(advice.score) || 0;
    const title = advice.title || '';
    const description = advice.description || '';
    
    // Add all items to adviceList (don't separate by score)
    coachMetrics[category].adviceList[adviceId] = {
      advice: description,
      title: title,
      score: score
    };
  });
  
  console.log('Final coach metrics:', coachMetrics);
  console.log('Performance items:', Object.keys(coachMetrics.performance.adviceList).length);
  console.log('Privacy items:', Object.keys(coachMetrics.privacy.adviceList).length);
  console.log('Best Practice items:', Object.keys(coachMetrics.bestpractice.adviceList).length);
  
  return coachMetrics;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { transformCoachData };
}

// Expose for browser usage (non-bundled)
if (typeof window !== 'undefined') {
  window.transformCoachData = transformCoachData;
}
