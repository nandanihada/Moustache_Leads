with open('routes/postback_receiver.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken f-string on line 271
content = content.replace('val != f"{{{key}}}\\"', 'val != f"{{{key}}}"')

with open('routes/postback_receiver.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed f-string!")
