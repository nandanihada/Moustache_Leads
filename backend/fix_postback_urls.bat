@echo off
REM Quick script to update postback URLs on Windows
REM Run this after deploying the new code

echo ==========================================
echo POSTBACK URL UPDATER
echo ==========================================
echo.
echo This will update all postback URLs to use:
echo postback.moustacheleads.com
echo.
echo Press Ctrl+C to cancel, or any key to continue...
pause > nul

python update_postback_urls.py

echo.
echo ==========================================
echo Done!
echo ==========================================
pause
