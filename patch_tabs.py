import os

def patch_click_tracking():
    with open('src/pages/AdminClickTracking.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    if '<AdminClickTrackingContent />' in content:
        return
        
    content = content.replace('function AdminClickTracking() {', 'export function AdminClickTrackingContent() {')
    
    wrapper = """
const AdminClickTrackingWrapper = () => {
    return (
        <AdminPageGuard requiredTab="tracking">
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Click Tracking</h1>
                    <p className="text-gray-500 mt-2">View detailed information about all clicks</p>
                </div>
                <AdminClickTrackingContent />
            </div>
        </AdminPageGuard>
    )
}
export default AdminClickTrackingWrapper;
"""
    content = content.replace('export default AdminClickTracking;', wrapper)
    
    header_to_remove = """    <div className="space-y-6 p-6\">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Click Tracking</h1>
        <p className="text-gray-500 mt-2">View detailed information about all clicks</p>
      </div>"""
      
    content = content.replace(header_to_remove, '    <div className="space-y-6">')
    
    with open('src/pages/AdminClickTracking.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

# Now we need to patch AdminReportsTracking.tsx to use this directly.
def patch_reports_tracking():
    with open('src/pages/AdminReportsTracking.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "import { AdminClickTrackingContent } from './AdminClickTracking';" not in content:
        content = "import { AdminClickTrackingContent } from './AdminClickTracking';\\n" + content
        
    # Replace `<ClickTrackingTab />` in the activeTab logic
    # activeTab === 'performance' ? <PerformanceTab /> : activeTab === 'conversion' ? <ConversionTab /> : <ClickTrackingTab />
    content = content.replace("<ClickTrackingTab />", "<AdminClickTrackingContent />")
    
    with open('src/pages/AdminReportsTracking.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

patch_click_tracking()
patch_reports_tracking()
