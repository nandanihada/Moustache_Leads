# Bulk Offer Upload Enhancements - README

## 🎯 Overview

This enhancement adds support for multiple currencies, percentage-based payouts, and an optional payout model field to the bulk offer upload system.

## ✨ Key Features

### 1. Multi-Currency Support
- **30+ currencies** supported with automatic symbol detection
- Display currency symbols in admin panel ($, €, £, ₹, ¥, etc.)
- Automatic currency code extraction

### 2. Percentage-Based Payouts
- Support for revenue sharing offers (e.g., 50%, 4%)
- Clear display of percentages (no more $0.00 confusion)
- Proper handling in exports and reports

### 3. Payout Model Field
- Optional field to specify payout type (CPA, CPI, CPL, etc.)
- Helps organize and categorize offers
- Included in CSV exports

## 🚀 Quick Start

### For Users

1. **Download Template**
   - Go to Admin Panel → Offers → Bulk Upload
   - Click "Download Template"

2. **Fill in Your Data**
   ```csv
   campaign_id,title,url,country,payout,payout_model
   CAMP-001,US Survey,https://example.com,US,$5.00,CPA
   CAMP-002,EU Offer,https://example.com,DE,€4.50,CPA
   CAMP-003,RevShare,https://example.com,US,50%,RevShare
   ```

3. **Upload**
   - Click "Bulk Upload"
   - Select your file
   - Review results

### For Developers

1. **Run Tests**
   ```bash
   cd backend
   python test_currency_parsing.py
   ```

2. **Check Sample Data**
   ```bash
   cat backend/sample_bulk_upload_with_currencies.csv
   ```

3. **Review Documentation**
   - See `BULK_OFFER_UPLOAD_ENHANCEMENTS.md` for technical details
   - See `BULK_UPLOAD_QUICK_GUIDE.md` for user guide

## 📁 Project Structure

```
.
├── backend/
│   ├── utils/
│   │   └── bulk_offer_upload.py          # Enhanced parser
│   ├── routes/
│   │   └── admin_offers.py               # Updated template
│   ├── test_currency_parsing.py          # Test suite
│   └── sample_bulk_upload_with_currencies.csv  # Sample data
│
├── src/
│   ├── pages/
│   │   └── AdminOffers.tsx               # Enhanced display
│   └── services/
│       └── adminOfferApi.ts              # Updated types
│
└── Documentation/
    ├── BULK_OFFER_UPLOAD_ENHANCEMENTS.md # Technical docs
    ├── BULK_UPLOAD_QUICK_GUIDE.md        # User guide
    ├── IMPLEMENTATION_SUMMARY.md         # Overview
    ├── BEFORE_AFTER_COMPARISON.md        # Visual comparison
    ├── DEPLOYMENT_CHECKLIST.md           # Deployment guide
    └── README_BULK_UPLOAD_ENHANCEMENTS.md # This file
```

## 💡 Usage Examples

### Example 1: Multiple Currencies
```csv
campaign_id,title,url,country,payout,payout_model
CAMP-US,US Survey,https://example.com/us,US,$5.00,CPA
CAMP-EU,EU Survey,https://example.com/eu,DE,€4.50,CPA
CAMP-UK,UK Survey,https://example.com/uk,GB,£3.75,CPA
CAMP-IN,India App,https://example.com/in,IN,₹100,CPI
```

### Example 2: Revenue Sharing
```csv
campaign_id,title,url,country,payout,payout_model
CAMP-REV1,High Share,https://example.com/high,US,50%,RevShare
CAMP-REV2,Low Share,https://example.com/low,US,4%,RevShare
```

### Example 3: Mixed Formats
```csv
campaign_id,title,url,country,payout,payout_model
CAMP-001,Fixed USD,https://example.com/1,US,$10.00,CPA
CAMP-002,Fixed EUR,https://example.com/2,DE,€8.50,CPI
CAMP-003,Percentage,https://example.com/3,US,25%,RevShare
CAMP-004,Plain Number,https://example.com/4,US,5.00,CPL
```

## 🎨 Display Examples

### Admin Panel
```
| Offer ID | Name          | Payout/Revenue | Payout Model |
|----------|---------------|----------------|--------------|
| OFF-001  | US Survey     | $5.00          | CPA          |
| OFF-002  | EU Offer      | €4.50          | CPA          |
| OFF-003  | Revenue Share | 50%            | RevShare     |
| OFF-004  | India App     | ₹100           | CPI          |
```

### CSV Export
```csv
Offer ID,Name,Payout,Payout Model,Currency
OFF-001,US Survey,$5.00,CPA,USD
OFF-002,EU Offer,€4.50,CPA,EUR
OFF-003,Revenue Share,50%,RevShare,USD
OFF-004,India App,₹100,CPI,INR
```

## 🔧 Technical Details

### Currency Detection
The parser automatically detects currency symbols:
```python
parse_payout_value("$42")   # → (42.0, 0, 'USD')
parse_payout_value("€30")   # → (30.0, 0, 'EUR')
parse_payout_value("50%")   # → (0, 50.0, 'USD')
```

### Supported Currencies
- **Americas:** USD ($), CAD (C$), BRL (R$)
- **Europe:** EUR (€), GBP (£), CHF, SEK (kr), PLN (zł)
- **Asia:** INR (₹), JPY (¥), CNY (¥), KRW (₩), THB (฿), VND (₫), IDR (Rp), MYR (RM), PHP (₱), SGD (S$), HKD (HK$), TWD (NT$)
- **Middle East:** AED (د.إ), SAR (SR), QAR (QR), BHD (BD), KWD (KD), OMR (OMR), ILS (₪)
- **Others:** RUB (₽), ZAR (R), AUD (A$)

### Database Schema
```javascript
{
  payout: Number,                    // Fixed amount
  currency: String,                  // Currency code
  revenue_share_percent: Number,     // Percentage (0-100)
  payout_model: String,              // Optional: CPA, CPI, etc.
  incentive_type: String             // Auto-calculated
}
```

## 📚 Documentation

### For Users
- **[Quick Guide](BULK_UPLOAD_QUICK_GUIDE.md)** - Step-by-step instructions
- **[Before/After Comparison](BEFORE_AFTER_COMPARISON.md)** - Visual examples

### For Developers
- **[Technical Documentation](BULK_OFFER_UPLOAD_ENHANCEMENTS.md)** - Implementation details
- **[Implementation Summary](IMPLEMENTATION_SUMMARY.md)** - Overview of changes

### For Deployment
- **[Deployment Checklist](DEPLOYMENT_CHECKLIST.md)** - Deployment guide

## 🧪 Testing

### Run Tests
```bash
cd backend
python test_currency_parsing.py
```

### Expected Output
```
✅ PASS: '$42' -> (42.0, 0, 'USD')
✅ PASS: '€30' -> (30.0, 0, 'EUR')
✅ PASS: '£25' -> (25.0, 0, 'GBP')
... (13 tests total)
SUMMARY: 13 passed, 0 failed
```

### Test Sample Data
```bash
# Use the sample CSV file
cat backend/sample_bulk_upload_with_currencies.csv
```

## ❓ FAQ

### Q: Can I still use plain numbers without currency symbols?
**A:** Yes! Plain numbers default to USD. Example: `5.00` → `$5.00 USD`

### Q: What happens to existing offers?
**A:** They continue to work. Existing offers without currency symbols will display with USD ($).

### Q: Is the payout_model field required?
**A:** No, it's optional. You can omit it if you don't need it.

### Q: Can I mix currencies in one upload?
**A:** Yes! Each row can have a different currency.

### Q: How do I specify a percentage payout?
**A:** Just add the % symbol: `50%`, `4%`, etc.

### Q: What if my currency isn't supported?
**A:** Contact support to add it. The system is designed to easily add new currencies.

## 🐛 Troubleshooting

### Issue: "Invalid payout value"
**Solution:** Ensure your payout is:
- A number with currency symbol: `$5.00`
- A percentage: `50%`
- A plain number: `5.00`

### Issue: "Payout shows as $0.00"
**Solution:** If you're using percentage-based payout, this is correct. The percentage is displayed separately as "50%".

### Issue: Currency symbol not recognized
**Solution:** Check the supported currencies list. Use the exact symbol shown.

## 📞 Support

For questions or issues:
1. Check the [Quick Guide](BULK_UPLOAD_QUICK_GUIDE.md)
2. Review the [FAQ](#-faq) section
3. Check validation errors in upload response
4. Contact your system administrator

## 🎉 What's New

### Version 2.0 (Current)
- ✅ Multi-currency support (30+ currencies)
- ✅ Percentage-based payouts
- ✅ Payout model field
- ✅ Enhanced display in admin panel
- ✅ Improved CSV export

### Version 1.0 (Previous)
- Basic bulk upload
- USD only
- Fixed payouts only

## 🔮 Future Enhancements

Potential future improvements:
- Currency conversion rates
- Multi-currency reporting
- Custom currency symbols
- Bulk currency conversion tool
- Advanced payout models

## 📄 License

This enhancement is part of the main project and follows the same license.

## 👥 Contributors

- Implementation: Development Team
- Documentation: Development Team
- Testing: QA Team

## 📅 Version History

- **v2.0** (December 2025) - Multi-currency and percentage support
- **v1.0** (Previous) - Basic bulk upload

---

**Last Updated:** December 29, 2025
**Status:** ✅ Production Ready
**Version:** 2.0
