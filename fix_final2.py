import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the section to replace
# Look for "proxy_parts = PROXY.split" marker
target = "proxy_parts = PROXY.split"
replacement_start = "proxy_parts = PROXY.split"
replacement_end = "subprocess.Popen(args)"

start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if target in line and start_idx is None:
        start_idx = i
    if start_idx is not None and replacement_end in line:
        end_idx = i
        break

if start_idx is None or end_idx is None:
    print(f"ERROR: start={start_idx}, end={end_idx}")
    sys.exit(1)

print(f"Replacing lines {start_idx} to {end_idx}")

# Build replacement lines
# We need to match the JS string format of the surrounding code
# Each line is like: 'code here\n' +
new_lines = [
    "                            proxy_parts = PROXY.split(\\':\\')\\n' +\n",
    "                            if len(proxy_parts) >= 4:\\n' +\n",
    "                                _sp.run([\\'cmdkey\\', \\'/add:\\' + proxy_parts[0] + \\':\\' + proxy_parts[1], \\'/user:\\' + proxy_parts[2], \\'/pass:\\' + proxy_parts[3]], capture_output=True)\\n' +\n",
    "                                args.append(\\'--proxy-server=http://\\' + proxy_parts[0] + \\':\\' + proxy_parts[1])\\n' +\n",
    "                            else:\\n' +\n",
    "                                args.append(\\'--proxy-server=http://\\' + PROXY)\\n' +\n",
    "                            args.append(url)\\n' +\n",
    "                        subprocess.Popen(args)\\n' +\n",
]

# Also need to handle import subprocess - add it at module level if not present
# Find where to add the import
import_marker = "import subprocess"
import_line = "import subprocess as _sp\n"
import_added = False

new_content = lines[:start_idx] + new_lines + lines[end_idx+1:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("OK")
