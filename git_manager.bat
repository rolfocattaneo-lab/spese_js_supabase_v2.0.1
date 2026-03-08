@echo off
setlocal enabledelayedexpansion

REM =====================================================
REM CONFIGURAZIONE
REM Cambia solo questi due valori per ogni nuovo progetto
REM =====================================================
set "REPO_URL=REPO_URL=https://github.com/rolfocattaneo-lab/spese_js_supabase_v2.0.1.git"
set "BRANCH=main"

REM usa automaticamente la cartella dove si trova lo script
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

cd /d "%PROJECT_DIR%" || (
  echo ERRORE: cartella non trovata.
  pause
  exit /b 1
)

:START
cls
echo ==========================================
echo GIT MANAGER
echo ==========================================
echo Cartella: %PROJECT_DIR%
echo Repo    : %REPO_URL%
echo Branch  : %BRANCH%
echo ==========================================
echo.

if not exist ".git" goto FIRST_SETUP

git remote get-url origin >nul 2>nul
if errorlevel 1 goto FIRST_SETUP

goto MENU

:FIRST_SETUP
echo Repository non inizializzata o remote mancante.
echo.
echo Avvio setup automatico...
echo.

if not exist ".git" (
  git init
)

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)

git add .

set /p COMMIT_MSG=Messaggio commit iniziale: 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Initial commit"

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Nessun nuovo commit creato.
)

git branch -M %BRANCH%

echo.
echo Provo push iniziale...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo.
  echo Il push normale non e' riuscito.
  echo Probabilmente il repository remoto contiene gia' file diversi.
  echo.
  set /p FORCE_SETUP=Vuoi eseguire FORCE PUSH? (S/N): 
  if /I "!FORCE_SETUP!"=="S" (
    git push -u origin %BRANCH% --force
  ) else (
    echo Setup interrotto senza force push.
    pause
    exit /b 1
  )
)

echo.
echo Setup completato.
pause
goto MENU

:MENU
cls
echo ==========================================
echo GIT MANAGER
echo ==========================================
echo 1 - Status
echo 2 - Pull
echo 3 - Push
echo 4 - Push forzato
echo 5 - Esci
echo ==========================================
set /p CHOICE=Seleziona operazione: 

if "%CHOICE%"=="1" goto STATUS
if "%CHOICE%"=="2" goto PULL
if "%CHOICE%"=="3" goto PUSH
if "%CHOICE%"=="4" goto FORCE_PUSH
if "%CHOICE%"=="5" goto END
goto MENU

:STATUS
echo.
git status
echo.
pause
goto MENU

:PULL
echo.
git pull origin %BRANCH%
if errorlevel 1 (
  echo.
  echo Pull non riuscito.
  echo Controlla eventuali conflitti o differenze locali.
)
echo.
pause
goto MENU

:PUSH
echo.
git add .

set /p COMMIT_MSG=Messaggio commit: 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Update"

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Nessun nuovo commit creato o niente da committare.
)

echo.
git push origin %BRANCH%
if errorlevel 1 (
  echo.
  echo Push normale non riuscito.
  echo Il remoto potrebbe contenere modifiche non presenti in locale.
  echo.
  set /p FORCE_PUSH_NOW=Vuoi eseguire FORCE PUSH? (S/N): 
  if /I "!FORCE_PUSH_NOW!"=="S" (
    git push origin %BRANCH% --force
  )
)

echo.
pause
goto MENU

:FORCE_PUSH
echo.
git add .

set /p COMMIT_MSG=Messaggio commit: 
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Forced update"

git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Nessun nuovo commit creato o niente da committare.
)

echo.
echo ATTENZIONE: il force push sovrascrive il remoto.
set /p CONFIRM_FORCE=Confermi FORCE PUSH? (S/N): 
if /I "!CONFIRM_FORCE!"=="S" (
  git push origin %BRANCH% --force
) else (
  echo Operazione annullata.
)

echo.
pause
goto MENU

:END
endlocal
exit /b 0