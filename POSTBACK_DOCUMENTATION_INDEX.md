# Postback System Documentation - Index

## 📚 Complete Documentation Suite

This folder contains comprehensive documentation for integrating with our postback system. Choose the document that best fits your needs:

---

## 🚀 Quick Start (5 minutes)

**Start here if you're new:**

1. **[POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)**
   - One-page overview
   - Essential parameters
   - Quick examples
   - Perfect for: Getting started fast

---

## 📖 Complete Guides

### For Upward Partners

2. **[POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md)**
   - Complete technical documentation
   - All parameters explained
   - HTTP methods and response codes
   - Revenue share model details
   - Security best practices
   - Perfect for: Full integration implementation

3. **[POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)**
   - 10+ real-world scenarios
   - Step-by-step examples
   - Common mistakes to avoid
   - Integration checklist
   - Perfect for: Learning by example

4. **[HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md)**
   - How to obtain your unique key
   - Testing your key
   - Security best practices
   - Troubleshooting
   - Perfect for: Getting set up

---

## 📋 Documentation Overview

### What is a Postback?

A postback is a server-to-server notification that you (upward partner) send to us when a user completes an offer or survey. This allows us to:
- Track conversions
- Calculate payouts
- Forward to downstream publishers
- Update user points

### Basic Flow

```
User Clicks Offer → User Completes Offer → Partner Sends Postback → We Process → Forward to Publisher → User Gets Points
```

---

## 🎯 Choose Your Path

### I'm a Partner Integrating for the First Time
1. Read: [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md)
2. Read: [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)
3. Test: Send a test postback
4. Read: [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) (Scenario 10)
5. Implement: Use examples from [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)
6. Reference: [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md) for details

### I'm a Developer Implementing the Integration
1. Read: [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md)
2. Reference: [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)
3. Study: [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)
4. Implement: Start with Scenario 1
5. Test: Use Scenario 10 examples

### I'm Troubleshooting an Issue
1. Check: [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) - "Common Mistakes"
2. Review: [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md) - "Troubleshooting"
3. Verify: [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md) - Response codes
4. Contact: Support with details from [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md)

### I Need a Quick Reference
1. Use: [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)
2. Bookmark it!

---

## 🔑 Key Concepts

### Unique Postback Key
- Every partner gets a unique key
- Used in the postback URL
- Must be kept confidential
- See: [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md)

### Required Parameters
- `click_id` - The only required parameter
- Must match a click we generated
- See: [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)

### Revenue Share
- Percentage-based: We pay X% of what you pay us
- Fixed: We pay a fixed amount regardless
- See: [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md) - "Revenue Share Model"

### Custom Data
- Send ANY parameters you want
- All captured in `custom_data`
- Perfect for survey responses
- See: [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) - Scenario 3

---

## 📊 Parameter Summary

### Must Have
- `click_id` ⭐

### Should Have
- `status` (approved/pending/rejected)
- `payout` (amount in USD)
- `offer_id` or `survey_id`
- `transaction_id`

### Nice to Have
- `conversion_id`
- `currency`
- `user_id`
- Any custom parameters

**Full list:** [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)

---

## 🔗 Quick Links

### Test Your Integration
```bash
curl "https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id=TEST-123&status=test&payout=1.00"
```

### Check System Status
```bash
curl "https://moustacheleads-backend.onrender.com/api/analytics/postback/test"
```

### Example Postback URL
```
https://moustacheleads-backend.onrender.com/postback/YOUR_KEY?click_id={click_id}&status={status}&payout={payout}&offer_id={offer_id}&transaction_id={transaction_id}
```

---

## 📞 Support

### Before Contacting Support

1. ✅ Check [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) - "Common Mistakes"
2. ✅ Review [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md) - "Troubleshooting"
3. ✅ Test with curl command
4. ✅ Check response codes in [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)

### When Contacting Support

Provide:
- Your unique postback key
- Example postback URL you're sending
- Response code and message
- Timestamp of the attempt
- Any error messages

### Contact Information
- Account Manager: [Contact info]
- Technical Support: [Support email]
- Emergency: [Emergency contact]

---

## 🎓 Learning Path

### Beginner (30 minutes)
1. [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md) - 5 min
2. [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md) - 10 min
3. [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) - Scenarios 1, 2, 10 - 15 min

### Intermediate (1 hour)
1. [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md) - 30 min
2. [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) - All scenarios - 30 min

### Advanced (2 hours)
1. Complete [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md)
2. Study all scenarios in [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)
3. Review source code: `backend/routes/postback_receiver.py`
4. Implement custom integration

---

## 🔄 Version History

### Current Version: 2.2

**Features:**
- ✅ GET and POST support
- ✅ Revenue share calculation
- ✅ Custom data capture
- ✅ Survey ID mapping
- ✅ Automatic forwarding
- ✅ Points tracking
- ✅ Multi-currency support

**Recent Updates:**
- v2.2: Enhanced custom data capture
- v2.1: Survey ID → Campaign ID mapping
- v2.0: Revenue share calculation
- v1.0: Initial release

---

## 📝 Document Summaries

### POSTBACK_QUICK_REFERENCE.md
**Length:** 1 page  
**Time to Read:** 5 minutes  
**Best For:** Quick lookup, getting started  
**Contains:** URL format, parameters, examples, response codes

### POSTBACK_INTEGRATION_GUIDE.md
**Length:** 10 pages  
**Time to Read:** 30 minutes  
**Best For:** Complete implementation  
**Contains:** Full technical specs, all parameters, security, testing

### POSTBACK_EXAMPLES.md
**Length:** 8 pages  
**Time to Read:** 20 minutes  
**Best For:** Learning by example  
**Contains:** 10 real-world scenarios, common mistakes, checklist

### HOW_TO_GET_POSTBACK_KEY.md
**Length:** 5 pages  
**Time to Read:** 15 minutes  
**Best For:** Getting set up  
**Contains:** Key generation, testing, security, troubleshooting

---

## 🎯 Common Use Cases

### Use Case 1: Simple Survey Integration
**Read:** Scenarios 1, 10 in [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)  
**Time:** 15 minutes

### Use Case 2: Survey with Custom Data
**Read:** Scenario 3 in [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)  
**Time:** 10 minutes

### Use Case 3: Pending/Approval Flow
**Read:** Scenario 2 in [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)  
**Time:** 10 minutes

### Use Case 4: Revenue Share Setup
**Read:** "Revenue Share Model" in [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md)  
**Time:** 15 minutes

---

## ✅ Integration Checklist

- [ ] Read [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)
- [ ] Obtain unique key from [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md)
- [ ] Test key with curl command
- [ ] Review [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md) Scenario 1
- [ ] Implement basic postback
- [ ] Test with real conversion
- [ ] Verify user received points
- [ ] Review [POSTBACK_INTEGRATION_GUIDE.md](POSTBACK_INTEGRATION_GUIDE.md) for advanced features
- [ ] Implement error handling
- [ ] Set up monitoring
- [ ] Document for your team

---

## 🚀 Ready to Start?

1. **Get Your Key:** [HOW_TO_GET_POSTBACK_KEY.md](HOW_TO_GET_POSTBACK_KEY.md)
2. **Quick Start:** [POSTBACK_QUICK_REFERENCE.md](POSTBACK_QUICK_REFERENCE.md)
3. **Test:** Use Scenario 10 from [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)
4. **Implement:** Follow Scenario 1 from [POSTBACK_EXAMPLES.md](POSTBACK_EXAMPLES.md)
5. **Go Live:** Monitor and optimize

---

## 📚 Additional Resources

### Source Code
- `backend/routes/postback_receiver.py` - Main postback endpoint
- `backend/routes/postback_enhanced.py` - Enhanced endpoint with custom data
- `backend/routes/postback_receiver_simple.py` - Simple forwarding endpoint

### Related Documentation
- Offer Management Guide
- Revenue Share Configuration
- User Points System
- Publisher Integration Guide

---

**Last Updated:** December 30, 2024  
**Version:** 2.2  
**Maintained By:** Technical Team
