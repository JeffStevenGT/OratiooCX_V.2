import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# The problematic section in the JS source looks like:
# 'proxy_parts = PROXY.split(\':\')\n                            if len...

# Replace the entire proxy handling section
# I'll rebuild it character by character to avoid escape issues

old = (
    "proxy_parts = PROXY.split(\\':\\')\\n"
    "                            if len(proxy_parts) >= 4:\\n"
    "                                proxy_url = proxy_parts[2] + \\':\\' + proxy_parts[3] + \\'@\\' + proxy_parts[0] + \\':\\' + proxy_parts[1]\\n"
    "                            else:\\n"
    "                                proxy_url = PROXY\\n"
    "                            args.append(\\'--proxy-server=http://\\' + proxy_url)"
)

new = (
    "proxy_parts = PROXY.split(\\':\\')\\n"
    "                            if len(proxy_parts) >= 4:\\n"
    "                                import subprocess as _sp\\n"
    "                                _sp.run([\\'cmdkey\\', \\'/add:\\' + proxy_parts[0] + \\':\\' + proxy_parts[1], \\'/user:\\' + proxy_parts[2], \\'/pass:\\' + proxy_parts[3]], capture_output=True)\\n"
    "                                args.append(\\'--proxy-server=http://\\' + proxy_parts[0] + \\':\\' + proxy_parts[1])\\n"
    "                            else:\\n"
    "                                args.append(\\'--proxy-server=http://\\' + PROXY)\\n"
    "                            args.append(url)"
)

if old in content:
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK - replaced")
else:
    print("Old text NOT found")
    # Show what's near the proxy_parts
    idx = content.find("proxy_parts = PROXY.split")
    if idx >= 0:
        print("Found at", idx)
        print(repr(content[idx:idx+400]))
