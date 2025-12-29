# Phase 2: Gift Card Promo Code Implementation Plan

## Overview
Add gift card functionality to the existing promo code system. Gift cards will directly credit user accounts with a fixed amount instead of providing percentage/fixed bonuses on offers.

## Requirements

### Gift Card Specifications
- **Type**: Direct account credit (not offer-based bonus)
- **Amount**: Fixed dollar amount (e.g., $10, $20, $50)
- **Usage**: Single-use per user
- **Expiration**: Standard promo code expiration rules apply
- **Stacking**: Cannot be stacked with other promo codes

## Database Schema Changes

### `promo_codes` Collection
Add new fields:
```javascript
{
  // Existing fields...
  is_gift_card: Boolean,  // true for gift cards, false for regular promos
  credit_amount: Number,  // Direct credit amount for gift cards (e.g., 10.00)
  // For gift cards:
  // - bonus_type will be 'fixed'
  // - bonus_amount will equal credit_amount
  // - applicable_offers will be empty (not offer-specific)
}
```

### `users` Collection
Update balance tracking:
```javascript
{
  // Existing fields...
  balance: Number,  // User's account balance
  gift_card_credits: [{
    promo_code_id: ObjectId,
    code: String,
    amount: Number,
    credited_at: Date
  }]
}
```

### `gift_card_redemptions` Collection (New)
Track gift card redemptions:
```javascript
{
  user_id: ObjectId,
  promo_code_id: ObjectId,
  code: String,
  credit_amount: Number,
  redeemed_at: Date,
  status: String,  // 'credited', 'reversed'
  transaction_id: ObjectId  // Reference to balance transaction
}
```

## Backend Implementation

### 1. Update `backend/models/promo_code.py`

#### Add Gift Card Creation
```python
def create_gift_card(self, code_data, created_by):
    \"\"\"
    Create a gift card promo code
    
    Args:
        code_data: {
            'code': String,
            'name': String,
            'credit_amount': Number,
            'max_uses': Number,
            'start_date': Date,
            'end_date': Date
        }
    \"\"\"
    # Validate credit_amount
    # Set is_gift_card = True
    # Set bonus_type = 'fixed'
    # Set bonus_amount = credit_amount
    # Set applicable_offers = []
```

#### Add Gift Card Redemption
```python
def redeem_gift_card(self, code, user_id):
    \"\"\"
    Redeem a gift card and credit user account
    
    Returns:
        Tuple (redemption_doc, error_message)
    \"\"\"
    # 1. Validate code is a gift card
    # 2. Validate user hasn't redeemed this code
    # 3. Credit user account balance
    # 4. Create redemption record
    # 5. Update usage count
```

### 2. Update `backend/models/user.py`

#### Add Balance Management
```python
def credit_balance(self, user_id, amount, source, reference_id):
    \"\"\"
    Credit user account balance
    
    Args:
        amount: Amount to credit
        source: 'gift_card', 'bonus', 'refund', etc.
        reference_id: Promo code ID or transaction ID
    \"\"\"
    # 1. Validate amount > 0
    # 2. Update user.balance
    # 3. Create transaction record
    # 4. Add to gift_card_credits array if source is gift_card
```

### 3. Create `backend/routes/gift_cards.py`

#### Endpoints
```python
@router.post('/api/publisher/gift-cards/redeem')
def redeem_gift_card(current_user):
    \"\"\"User endpoint to redeem gift card\"\"\"
    # 1. Get code from request
    # 2. Call promo_code.redeem_gift_card()
    # 3. Return success with credited amount
```

```python
@router.get('/api/publisher/gift-cards/history')
def get_gift_card_history(current_user):
    \"\"\"Get user's gift card redemption history\"\"\"
```

### 4. Update `backend/routes/admin_promo_codes.py`

#### Add Gift Card Creation Endpoint
```python
@router.post('/api/admin/promo-codes/gift-card')
def create_gift_card(current_user):
    \"\"\"Admin endpoint to create gift card\"\"\"
    # 1. Validate admin permissions
    # 2. Call promo_code.create_gift_card()
    # 3. Return created gift card
```

## Frontend Implementation

### 1. Update `src/pages/AdminPromoCodeManagement.tsx`

#### Add Gift Card Toggle
```typescript
const [isGiftCard, setIsGiftCard] = useState(false);
const [creditAmount, setCreditAmount] = useState('');

// In the form:
<div>
  <label>
    <input 
      type="checkbox" 
      checked={isGiftCard}
      onChange={(e) => setIsGiftCard(e.target.checked)}
    />
    Gift Card (Direct Account Credit)
  </label>
</div>

{isGiftCard && (
  <div>
    <label>Credit Amount ($)</label>
    <input 
      type="number"
      value={creditAmount}
      onChange={(e) => setCreditAmount(e.target.value)}
      placeholder="10.00"
    />
  </div>
)}
```

#### Update Table Columns
```typescript
// Add column for gift card indicator
{
  header: 'Type',
  cell: (row) => row.is_gift_card ? 
    <Badge>Gift Card - ${row.credit_amount}</Badge> : 
    <Badge>{row.bonus_type} {row.bonus_amount}%</Badge>
}
```

### 2. Create `src/pages/GiftCardRedemption.tsx`

#### User Redemption Page
```typescript
const GiftCardRedemption = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleRedeem = async () => {
    // 1. Call API to redeem gift card
    // 2. Show success message with credited amount
    // 3. Update user balance display
  };
  
  return (
    <div>
      <h2>Redeem Gift Card</h2>
      <input 
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter gift card code"
      />
      <button onClick={handleRedeem}>Redeem</button>
    </div>
  );
};
```

### 3. Update `src/components/UserBalance.tsx`

#### Display Balance
```typescript
const UserBalance = ({ user }) => {
  return (
    <div>
      <h3>Account Balance</h3>
      <p>${user.balance.toFixed(2)}</p>
      
      {user.gift_card_credits?.length > 0 && (
        <div>
          <h4>Gift Card Credits</h4>
          {user.gift_card_credits.map(credit => (
            <div key={credit.promo_code_id}>
              {credit.code}: ${credit.amount}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Testing Plan

### Backend Tests
1. Test gift card creation with valid data
2. Test gift card creation with invalid data
3. Test gift card redemption (first time)
4. Test duplicate redemption prevention
5. Test balance credit functionality
6. Test expiration logic
7. Test max uses limit

### Frontend Tests
1. Test gift card creation form
2. Test gift card redemption flow
3. Test balance display update
4. Test error handling
5. Test redemption history display

## Migration Script

Create `backend/migrations/add_gift_card_support.py`:
```python
def migrate():
    \"\"\"Add gift card support to existing promo codes\"\"\"
    # 1. Add is_gift_card field to all existing codes (default: False)
    # 2. Add credit_amount field (default: 0)
    # 3. Add balance field to users (default: 0)
    # 4. Add gift_card_credits array to users (default: [])
```

## Implementation Order

1. ✅ Create implementation plan (this document)
2. [ ] Update database models
   - [ ] Update `promo_code.py` with gift card fields
   - [ ] Add gift card methods to `promo_code.py`
   - [ ] Update `user.py` with balance management
3. [ ] Create backend routes
   - [ ] Create `gift_cards.py` routes
   - [ ] Update `admin_promo_codes.py`
4. [ ] Update frontend
   - [ ] Update admin promo code management
   - [ ] Create gift card redemption page
   - [ ] Update user balance display
5. [ ] Testing
   - [ ] Backend unit tests
   - [ ] Frontend integration tests
   - [ ] End-to-end testing
6. [ ] Documentation
   - [ ] Update API documentation
   - [ ] Create user guide

## Notes

- Gift cards are essentially promo codes with `is_gift_card=true`
- They credit the user's account balance directly
- Balance can be used for future purchases/withdrawals
- Single-use per user to prevent abuse
- Admin can track redemptions through existing promo code analytics

---

**Status**: Planning Complete  
**Next Step**: Start implementation with database model updates
