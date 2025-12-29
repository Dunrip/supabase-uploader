@echo off
setlocal enabledelayedexpansion

REM CLI Tool for Supabase File Uploader
REM Usage: supabase-uploader.bat [command] [arguments]
REM Examples:
REM   supabase-uploader.bat file.pdf
REM   supabase-uploader.bat --list
REM   supabase-uploader.bat --download path/to/file.pdf documents

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Auto-install dependencies if needed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install --silent
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies
        exit /b 1
    )
)

REM Check if .env file exists (warning only, don't block)
if not exist ".env" (
    echo [WARNING] .env file not found! Some operations may fail.
    echo Create a .env file with your Supabase credentials (see env.example)
    echo.
)

REM If no arguments provided, show help
if "%~1"=="" (
    echo Supabase File Uploader - CLI Tool
    echo.
    echo Usage:
    echo   supabase-uploader.bat [command] [arguments]
    echo.
    echo Commands:
    echo   file.pdf [bucket] [path]     Upload a file
    echo   --list [bucket] [folder]      List files in bucket
    echo   --download [path] [bucket]   Download a file
    echo   --delete [path] [bucket]     Delete a file
    echo   --batch [files...] [bucket]  Upload multiple files
    echo   --interactive                Launch interactive mode
    echo   --help                       Show this help
    echo.
    echo Examples:
    echo   supabase-uploader.bat document.pdf
    echo   supabase-uploader.bat --list documents
    echo   supabase-uploader.bat --download images/photo.jpg images
    echo.
    echo For interactive mode, use: supabase-uploader-interactive.bat
    echo.
    exit /b 0
)

REM Run the script with all passed arguments
node uploadToSupabase.js %*

REM Capture and return exit code
set "EXIT_CODE=%ERRORLEVEL%"
endlocal
exit /b %EXIT_CODE%
