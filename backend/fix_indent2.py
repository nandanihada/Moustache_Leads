"""
Fix all indentation in postback_receiver.py starting from line 371
"""

with open('routes/postback_receiver.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix lines 371 onwards - reduce indentation by 8 spaces (2 levels)
fixed_lines = []
for i, line in enumerate(lines, 1):
    if i >= 371 and i <= 500:
        stripped = line.lstrip()
        if stripped and not stripped.startswith('#'):
            # Count current leading spaces
            current_indent = len(line) - len(stripped)
            # Reduce by 8 spaces if possible
            new_indent = max(0, current_indent - 8)
            fixed_lines.append(' ' * new_indent + stripped)
        else:
            fixed_lines.append(line)
    else:
        fixed_lines.append(line)

with open('routes/postback_receiver.py', 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print("✅ Fixed indentation!")
