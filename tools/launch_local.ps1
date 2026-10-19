param(
    [ValidateSet('game', 'editor')][string]$Mode,
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$LauncherArguments
)
$ErrorActionPreference = 'Stop'

function Test-WhalePython {
    param([string]$Executable, [string[]]$Prefix = @())
    if (-not $Executable) { return $null }
    try {
        $result = & $Executable @Prefix -c 'import sys; sys.exit(1) if sys.version_info < (3,10) else print(sys.executable)' 2>$null
        if ($LASTEXITCODE -eq 0 -and $result) {
            $path = ([string]($result | Select-Object -Last 1)).Trim()
            if (Test-Path -LiteralPath $path -PathType Leaf) { return $path }
        }
    } catch { }
    return $null
}

function Find-WhalePython {
    param([string]$ProjectRoot)
    if ($env:WHALE_PYTHON) {
        $python = Test-WhalePython $env:WHALE_PYTHON
        if (-not $python) { throw 'WHALE_PYTHON must point to a working Python 3.10+ executable.' }
        return $python
    }
    $python = Test-WhalePython (Join-Path $ProjectRoot '.venv/Scripts/python.exe')
    if ($python) { return $python }
    $launcher = Get-Command py.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($launcher -and $launcher.Source -notmatch '\\WindowsApps\\') {
        $python = Test-WhalePython $launcher.Source @('-3')
        if ($python) { return $python }
    }
    foreach ($name in @('python.exe', 'python3.exe')) {
        $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command -and $command.Source -notmatch '\\WindowsApps\\') {
            $python = Test-WhalePython $command.Source
            if ($python) { return $python }
        }
    }
    foreach ($registry in @('HKCU:\Software\Python\PythonCore', 'HKLM:\Software\Python\PythonCore', 'HKLM:\Software\WOW6432Node\Python\PythonCore')) {
        foreach ($entry in @(Get-ChildItem -LiteralPath $registry -ErrorAction SilentlyContinue)) {
            $install = Get-Item -LiteralPath ($entry.PSPath + '\InstallPath') -ErrorAction SilentlyContinue
            if ($install) {
                $candidate = $install.GetValue('ExecutablePath')
                if (-not $candidate -and $install.GetValue('')) { $candidate = Join-Path $install.GetValue('') 'python.exe' }
                $python = Test-WhalePython $candidate
                if ($python) { return $python }
            }
        }
    }
    foreach ($base in @((Join-Path $env:LOCALAPPDATA 'Programs/Python'), $env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $base) { continue }
        foreach ($directory in @(Get-ChildItem -LiteralPath $base -Directory -Filter 'Python3*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending)) {
            $python = Test-WhalePython (Join-Path $directory.FullName 'python.exe')
            if ($python) { return $python }
        }
    }
    return $null
}

function Get-WhaleInstallerSpec {
    param($Config, [string]$Architecture)
    $spec = $Config.installers.$Architecture
    if (-not $spec) { throw "Unsupported Windows architecture: $Architecture" }
    $url = [Uri]($Config.downloadBase + $spec.file)
    if ($url.Scheme -ne 'https' -or $url.Host -ne 'www.python.org' -or $spec.file -ne [IO.Path]::GetFileName($spec.file)) {
        throw 'The Python installer must come from the official HTTPS download source.'
    }
    return @{ Url = $url.AbsoluteUri; File = $spec.file; Sha256 = $spec.sha256 }
}

function Get-WhaleInstaller {
    param($Spec, [string]$CacheDirectory)
    $cache = [IO.Path]::GetFullPath($CacheDirectory)
    [IO.Directory]::CreateDirectory($cache) | Out-Null
    $installer = Join-Path $cache $Spec.File
    if ((Test-Path -LiteralPath $installer -PathType Leaf) -and (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -eq $Spec.Sha256) {
        return $installer
    }
    $partial = Join-Path $cache ($Spec.File + '.' + [Guid]::NewGuid().ToString('N') + '.partial')
    try {
        Write-Host '正在从 Python 官网下载安装器，首次下载需要联网，请稍候……'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $savedProgress = $ProgressPreference
        try {
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -UseBasicParsing -Uri $Spec.Url -OutFile $partial -TimeoutSec 180
        } finally { $ProgressPreference = $savedProgress }
        if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $Spec.Sha256) {
            throw '下载文件校验失败，请检查网络后重新双击启动文件。'
        }
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($partial)) -ne $cache -or [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($installer)) -ne $cache) {
            throw 'Unexpected bootstrap cache path.'
        }
        Move-Item -LiteralPath $partial -Destination $installer -Force
        return $installer
    } finally {
        if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($partial)) -eq $cache -and (Test-Path -LiteralPath $partial)) {
            Remove-Item -LiteralPath $partial -Force
        }
    }
}

function Install-WhalePython {
    param($Config)
    $architecture = $env:PROCESSOR_ARCHITEW6432
    if (-not $architecture) { $architecture = $env:PROCESSOR_ARCHITECTURE }
    $spec = Get-WhaleInstallerSpec $Config $architecture.ToUpperInvariant()
    $installer = Get-WhaleInstaller $spec (Join-Path $env:LOCALAPPDATA $Config.cacheDirectory)
    $target = Join-Path (Join-Path $env:LOCALAPPDATA 'Programs/Python') $Config.installDirectory
    Write-Host '下载完成。请在 Python 安装向导中点“安装”，安装后会自动继续启动。'
    $options = @('InstallAllUsers=0', 'Include_pip=1', 'Include_launcher=0', 'Include_test=0', 'PrependPath=0', 'SimpleInstall=1', ('TargetDir="' + $target + '"'))
    $process = Start-Process -FilePath $installer -ArgumentList $options -WindowStyle Normal -Wait -PassThru
    if ($process.ExitCode -notin @(0, 3010)) {
        throw ('Python 安装未完成（退出码 ' + $process.ExitCode + '）。可重新双击启动文件继续。')
    }
    $python = Test-WhalePython (Join-Path $target 'python.exe')
    if (-not $python) { throw '安装后未找到可用 Python，请保留错误信息并重新启动。' }
    return $python
}

if ($Mode) {
    try {
        $env:PYTHONUTF8 = '1'
        $toolsDirectory = Split-Path -Parent $env:WHALE_LAUNCH_SCRIPT
        $projectRoot = Split-Path -Parent $toolsDirectory
        Write-Host '正在检查 Python 运行环境……'
        $python = Find-WhalePython $projectRoot
        if (-not $python) {
            $config = Get-Content -LiteralPath (Join-Path $toolsDirectory 'python-bootstrap.json') -Raw | ConvertFrom-Json
            $python = Install-WhalePython $config
        }
        Write-Host 'Python 已就绪，正在启动……'
        & $python -B (Join-Path $toolsDirectory 'start_local.py') $Mode @LauncherArguments
        exit $LASTEXITCODE
    } catch {
        Write-Host ('启动失败：' + $_.Exception.Message) -ForegroundColor Red
        exit 1
    }
}
