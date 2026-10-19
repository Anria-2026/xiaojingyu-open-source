@echo off
setlocal
set "WHALE_OPEN_PUBLISH_SCRIPT=%~dp0tools\push_open_source.ps1"
powershell.exe -NoProfile -Command "& ([ScriptBlock]::Create([IO.File]::ReadAllText($env:WHALE_OPEN_PUBLISH_SCRIPT)))" %*
set "WHALE_OPEN_EXIT=%ERRORLEVEL%"
if not "%WHALE_OPEN_EXIT%"=="0" pause
exit /b %WHALE_OPEN_EXIT%
