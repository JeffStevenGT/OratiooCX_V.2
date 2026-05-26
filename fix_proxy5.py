import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

# Replace the proxy section with a PowerShell-based approach
old_code = (
    "'                        if PROXY:\\n' +\n"
    "'                            proxy_parts = PROXY.split(\\':\\')\\n' +\n"
    "'                            if len(proxy_parts) >= 4:\\n' +\n"
    "'                                proxy_url = proxy_parts[2] + \\':\\' + proxy_parts[3] + \\'@\\' + proxy_parts[0] + \\':\\' + proxy_parts[1]\\n' +\n"
    "'                            else:\\n' +\n"
    "'                                proxy_url = PROXY\\n' +\n"
    "'                            args.append(\\'--proxy-server=http://\\' + proxy_url)\\n' +\n"
    "'                        args.append(url)\\n' +\n"
    "'                        subprocess.Popen(args)\\n'"
)

new_code = (
    "'                        if PROXY:\\n' +\n"
    "'                            proxy_parts = PROXY.split(\\':\\')\\n' +\n"
    "'                            if len(proxy_parts) >= 4:\\n' +\n"
    "'                                puerto = proxy_parts[1]\\n' +\n"
    "'                                import subprocess, tempfile, os\\n' +\n"
    "'                                ps = subprocess.check_output([\\'where\\', \\'powershell\\']).decode().strip() if os.name == \\'nt\\' else \\'\\'\\n' +\n"
    "'                                if os.path.exists(ps):\\n' +\n"
    "'                                    ps_script = \\'\\n' +\n"
    "'                                    ps_script += \\'$proxy = \\\\\\\"http://\\\" + \\\\\\\"\\' + PROXY + \\'\\\\\\\"\\n' +\n"
    "'                                    ps_script += \\'$reg = \\\\\\\"HKCU:\\\\\\\\Software\\\\\\\\Microsoft\\\\\\\\Windows\\\\\\\\CurrentVersion\\\\\\\\Internet Settings\\\\\\\"\\n' +\n"
    "'                                    ps_script += \\'$old = Get-ItemProperty -Path $reg -Name ProxyEnable -ErrorAction SilentlyContinue\\n' +\n"
    "'                                    ps_script += \\'Set-ItemProperty -Path $reg -Name ProxyEnable -Value 1\\n' +\n"
    "'                                    ps_script += \\'Set-ItemProperty -Path $reg -Name ProxyServer -Value $proxy\\n' +\n"
    "'                                    ps_script += \\'Start-Process -WindowStyle Hidden chrome \\\\\\\"https://pangea.orange.es/\\\\\\\"\\n' +\n"
    "'                                    ps_script += \\'Start-Sleep -Seconds 120\\n' +\n"
    "'                                    ps_script += \\'Set-ItemProperty -Path $reg -Name ProxyEnable -Value 0\\n' +\n"
    "'                                    subprocess.Popen([ps, \\'-Command\\', ps_script], shell=True)\\n' +\n"
    "'                                else:\\n' +\n"
    "'                                    args.append(url)\\n' +\n"
    "'                                    subprocess.Popen(args)\\n' +\n"
    "'                            else:\\n' +\n"
    "'                                args.append(\\'--proxy-server=http://\\' + PROXY)\\n' +\n"
    "'                                args.append(url)\\n' +\n"
    "'                                subprocess.Popen(args)\\n'"
)

count = c.count(old_code)
print(f"Found {count} occurrences")

if count > 0:
    c = c.replace(old_code, new_code)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(c)
    print("OK - replaced")
else:
    print("Old code not found - checking with repr")
    idx = c.find("proxy_parts = PROXY.split")
    if idx >= 0:
        print("Found proxy_parts at", idx)
        print(repr(c[idx:idx+600]))
