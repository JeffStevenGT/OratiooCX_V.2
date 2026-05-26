import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    c = f.read()

old = """                '                                                        proxy_parts = PROXY.split(\':\')\\n                            if len(proxy_parts) >= 4:\\n                                proxy_url = proxy_parts[2] + \\':\\' + proxy_parts[3] + \\'@\\' + proxy_parts[0] + \\':\\' + proxy_parts[1]\\n                            else:\\n                                proxy_url = PROXY\\nargs.append(\\'--proxy-server=http://\\' + proxy_url)\\n' +"""

new = """                '                            proxy_parts = PROXY.split(\\':\\')\\n' +
                '                            if len(proxy_parts) >= 4:\\n' +
                '                                import subprocess as _sp\\n' +
                '                                _sp.run([\\'cmdkey\\', \\'/add:\\' + proxy_parts[0] + \\':\\' + proxy_parts[1], \\'/user:\\' + proxy_parts[2], \\'/pass:\\' + proxy_parts[3]], capture_output=True)\\n' +
                '                                args.append(\\'--proxy-server=http://\\' + proxy_parts[0] + \\':\\' + proxy_parts[1])\\n' +
                '                            else:\\n' +
                '                                args.append(\\'--proxy-server=http://\\' + PROXY)\\n' +
                '                            args.append(url)\\n' +"""

if old in c:
    c = c.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(c)
    print("OK")
else:
    print("NOT FOUND")
