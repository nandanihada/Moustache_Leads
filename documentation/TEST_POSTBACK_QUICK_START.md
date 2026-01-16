# Test Postback - Quick Start Guide

## What is Test Postback?

Test Postback is a tool that allows you to send test conversion data to your downstream partners to verify their integration is working correctly before going live.

## Why Use It?

- **Verify Integration**: Ensure partner postback URLs are configured correctly
- **Test Multiple Partners**: Send test data to different partners in one go
- **Simulate Real Scenarios**: Add time delays between postbacks to mimic real user behavior
- **Instant Feedback**: See results in real-time with detailed success/failure information

## How to Access

1. Log in to Admin Dashboard
2. Navigate to **Integration** → **Test Postback**
3. Or visit: `https://dashboard.moustacheleads.com/admin/test-postback`

## Quick Example

### Scenario: Test Two Partners

**Goal**: Send test postback to Partner A immediately, then to Partner B after 10 minutes.

**Steps**:

1. **First Test Entry**:
   - Select Partner: **Partner A**
   - Username: `Don1`
   - Offer Name: `Zen Offer`
   - Points: `30`
   - Delay: `0` minutes

2. **Add Second Entry** (Click "Add Another Postback"):
   - Select Partner: **Partner B**
   - Username: `Arjun`
   - Offer Name: `Rovan Offer`
   - Points: `40`
   - Delay: `10` minutes

3. **Click "Send Test Postbacks"**

4. **View Results**:
   - First postback to Partner A sends immediately
   - After 10 minutes, second postback to Partner B sends
   - Both results appear in the log with ✅ (success) or ❌ (failed)

## Understanding Results

### Success ✅
- Green border
- Shows status code (usually 200)
- Shows response time
- Partner received the postback correctly

### Failed ❌
- Red border
- Shows error message
- May show timeout or connection error
- Partner did not receive or rejected the postback

## Common Use Cases

### 1. Single Partner Test
- Add one entry
- Set delay to 0
- Send immediately
- Verify partner receives it

### 2. Multiple Conversions Test
- Add multiple entries for same partner
- Set different delays (0, 5, 10 minutes)
- Simulates multiple users completing offers
- Tests partner's ability to handle multiple postbacks

### 3. Multi-Partner Test
- Add entries for different partners
- Each with different user/offer data
- Tests all partner integrations at once

## Tips

✅ **DO**:
- Use realistic usernames and offer names
- Start with one partner to verify setup
- Check partner's system to confirm receipt
- Document successful configurations

❌ **DON'T**:
- Use production user data
- Send too many tests at once
- Ignore failed results
- Skip verifying with partner

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Postback not received | Check partner's postback URL is correct |
| Timeout error | Partner's server may be slow or down |
| Wrong data format | Verify partner's parameter mapping |
| 404 Error | Partner's endpoint URL is incorrect |
| 500 Error | Partner's server has an internal error |

## What Data is Sent?

Each test postback includes:
- Username (your input)
- Offer name (your input)
- Points/payout (your input)
- Test offer ID (auto-generated)
- Test conversion ID (auto-generated)
- Test transaction ID (auto-generated)
- Timestamp
- Test mode flag (`test_mode: true`)

## Next Steps After Testing

1. ✅ Verify partner confirms receipt
2. ✅ Check data format matches partner's expectations
3. ✅ Test both success and failure scenarios
4. ✅ Document working configuration
5. ✅ Enable partner for production traffic

## Need Help?

- Review detailed logs in the Test Results section
- Check partner's API documentation
- Verify partner's postback URL configuration
- Contact technical support if issues persist

---

**Remember**: This is for testing only. Real conversions will be sent automatically when users complete offers.
