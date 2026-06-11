@echo off
rem Wait until the server is actually listening, then open the browser.
set /a tries=0
:wait
curl -s -o nul http://localhost:3000
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% geq 90 goto failed
timeout /t 1 >nul
goto wait

:ready
start "" http://localhost:3000
exit

:failed
echo.
echo The server did not start within 90 seconds.
echo Please check the file "server.log" in this folder, or contact support.
echo.
pause
exit
