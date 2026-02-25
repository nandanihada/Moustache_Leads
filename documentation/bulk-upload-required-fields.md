# Bulk Upload Required Fields

## Overview
This document clarifies which fields are required for bulk offer uploads and how special networks are handled.

## Always Required Fields (ALL Networks)

These fields are **MANDATORY** for every offer, regardless of network:

1. **campaign_id** (also called offer_id)
   - The unique offer identifier from the network
   - Example: `12345`
   - Column names accepted: `campaign_id`, `offer_id`

2. **name** (also called title)
   - The offer name/title
   - Example: `Sign up for Premium Subscription`
   - Column names accepted: `name`, `title`

3. **description**
   - Offer description
   - Example: `Complete a survey and earn rewards`
   - Column names accepted: `description`

4. **network** (also called platform)
   - The network/platform name
   - Example: `cpamerchant`, `leadads`, `chameleonads`
   - Column names accepted: `network`, `platform`, `name of platform`

5. **countries**
   - Target countries (comma-separated)
   - Example: `US, UK, CA`
   - Column names accepted: `countries`, `country`

6. **payout OR revenue_share_percent**
   - Either fixed payout amount OR revenue share percentage
   - Examples: `$5.00`, `50%`, `€10`
   - Column names accepted: `payout`, `revenue_share_percent`, `percent`

## Conditionally Required: target_url

The `target_url` field requirement depends on the network:

### Special Networks (target_url OPTIONAL)
For these three networks, `target_url` is **OPTIONAL** if `campaign_id` is provided:
- **cpamerchant**
- **leadads**
- **chameleonads**

**Why?** The system can automatically generate the tracking URL for these networks using the campaign_id.

**Requirements for auto-generation:**
- `campaign_id` must be present
- `network` must be one of the three special networks

**Example:**
```csv
campaign_id,name,description,network,countries,payout
12345,Test Offer,Complete survey,cpamerchant,US,5.00
```
✅ Valid - target_url will be auto-generated as: `https://tracking.cpamerchant.com/aff_c?offer_id=12345&aff_id=3394`

### All Other Networks (target_url REQUIRED)
For any network that is NOT one of the three special networks, `target_url` is **REQUIRED**.

**Example:**
```csv
campaign_id,name,target_url,description,network,countries,payout
12345,Test Offer,https://example.com/offer,Complete survey,othernetwork,US,5.00
```
✅ Valid - target_url is provided

```csv
campaign_id,name,description,network,countries,payout
12345,Test Offer,Complete survey,othernetwork,US,5.00
```
❌ Invalid - target_url is missing for non-special network

## Validation Logic

### Step 1: Check Network Type
```python
network = row['network'].lower().strip()
is_special_network = network in ['cpamerchant', 'leadads', 'chameleonads']
```

### Step 2: Check campaign_id
```python
has_campaign_id = 'campaign_id' in row and row['campaign_id']
```

### Step 3: Validate target_url
```python
if is_special_network and has_campaign_id:
    # target_url is optional - will be auto-generated
    if not target_url:
        warning: "target_url will be auto-generated"
else:
    # target_url is required
    if not target_url:
        error: "Missing required field: target_url"
```

## Common Validation Errors

### Error 1: Missing ALL Fields
```
Missing fields: campaign_id, name, target_url, description, network
```
**Cause:** Row is completely empty or has no recognized column names
**Fix:** Ensure your spreadsheet has the correct column headers

### Error 2: Missing target_url for Regular Network
```
Missing fields: target_url
Network: someothernetwork
```
**Cause:** target_url is required for this network but not provided
**Fix:** Add target_url column with valid URLs

### Error 3: Missing campaign_id for Special Network
```
Missing fields: campaign_id
Network: cpamerchant
```
**Cause:** Even though target_url is optional for cpamerchant, campaign_id is still required
**Fix:** Add campaign_id column

## Complete Examples

### Example 1: Special Network (cpamerchant) - Minimal
```csv
campaign_id,name,description,network,countries,payout
12345,Survey Offer,Complete a survey,cpamerchant,US,5.00
```
✅ Valid - target_url will be auto-generated

### Example 2: Special Network (leadads) - With target_url
```csv
campaign_id,name,target_url,description,network,countries,payout
67890,App Install,https://custom.url/offer,Install our app,leadads,UK,3.50
```
✅ Valid - custom target_url will be used instead of auto-generated

### Example 3: Regular Network - Complete
```csv
campaign_id,name,target_url,description,network,countries,payout
11111,Shopping Offer,https://shop.example.com/deal,Buy products,regularnetwork,US,10.00
```
✅ Valid - all required fields present

### Example 4: Invalid - Missing campaign_id
```csv
name,target_url,description,network,countries,payout
Test Offer,https://example.com,Test description,cpamerchant,US,5.00
```
❌ Invalid - campaign_id is ALWAYS required

### Example 5: Invalid - Missing target_url for Regular Network
```csv
campaign_id,name,description,network,countries,payout
22222,Test Offer,Test description,regularnetwork,US,5.00
```
❌ Invalid - target_url is required for non-special networks

## Summary Table

| Field | Special Networks | Other Networks |
|-------|-----------------|----------------|
| campaign_id | ✅ REQUIRED | ✅ REQUIRED |
| name | ✅ REQUIRED | ✅ REQUIRED |
| description | ✅ REQUIRED | ✅ REQUIRED |
| network | ✅ REQUIRED | ✅ REQUIRED |
| countries | ✅ REQUIRED | ✅ REQUIRED |
| payout/percent | ✅ REQUIRED | ✅ REQUIRED |
| target_url | ⚠️ OPTIONAL* | ✅ REQUIRED |

*Optional only if campaign_id is provided

## Special Networks List

1. **cpamerchant**
   - Auto-generated URL: `https://tracking.cpamerchant.com/aff_c?offer_id={campaign_id}&aff_id=3394`

2. **leadads**
   - Auto-generated URL: `https://leadads.go2jump.org/aff_c?offer_id={campaign_id}&aff_id=10843`

3. **chameleonads**
   - Auto-generated URL: `https://chameleonads.go2cloud.org/aff_c?offer_id={campaign_id}&aff_id=5696`
