@echo off
setlocal
set "WHALE_LAUNCH_SCRIPT=%~dp0launch_local.ps1"
powershell.exe -NoProfile -Command "& ([ScriptBlock]::Create([IO.File]::ReadAllText($env:WHALE_LAUNCH_SCRIPT)))" %*
set "WHALE_LAUNCH_EXIT=%ERRORLEVEL%"
if not "%WHALE_LAUNCH_EXIT%"=="0" pause
exit /b %WHALE_LAUNCH_EXIT%
