#!/usr/bin/env python3
"""
Script to add AdminPageGuard to all admin pages
Handles function declarations, const declarations, and inline export default function
"""

import re
import os

# Define pages and their required tabs
pages = {
    "AdminPromoCodeManagement.tsx": "promo-codes",
    "AdminBonusManagement.tsx": "bonus-management",
    "AdminOfferAccessRequests.tsx": "offer-access-requests",
    "AdminPlacementApproval.tsx": "placement-approval",
    "AdminOfferwallAnalytics.tsx": "offerwall-analytics",
    "ComprehensiveOfferwallAnalytics.tsx": "comprehensive-analytics",
    "AdminClickTracking.tsx": "click-tracking",
    "AdminActiveUsers.tsx": "active-users",
    "AdminFraudManagement.tsx": "fraud-management",
    "AdminAnalytics.tsx": "analytics",
    "AdminReports.tsx": "reports",
    "AdminTracking.tsx": "tracking",
    "Partners.tsx": "partners",
    "PostbackLogs.tsx": "postback-logs",
    "AdminPublisherManagementFixed.tsx": "publishers",
}

PAGES_DIR = "/home/rishabhg/NanWork/Moustache_Leads/src/pages"

def add_guard_to_file(filepath, tab_name):
    """Add AdminPageGuard to a single file"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already has the guard
    if 'AdminPageGuard' in content:
        return False, "already has guard"
    
    # Add import after the last import statement
    import_statement = "import { AdminPageGuard } from '@/components/AdminPageGuard';"
    
    # Find the last import line
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import '):
            last_import_idx = i
    
    if last_import_idx >= 0:
        lines.insert(last_import_idx + 1, import_statement)
        content = '\n'.join(lines)
    
    # Try to find export default at end of file
    export_match = re.search(r'^export default (\w+);?\s*$', content, re.MULTILINE)
    
    if export_match:
        component_name = export_match.group(1)
        
        # Replace the export with wrapped version
        wrapper = f"""const {component_name}WithGuard = () => (
  <AdminPageGuard requiredTab="{tab_name}">
    <{component_name} />
  </AdminPageGuard>
);

export default {component_name}WithGuard;
"""
        
        content = re.sub(
            r'^export default ' + component_name + r';?\s*$',
            wrapper.rstrip(),
            content,
            flags=re.MULTILINE
        )
        
        # Write back
        with open(filepath, 'w') as f:
            f.write(content)
        
        return True, f"added guard (tab: {tab_name})"
    
    # Try to find inline export default function
    inline_export_match = re.search(r'^export default function (\w+)\(\)', content, re.MULTILINE)
    
    if inline_export_match:
        component_name = inline_export_match.group(1)
        
        # Find the end of the function (closing brace at start of line followed by optional whitespace)
        # We need to find the matching closing brace for this function
        function_start = inline_export_match.start()
        
        # Count braces to find the end
        brace_count = 0
        in_function = False
        function_end = -1
        
        for i, char in enumerate(content[function_start:], start=function_start):
            if char == '{':
                brace_count += 1
                in_function = True
            elif char == '}':
                brace_count -= 1
                if in_function and brace_count == 0:
                    function_end = i + 1
                    break
        
        if function_end > 0:
            # Replace "export default function" with just "function"
            content = content[:function_start] + 'function ' + component_name + '()' + content[inline_export_match.end():]
            
            # Recalculate function_end after modification
            offset = len('function ' + component_name + '()') - len(inline_export_match.group(0))
            function_end += offset
            
            # Add the wrapper at the end
            wrapper = f"""\n\nconst {component_name}WithGuard = () => (
  <AdminPageGuard requiredTab="{tab_name}">
    <{component_name} />
  </AdminPageGuard>
);

export default {component_name}WithGuard;
"""
            
            content = content[:function_end] + wrapper + content[function_end:]
            
            # Write back
            with open(filepath, 'w') as f:
                f.write(content)
            
            return True, f"added guard to inline export (tab: {tab_name})"
    
    return False, "no export default found"

def main():
    print("🔧 Adding AdminPageGuard to admin pages...\n")
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for page, tab in pages.items():
        filepath = os.path.join(PAGES_DIR, page)
        
        if not os.path.exists(filepath):
            print(f"⚠️  {page} - file not found")
            error_count += 1
            continue
        
        try:
            success, message = add_guard_to_file(filepath, tab)
            
            if success:
                print(f"✅ {page} - {message}")
                success_count += 1
            else:
                print(f"⏭️  {page} - {message}")
                skip_count += 1
                
        except Exception as e:
            print(f"❌ {page} - error: {e}")
            error_count += 1
    
    print(f"\n🎉 Complete!")
    print(f"   ✅ Success: {success_count}")
    print(f"   ⏭️  Skipped: {skip_count}")
    print(f"   ❌ Errors: {error_count}")

if __name__ == "__main__":
    main()
