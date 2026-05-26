import sys
filepath = sys.argv[1]

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the problematic section
old_start = "var msg = 'Archivo descargado: ' + email.split('@')[0] + '.py"
new_block = """              var msg = 'Archivo descargado: ' + email.split('@')[0] + '.py\\n\\n';
              msg += 'INSTRUCCIONES (SOLO UNA VEZ):\\n';
              msg += '1. Abre una terminal (Win+R, cmd, Enter)\\n';
              msg += '2. Arrastra el .py a la terminal y presiona Enter\\n';
              msg += '3. Se abrira ventana con confirmacion\\n';
              msg += '4. CIERRA esa ventana\\n\\n';
              msg += 'A PARTIR DE AHORA:\\n';
              msg += '- Se ejecuta solo al encender el PC\\n';
              msg += '- Cuando hagas clic en Abrir Orange\\n';
              msg += '  se abrira Chrome con proxy espanol\\n';
              msg += '- No necesitas hacer nada mas';
              alert(msg)"""

lines = content.split('\n')
for i, line in enumerate(lines):
    if old_start in line:
        # Find how many lines to replace
        end_idx = i
        for j in range(i, min(i+20, len(lines))):
            if 'alert(msg)' in lines[j]:
                end_idx = j
                break
        # Replace from line i to end_idx with new_block
        lines[i:end_idx+1] = new_block.split('\n')
        break

result = '\n'.join(lines)
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(result)
print('OK')
