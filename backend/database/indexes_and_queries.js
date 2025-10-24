/**
 * MongoDB Indexes and Query Examples for Extended Offer Schema
 * 
 * This file contains comprehensive index definitions and query examples
 * for efficient querying of offers with schedule and smartRules subdocuments.
 */

// ============================================================================
// INDEX DEFINITIONS
// ============================================================================

const indexDefinitions = {
  // Basic indexes for core fields
  basic: [
    { offer_id: 1 }, // Unique offer identifier
    { campaign_id: 1 }, // Campaign lookup
    { status: 1 }, // Filter by offer status
    { network: 1 }, // Network-specific queries
    { category: 1 }, // Browse by category
    { created_by: 1 }, // User's offers
    { is_active: 1 }, // Active/inactive filter
    { payout: -1 }, // Sort by payout (descending)
    { createdAt: -1 }, // Sort by creation date
    { hits: -1 } // Sort by popularity
  ],

  // Schedule-specific indexes
  schedule: [
    { 'schedule.startAt': 1 }, // Find offers starting at specific time
    { 'schedule.endAt': 1 }, // Find offers ending at specific time
    { 'schedule.status': 1 }, // Active/paused schedules
    { 'schedule.isRecurring': 1 }, // Recurring vs one-time offers
    { 'schedule.recurringDays': 1 } // Specific day targeting
  ],

  // Smart Rules indexes
  smartRules: [
    { 'smartRules.active': 1 }, // Active rules only
    { 'smartRules.type': 1 }, // Rule type filtering
    { 'smartRules.priority': 1 }, // Priority ordering
    { 'smartRules.geo': 1 }, // Geographic targeting
    { 'smartRules.percentage': -1 } // Traffic split percentage
  ],

  // Compound indexes for complex queries
  compound: [
    // Active offers with active schedules
    { status: 1, 'schedule.status': 1, is_active: 1 },
    
    // Time-based offer queries
    { 'schedule.startAt': 1, 'schedule.endAt': 1, status: 1 },
    
    // Geographic and category targeting
    { countries: 1, category: 1, status: 1 },
    
    // Network and payout optimization
    { network: 1, payout: -1, status: 1 },
    
    // User-specific active offers
    { created_by: 1, status: 1, is_active: 1 },
    
    // Smart rules by geo and type
    { 'smartRules.geo': 1, 'smartRules.type': 1, 'smartRules.active': 1 },
    
    // Scheduled offers by time and status
    { 'schedule.startAt': 1, status: 1, 'schedule.status': 1 },
    
    // Category and device targeting
    { category: 1, device_targeting: 1, status: 1 },
    
    // Payout and conversion optimization
    { payout: -1, conversion_goal: 1, status: 1 }
  ],

  // Text search index
  textSearch: {
    name: 'text',
    description: 'text',
    campaign_id: 'text',
    offer_id: 'text',
    keywords: 'text'
  },

  // TTL (Time To Live) indexes for cleanup
  ttl: [
    // Auto-remove expired offers after 30 days
    {
      index: { 'schedule.endAt': 1 },
      options: {
        expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
        partialFilterExpression: { 'schedule.endAt': { $exists: true } }
      }
    }
  ]
};

// ============================================================================
// QUERY EXAMPLES
// ============================================================================

const queryExamples = {
  
  // 1. Find currently active offers (considering schedule)
  findCurrentlyActiveOffers: () => {
    const now = new Date();
    return {
      status: 'Active',
      is_active: true,
      'schedule.status': 'Active',
      $or: [
        { 'schedule.startAt': { $exists: false } },
        { 'schedule.startAt': { $lte: now } }
      ],
      $and: [
        {
          $or: [
            { 'schedule.endAt': { $exists: false } },
            { 'schedule.endAt': { $gte: now } }
          ]
        }
      ]
    };
  },

  // 2. Find offers starting in the next 24 hours
  findOffersStartingSoon: () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      'schedule.startAt': {
        $gte: now,
        $lte: tomorrow
      },
      status: 'Active'
    };
  },

  // 3. Find offers expiring in the next 7 days
  findOffersExpiringSoon: () => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      'schedule.endAt': {
        $gte: now,
        $lte: nextWeek
      },
      status: 'Active'
    };
  },

  // 4. Find offers with active GEO-based smart rules for specific country
  findGeoTargetedOffers: (countryCode) => {
    return {
      status: 'Active',
      'smartRules': {
        $elemMatch: {
          type: 'GEO',
          geo: countryCode,
          active: true
        }
      }
    };
  },

  // 5. Find offers with backup rules available
  findOffersWithBackup: () => {
    return {
      status: 'Active',
      'smartRules': {
        $elemMatch: {
          type: 'Backup',
          active: true
        }
      }
    };
  },

  // 6. Find recurring offers active on specific day
  findRecurringOffersForDay: (dayName) => {
    return {
      status: 'Active',
      'schedule.isRecurring': true,
      'schedule.recurringDays': dayName,
      'schedule.status': 'Active'
    };
  },

  // 7. Find high-payout offers with active schedules
  findHighPayoutActiveOffers: (minPayout = 5.0) => {
    return {
      status: 'Active',
      payout: { $gte: minPayout },
      'schedule.status': 'Active',
      is_active: true
    };
  },

  // 8. Find offers by network with smart rules
  findNetworkOffersWithRules: (networkName) => {
    return {
      network: networkName,
      status: 'Active',
      'smartRules.0': { $exists: true }, // Has at least one smart rule
      'smartRules.active': true
    };
  },

  // 9. Complex aggregation: Offers with rule statistics
  getOffersWithRuleStats: () => {
    return [
      {
        $match: {
          status: 'Active',
          is_active: true
        }
      },
      {
        $addFields: {
          totalRules: { $size: '$smartRules' },
          activeRules: {
            $size: {
              $filter: {
                input: '$smartRules',
                cond: { $eq: ['$$this.active', true] }
              }
            }
          },
          hasGeoRules: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$smartRules',
                    cond: { $eq: ['$$this.type', 'GEO'] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $sort: { payout: -1, activeRules: -1 }
      }
    ];
  },

  // 10. Find offers needing attention (expiring soon or no rules)
  findOffersNeedingAttention: () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return {
      status: 'Active',
      $or: [
        // Expiring soon
        {
          'schedule.endAt': {
            $exists: true,
            $lte: nextWeek
          }
        },
        // No smart rules
        {
          $or: [
            { smartRules: { $exists: false } },
            { smartRules: { $size: 0 } },
            { 'smartRules.active': { $ne: true } }
          ]
        },
        // Schedule paused
        { 'schedule.status': 'Paused' }
      ]
    };
  }
};

// ============================================================================
// AGGREGATION PIPELINES
// ============================================================================

const aggregationPipelines = {
  
  // Performance analytics by smart rule type
  smartRulePerformance: [
    {
      $match: {
        status: 'Active',
        'smartRules.active': true
      }
    },
    {
      $unwind: '$smartRules'
    },
    {
      $match: {
        'smartRules.active': true
      }
    },
    {
      $group: {
        _id: '$smartRules.type',
        totalOffers: { $sum: 1 },
        avgPercentage: { $avg: '$smartRules.percentage' },
        avgCap: { $avg: '$smartRules.cap' },
        totalHits: { $sum: '$hits' }
      }
    },
    {
      $sort: { totalOffers: -1 }
    }
  ],

  // Schedule utilization report
  scheduleUtilization: [
    {
      $match: {
        'schedule': { $exists: true }
      }
    },
    {
      $group: {
        _id: '$schedule.status',
        count: { $sum: 1 },
        avgPayout: { $avg: '$payout' },
        totalHits: { $sum: '$hits' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ],

  // Geographic distribution of smart rules
  geoDistribution: [
    {
      $match: {
        'smartRules.geo': { $exists: true, $ne: [] }
      }
    },
    {
      $unwind: '$smartRules'
    },
    {
      $unwind: '$smartRules.geo'
    },
    {
      $group: {
        _id: '$smartRules.geo',
        offerCount: { $sum: 1 },
        ruleTypes: { $addToSet: '$smartRules.type' },
        avgPercentage: { $avg: '$smartRules.percentage' }
      }
    },
    {
      $sort: { offerCount: -1 }
    }
  ]
};

// ============================================================================
// INDEX CREATION SCRIPT
// ============================================================================

async function createAllIndexes(db) {
  const collection = db.collection('offers');
  const results = [];

  try {
    console.log('Creating basic indexes...');
    for (const index of indexDefinitions.basic) {
      try {
        await collection.createIndex(index);
        results.push({ index, status: 'created' });
      } catch (error) {
        results.push({ index, status: 'error', error: error.message });
      }
    }

    console.log('Creating schedule indexes...');
    for (const index of indexDefinitions.schedule) {
      try {
        await collection.createIndex(index);
        results.push({ index, status: 'created' });
      } catch (error) {
        results.push({ index, status: 'error', error: error.message });
      }
    }

    console.log('Creating smart rules indexes...');
    for (const index of indexDefinitions.smartRules) {
      try {
        await collection.createIndex(index);
        results.push({ index, status: 'created' });
      } catch (error) {
        results.push({ index, status: 'error', error: error.message });
      }
    }

    console.log('Creating compound indexes...');
    for (const index of indexDefinitions.compound) {
      try {
        await collection.createIndex(index);
        results.push({ index, status: 'created' });
      } catch (error) {
        results.push({ index, status: 'error', error: error.message });
      }
    }

    console.log('Creating text search index...');
    try {
      await collection.createIndex(indexDefinitions.textSearch);
      results.push({ index: indexDefinitions.textSearch, status: 'created' });
    } catch (error) {
      results.push({ index: indexDefinitions.textSearch, status: 'error', error: error.message });
    }

    console.log('Creating TTL indexes...');
    for (const ttlIndex of indexDefinitions.ttl) {
      try {
        await collection.createIndex(ttlIndex.index, ttlIndex.options);
        results.push({ index: ttlIndex.index, status: 'created' });
      } catch (error) {
        results.push({ index: ttlIndex.index, status: 'error', error: error.message });
      }
    }

    console.log(`✅ Index creation completed. ${results.length} indexes processed.`);
    return results;

  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

module.exports = {
  indexDefinitions,
  queryExamples,
  aggregationPipelines,
  createAllIndexes
};
