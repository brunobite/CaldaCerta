@echo off
echo ========================================
echo   CALDACERTA PRO - MODO DESENVOLVIMENTO
echo ========================================
echo.

cd server

echo Verificando dependencias...
if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
)

echo.
echo Instalando nodemon (se necessario)...
call npm install -g nodemon 2>nul || echo Nodemon ja instalado.

echo.
echo Iniciando servidor com recarga automatica...
echo.
echo ✅ Frontend: http://localhost:3000
echo ✅ Modo: Desenvolvimento
echo ✅ Recarga: Ativa
echo.

call npm run dev

pause