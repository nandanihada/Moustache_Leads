# Promo Code Email Implementation - Complete Guide

## 🎯 Two Workflows Implemented

### **Workflow 1: Admin Assigns Code to Offer**
```
Admin Dashboard → Edit Offer
    ↓
Select Promo Code
    ↓
Save Offer
    ↓
Email sent to publishers:
  "New Bonus Available on [Offer Name]"
```

### **Workflow 2: New Code Created**
```
Admin Dashboard → Create Promo Code
    ↓
Code Created
    ↓
Email sent to all publishers:
  "New Promo Code Available: [CODE]"
```

---

## ✅ What's Been Implemented

### **1. Database Changes**
✅ Added promo code fields to offer model:
- `promo_code_id` - ObjectId of assigned code
- `promo_code` - Code name (e.g., "SUMMER20")
- `promo_code_assigned_at` - When assigned
- `promo_code_assigned_by` - Admin who assigned

### **2. Email Service Methods**
✅ Added two new email methods:

**Method 1: `send_promo_code_assigned_to_offer()`**
```python
# When admin assigns code to offer
email_service.send_promo_code_assigned_to_offer(
    recipient_email="publisher@example.com",
    offer_name="Finance Offer",
    code="SUMMER20",
    bonus_amount=20,
    bonus_type="percentage"
)
```

**Method 2: `send_new_promo_code_available()`**
```python
# When new code is created
email_service.send_new_promo_code_available(
    recipient_email="publisher@example.com",
    code="SUMMER20",
    bonus_amount=20,
    bonus_type="percentage",
    description="20% bonus on all conversions"
)
```

### **3. Email Templates**
✅ Two beautiful HTML email templates:

**Email 1: Bonus Available on Offer**
- Shows offer name
- Shows promo code prominently
- Shows bonus amount
- CTA button to view offer
- Professional design

**Email 2: New Promo Code Available**
- Shows promo code prominently
- Shows bonus amount
- Shows code description
- CTA button to view promo codes
- Professional design

---

## 🔧 Backend Implementation Needed

### **Step 1: Modify Admin Offer API**
**File**: `backend/routes/admin_offers.py`

Add endpoint to update offer with promo code:

```python
@admin_bp.route('/offers/<offer_id>/assign-promo-code', methods=['PUT'])
@token_required
@admin_required
def assign_promo_code_to_offer(offer_id):
    """Assign promo code to offer and notify publishers"""
    try:
        data = request.get_json()
        
        # Get offer
        offer = offers_collection.find_one({'_id': ObjectId(offer_id)})
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Get promo code
        promo_code = promo_codes_collection.find_one({
            '_id': ObjectId(data.get('promo_code_id'))
        })
        if not promo_code:
            return jsonify({'error': 'Promo code not found'}), 404
        
        # Update offer with promo code
        offers_collection.update_one(
            {'_id': ObjectId(offer_id)},
            {
                '$set': {
                    'promo_code_id': ObjectId(data.get('promo_code_id')),
                    'promo_code': promo_code['code'],
                    'promo_code_assigned_at': datetime.utcnow(),
                    'promo_code_assigned_by': current_user['_id']
                }
            }
        )
        
        # Send email to all publishers
        publishers = users_collection.find({'role': 'publisher'})
        email_service = get_email_service()
        
        for publisher in publishers:
            if publisher.get('email'):
                email_service.send_promo_code_assigned_to_offer(
                    recipient_email=publisher['email'],
                    offer_name=offer['name'],
                    code=promo_code['code'],
                    bonus_amount=promo_code['bonus_amount'],
                    bonus_type=promo_code['bonus_type'],
                    offer_id=str(offer_id)
                )
        
        return jsonify({
            'message': 'Promo code assigned and emails sent',
            'offer': offer
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### **Step 2: Modify Promo Code Creation**
**File**: `backend/routes/admin_promo_codes.py`

Add email trigger when creating new code:

```python
@admin_bp.route('/promo-codes', methods=['POST'])
@token_required
@admin_required
def create_promo_code():
    """Create promo code and notify all publishers"""
    try:
        data = request.get_json()
        
        # ... existing code creation logic ...
        
        # After code is created, send email to all publishers
        publishers = users_collection.find({'role': 'publisher'})
        email_service = get_email_service()
        
        for publisher in publishers:
            if publisher.get('email'):
                email_service.send_new_promo_code_available(
                    recipient_email=publisher['email'],
                    code=data['code'],
                    bonus_amount=data['bonus_amount'],
                    bonus_type=data['bonus_type'],
                    description=data.get('description', '')
                )
        
        return jsonify({
            'message': 'Promo code created and emails sent',
            'promo_code': promo_code
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

---

## 🎨 Frontend Implementation Needed

### **Step 1: Admin Offer Editor**
**File**: `src/components/AddOfferModal.tsx`

Add promo code selector:

```tsx
// Add to form
<div className="space-y-4">
  <Label>Assign Promo Code (Optional)</Label>
  <Select 
    value={formData.promo_code_id || ''}
    onValueChange={(value) => setFormData({...formData, promo_code_id: value})}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select a promo code" />
    </SelectTrigger>
    <SelectContent>
      {promoCodes.map(code => (
        <SelectItem key={code._id} value={code._id}>
          {code.code} - {code.bonus_amount}% Bonus
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  <p className="text-sm text-gray-500">
    Publishers will receive an email notification when you assign a code to this offer
  </p>
</div>
```

### **Step 2: Update Offer Edit Page**
**File**: `src/pages/AdminOffers.tsx`

Add button to assign promo code:

```tsx
<Button 
  onClick={() => handleAssignPromoCode(offer._id)}
  className="gap-2"
>
  <Zap className="w-4 h-4" />
  Assign Promo Code
</Button>
```

---

## 📧 Email Templates

### **Email 1: Bonus Available on Offer**
```
Subject: 🎉 New Bonus Available on [Offer Name]! (CODE - 20%)

Hi [Publisher Name],

Great news! A new bonus is now available on one of your offers:

Offer: Finance Offer
Promo Code: SUMMER20
Bonus: 20% of earnings

Your users will earn 20% extra on every conversion from this offer!

[View Offer Button]

This bonus will be automatically applied to conversions from this offer.
```

### **Email 2: New Promo Code Available**
```
Subject: ✨ New Promo Code Available: SUMMER20 (20% Bonus)

Hi [Publisher Name],

A new promo code is now available for you to use!

Promo Code: SUMMER20
Bonus: 20% of earnings

You can apply this code to any offer you're promoting to start earning 20% extra on conversions!

[View Promo Codes Button]

This code is valid until the expiration date. Apply it to your offers to maximize your earnings!
```

---

## 🔌 API Endpoints to Add

### **Assign Promo Code to Offer**
```
PUT /api/admin/offers/{id}/assign-promo-code
Authorization: Bearer {admin_token}

Body:
{
  "promo_code_id": "507f1f77bcf86cd799439011"
}

Response:
{
  "message": "Promo code assigned and emails sent",
  "offer": { ... }
}
```

---

## 📋 Implementation Checklist

### Backend
- [ ] Add email trigger to offer update endpoint
- [ ] Add email trigger to promo code creation
- [ ] Test email sending
- [ ] Verify email content
- [ ] Check email delivery

### Frontend
- [ ] Add promo code selector to offer editor
- [ ] Add assign button to offer page
- [ ] Update offer display to show assigned code
- [ ] Add email notification indicator
- [ ] Test form submission

### Testing
- [ ] Test admin assigns code to offer
- [ ] Verify email sent to publishers
- [ ] Test new code creation
- [ ] Verify email sent to all publishers
- [ ] Check email content and formatting
- [ ] Verify links work in email

---

## 🚀 Implementation Steps

### Step 1: Backend Email Triggers (2-3 hours)
1. Modify admin offer API to send email
2. Modify promo code creation to send email
3. Test email sending
4. Verify email content

### Step 2: Frontend UI (1-2 hours)
1. Add promo code selector to offer form
2. Add assign button to offer page
3. Update display to show assigned code
4. Test form submission

### Step 3: Testing (1-2 hours)
1. Test admin assigns code
2. Verify email sent
3. Test new code creation
4. Verify email sent
5. Check email formatting

**Total Time: 4-7 hours**

---

## 📊 Email Service Methods Available

```python
# Method 1: Send when code assigned to offer
email_service.send_promo_code_assigned_to_offer(
    recipient_email: str,
    offer_name: str,
    code: str,
    bonus_amount: float,
    bonus_type: str,
    offer_id: str = ''
) -> bool

# Method 2: Send when new code created
email_service.send_new_promo_code_available(
    recipient_email: str,
    code: str,
    bonus_amount: float,
    bonus_type: str,
    description: str = ''
) -> bool
```

---

## 🎯 Success Criteria

✅ **Implementation Complete When**:
- Admin can assign promo code to offer
- Email sent to all publishers when code assigned
- Admin can create promo code
- Email sent to all publishers when new code created
- Email templates render correctly
- Links work in emails
- All tests pass

---

## 📞 Support

**Email Service**: `backend/services/email_service.py`
**Methods Added**:
- `send_promo_code_assigned_to_offer()` - Line 672
- `send_new_promo_code_available()` - Line 775

**Configuration**:
- SMTP_SERVER
- SMTP_PORT
- SMTP_USERNAME
- SMTP_PASSWORD
- FROM_EMAIL

---

## 🎉 Summary

✅ Email service methods created
✅ Email templates designed
✅ Database schema updated
✅ Ready for backend implementation
✅ Ready for frontend implementation

**Next**: Implement backend email triggers and frontend UI

---

**Status: Ready for Implementation! 🚀**
