#!/bin/bash

# Quick script to update postback URLs
# Run this after deploying the new code

echo "=========================================="
echo "POSTBACK URL UPDATER"
echo "=========================================="
echo ""
echo "This will update all postback URLs to use:"
echo "postback.moustacheleads.com"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

python update_postback_urls.py

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="
