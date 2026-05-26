"""Check AdminUsers.jsx for proxy references"""
with open('src/pages/AdminUsers.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    "Proxy asignado",
    "proxy_asignado",
    "todosProxies",
    "Globe",
    "select value={form.proxy_asignado}",
]
for name in checks:
    found = name in content
    print(f'{name}: {"OK" if found else "FALTA"}')

print(f'Total chars: {len(content)}')

# Also check if there's a cached version Vite might be using
import os
vite_cache = os.path.expanduser('~/AppData/Local/Temp')
print(f'Temp dir: {vite_cache}')
