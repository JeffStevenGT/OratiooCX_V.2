# 📖 Guía para el Cliente — Oratioo CX

## ¿Qué hace este sistema?

Un bot automatizado que ingresa a la plataforma **Pangea Orange**, busca clientes por **DNI**, extrae toda su información comercial (ofertas, descuentos, renovaciones, etc.) y la guarda en una base de datos en la nube. Luego puedes ver los resultados desde cualquier navegador web.

---

## 🖥️ La Web

Abre tu navegador y ve a la URL que te proporcionemos.

### Dashboard (pantalla principal)

Aquí ves un resumen de la semana actual:

- **Total DNIs** procesados
- **Clientes CIMA** detectados
- **Clientes con Renove Mixto** (los más valiosos)
- **Tasa de conversión** (porcentaje de CIMA que tienen Renove)
- **Gráfico** de DNIs procesados por día

### Clientes

Tabla con todos los DNIs procesados. **Por defecto solo muestra clientes CIMA que tienen Renove Mixto** — que son los que te interesan.

Cada fila se puede **expandir** (clic) para ver:
- Datos del cliente (nombre, dirección, seguros)
- Todas sus líneas telefónicas (con qué oferta tiene cada una)
- El detalle completo de cada pestaña (Destacadas, Renove, Bonos, etc.)

**Filtros disponibles:**
| Filtro | Qué hace |
|---|---|
| Solo CIMA | Muestra solo clientes con línea CIMA |
| Solo Renove Mixto | Muestra solo clientes con alguna oferta Renove |
| Variantes de Renove | 4 checkboxes para cada tipo de Renove |
| Buscador | Busca por DNI o nombre |

### Proxies y Workers

Aquí controlas los bots:
1. Ves la lista de proxies disponibles (IPs españolas)
2. Defines cuántos workers (bots) quieres iniciar
3. El sistema asigna automáticamente un proxy distinto a cada worker
4. Ves el estado de cada worker en tiempo real

### Subir Documentos

Para cargar una nueva lista de DNIs:
1. Arrastra un archivo Excel (.xlsx) o CSV
2. El sistema detecta automáticamente la columna de DNIs
3. Confirmas y los DNIs se agregan a la cola de procesamiento
4. Los bots los toman automáticamente

### Usuarios

En la sección **Usuarios** (visible solo para Jefe de Área y Desarrollador) puedes:

1. **Ver todos los usuarios** registrados en el sistema, con su rol, estado y última conexión
2. **Registrar nuevos usuarios** con nombre, usuario, contraseña, email y rol
3. **Editar** el rol de un usuario existente
4. **Activar/Desactivar** usuarios (un usuario desactivado no puede iniciar sesión)
5. **Eliminar** usuarios completamente

**Roles disponibles:**
| Rol | Acceso |
|---|---|
| 👤 Asesor | Dashboard, Clientes |
| 📋 Back Office | Dashboard, Clientes, Documentos |
| 🔧 IT | Dashboard, Clientes, Proxies, Máquinas, Workers |
| 👑 Jefe de Área | Dashboard, Clientes, Proxies, Máquinas, Documentos, Workers, Usuarios |
| ⚙️ Desarrollador | Acceso total |

Al hacer clic en una fila se expande el detalle del usuario con la descripción completa de sus permisos.

### Exportar

Puedes descargar:
- **Excel CIMA+Renove** — Solo los clientes que cumplen ambos criterios (el entregable principal para tu equipo comercial)
- **Excel Completo** — Todo lo procesado
- **JSON** — Datos crudos para análisis

---

## 🤖 Los Bots (Workers)

Los bots se ejecutan en segundo plano. No necesitas hacer nada más que:

1. **Iniciarlos**: desde la web, define cuántos workers quieres y dale a "Iniciar"
2. **Dejarlos trabajar**: cada worker procesa DNIs uno tras otro
3. **Ver el progreso**: la web se actualiza sola

### ¿Cuántos workers necesito?

| Workers | DNIs/día aprox | Ideal para |
|---|---|---|
| 1 | ~650-800 | Pruebas |
| 2 | ~1,300-1,600 | 1,000 DNIs/día |
| 3 | ~2,000-2,400 | Producción estable |
| 4-5 | ~3,000+ | Alta demanda |

---

## 📊 Interpretando Resultados

### Clientes CIMA
Son los clientes con línea principal **CIMA**. Estos son los que más te interesan.

### Renove Mixto
Aparece en la pestaña "Renove" de cada línea. Hay **4 variantes** ordenadas por prioridad:

| Variante | Qué significa |
|---|---|
| 🟢 Máximo descuento | La mejor oferta disponible |
| 🔵 Con descuento | Oferta con descuento aplicado |
| 🟠 Mejor precio | Buen precio sin descuento extra |
| 🟡 Mixto básico | Renove estándar |

Si un cliente CIMA tiene **Renove Mixto al mejor precio con máximo descuento** → es el cliente ideal.

### Estados de un DNI

| Estado | Significado |
|---|---|
| ✅ Completado | Datos extraídos correctamente |
| ❌ No es cliente | Ese DNI no existe en Orange |
| ⚠️ Error | Falló la conexión o timeout |
| ⏳ Pendiente | Esperando ser procesado |

---

## ⚠️ Cosas a tener en cuenta

1. **Los proxies son clave**: cada bot necesita un proxy español distinto. Si un proxy falla, el bot no funciona.
2. **Una sola cuenta de Orange**: todos los bots comparten la misma cuenta. No se recomienda más de 3-4 bots simultáneos con 1 cuenta.
3. **Horario**: La web de Orange puede tener mantenimiento nocturno. El bot funciona mejor en horario laboral español.
4. **Si algo falla**: el bot reintenta automáticamente. Si un DNI falla 3 veces, se marca como error y pasa al siguiente.

---

## ❓ Preguntas Frecuentes

**¿Puedo usar el sistema desde cualquier PC?**
Sí, solo necesitas un navegador web. Los bots pueden correr en otra máquina.

**¿Cuánto tarda en procesarse un lote de 1,000 DNIs?**
Con 3 workers: aproximadamente 6-8 horas.

**¿Qué pasa si apago mi PC donde corren los bots?**
Los bots se detienen. Al encenderla de nuevo, solo hay que reiniciar el coordinador y retoma desde donde quedó.

**¿Los datos son seguros?**
Sí. Supabase tiene cifrado en reposo y en tránsito. Los bots usan service_role key que solo tiene acceso a las tablas necesarias.

**¿Puedo tener 2 personas viendo la web al mismo tiempo?**
Sí, la web es multi-sesión. Cada quien con su login.


### Etiquetas de línea
Cada línea del cliente muestra etiquetas como:
- **CIMA** 🟢 — Cliente de alta prioridad
- **TV** 📺 — Tiene televisión contratada
- **Principal** — Es la línea principal del cliente
- **Activo desde** — Fecha de antigüedad del cliente

Estos datos se ven tanto en la tabla principal (badge CIMA) como al expandir la fila.
