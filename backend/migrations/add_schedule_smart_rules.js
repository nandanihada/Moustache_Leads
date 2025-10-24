/**
 * Migration Script: Add Schedule and Smart Rules to Existing Offers
 * 
 * This script migrates existing offers in the MongoDB collection to include
 * the new schedule and smartRules subdocuments while preserving existing data.
 */

const { MongoClient } = require('mongodb');

// Configuration
const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/';
const DATABASE_NAME = 'ascend_db';
const COLLECTION_NAME = 'offers';

async function migrateOffers() {
  let client;
  
  try {
    console.log('🔄 Starting migration: Add Schedule and Smart Rules to offers...');
    
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    // Get count of offers to migrate
    const totalOffers = await collection.countDocuments({});
    console.log(`📊 Found ${totalOffers} offers to migrate`);
    
    if (totalOffers === 0) {
      console.log('ℹ️  No offers found to migrate');
      return;
    }
    
    // Migration operations
    const bulkOps = [];
    
    // Find all offers that don't have the new schema fields
    const offersToMigrate = await collection.find({
      $or: [
        { schedule: { $exists: false } },
        { smartRules: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`🔧 Migrating ${offersToMigrate.length} offers...`);
    
    for (const offer of offersToMigrate) {
      const updateDoc = {
        $set: {},
        $unset: {}
      };
      
      // Add schedule subdocument if it doesn't exist
      if (!offer.schedule) {
        updateDoc.$set.schedule = {
          startAt: offer.start_date ? new Date(offer.start_date) : null,
          endAt: offer.expiration_date ? new Date(offer.expiration_date) : null,
          recurringDays: [],
          status: 'Active',
          timezone: offer.timezone || 'UTC',
          isRecurring: false
        };
        
        // Remove old fields after migration
        if (offer.start_date) updateDoc.$unset.start_date = '';
        if (offer.expiration_date) updateDoc.$unset.expiration_date = '';
      }
      
      // Add smartRules array if it doesn't exist
      if (!offer.smartRules) {
        const smartRules = [];
        
        // Migrate existing smart rule fields to new structure
        if (offer.random_redirect && offer.redirect_urls && offer.redirect_urls.length > 0) {
          offer.redirect_urls.forEach((url, index) => {
            smartRules.push({
              type: 'Rotation',
              url: url,
              geo: offer.countries || [],
              percentage: Math.floor(100 / offer.redirect_urls.length),
              cap: 0,
              priority: index + 1,
              active: true,
              createdAt: new Date()
            });
          });
        }
        
        // Add GEO redirect rules if they exist
        if (offer.geo_redirect_rules && Object.keys(offer.geo_redirect_rules).length > 0) {
          Object.entries(offer.geo_redirect_rules).forEach(([country, url], index) => {
            smartRules.push({
              type: 'GEO',
              url: url,
              geo: [country.toUpperCase()],
              percentage: 100,
              cap: 0,
              priority: smartRules.length + index + 1,
              active: true,
              createdAt: new Date()
            });
          });
        }
        
        // Add backup rule using main target_url
        if (offer.target_url) {
          smartRules.push({
            type: 'Backup',
            url: offer.target_url,
            geo: offer.countries || [],
            percentage: 100,
            cap: 0,
            priority: smartRules.length + 1,
            active: true,
            createdAt: new Date()
          });
        }
        
        updateDoc.$set.smartRules = smartRules;
        
        // Remove old smart rule fields
        if (offer.random_redirect !== undefined) updateDoc.$unset.random_redirect = '';
        if (offer.redirect_urls) updateDoc.$unset.redirect_urls = '';
        if (offer.geo_redirect_rules) updateDoc.$unset.geo_redirect_rules = '';
        if (offer.rotation_enabled !== undefined) updateDoc.$unset.rotation_enabled = '';
        if (offer.leads_filter_enabled !== undefined) updateDoc.$unset.leads_filter_enabled = '';
        if (offer.rotation_rules) updateDoc.$unset.rotation_rules = '';
      }
      
      // Add migration timestamp
      updateDoc.$set.migratedAt = new Date();
      updateDoc.$set.schemaVersion = '2.0';
      
      // Only add to bulk operations if there are changes
      if (Object.keys(updateDoc.$set).length > 0 || Object.keys(updateDoc.$unset).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: offer._id },
            update: updateDoc
          }
        });
      }
    }
    
    // Execute bulk operations
    if (bulkOps.length > 0) {
      console.log(`📝 Executing ${bulkOps.length} update operations...`);
      const result = await collection.bulkWrite(bulkOps);
      console.log(`✅ Migration completed successfully!`);
      console.log(`   - Modified: ${result.modifiedCount} offers`);
      console.log(`   - Matched: ${result.matchedCount} offers`);
    } else {
      console.log('ℹ️  No offers needed migration');
    }
    
    // Create indexes for new fields
    console.log('🔍 Creating indexes for new fields...');
    
    const indexes = [
      { 'schedule.startAt': 1 },
      { 'schedule.endAt': 1 },
      { 'schedule.status': 1 },
      { 'smartRules.active': 1 },
      { 'smartRules.type': 1 },
      { 'smartRules.priority': 1 },
      { status: 1, 'schedule.status': 1 },
      { 'schedule.startAt': 1, 'schedule.endAt': 1 }
    ];
    
    for (const index of indexes) {
      try {
        await collection.createIndex(index);
        console.log(`   ✅ Created index: ${JSON.stringify(index)}`);
      } catch (error) {
        if (error.code === 85) {
          console.log(`   ℹ️  Index already exists: ${JSON.stringify(index)}`);
        } else {
          console.log(`   ❌ Failed to create index ${JSON.stringify(index)}: ${error.message}`);
        }
      }
    }
    
    // Validation: Check migration results
    console.log('🔍 Validating migration results...');
    const migratedCount = await collection.countDocuments({
      schedule: { $exists: true },
      smartRules: { $exists: true },
      schemaVersion: '2.0'
    });
    
    console.log(`✅ Validation complete: ${migratedCount} offers have new schema`);
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   - Total offers: ${totalOffers}`);
    console.log(`   - Migrated offers: ${migratedCount}`);
    console.log(`   - Success rate: ${((migratedCount / totalOffers) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Rollback function (in case migration needs to be reversed)
async function rollbackMigration() {
  let client;
  
  try {
    console.log('🔄 Starting rollback: Remove Schedule and Smart Rules...');
    
    client = new MongoClient(MONGO_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    const result = await collection.updateMany(
      { schemaVersion: '2.0' },
      {
        $unset: {
          schedule: '',
          smartRules: '',
          migratedAt: '',
          schemaVersion: ''
        }
      }
    );
    
    console.log(`✅ Rollback completed: ${result.modifiedCount} offers restored`);
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    rollbackMigration()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    migrateOffers()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

module.exports = {
  migrateOffers,
  rollbackMigration
};
