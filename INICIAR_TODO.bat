@echo off
:: JARVIS Launcher DEFINITIVO — Levanta backend + frontend en orden

cd /d "C:\Users\First\Documents\Python Projects\javis0.0\jarvis-next"

title JARVIS Launcher
color 0E

echo ==========================================
echo    JARVIS NEURAL INTERFACE
echo ==========================================
echo.

:: Paso 1: Limpiar procesos viejos
echo [1/4] Limpiando procesos...
taskkill /F /IM node.exe /T >NUL 2>NUL
taskkill /F /IM python.exe /T >NUL 2>NUL
timeout /t 2 /nobreak >NUL
echo      OK

:: Paso 2: Levantar BACKEND
echo.
echo [2/4] Iniciando BACKEND...
start "JARVIS BACKEND" cmd /k "cd /d "C:\Users\First\Documents\Python Projects\javis0.0\jarvis-next" && color 0A && echo BACKEND INICIANDO... && echo Espera que diga 'Application startup complete' && echo. && venv\Scripts\python.exe -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8001 --reload"

echo      Esperando 20 segundos para que el backend arranque...
timeout /t 20 /nobreak >NUL

:: Paso 3: Levantar FRONTEND
echo.
echo [3/4] Iniciando FRONTEND...
start "JARVIS FRONTEND" cmd /k "cd /d "C:\Users\First\Documents\Python Projects\javis0.0\jarvis-next\web-next" && color 0B && echo FRONTEND INICIANDO... && set API_URL=http://127.0.0.1:8001 && npm run dev -- --port 3001"

echo      Esperando 15 segundos...
timeout /t 15 /nobreak >NUL

:: Paso 4: Abrir navegador
echo.
echo [4/4] Abriendo Chrome...
start chrome "http://localhost:3001"

echo.
echo ==========================================
echo    JARVIS LISTO

echo    Chat: http://localhost:3001
	echo    Backend: http://localhost:8001
echo ==========================================
echo.
echo Se abrieron 3 ventanas: BACKEND + FRONTEND + CHROME
echo NO cerrar esta ventana ni las otras.
echo.
pause
