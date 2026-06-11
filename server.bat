@echo off
title JoseikinServer - leave this minimized (use STOP.bat to quit)
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
npm start
echo.
echo The server has stopped. Press any key to close.
pause >nul
