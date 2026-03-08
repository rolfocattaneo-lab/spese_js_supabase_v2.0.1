@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "BRANCH=main"

cd /d "%PROJECT_DIR%"

:MENU
cls
echo =============================
echo GIT MANAGER
echo =============================
echo Cartella: %PROJECT_DIR%
echo Branch: %BRANCH%
echo.
echo 1 - Status
echo 2 - Pull
echo 3 - Push
echo 4 - Esci
echo =============================

set /p scelta=Seleziona operazione: 

if "%scelta%"=="1" goto STATUS
if "%scelta%"=="2" goto PULL
if "%scelta%"=="3" goto PUSH
if "%scelta%"=="4" exit

goto MENU

:STATUS
git status
pause
goto MENU

:PULL
git pull origin %BRANCH%
pause
goto MENU

:PUSH
git add .

set /p msg=Messaggio commit: 
if "%msg%"=="" set msg=Update

git commit -m "%msg%"
git push origin %BRANCH%

pause
goto MENU