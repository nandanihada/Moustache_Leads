#!/bin/bash

echo "=========================================="
echo "CONFIGURATION VERIFICATION"
echo "=========================================="
echo ""

echo "Checking backend tracking URLs..."
grep -n "base_url.*moustacheleads-backend" backend/services/tracking_service.py
grep -n "base_url.*moustacheleads-backend" backend/routes/offerwall.py

echo ""
echo "Checking postback URLs..."
grep -n "postback.moustacheleads.com" backend/routes/postback_receiver.py | head -3

echo ""
echo "Checking SubdomainRouter..."
grep -n "SubdomainRouter" src/App.tsx | head -3

echo ""
echo "Checking Login redirect..."
grep -n "window.location.href.*dashboard" src/pages/Login.tsx | head -2

echo ""
echo "=========================================="
echo "✅ Configuration Check Complete"
echo "=========================================="
echo ""
echo "Expected results:"
echo "- Tracking URLs: moustacheleads-backend.onrender.com"
echo "- Postback URLs: postback.moustacheleads.com"
echo "- SubdomainRouter: Enabled in App.tsx"
echo "- Login: Redirects to correct subdomain"
echo ""
