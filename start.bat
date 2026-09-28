@echo off
title Apex Gym Management System
cd /d "%~dp0"
echo ========================================================
echo   Launching Apex Gym Management System...
echo ========================================================
py run.py
if %errorlevel% neq 0 (
    python run.py
)
if %errorlevel% neq 0 (
    echo.
    echo [!] Python is not recognized on this computer.
    echo     Please install Python 3 from https://www.python.org/downloads/
    echo     IMPORTANT: Check the box "Add python.exe to PATH" during installation!
    echo.
    pause
)
