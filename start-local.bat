@echo off
echo ========================================
echo   CALDACERTA PRO - INICIANDO SERVIDOR
echo ========================================
echo.

cd server

echo Verificando dependencias...
if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
) else (
  echo Dependencias ja instaladas.
)

echo.
echo Iniciando servidor na porta 3000...
echo Frontend: http://localhost:3000
echo Firebase: https://console.firebase.google.com
echo.

call npm start

pause