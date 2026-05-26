import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# The line to replace - read from the actual file to get exact match
# Find the line containing 'proxy_parts = PROXY.split'
lines = c.split('\n')
target_idx = None
for i, line in enumerate(lines):
    if 'proxy_parts = PROXY.split' in line:
        target_idx = i
        break

if target_idx is None:
    print("ERROR: target line not found")
    sys.exit(1)

print(f"Replacing line {target_idx}")
old_line = lines[target_idx]

# Build the replacement lines
new_lines = [
    "                '                            proxy_parts = PROXY.split(\\':\\')\\n' +",
    "                '                            if len(proxy_parts) >= 4:\\n' +",
    "                '                                import subprocess as _sp\\n' +",
    "                '                                _sp.run([\\'cmdkey\\', \\'/add:\\' + proxy_parts[0] + \\':\\' + proxy_parts[1], \\'/user:\\' + proxy_parts[2], \\'/pass:\\' + proxy_parts[3]], capture_output=True)\\n' +",
    "                '                                args.append(\\'--proxy-server=http://\\' + proxy_parts[0] + \\':\\' + proxy_parts[1])\\n' +",
    "                '                            else:\\n' +",
    "                '                                args.append(\\'--proxy-server=http://\\' + PROXY)\\n' +",
    "                '                            args.append(url)\\n' +",
]

lines[target_idx] = '\n'.join(new_lines)

# Remove the next line if it's '                \'                        args.append(url)\\n\' +'
# Since we now include args.append(url) in our replacement
if target_idx + 1 < len(lines):
    next_line = lines[target_idx + 1]
    if 'args.append(url)' in next_line:
        print(f"Removing duplicate line {target_idx + 1}")
        lines.pop(target_idx + 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print("OK")
