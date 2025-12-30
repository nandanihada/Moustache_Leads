# 👀 What You Will See - Visual Guide

## Opening the Modal

### Step 1: Navigate to Partners Page
Go to: **Admin Dashboard → Partners Tab**

You'll see:
```
┌─────────────────────────────────────────────────────────┐
│  Partner Management                                      │
│  Manage upward and downward partners                     │
│                                                          │
│  [Upward Partners] [Downward Partners (Users)]          │
│                                                          │
│  Upward Partners                    [+ Generate Postback URL] ← CLICK HERE
│  Generate postback URLs to share with partners...       │
└─────────────────────────────────────────────────────────┘
```

### Step 2: Modal Opens
When you click "Generate Postback URL", you'll see a large modal with:

## Modal Layout

```
╔═══════════════════════════════════════════════════════════════════╗
║  Generate Postback URL for Upward Partner                    [X]  ║
║  Create a unique postback URL with visual parameter mapping       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  ┌─ Basic Information ─────────────────────────────────────────┐ ║
║  │                                                              │ ║
║  │  Partner Name *                                              │ ║
║  │  [LeadAds                                    ]               │ ║
║  │  Enter the name of the partner who will send you postbacks   │ ║
║  │                                                              │ ║
║  │  Description (Optional)                                      │ ║
║  │  [Survey offers partner                      ]               │ ║
║  │                                                              │ ║
║  │  Status                                                      │ ║
║  │  [Active ▼]                                                  │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║  ┌─ Parameter Mapping ──────────────────────── [+ Add Parameter] ║
║  │  Map your parameters to their parameter names                │ ║
║  │                                                              │ ║
║  │  Partner Template (Quick Start)                              │ ║
║  │  [LeadAds ▼]  ← SELECT TEMPLATE HERE                         │ ║
║  │  Select a template to auto-fill common parameter mappings    │ ║
║  │                                                              │ ║
║  │  ┌────────────────────────────────────────────────────────┐ │ ║
║  │  │ [✓] | OUR Parameter    →  THEIR Parameter  | Actions   │ │ ║
║  │  ├────────────────────────────────────────────────────────┤ │ ║
║  │  │ [✓] | user_id          →  [aff_sub      ]  | [Delete]  │ │ ║
║  │  │ [✓] | status           →  [status       ]  | [Delete]  │ │ ║
║  │  │ [✓] | payout           →  [payout       ]  | [Delete]  │ │ ║
║  │  │ [✓] | transaction_id   →  [transaction_id] | [Delete]  │ │ ║
║  │  └────────────────────────────────────────────────────────┘ │ ║
║  └──────────────────────────────────────────────────────────────┘ ║
║                                                                    ║
║  ┌─ Generated Postback URL Preview ──────────────────────────┐   ║
║  │  ✓ This URL will be generated and shared with your partner│   ║
║  │                                                            │   ║
║  │  https://moustacheleads-backend.onrender.com/postback/    │   ║
║  │  [UNIQUE_KEY]?aff_sub={aff_sub}&status={status}&          │   ║
║  │  payout={payout}&transaction_id={transaction_id}  [Copy]  │   ║
║  │                                                            │   ║
║  │  Note: [UNIQUE_KEY] will be automatically generated       │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  ┌─ 📋 How It Works: ────────────────────────────────────────┐   ║
║  │  1. We'll generate a unique postback URL with your        │   ║
║  │     parameter mappings                                     │   ║
║  │  2. Share this URL with your partner                       │   ║
║  │  3. Partner will send postbacks using THEIR parameter names│   ║
║  │  4. Our system automatically maps their parameters to ours │   ║
║  │  5. Users get credited based on the mapped user_id         │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║  ┌─ 💡 Example: ─────────────────────────────────────────────┐   ║
║  │  user_id  →  aff_sub  Partner uses "aff_sub" for tracking │   ║
║  │                                                            │   ║
║  │  Generated URL will include:                               │   ║
║  │  ?aff_sub={aff_sub}&status={status}&payout={payout}       │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                    ║
║                                    [Cancel] [Generate Postback URL]║
╚═══════════════════════════════════════════════════════════════════╝
```

## Key Features You'll See

### 1. Partner Template Dropdown
```
┌─────────────────────────┐
│ LeadAds            ▼    │
├─────────────────────────┤
│ LeadAds                 │ ← Pre-configured for LeadAds
│ CPALead                 │ ← Pre-configured for CPALead
│ OfferToro               │ ← Pre-configured for OfferToro
│ AdGate Media            │ ← Pre-configured for AdGate
│ Custom                  │ ← Start from scratch
└─────────────────────────┘
```

### 2. Parameter Mapping Table
```
┌──────────────────────────────────────────────────────────┐
│ Enable │ OUR Parameter      →  THEIR Parameter │ Actions │
├──────────────────────────────────────────────────────────┤
│  [✓]   │ [user_id      ▼]  →  [aff_sub      ]  │ [🗑️]   │
│  [✓]   │ [status       ▼]  →  [status       ]  │ [🗑️]   │
│  [✓]   │ [payout       ▼]  →  [payout       ]  │ [🗑️]   │
│  [ ]   │ [click_id     ▼]  →  [s2           ]  │ [🗑️]   │
└──────────────────────────────────────────────────────────┘
```

**Left Column (OUR Parameter)**: Dropdown with options
- user_id - User MongoDB ID
- click_id - Unique click identifier
- payout - Conversion payout amount
- status - Conversion status
- transaction_id - Transaction identifier
- offer_id - Offer identifier
- conversion_id - Conversion identifier
- currency - Currency code

**Right Column (THEIR Parameter)**: Text input
- Type the parameter name your partner uses
- Examples: aff_sub, subid, user_id, s2, oid, amount

### 3. Real-Time URL Preview
As you add/remove/modify parameters, the URL updates instantly:

```
┌────────────────────────────────────────────────────────────┐
│ ✓ Generated Postback URL Preview                           │
│                                                             │
│ https://moustacheleads-backend.onrender.com/postback/      │
│ [UNIQUE_KEY]?aff_sub={aff_sub}&status={status}&            │
│ payout={payout}&transaction_id={transaction_id}    [Copy]  │
│                                                             │
│ Note: [UNIQUE_KEY] will be automatically generated         │
└────────────────────────────────────────────────────────────┘
```

### 4. Interactive Actions

**Add Parameter Button**
```
[+ Add Parameter]  ← Click to add a new row to the mapping table
```

**Delete Button**
```
[🗑️]  ← Click to remove a parameter mapping
```

**Enable Checkbox**
```
[✓]  ← Checked = Include in URL
[ ]  ← Unchecked = Exclude from URL
```

**Copy Button**
```
[📋 Copy]  ← Click to copy URL to clipboard
```

## Example Workflow

### Scenario: Adding LeadAds Partner

1. **Click "Generate Postback URL"**
   - Modal opens

2. **Enter Partner Name**
   ```
   Partner Name: LeadAds
   ```

3. **Select Template**
   ```
   Partner Template: [LeadAds ▼]
   ```
   - Table auto-fills with:
     - user_id → aff_sub ✓
     - status → status ✓
     - payout → payout ✓
     - transaction_id → transaction_id ✓

4. **Review URL Preview**
   ```
   https://moustacheleads-backend.onrender.com/postback/
   [UNIQUE_KEY]?aff_sub={aff_sub}&status={status}&
   payout={payout}&transaction_id={transaction_id}
   ```

5. **Click "Generate Postback URL"**
   - Partner created
   - Unique key generated
   - URL appears in partners table

6. **Copy & Share**
   - Click copy button next to URL in table
   - Share with LeadAds

## What Happens After

### In Partners Table
```
┌──────────────────────────────────────────────────────────────────┐
│ Partner Name │ Our Postback URL (Share with Partner)  │ Actions │
├──────────────────────────────────────────────────────────────────┤
│ LeadAds      │ https://moustacheleads-backend...      │ [Edit]  │
│              │ /-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?     │ [Delete]│
│              │ aff_sub={aff_sub}&status={status}...   │ [Copy]  │
└──────────────────────────────────────────────────────────────────┘
```

### When LeadAds Sends Postback
```
Incoming:
https://moustacheleads-backend.onrender.com/postback/
-3YJWcgL-TnlNnscehd5j23IbVZRJHUY?
aff_sub=507f1f77bcf86cd799439011&
status=approved&
payout=10.00&
transaction_id=TXN123

System extracts:
- aff_sub → user_id: 507f1f77bcf86cd799439011
- status: approved
- payout: 10.00
- transaction_id: TXN123

Result:
✅ User 507f1f77bcf86cd799439011 credited $10.00
```

## Tips

### Quick Setup
1. Always start with a partner template if available
2. Templates auto-fill common parameters
3. You can modify after selecting template

### Custom Parameters
1. Select "Custom" template
2. Click "+ Add Parameter"
3. Choose OUR parameter from dropdown
4. Type THEIR parameter name
5. Enable checkbox

### Testing
1. Generate URL
2. Copy to clipboard
3. Test with httpbin.org or partner's test endpoint
4. Verify parameters are correct

## Summary

The modal provides:
- ✨ Visual parameter mapping (no confusion!)
- 🎯 Partner templates (quick setup)
- 🔄 Real-time URL preview (see what you're creating)
- 📋 One-click copy (easy sharing)
- 💡 Examples and guides (learn as you go)

**No more confusion about which parameter goes where!** 🎉
