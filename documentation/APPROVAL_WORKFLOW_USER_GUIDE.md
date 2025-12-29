# 📋 Offer Approval Workflow - User Guide

## Overview
The offer approval workflow allows admins to control publisher access to offers. Publishers must request access and wait for admin approval before they can see tracking links and promote offers.

---

## 👨‍💼 ADMIN GUIDE

### Creating an Offer with Approval Requirements

#### Step 1: Open Add Offer Modal
- Click "Add Offer" button in Admin Dashboard
- Fill in basic offer details (Name, Payout, Network, etc.)

#### Step 2: Configure Approval Workflow
Navigate to the **Access** tab and scroll to "Approval Workflow" section:

**Option A: Manual Approval**
- Approval Type: `Manual`
- Require Approval: `ON`
- Approval Message: "Please contact support for access to this offer"
- Max Inactive Days: `30`

**Option B: Time-based Auto-Approval**
- Approval Type: `Time-based`
- Auto-approve Delay: `5` (minutes)
- Approval Message: "Your request will be auto-approved in 5 minutes"
- Max Inactive Days: `30`

**Option C: Auto-Approve (Default)**
- Approval Type: `Auto-approve`
- Require Approval: `OFF`
- Publishers get instant access

#### Step 3: Save Offer
- Click "Create Offer"
- Backend automatically sets `affiliates = 'request'` to enforce access control

### Editing an Existing Offer

#### To Add Approval to an Existing Offer:
1. Click on the offer in the offers list
2. Click "Edit" button
3. Go to **Access** tab
4. Find "Approval Workflow" section
5. Change Approval Type from "Auto-approve" to "Manual" or "Time-based"
6. Configure settings as needed
7. Click "Update Offer"

**⚠️ Important:** When you add approval requirements to an existing offer:
- Publishers who previously had access will **lose access**
- They must request access again
- You must approve their request for them to regain access

### Managing Access Requests

#### View All Requests
1. Click "Offer Access Requests" in sidebar
2. See statistics dashboard:
   - Total Requests
   - Pending Requests
   - Approved Requests
   - Rejected Requests

#### Filter & Search Requests
- **Filter by Status**: Pending, Approved, Rejected
- **Search**: By publisher name, email, or offer name
- **Sort**: By date, status, or publisher

#### Approve a Request
1. Find the request in the table
2. Click the request row to see details
3. Click "Approve" button
4. Optionally add approval notes
5. Click "Confirm Approve"
6. Publisher immediately gets access

#### Reject a Request
1. Find the request in the table
2. Click the request row to see details
3. Click "Reject" button
4. Enter rejection reason (optional)
5. Click "Confirm Reject"
6. Publisher is notified of rejection

#### View Request Details
- Publisher name and email
- Offer name and details
- Request date and time
- Publisher's message (if any)
- Current status and timeline

---

## 👤 PUBLISHER GUIDE

### Viewing Available Offers

#### See All Offers
1. Click "Offers" in sidebar
2. Click "Available Offers" tab
3. See all offers you have access to

#### Offers Requiring Approval
- Offers appear with a **lock icon** 🔒
- Offer card is **blurred** to show it's restricted
- You can see offer name and basic info
- **Tracking URL is NOT visible**
- Shows "Request Access" button

### Requesting Access

#### Step 1: Find Restricted Offer
- Look for offers with lock icon 🔒
- These require approval before you can use them

#### Step 2: Click "Request Access"
- Click the "Request Access" button on the offer card
- A dialog appears

#### Step 3: Add Optional Message
- Type a message to the admin (optional)
- Example: "I have experience with this offer type"
- Click "Submit Request"

#### Step 4: Wait for Approval
- Your request status changes to "Pending"
- Admin reviews your request
- You'll see estimated approval time

### Tracking Your Requests

#### View All Your Requests
1. Click "Offers" in sidebar
2. Click "My Requests" tab
3. See all requests you've submitted

#### Request Status Meanings
- **Pending** ⏳: Waiting for admin approval
- **Approved** ✅: You now have access to the offer
- **Rejected** ❌: Admin declined your request

#### After Approval
- Go back to "Available Offers" tab
- The offer is no longer blurred
- Lock icon is gone
- **Tracking URL is now visible**
- You can now promote the offer

### Using Approved Offers

#### Generate Tracking Link
1. Click on approved offer
2. Click "View Details"
3. Copy the tracking URL
4. Use it in your campaigns

#### Promote the Offer
- Add to your email lists
- Share on social media
- Use in paid advertising
- Track conversions

---

## 🔄 WORKFLOW EXAMPLES

### Example 1: Manual Approval Workflow
```
Day 1, 10:00 AM
├─ Admin creates offer "Premium Loan" with Manual Approval
├─ Backend sets affiliates = 'request'
└─ Offer appears to publishers with lock icon

Day 1, 11:00 AM
├─ Publisher sees "Premium Loan" offer
├─ Clicks "Request Access"
├─ Submits message: "I have 10k email subscribers"
└─ Request status: PENDING

Day 1, 2:00 PM
├─ Admin reviews request
├─ Sees publisher's message
├─ Clicks "Approve"
└─ Request status: APPROVED

Day 1, 2:05 PM
├─ Publisher refreshes page
├─ Lock icon disappears
├─ Tracking URL now visible
└─ Can start promoting offer
```

### Example 2: Time-based Auto-Approval
```
Day 1, 10:00 AM
├─ Admin creates offer "Casino Game" with Time-based Approval (5 min)
└─ Backend sets affiliates = 'request'

Day 1, 11:00 AM
├─ Publisher requests access
├─ Request status: PENDING
├─ Shows "Auto-approves in 5 minutes"
└─ Admin doesn't need to do anything

Day 1, 11:05 AM
├─ System auto-approves request
├─ Request status: APPROVED
├─ Publisher gets access automatically
└─ Can start promoting
```

### Example 3: Editing Offer to Add Approval
```
Day 1
├─ Admin creates offer "Dating App" with Auto-approve
├─ Publisher gets instant access
└─ Publisher starts promoting

Day 5
├─ Admin wants to restrict access
├─ Edits offer: changes to Manual Approval
├─ Saves changes
└─ Backend sets affiliates = 'request'

Day 5 (immediately)
├─ Publisher loses access
├─ Tracking URL disappears
├─ Must request access again
└─ Waits for admin approval

Day 5 (1 hour later)
├─ Admin approves request
├─ Publisher regains access
└─ Can continue promoting
```

---

## ⚙️ APPROVAL SETTINGS REFERENCE

### Approval Type Options

| Type | Behavior | Use Case |
|------|----------|----------|
| **Auto-approve** | Publishers get instant access | Low-risk offers, public offers |
| **Manual** | Admin must approve each request | High-value offers, premium publishers |
| **Time-based** | Auto-approve after delay | Moderate offers, verification period |

### Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| **Approval Type** | How requests are handled | auto_approve |
| **Auto-approve Delay** | Minutes to wait before auto-approving | 0 |
| **Require Approval** | Force manual approval override | false |
| **Approval Message** | Message shown to publishers | (empty) |
| **Max Inactive Days** | Days before auto-locking inactive offers | 30 |

---

## 🔍 TROUBLESHOOTING

### Publisher Can't See Offer
**Possible Causes:**
- Offer status is not "Active"
- Offer approval_status is "Paused" or "Locked"
- Publisher's account is inactive
- Offer is restricted to specific countries/languages

**Solution:**
- Check offer status in admin panel
- Verify publisher account is active
- Check country/language targeting

### Publisher Sees Offer But No Tracking URL
**This is Normal!** 
- Offer requires approval
- Publisher must request access
- Admin must approve request
- Then tracking URL will appear

### Request Stuck in "Pending"
**Possible Causes:**
- Admin hasn't reviewed it yet
- Time-based approval delay hasn't passed
- Request was lost in system

**Solution:**
- Wait for admin review
- Check estimated approval time
- Contact admin if stuck for too long

### Publisher Lost Access After Edit
**This is Expected!**
- Admin changed offer to require approval
- Publisher must request access again
- Admin must approve new request

---

## 📊 STATISTICS & MONITORING

### Admin Dashboard Metrics
- **Total Requests**: All requests ever submitted
- **Pending Requests**: Waiting for approval
- **Approved Requests**: Successfully approved
- **Rejected Requests**: Declined by admin
- **Approval Rate**: % of approved vs rejected

### Request Analytics
- Requests by offer
- Requests by publisher
- Average approval time
- Rejection reasons

---

## 🎯 BEST PRACTICES

### For Admins
✅ Use Manual Approval for high-value offers
✅ Use Time-based for verification periods
✅ Set clear approval messages
✅ Review requests regularly
✅ Provide feedback on rejections
✅ Monitor approval statistics

### For Publishers
✅ Include relevant info in request message
✅ Check "My Requests" tab regularly
✅ Don't request same offer multiple times
✅ Wait for approval before promoting
✅ Contact admin if stuck

---

## 📞 SUPPORT

For issues or questions:
1. Check this guide first
2. Review offer approval settings
3. Check request status and messages
4. Contact admin support

---

**Last Updated:** 2024
**Version:** 1.0
