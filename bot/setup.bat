@echo off
REM ============================================================
REM Oratioo Bot — Setup para PC Windows
REM ============================================================
REM Ejecutar como Administrador en la PC que correrá el bot.
REM ============================================================

echo ========================================
echo  Oratioo Bot — Setup PC
echo ========================================
echo.

REM ── 1. Verificar Python ──
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado. Instala Python 3.11+ desde https://python.org
    pause
    exit /b 1
)
echo [✓] Python detectado

REM ── 2. Instalar dependencias ──
echo [✓] Instalando dependencias Python...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al instalar dependencias
    pause
    exit /b 1
)

REM ── 3. Instalar Chromium para Playwright ──
echo [✓] Instalando Chromium...
playwright install chromium
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al instalar Chromium
    pause
    exit /b 1
)

REM ── 4. Verificar .env ──
if not exist .env (
    echo [!] No se encontro .env
    if exist .env.template (
        copy .env.template .env >nul
        echo [!] Creado .env desde template
        echo.
        echo     EDITA .env AHORA con tus valores reales:
        echo       - BOT_API_URL  = https://tudominio.com
        echo       - BOT_API_KEY  = la misma clave que en el VPS
        echo       - ORANGE_USER  = usuario de Pangea
        echo       - ORANGE_PASS  = contraseña de Pangea
        echo.
        echo     Luego ejecuta: start_bot.bat
        pause
        exit /b 0
    ) else (
        echo [ERROR] No existe .env ni .env.template
        pause
        exit /b 1
    )
)
echo [✓] .env detectado

REM ── 5. Verificar proxies.txt ──
if not exist proxies.txt (
    echo [!] No se encontro proxies.txt
    echo     Crea el archivo con al menos 1 proxy español por worker.
    echo     Formato: ip:puerto:usuario:contraseña
    echo.
)

echo.
echo ========================================
echo  Setup completado
echo.
echo  Para arrancar el bot:
echo    python coordinator_loop.py --machine-name PC-OFICINA --workers 3
echo.
echo  Para instalarlo como servicio Windows (24/7):
echo    descarga NSSM desde https://nssm.cc
echo    nssm install OratiooBot
echo ========================================
pause
