import os

path = 'src/services/loginLogsService.ts'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("api.get('/api/admin/mail-history'", "api.get('/api/admin/insights/email-history'")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
