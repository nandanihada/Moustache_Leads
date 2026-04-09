import sys
with open(r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import AdminOffers from './pages/AdminOffers';", "import AdminOffers from './pages/AdminOffers';\nimport AdminOffersV2 from './pages/AdminOffersV2';")

text = text.replace('<Route path="offers" element={<AdminOffers />} />', '<Route path="offers" element={<AdminOffers />} />\n                <Route path="offers-new" element={<AdminOffersV2 />} />')

with open(r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Injected routes into App.tsx')
