@echo off
echo Stopping the Joseikin Shindan System...
taskkill /F /IM node.exe >nul 2>&1
echo Done. You can close this window.
timeout /t 3 >nul
exit
