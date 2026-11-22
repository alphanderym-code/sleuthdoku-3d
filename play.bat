@echo off
rem Starts the local server (if not already running) and opens Tiny Crimes.
cd /d "%~dp0"
powershell -NoProfile -Command "if (-not (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue)) { exit 1 }"
if errorlevel 1 start "Tiny Crimes server" /min python -m http.server 8765
timeout /t 1 /nobreak >nul
start "" http://localhost:8765/
