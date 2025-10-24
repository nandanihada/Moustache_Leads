/**
 * Extended MongoDB Offer Schema with Schedule and Smart Rules
 * Using Mongoose for schema definition and validation
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Smart Rule subdocument schema
const smartRuleSchema = new Schema({
  type: {
    type: String,
    enum: ['Backup', 'Rotation', 'GEO', 'Time'],
    required: true,
    default: 'Backup'
  },
  url: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL must be a valid HTTP/HTTPS URL'
    }
  },
  geo: [{
    type: String,
    uppercase: true,
    minlength: 2,
    maxlength: 2
  }],
  percentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  cap: {
    type: Number,
    min: 0,
    default: 0
  },
  priority: {
    type: Number,
    min: 1,
    default: 1
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  _id: true,
  timestamps: false
});

// Schedule subdocument schema
const scheduleSchema = new Schema({
  startAt: {
    type: Date,
    required: false,
    index: true
  },
  endAt: {
    type: Date,
    required: false,
    index: true,
    validate: {
      validator: function(v) {
        return !this.startAt || !v || v > this.startAt;
      },
      message: 'End date must be after start date'
    }
  },
  recurringDays: [{
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  }],
  status: {
    type: String,
    enum: ['Active', 'Paused'],
    default: 'Active',
    index: true
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  isRecurring: {
    type: Boolean,
    default: false
  }
}, {
  _id: false,
  timestamps: false
});

// Main Offer Schema (Extended)
const offerSchema = new Schema({
  // SECTION 1: OFFER IDENTIFICATION
  offer_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  campaign_id: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['Finance', 'Gaming', 'Dating', 'Health', 'Education', 'Shopping', 'Travel', 'General'],
    default: 'General',
    index: true
  },
  offer_type: {
    type: String,
    enum: ['CPA', 'CPL', 'CPS', 'CPI', 'CPC'],
    default: 'CPA',
    index: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Pending', 'Paused', 'Hidden'],
    default: 'Pending',
    index: true
  },
  tags: [String],
  keywords: [String],

  // SECTION 2: TARGETING RULES
  countries: [{
    type: String,
    uppercase: true,
    minlength: 2,
    maxlength: 2
  }],
  languages: [String],
  device_targeting: {
    type: String,
    enum: ['all', 'mobile', 'desktop'],
    default: 'all'
  },
  os_targeting: [String],
  browser_targeting: [String],
  carrier_targeting: [String],
  connection_type: {
    type: String,
    enum: ['wifi', 'mobile', 'all'],
    default: 'all'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },

  // SECTION 3: PAYOUT & FINANCE
  payout: {
    type: Number,
    required: true,
    min: 0,
    index: true
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  revenue: Number,
  payout_type: {
    type: String,
    enum: ['fixed', 'tiered', 'percentage'],
    default: 'fixed'
  },
  daily_cap: Number,
  weekly_cap: Number,
  monthly_cap: Number,
  auto_pause_on_cap: {
    type: Boolean,
    default: false
  },
  cap_alert_emails: [String],

  // SECTION 4: TRACKING SETUP
  network: {
    type: String,
    required: true,
    index: true
  },
  target_url: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Target URL must be a valid HTTP/HTTPS URL'
    }
  },
  preview_url: String,
  tracking_domain: {
    type: String,
    default: 'main'
  },
  tracking_protocol: {
    type: String,
    enum: ['pixel', 's2s', 'api'],
    default: 'pixel'
  },
  postback_url: String,
  hash_code: String,
  click_expiration: {
    type: Number,
    default: 7
  },
  conversion_window: {
    type: Number,
    default: 30
  },
  allowed_traffic_sources: [String],
  blocked_traffic_sources: [String],
  duplicate_conversion_rule: {
    type: String,
    enum: ['allow', 'deny', 'unique'],
    default: 'allow'
  },

  // SECTION 5: ACCESS & AFFILIATES
  affiliates: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'
  },
  access_type: {
    type: String,
    enum: ['public', 'private', 'request-only'],
    default: 'public'
  },
  selected_users: [String],
  manager: String,
  approval_notes: String,

  // SECTION 6: CREATIVES & VISUALS
  creative_type: {
    type: String,
    enum: ['image', 'html', 'email'],
    default: 'image'
  },
  image_url: String,
  thumbnail_url: String,
  html_code: String,
  email_template: String,
  email_subject: String,
  banner_codes: [String],
  email_creative: String,
  landing_page_variants: [String],
  creative_category: {
    type: String,
    enum: ['banner', 'email', 'video'],
    default: 'banner'
  },

  // SECTION 7: SCHEDULE (NEW EXTENDED SCHEMA)
  schedule: {
    type: scheduleSchema,
    default: () => ({})
  },

  // SECTION 8: SMART RULES (NEW EXTENDED SCHEMA)
  smartRules: {
    type: [smartRuleSchema],
    default: []
  },

  // SECTION 9: COMPLIANCE
  allowed_traffic_types: {
    type: [String],
    default: ['email', 'search', 'display']
  },
  disallowed_traffic_types: {
    type: [String],
    default: ['adult', 'fraud']
  },
  creative_approval_required: {
    type: Boolean,
    default: false
  },
  affiliate_terms: String,
  brand_guidelines: String,
  terms_notes: String,

  // SECTION 10: INTEGRATIONS
  network_partner: String,
  network_short_description: String,
  external_offer_id: String,
  sync_frequency: {
    type: String,
    enum: ['daily', 'weekly', 'manual'],
    default: 'manual'
  },
  webhook_template: String,
  webhook_url: String,

  // SECTION 11: REPORTING & MONITORING
  hit_limit: Number,
  conversion_goal: {
    type: String,
    enum: ['lead', 'sale', 'install'],
    default: 'lead'
  },
  quality_threshold: Number,
  validation_type: {
    type: String,
    enum: ['internal', 'external'],
    default: 'internal'
  },

  // SYSTEM FIELDS
  hits: {
    type: Number,
    default: 0,
    index: true
  },
  limit: Number,
  created_by: {
    type: String,
    required: true,
    index: true
  },
  is_active: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'offers'
});

// INDEXES FOR EFFICIENT QUERYING

// Compound indexes for common queries
offerSchema.index({ status: 1, 'schedule.status': 1 }); // Active offers with active schedules
offerSchema.index({ 'schedule.startAt': 1, 'schedule.endAt': 1 }); // Time-based queries
offerSchema.index({ status: 1, category: 1, payout: -1 }); // Browse offers by category and payout
offerSchema.index({ network: 1, status: 1 }); // Network-specific offers
offerSchema.index({ countries: 1, status: 1 }); // Geo-targeted offers
offerSchema.index({ created_by: 1, status: 1 }); // User's offers
offerSchema.index({ 'smartRules.active': 1, 'smartRules.type': 1 }); // Active smart rules by type

// Text search index
offerSchema.index({
  name: 'text',
  description: 'text',
  campaign_id: 'text',
  offer_id: 'text'
});

// TTL index for expired offers (optional - removes offers 30 days after end date)
offerSchema.index({ 'schedule.endAt': 1 }, { 
  expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days
  partialFilterExpression: { 'schedule.endAt': { $exists: true } }
});

// Virtual for checking if offer is currently active based on schedule
offerSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  const schedule = this.schedule;
  
  if (!schedule || schedule.status !== 'Active') {
    return false;
  }
  
  // Check date range
  if (schedule.startAt && now < schedule.startAt) {
    return false;
  }
  
  if (schedule.endAt && now > schedule.endAt) {
    return false;
  }
  
  // Check recurring days
  if (schedule.isRecurring && schedule.recurringDays.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[now.getDay()];
    return schedule.recurringDays.includes(currentDay);
  }
  
  return true;
});

// Instance method to add smart rule
offerSchema.methods.addSmartRule = function(ruleData) {
  this.smartRules.push(ruleData);
  return this.save();
};

// Instance method to remove smart rule
offerSchema.methods.removeSmartRule = function(ruleId) {
  this.smartRules.id(ruleId).remove();
  return this.save();
};

// Static method to find active offers with schedules
offerSchema.statics.findActiveWithSchedule = function() {
  const now = new Date();
  return this.find({
    status: 'Active',
    is_active: true,
    'schedule.status': 'Active',
    $or: [
      { 'schedule.startAt': { $exists: false } },
      { 'schedule.startAt': { $lte: now } }
    ],
    $or: [
      { 'schedule.endAt': { $exists: false } },
      { 'schedule.endAt': { $gte: now } }
    ]
  });
};

// Pre-save middleware to validate smart rules
offerSchema.pre('save', function(next) {
  // Ensure smart rule priorities are unique
  const priorities = this.smartRules.map(rule => rule.priority);
  const uniquePriorities = [...new Set(priorities)];
  
  if (priorities.length !== uniquePriorities.length) {
    return next(new Error('Smart rule priorities must be unique'));
  }
  
  next();
});

module.exports = mongoose.model('Offer', offerSchema);
