@echo off
chcp 65001 > nul
title JARVIS BACKEND
echo ==========================================
echo    JARVIS BACKEND — FastAPI + NeonDB
echo ==========================================
echo.

:: Activar venv
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate

:: Verificar NeonDB
echo [*] Verificando NeonDB...
python -c "
from backend.storage import get_store
import sqlalchemy as sa
store = get_store()
session = store.get_session()
tables = session.execute(sa.text(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\")).fetchall()
print('Tablas en NeonDB:', [t[0] for t in tables])
for t in ['notes','todos','threads','messages']:
    try:
        c = session.execute(sa.text(f'SELECT COUNT(*) FROM {t}')).fetchone()[0]
        print(f'  {t}: {c} registros')
    except:
        print(f'  {t}: 0 registros')
session.close()
" 2>nul
if %errorlevel% neq 0 (
    echo [!] Advertencia: Verificar .env con STORAGE_TYPE=neon y DATABASE_URL
)

echo.
echo [*] Iniciando uvicorn en http://localhost:8000
echo    Docs: http://localhost:8000/api/v1/docs
echo.

python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 --reload

if %errorlevel% neq 0 (
    echo.
    echo [X] Error al iniciar. Verificar:
    echo    - LM Studio corriendo en puerto 1234
    echo    - .env con STORAGE_TYPE=neon y DATABASE_URL
    pause
)