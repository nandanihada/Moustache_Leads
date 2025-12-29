# Bulk Offer Upload - Quick Reference Guide

## 📋 Overview

The bulk offer upload system now supports multiple currencies and percentage-based payouts. You can upload offers via:
- Excel files (.xlsx, .xls)
- CSV files (.csv)
- Google Sheets URL

## 💰 Payout Column - New Features

### Fixed Payout with Currency Symbols

You can now specify the currency directly in the payout column:

| Currency | Symbol | Example | Result |
|----------|--------|---------|--------|
| US Dollar | $ | $5.00 | $5.00 USD |
| Euro | € | €4.50 | €4.50 EUR |
| British Pound | £ | £3.75 | £3.75 GBP |
| Indian Rupee | ₹ | ₹100 | ₹100 INR |
| Japanese Yen | ¥ | ¥500 | ¥500 JPY |
| Brazilian Real | R$ | R$15 | R$15 BRL |
| Canadian Dollar | C$ | C$6.50 | C$6.50 CAD |
| Australian Dollar | A$ | A$7.00 | A$7.00 AUD |

**More currencies supported:** Russian Ruble (₽), Swiss Franc (CHF), Swedish Krona (kr), Polish Zloty (zł), Israeli Shekel (₪), Korean Won (₩), Thai Baht (฿), Vietnamese Dong (₫), Indonesian Rupiah (Rp), Malaysian Ringgit (RM), Philippine Peso (₱), Singapore Dollar (S$), Hong Kong Dollar (HK$), Taiwan Dollar (NT$), South African Rand (R), UAE Dirham (د.إ), Saudi Riyal (SR), Qatari Riyal (QR), Bahraini Dinar (BD), Kuwaiti Dinar (KD), Omani Rial (OMR)

### Percentage-Based Payout

For revenue sharing offers, use the percentage symbol:

| Example | Result |
|---------|--------|
| 50% | 50% revenue share |
| 4% | 4% commission |
| 25% | 25% revenue share |

### Plain Numbers

If you don't specify a currency symbol, it defaults to USD:

| Example | Result |
|---------|--------|
| 10.50 | $10.50 USD |
| 5 | $5.00 USD |

## 📊 New Optional Column: Payout_Model

You can now add an optional `payout_model` column to specify the type of payout:

| Payout Model | Description |
|--------------|-------------|
| CPA | Cost Per Action |
| CPI | Cost Per Install |
| CPL | Cost Per Lead |
| CPS | Cost Per Sale |
| CPM | Cost Per Mille (1000 impressions) |
| RevShare | Revenue Sharing |
| Hybrid | Mixed model |

## 📝 Template Structure

### Required Columns
- `campaign_id` - Your campaign identifier
- `title` - Offer name
- `url` - Target URL
- `country` - Country code (e.g., US, GB, IN)
- `payout` - Amount with currency symbol or percentage
- `description` - Offer description
- `platform` - Network/platform name

### Optional Columns
- `payout_model` - Type of payout (CPA, CPI, etc.)
- `preview_url` - Preview page URL
- `image_url` - Offer image URL
- `expiry` - Expiration date (YYYY-MM-DD)
- `category` - Offer category
- `device` - Device targeting (all, mobile, desktop)
- `traffic_sources` - Allowed traffic types

## 📄 Example CSV

```csv
campaign_id,title,url,country,payout,payout_model,description,platform
CAMP-001,US Survey,$5.00,CPA,https://example.com/us,US,Complete survey,SurveyNet
CAMP-002,EU Offer,€4.50,CPA,https://example.com/eu,DE,European offer,EuroNet
CAMP-003,RevShare,50%,RevShare,https://example.com/rev,US,Revenue share,AffHub
CAMP-004,India App,₹100,CPI,https://example.com/in,IN,Install app,AppNetwork
```

## 🎯 How It Works

### 1. Download Template
Click "Bulk Upload" → "Download Template" in the admin panel

### 2. Fill in Your Data
- Add your offers row by row
- Use currency symbols in the payout column
- Add payout_model if needed (optional)

### 3. Upload
- Click "Bulk Upload"
- Select your file or paste Google Sheets URL
- Click "Upload"

### 4. Review Results
- System validates all data
- Shows success count and any errors
- Offers are created automatically

## ✅ Validation Rules

The system validates:
- ✓ Currency symbols are recognized
- ✓ Numeric values are valid
- ✓ Percentage values are 0-100
- ✓ Required fields are present
- ✓ URLs are properly formatted
- ✓ Country codes are valid

## 🔍 Display in Admin Panel

After upload, the "Payout/Revenue" column shows:
- **Fixed:** `$42.00`, `€30.00`, `₹100`
- **Percentage:** `50%`, `4%`

The system automatically detects and displays the correct format!

## 🚀 Tips

1. **Use Currency Symbols:** Makes it clear which currency you're using
2. **Consistent Format:** Keep your payout format consistent within each offer
3. **Test First:** Upload a small batch first to verify formatting
4. **Check Preview:** Use the preview feature to verify offers before going live
5. **Payout Model:** Add payout_model for better organization and reporting

## 🆘 Common Issues

### Issue: "Invalid payout value"
**Solution:** Make sure your payout is either:
- A number with currency symbol: `$5.00`
- A percentage: `50%`
- A plain number: `5.00`

### Issue: "Currency not recognized"
**Solution:** Check the supported currencies list above. If your currency isn't listed, use the 3-letter code (e.g., USD, EUR) in a separate currency column.

### Issue: "Payout shows as $0.00"
**Solution:** If you're using percentage-based payout, this is correct. The percentage is stored separately and displayed as "50%" in the admin panel.

## 📞 Support

For questions or issues:
1. Check the validation errors in the upload response
2. Review this guide
3. Contact your system administrator

---

**Last Updated:** December 2025
**Version:** 2.0
