import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_start = "alert('Archivo descargado: abrir_orange_'"
new_code = """\
              var msg = 'Archivo descargado: ' + email.split('@')[0] + '.py\\n\\n';\\n
              msg += 'INSTRUCCIONES (SOLO UNA VEZ):\\n';\\n
              msg += '1. Abre una terminal (Win+R, cmd, Enter)\\n';\\n
              msg += '2. Arrastra el .py a la terminal y presiona Enter\\n';\\n
              msg += '3. Se abrira ventana con confirmacion\\n';\\n
              msg += '4. CIERRA esa ventana\\n\\n';\\n
              msg += 'A PARTIR DE AHORA:\\n';\\n
              msg += '- Se ejecuta solo al encender el PC\\n';\\n
              msg += '- Cuando hagas clic en Abrir Orange\\n';\\n
              msg += '  se abrira Chrome con proxy espanol\\n';\\n
              msg += '- No necesitas hacer nada mas';\\n
              alert(msg)"""

# Find the alert line
lines = content.split('\n')
found = False
for i, line in enumerate(lines):
    if old_start in line:
        lines[i] = new_code
        # Remove the next line which should be the closing }}
        if i+1 < len(lines) and lines[i+1].strip() == '}}':
            lines[i+1] = '            }}'
        found = True
        break

if found:
    result = '\n'.join(lines)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)
    print('OK - replaced')
else:
    print('Not found')
    for i, line in enumerate(lines):
        if 'alert' in line and 'descargado' in line:
            print(f'{i}: {line}')
