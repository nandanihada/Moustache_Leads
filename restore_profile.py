import os
import subprocess

subprocess.run(['git', 'show', '5d63442609ac1e9dde489d8373b2e7cd3b6d9b24:src/components/UserIntelligenceProfile.tsx'], stdout=open('temp_profile.tsx', 'wb'))

with open('temp_profile.tsx', 'rb') as f:
    content = f.read()

if b'\xff\xfe' in content[:2] or b'\xfe\xff' in content[:2]:
    text = content.decode('utf-16', errors='ignore')
else:
    text = content.decode('utf-8', errors='ignore')

with open('src/components/UserIntelligenceProfile.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

os.remove('temp_profile.tsx')
