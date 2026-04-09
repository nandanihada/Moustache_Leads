import sys
with open(r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffersV2.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

missing_imports = """
import { Pin } from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
"""

if 'import { Pin }' not in text:
    text = missing_imports + text

with open(r'c:\Users\rupav\OneDrive\Desktop\moustache\Moustache_Leads\src\pages\AdminOffersV2.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print('Added missing imports to AdminOffersV2.tsx')
