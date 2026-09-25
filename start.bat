@echo off
title Apex Gym Management System
cls
echo ========================================================================
echo   APEX FITNESS CLUB — FULL-STACK SYSTEM LAUNCHER
echo ========================================================================
echo.
echo [*] Checking Python runtime...

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PY_EXE=py
    goto RUN_SERVER
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    set PY_EXE=python
    goto RUN_SERVER
)

echo [!] Python is not detected in your PATH.
echo     Please install Python 3.10+ from https://www.python.org/downloads/
echo     (Make sure to check "Add Python to PATH" during installation)
echo.
pause
exit /b 1

:RUN_SERVER
echo [+] Python detected: %PY_EXE%
echo [*] Starting Backend API and Serving Frontend on Port 5000...
echo [*] Google Chrome will automatically open at http://127.0.0.1:5000/login
echo.
%PY_EXE% run.py
pause
