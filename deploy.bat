@echo off
echo ========================================
echo   CALDACERTA PRO - DEPLOY PARA GITHUB
echo ========================================
echo.

echo 1. Parando servidor local...
taskkill /f /im node.exe 2>nul

echo 2. Verificando status do Git...
git status

echo 3. Adicionando todos os arquivos...
git add .

echo 4. Digite a mensagem do commit:
set /p commit_msg="Commit message: "

echo 5. Fazendo commit: %commit_msg%
git commit -m "%commit_msg%"

echo 6. Enviando para GitHub...
git push

echo.
echo ✅ DEPLOY CONCLUIDO!
echo.
echo O Render fara deploy automatico em:
echo https://caldacerta-1.onrender.com
echo.
pause