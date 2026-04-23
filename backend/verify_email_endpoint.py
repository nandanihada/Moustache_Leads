"""
Quick check script - Run this to verify email endpoint is registered
"""
import sys
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

print("=" * 60)
print("EMAIL ENDPOINT VERIFICATION")
print("=" * 60)

# Check 1: File exists
import os
file_path = "routes/admin_publisher_email.py"
if os.path.exists(file_path):
    print("[OK] File exists: routes/admin_publisher_email.py")
else:
    print("[ERROR] File NOT found: routes/admin_publisher_email.py")
    print("   Please create the file first!")
    exit(1)

# Check 2: Blueprint defined
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()
    if 'admin_publisher_email_bp' in content:
        print("[OK] Blueprint defined in file")
    else:
        print("[ERROR] Blueprint NOT defined in file")
        exit(1)
    
    if '@admin_publisher_email_bp.route' in content:
        print("[OK] Routes defined in blueprint")
    else:
        print("[ERROR] No routes found in blueprint")
        exit(1)

# Check 3: app.py imports it
app_file = "app.py"
if os.path.exists(app_file):
    with open(app_file, 'r', encoding='utf-8') as f:
        app_content = f.read()
        if 'admin_publisher_email_bp' in app_content:
            print("[OK] Blueprint imported in app.py")
            
            # Count occurrences
            import_count = app_content.count("admin_publisher_email_bp = safe_import_blueprint")
            register_count = app_content.count("(admin_publisher_email_bp,")
            
            if import_count > 0:
                print(f"   - Import statement found ({import_count}x)")
            else:
                print("   [WARNING] Import statement NOT found!")
                
            if register_count > 0:
                print(f"   - Registration found ({register_count}x)")
            else:
                print("   [WARNING] Registration NOT found!")
        else:
            print("[ERROR] Blueprint NOT imported in app.py")
            print("   Add this line around line 101:")
            print("   admin_publisher_email_bp = safe_import_blueprint('routes.admin_publisher_email', 'admin_publisher_email_bp')")
            print()
            print("   And add this line around line 190:")
            print("   (admin_publisher_email_bp, ''),")
            exit(1)
else:
    print("[ERROR] app.py not found!")
    exit(1)

print()
print("=" * 60)
print("ALL CHECKS PASSED!")
print("=" * 60)
print()
print("Next steps:")
print("1. RESTART the backend server (Ctrl+C then python app.py)")
print("2. Look for this line in the startup logs:")
print("   [+] Registered blueprint: admin_publisher_email at ")
print("3. Test the email feature in the frontend")
print()
print("If you still get 'endpoint not found':")
print("- Make sure you restarted the backend")
print("- Check the backend console for errors")
print("- Verify API_BASE_URL in frontend matches backend URL")
