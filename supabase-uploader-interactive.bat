@echo off
REM Simple launcher for Interactive Mode
REM This file launches the Supabase Uploader in interactive mode

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Quick check for Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Auto-install dependencies if needed
if not exist "node_modules" (
    echo.
    echo [INFO] Installing dependencies for the first time...
    echo.
    call npm install --silent
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Launch interactive mode
cls
echo.
echo ========================================
echo   Supabase File Uploader
echo   Interactive Mode
echo ========================================
echo.
node uploadToSupabase.js --interactive

REM Keep window open if there was an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Press any key to exit...
    pause >nul
)
