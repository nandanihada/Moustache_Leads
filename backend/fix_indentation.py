"""
Fix indentation in postback_receiver.py
"""

# Read the file
with open('routes/postback_receiver.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix lines 459 onwards - they should be at the same indentation as line 456
fixed_lines = []
for i, line in enumerate(lines, 1):
    if i >= 459 and i <= 520:
        # Count leading spaces
        stripped = line.lstrip()
        if stripped:  # Not empty line
            # Lines 459-520 should have 44 spaces (same as line 456)
            fixed_lines.append(' ' * 44 + stripped)
        else:
            fixed_lines.append(line)
    else:
        fixed_lines.append(line)

# Write back
with open('routes/postback_receiver.py', 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print("✅ Fixed indentation!")
