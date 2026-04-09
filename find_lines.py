import sys

with open(r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffersV2.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '<TabsContent value="offers"' in line:
        start_idx = i
    if start_idx != -1 and i > start_idx and '</TabsContent>' in line:
        end_idx = i
        break

print(f"Offers tab: {start_idx + 1} to {end_idx + 1}")
