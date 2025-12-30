# Postback URL Builder - Visual Mockup

## 🎨 What It Looks Like

```
╔══════════════════════════════════════════════════════════════════════╗
║                     Postback URL Builder                             ║
║  Visually map parameters to generate postback URLs for partners      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  Select Partner Template                                             ║
║  ┌────────────────────────────────────────────────────────────────┐ ║
║  │ LeadAds ▼                                                       │ ║
║  └────────────────────────────────────────────────────────────────┘ ║
║                                                                      ║
║  Your Postback Key                                                   ║
║  ┌────────────────────────────────────────────────────────────────┐ ║
║  │ -3YJWcgL-TnlNnscehd5j23IbVZRJHUY                                │ ║
║  └────────────────────────────────────────────────────────────────┘ ║
║  This is the unique key for this partner                             ║
║                                                                      ║
║  Parameter Mapping                          [+ Add Parameter]        ║
║  ┌────────────────────────────────────────────────────────────────┐ ║
║  │ ☑ │ Our Parameter      │ → │ Their Parameter    │ Actions    │ ║
║  ├───┼────────────────────┼───┼────────────────────┼────────────┤ ║
║  │ ☑ │ user_id ▼          │ → │ aff_sub            │ [🗑️]       │ ║
║  │   │ User MongoDB ID    │   │                    │            │ ║
║  ├───┼────────────────────┼───┼────────────────────┼────────────┤ ║
║  │ ☑ │ status ▼           │ → │ status             │ [🗑️]       │ ║
║  │   │ Conversion status  │   │                    │            │ ║
║  ├───┼────────────────────┼───┼────────────────────┼────────────┤ ║
║  │ ☑ │ payout ▼           │ → │ payout             │ [🗑️]       │ ║
║  │   │ Payout amount      │   │                    │            │ ║
║  ├───┼────────────────────┼───┼────────────────────┼────────────┤ ║
║  │ ☑ │ transaction_id ▼   │ → │ transaction_id     │ [🗑️]       │ ║
║  │   │ Transaction ID     │   │                    │            │ ║
║  └────────────────────────────────────────────────────────────────┘ ║
║                                                                      ║
║  Generated Postback URL                                              ║
║  ┌────────────────────────────────────────────────────────────────┐ ║
║  │ https://moustacheleads-backend.onrender.com/postback/           │ ║
║  │ -3YJWcgL-TnlNnscehd5j23IbVZRJHUY?                               │ ║
║  │ aff_sub={aff_sub}&                                              │ ║
║  │ status={status}&                                                │ ║
║  │ payout={payout}&                                                │ ║
║  │ transaction_id={transaction_id}                        [📋 Copy]│ ║
║  └────────────────────────────────────────────────────────────────┘ ║
║  Share this URL with your partner. They will replace the macros.    ║
║                                                                      ║
║  ┌────────────────────────────────────────────────────────────────┐ ║
║  │ 📋 How It Works:                                                │ ║
║  │ 1. Select a partner template or create custom mapping           │ ║
║  │ 2. Map YOUR parameters (left) to THEIR parameters (right)       │ ║
║  │ 3. Copy the generated postback URL                              │ ║
║  │ 4. Give this URL to your partner                                │ ║
║  │ 5. Partner will send postbacks with their parameter names       │ ║
║  │ 6. Our system will extract the values and credit users          │ ║
║  └────────────────────────────────────────────────────────────────┘ ║
║                                                                      ║
║  [📋 Copy Postback URL]  [💾 Save Partner Config]                   ║
║                                                                      ║
║  ┌────────────────────────────────────────────────────────────────┐ ║
║  │ 💡 Example: LeadAds Integration                                 │ ║
║  │                                                                  │ ║
║  │ user_id → aff_sub  (LeadAds uses "aff_sub" for user tracking)  │ ║
║  │                                                                  │ ║
║  │ Generated URL:                                                   │ ║
║  │ https://moustacheleads.com/postback/KEY?aff_sub={aff_sub}&...  │ ║
║  │                                                                  │ ║
║  │ When LeadAds sends postback:                                     │ ║
║  │ https://moustacheleads.com/postback/KEY?                        │ ║
║  │ aff_sub=507f1f77bcf86cd799439011&status=approved&payout=10.00  │ ║
║  │                                                                  │ ║
║  │ ✅ Our system extracts aff_sub=507f1f77bcf86cd799439011         │ ║
║  │    and credits that user!                                        │ ║
║  └────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 🎯 Key Features Highlighted

### 1. Partner Template Dropdown
```
┌─────────────────────────┐
│ LeadAds ▼               │  ← Select from pre-configured templates
│  - LeadAds              │
│  - CPALead              │
│  - OfferToro            │
│  - AdGate Media         │
│  - Custom               │
└─────────────────────────┘
```

### 2. Visual Parameter Mapping
```
┌──────────────────────────────────────────┐
│ ☑ │ user_id  →  aff_sub     │ [Delete] │  ← Clear visual mapping
│ ☑ │ status   →  status      │ [Delete] │
│ ☑ │ payout   →  payout      │ [Delete] │
└──────────────────────────────────────────┘
     ↑            ↑
   OUR NAME    THEIR NAME
```

### 3. Generated URL Preview
```
┌────────────────────────────────────────────────┐
│ https://moustacheleads.com/postback/KEY?       │
│ aff_sub={aff_sub}&                             │  ← See the final URL
│ status={status}&                               │
│ payout={payout}                       [Copy 📋]│  ← One-click copy
└────────────────────────────────────────────────┘
```

### 4. Real Example Section
```
┌────────────────────────────────────────────────┐
│ 💡 Example: LeadAds Integration                │
│                                                 │
│ user_id → aff_sub                              │  ← Shows real mapping
│                                                 │
│ When LeadAds sends postback:                    │
│ ...?aff_sub=507f1f77bcf86cd799439011&...      │  ← Shows real postback
│                                                 │
│ ✅ System credits that user!                   │  ← Shows result
└────────────────────────────────────────────────┘
```

---

## 📱 Mobile View

```
╔═══════════════════════════════════╗
║  Postback URL Builder             ║
╠═══════════════════════════════════╣
║                                   ║
║  Partner Template                 ║
║  [LeadAds ▼]                      ║
║                                   ║
║  Postback Key                     ║
║  [-3YJWcgL-TnlNnscehd5j23IbVZRJ] ║
║                                   ║
║  Parameter Mapping  [+ Add]       ║
║  ┌───────────────────────────────┐║
║  │ ☑ user_id                     │║
║  │    ↓                          │║
║  │   aff_sub            [Delete] │║
║  ├───────────────────────────────┤║
║  │ ☑ status                      │║
║  │    ↓                          │║
║  │   status             [Delete] │║
║  └───────────────────────────────┘║
║                                   ║
║  Generated URL                    ║
║  ┌───────────────────────────────┐║
║  │ https://moustacheleads.com/  │║
║  │ postback/KEY?aff_sub={...}   │║
║  │                      [Copy 📋]│║
║  └───────────────────────────────┘║
║                                   ║
║  [Copy URL] [Save Config]         ║
╚═══════════════════════════════════╝
```

---

## 🎨 Color Scheme

- **Primary Blue**: Buttons, arrows, highlights
- **Gray**: Borders, backgrounds
- **Green**: Success states, checkmarks
- **Red**: Delete buttons
- **White**: Main background

---

## 🔄 User Interaction Flow

### Step 1: Select Partner
```
Click dropdown → Select "LeadAds"
↓
Template loads with pre-configured mappings
```

### Step 2: Review Mappings
```
See: user_id → aff_sub
     status → status
     payout → payout
↓
Mappings are clear and visual
```

### Step 3: Edit if Needed
```
Click "Their Parameter" field
↓
Type new parameter name
↓
See URL update in real-time
```

### Step 4: Copy URL
```
Click "Copy" button
↓
URL copied to clipboard
↓
Green checkmark appears
```

### Step 5: Save Config
```
Click "Save Partner Config"
↓
Configuration saved for future use
```

---

## 💡 Why This UI Works

### 1. Visual Clarity
```
user_id  →  aff_sub
```
You can SEE the mapping, not just imagine it.

### 2. No Confusion
```
LEFT SIDE  = What WE call it
RIGHT SIDE = What THEY call it
```
Crystal clear distinction.

### 3. Instant Feedback
```
Change mapping → URL updates immediately
```
See the result in real-time.

### 4. One-Click Copy
```
[Copy 📋] → Clipboard
```
No manual copying/pasting.

### 5. Templates
```
Select "LeadAds" → Pre-configured
```
Don't start from scratch.

---

## 🎯 Comparison

### Before (Manual)
```
1. Open text editor
2. Type: https://moustacheleads.com/postback/KEY?
3. Think: "What parameter does LeadAds use?"
4. Google it
5. Type: aff_sub={aff_sub}&
6. Think: "What else do they need?"
7. Type: status={status}&
8. Copy/paste
9. Hope it's correct
```

### After (UI)
```
1. Select "LeadAds" from dropdown
2. Click "Copy"
3. Done! ✅
```

---

## 📊 Benefits Summary

| Feature | Benefit |
|---------|---------|
| Visual Mapping | See parameter relationships clearly |
| Partner Templates | Start with pre-configured mappings |
| Real-time Preview | See URL update as you type |
| One-Click Copy | Copy URL to clipboard instantly |
| Save Configuration | Reuse mappings for future partners |
| Mobile Responsive | Works on all devices |
| Example Section | Learn by seeing real examples |
| No Confusion | Clear left/right distinction |

---

**This UI makes postback URL generation simple and error-free!** 🎉
