# How to Add Postback URL Builder to Your Admin Panel

## ✅ File Location

The component is already created at:
```
src/components/PostbackURLBuilder.tsx
```

## 🎯 Option 1: Add as a Tab in Partners Page (Recommended)

### Step 1: Open Partners.tsx

File: `src/pages/Partners.tsx`

### Step 2: Import the Component

Add this import at the top of the file (around line 1-30):

```tsx
import PostbackURLBuilder from '@/components/PostbackURLBuilder';
```

### Step 3: Add a New Tab

Find the `<Tabs>` component in your Partners page (around line 200-300) and add a new tab:

```tsx
<Tabs defaultValue="upward" className="w-full">
  <TabsList className="grid w-full grid-cols-3">  {/* Change from grid-cols-2 to grid-cols-3 */}
    <TabsTrigger value="upward">Upward Partners</TabsTrigger>
    <TabsTrigger value="downward">Downward Partners (Users)</TabsTrigger>
    <TabsTrigger value="postback-builder">Postback URL Builder</TabsTrigger>  {/* NEW TAB */}
  </TabsList>

  <TabsContent value="upward">
    {/* Existing upward partners content */}
  </TabsContent>

  <TabsContent value="downward">
    {/* Existing downward partners content */}
  </TabsContent>

  {/* NEW TAB CONTENT */}
  <TabsContent value="postback-builder">
    <PostbackURLBuilder />
  </TabsContent>
</Tabs>
```

### Step 4: Save and Test

1. Save the file
2. Refresh your browser
3. Go to Partners page
4. You should see a new "Postback URL Builder" tab
5. Click it to use the builder!

---

## 🎯 Option 2: Add as a Button with Modal

### Step 1: Import the Component and Dialog

```tsx
import PostbackURLBuilder from '@/components/PostbackURLBuilder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
```

### Step 2: Add State for Modal

```tsx
const [isBuilderModalOpen, setIsBuilderModalOpen] = useState(false);
```

### Step 3: Add Button in Upward Partners Section

Find the "Generate Postback URL" button area and add:

```tsx
<Button
  onClick={() => setIsBuilderModalOpen(true)}
  className="flex items-center gap-2"
>
  <Settings className="h-4 w-4" />
  Postback URL Builder
</Button>

<Dialog open={isBuilderModalOpen} onOpenChange={setIsBuilderModalOpen}>
  <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Postback URL Builder</DialogTitle>
    </DialogHeader>
    <PostbackURLBuilder />
  </DialogContent>
</Dialog>
```

---

## 🎯 Option 3: Add as Standalone Page

### Step 1: Create New Page

Create file: `src/pages/PostbackBuilder.tsx`

```tsx
import React from 'react';
import { AdminPageGuard } from '@/components/AdminPageGuard';
import PostbackURLBuilder from '@/components/PostbackURLBuilder';

const PostbackBuilder: React.FC = () => {
  return (
    <AdminPageGuard>
      <div className="container mx-auto py-6">
        <PostbackURLBuilder />
      </div>
    </AdminPageGuard>
  );
};

export default PostbackBuilder;
```

### Step 2: Add Route

In your router file (usually `App.tsx` or `routes.tsx`), add:

```tsx
import PostbackBuilder from '@/pages/PostbackBuilder';

// In your routes:
<Route path="/admin/postback-builder" element={<PostbackBuilder />} />
```

### Step 3: Add to Sidebar

In your sidebar navigation, add a link:

```tsx
<Link to="/admin/postback-builder">
  <Settings className="h-4 w-4" />
  Postback URL Builder
</Link>
```

---

## 🚀 Quick Start (Easiest Method)

### Just Add It to Partners Page as a Tab

1. **Open** `src/pages/Partners.tsx`

2. **Add import** at the top:
   ```tsx
   import PostbackURLBuilder from '@/components/PostbackURLBuilder';
   ```

3. **Find the Tabs section** (search for `<Tabs defaultValue="upward"`)

4. **Change** `grid-cols-2` to `grid-cols-3` in TabsList

5. **Add new tab trigger**:
   ```tsx
   <TabsTrigger value="postback-builder">Postback URL Builder</TabsTrigger>
   ```

6. **Add new tab content** after the last TabsContent:
   ```tsx
   <TabsContent value="postback-builder">
     <PostbackURLBuilder />
   </TabsContent>
   ```

7. **Save and refresh** your browser

**Done!** You should see a new tab in your Partners page! 🎉

---

## 📸 What You'll See

After adding it, you'll see:

```
┌─────────────────────────────────────────────────┐
│ Partner Management                              │
├─────────────────────────────────────────────────┤
│ [Upward Partners] [Downward Partners] [Postback URL Builder] ← NEW TAB
├─────────────────────────────────────────────────┤
│                                                  │
│  Postback URL Builder                           │
│  Visually map parameters to generate postback   │
│  URLs for upward partners                        │
│                                                  │
│  Select Partner Template                         │
│  [LeadAds ▼]                                    │
│                                                  │
│  Your Postback Key                              │
│  [Enter key...]                                 │
│                                                  │
│  Parameter Mapping                              │
│  ┌──────────────────────────────────────────┐  │
│  │ ☑ user_id → aff_sub        [Delete]     │  │
│  │ ☑ status  → status         [Delete]     │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  Generated Postback URL                         │
│  [https://moustacheleads.com/postback/...]     │
│                                                  │
│  [Copy URL] [Save Config]                       │
└─────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@/components/PostbackURLBuilder'"

**Solution:** Make sure the file exists at `src/components/PostbackURLBuilder.tsx`

Check with:
```bash
ls src/components/PostbackURLBuilder.tsx
```

### Issue: "Component not rendering"

**Solution:** Check browser console for errors. Make sure all imports are correct.

### Issue: "Styling looks broken"

**Solution:** The component uses Tailwind CSS. Make sure your project has Tailwind configured.

---

## ✅ Verification

After adding the component, verify it works:

1. ✅ Navigate to Partners page
2. ✅ See "Postback URL Builder" tab
3. ✅ Click the tab
4. ✅ See the builder UI
5. ✅ Select "LeadAds" from dropdown
6. ✅ See parameter mappings
7. ✅ See generated URL
8. ✅ Click "Copy" button
9. ✅ URL copied to clipboard

---

## 📞 Need Help?

If you're having trouble adding it, let me know and I can:
1. Show you the exact code changes
2. Create a complete modified Partners.tsx file
3. Help debug any issues

---

**The component is ready to use! Just add it to your Partners page!** 🚀
