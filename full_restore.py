import os
import subprocess

def restore_file(commit_hash, file_path):
    temp_path = 'temp_' + os.path.basename(file_path)
    subprocess.run(['git', 'show', f'{commit_hash}:{file_path}'], stdout=open(temp_path, 'wb'))
    with open(temp_path, 'rb') as f:
        content = f.read()
    if b'\xff\xfe' in content[:2] or b'\xfe\xff' in content[:2]:
        text = content.decode('utf-16', errors='ignore')
    else:
        text = content.decode('utf-8', errors='ignore')
    os.remove(temp_path)
    return text

# 1. Restore loginLogsService.ts
login_logs_text = restore_file('5d63442609ac1e9dde489d8373b2e7cd3b6d9b24', 'src/services/loginLogsService.ts')
with open('src/services/loginLogsService.ts', 'w', encoding='utf-8') as f:
    f.write(login_logs_text)

# 2. Restore AdminRecentActivity.tsx
admin_recent_text = restore_file('5d63442609ac1e9dde489d8373b2e7cd3b6d9b24', 'src/pages/AdminRecentActivity.tsx')

# Fix AggregatedUser interface
admin_recent_text = admin_recent_text.replace("logs: LoginLog[];\r\n", "logs: LoginLog[];\r\n  first_name?: string;\r\n  last_name?: string;\r\n")
admin_recent_text = admin_recent_text.replace("logs: LoginLog[];\n", "logs: LoginLog[];\n  first_name?: string;\n  last_name?: string;\n")

# Fix scheduleType state type
admin_recent_text = admin_recent_text.replace("useState<'welcome' | 'referral' | 'warning' | 'welcome_referral'>('welcome')", "useState<'welcome' | 'referral' | 'warning' | 'welcome_referral' | string>('welcome')")
admin_recent_text = admin_recent_text.replace("useState<'welcome' | 'referral' | 'warning'>('welcome')", "useState<'welcome' | 'referral' | 'warning' | string>('welcome')")
admin_recent_text = admin_recent_text.replace("(type: 'welcome' | 'referral' | 'warning',", "(type: 'welcome' | 'referral' | 'warning' | string,")

with open('src/pages/AdminRecentActivity.tsx', 'w', encoding='utf-8') as f:
    f.write(admin_recent_text)
