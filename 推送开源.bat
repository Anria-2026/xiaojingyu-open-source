@echo off
setlocal
set "WHALE_OPEN_PUBLISH_SCRIPT=%~dp0tools\push_open_source.ps1"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "& ([ScriptBlock]::Create([IO.File]::ReadAllText($env:WHALE_OPEN_PUBLISH_SCRIPT)))" %*
set "WHALE_OPEN_EXIT=%ERRORLEVEL%"
if not "%WHALE_OPEN_EXIT%"=="0" pause
exit /b %WHALE_OPEN_EXIT%
