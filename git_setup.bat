@echo off
setlocal

REM usa automaticamente la cartella dove si trova lo script
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

REM MODIFICA SOLO QUESTO
set "REPO_URL=https://github.com/USERNAME/NOME_REPO.git"
set "BRANCH=main"

echo =============================
echo GIT SETUP
echo =============================
echo Cartella: %PROJECT_DIR%
echo Repo: %REPO_URL%
echo Branch: %BRANCH%
echo.

cd /d "%PROJECT_DIR%"

if not exist ".git" (
    echo Inizializzo repository git...
    git init
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo Collego repository remoto...
    git remote add origin %REPO_URL%
) else (
    echo Remote gia presente
)

echo.
git add .

set /p msg=Messaggio primo commit: 
if "%msg%"=="" set msg=Initial commit

git commit -m "%msg%"

git branch -M %BRANCH%

echo.
echo Invio su GitHub...
git push -u origin %BRANCH% --force

echo.
echo SETUP COMPLETATO
pause