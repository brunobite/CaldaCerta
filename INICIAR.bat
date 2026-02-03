@echo off
echo ====================================
echo  CALDACERTA - Iniciando Servidor
echo ====================================
echo.

REM Criar pasta database se não existir
if not exist "..\database" mkdir "..\database"
echo Pasta database verificada...

cd server

REM Instalar dependências na primeira vez
if not exist "node_modules" (
    echo.
    echo Instalando dependencias pela primeira vez...
    echo Isso pode demorar alguns minutos...
    call npm install
    echo.
)

echo.
echo Iniciando servidor CaldaCerta...
echo Acesse: http://localhost:3000
echo.
call npm start
pause
