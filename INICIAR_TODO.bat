@echo off
title JARVIS — Iniciando...
color 0A
cls

echo.
echo  ╔══════════════════════════════════════╗
echo  ║     JARVIS NEURAL INTERFACE        ║
echo  ╚══════════════════════════════════════╝
echo.

echo [1/5] Liberando puertos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":1234 " 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [2/5] Verificando entorno Python...
if not exist "venv\Scripts\activate.bat" (
    echo     Creando entorno virtual...
    python -m venv venv
)
call venv\Scripts\activate.bat

echo [3/5] Verificando LM Studio (puerto 1234)...
curl -s http://127.0.0.1:1234/v1/models >nul 2>&1
if %errorlevel%==0 (
    echo     [OK] LM Studio detectado
) else (
    echo     [AVISO] LM Studio no detectado en puerto 1234
    echo     El backend igual arrancara, pero chat no funcionara sin LLM
)

echo [4/5] Iniciando Backend (puerto 8000)...
start "JARVIS Backend" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 6 /nobreak >nul

echo [5/5] Verificando backend...
curl -s http://localhost:8000/api/v1/health >nul 2>&1
if %errorlevel%==0 (
    echo     [OK] Backend corriendo en http://localhost:8000
) else (
    echo     [ADVERTENCIA] Backend tardando en arrancar, continuando...
)

echo.
echo [+] Iniciando Frontend (puerto 3000)...
start "JARVIS Frontend" cmd /k "cd /d %~dp0web-next && npm run dev"
timeout /t 8 /nobreak >nul

echo.
start http://localhost:3000

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       JARVIS LISTO                   ║
echo  ╠══════════════════════════════════════╣
echo  ║  Frontend:  http://localhost:3000   ║
echo  ║  Backend:   http://localhost:8000   ║
echo  ║  API Docs:  http://localhost:8000/docs║
echo  ╠══════════════════════════════════════╣
echo  ║  Requiere:  LM Studio en :1234      ║
echo  ╚══════════════════════════════════════╝
echo.
pause