#!/bin/bash
# Test updating offer with geo-restrictions via API

# You'll need to replace YOUR_AUTH_TOKEN with your actual JWT token
# Get it from browser localStorage or login response

curl -X PUT http://localhost:5000/api/admin/offers/ML-00135 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "allowed_countries": ["IN"],
    "non_access_url": "https://www.example.com/not-available-india"
  }'

echo ""
echo "Now check the database again:"
python3 check_offer_geo_settings.py
