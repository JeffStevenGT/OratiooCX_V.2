import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# Find the section from proxy_parts to subprocess.Popen
old_start = "proxy_parts = PROXY.split"
old_end = "subprocess.Popen(args)"

idx_start = c.find(old_start)
idx_end = c.find(old_end, idx_start)
if idx_start < 0 or idx_end < 0:
    print("ERROR: section not found")
    sys.exit(1)

# Extend to end of line
idx_end = c.find("\n", idx_end)
section = c[idx_start:idx_end]

print("Found section:")
print(repr(section[:200]))

# Replace with cmdkey approach - much simpler and works with Chrome
new_section = (
    "proxy_parts = PROXY.split(\\':\\')\\n"
    "                            if len(proxy_parts) >= 4:\\n"
    "                                user = proxy_parts[2]\\n"
    "                                pwd = proxy_parts[3]\\n"
    "                                host = proxy_parts[0]\\n"
    "                                port = proxy_parts[1]\\n"
    "                                # Guardar credencial en Windows Credential Manager\\n"
    "                                import subprocess\\n"
    "                                subprocess.run([\\'cmdkey\\', \\'/generic:TERMSRV/\\' + host, \\'/user:\\' + user, \\'/pass:\\' + pwd], capture_output=True)\\n"
    "                                # Iniciar Chrome con proxy (pedira auth, pero cmdkey lo provee)\\n"
    "                                chrome = os.path.expandvars(\\'%ProgramFiles%\\\\\\\\Google\\\\\\\\Chrome\\\\\\\\Application\\\\\\\\chrome.exe\\')\\n"
    "                                if not os.path.exists(chrome):\\n"
    "                                    chrome = os.path.expandvars(\\'%LocalAppData%\\\\\\\\Google\\\\\\\\Chrome\\\\\\\\Application\\\\\\\\chrome.exe\\')\\n"
    "                                if os.path.exists(chrome):\\n"
    "                                    args = [chrome, \\'--proxy-server=http://\\' + host + \\':\\' + port, url]\\n"
    "                                    subprocess.Popen(args)\\n"
    "                                else:\\n"
    "                                    subprocess.Popen([\\'start\\', url], shell=True)\\n"
    "                            else:\\n"
    "                                args.append(\\'--proxy-server=http://\\' + PROXY)\\n"
    "                                args.append(url)\\n"
    "                                subprocess.Popen(args)"
)

c = c[:idx_start] + new_section + c[idx_end:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(c)
print("OK - replaced with cmdkey approach")
