@echo off
cd /d "%~dp0"

rem サーバーを独立した最小化ウィンドウで起動する。
rem （この START.bat のウィンドウを閉じても、サーバーは止まりません）
start "JoseikinServer" /min cmd /k "%~dp0server.bat"

rem サーバーの準備が完了したら自動でブラウザを開く
start "" /min "%~dp0open-when-ready.bat"

exit
