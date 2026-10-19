param([switch]$CheckOnly, [switch]$CommitOnly)
$ErrorActionPreference = 'Stop'
$Utf8 = New-Object System.Text.UTF8Encoding($false)
function Quote-Arg([string]$Value) {
    '"' + [regex]::Replace([regex]::Replace($Value, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Git-Run([string[]]$GitArgs, [switch]$AllowFailure) {
    $p = New-Object System.Diagnostics.Process
    $p.StartInfo.FileName = $script:GitExe
    $p.StartInfo.Arguments = ((@('-C', $script:RepoRoot, '-c', 'core.quotePath=false') + $GitArgs | ForEach-Object { Quote-Arg $_ }) -join ' ')
    $p.StartInfo.UseShellExecute = $false
    $p.StartInfo.CreateNoWindow = $true
    $p.StartInfo.RedirectStandardOutput = $true
    $p.StartInfo.RedirectStandardError = $true
    $p.StartInfo.StandardOutputEncoding = $script:Utf8
    $p.StartInfo.StandardErrorEncoding = $script:Utf8
    [void]$p.Start()
    $stdout = $p.StandardOutput.ReadToEndAsync()
    $stderr = $p.StandardError.ReadToEndAsync()
    $p.WaitForExit()
    $r = [pscustomobject]@{ Code=$p.ExitCode; Out=$stdout.Result; Error=$stderr.Result }
    $p.Dispose()
    if ($r.Code -ne 0 -and -not $AllowFailure) { throw ('Git failed: ' + $r.Error.Trim()) }
    $r
}
function Names([string]$Value) { @($Value.Split([char]0) | Where-Object { $_ -ne '' }) }
function Clean-Remote([string]$Url) { $Url.Trim().TrimEnd('/').Replace('git@github.com:', 'https://github.com/').Replace('ssh://git@github.com/', 'https://github.com/') -replace '\.git$', '' }
function Check-Path([string]$Rel) {
    if ($Rel -match '^[/\\]|^[A-Za-z]:|\\|(^|/)\.\.(/|$)|[\x00-\x1f]') { throw ('Unsafe allowlist path: ' + $Rel) }
    if ($Rel -match '(^|/)(\.git|\.local-secrets|\.workbuddy|\.trae|\.zcode|doc|backup|backups|saves|origin_source|output|tmp|node_modules|__pycache__|\.venv)(/|$)|(^|/)\.env(?:\.|$)|(^|/)server_config\.json$|\.(?:bak|backup|log|pyc|lnk)(?:[._-].*)?$') { throw ('Private/generated file is not publishable: ' + $Rel) }
    $first = $Rel.Split('/')[0]
    if ($Rel.Contains('/') -and $first -notin @('.agents','editor','h5_demo','resource','tools')) { throw ('Directory outside public scope: ' + $Rel) }
}
function Check-Content([string]$Rel, [string]$Text) {
    if ($Text -match '(?i)[A-Za-z]:[\\/](?:Users[\\/][^\\/\s"'']+|SOLO|VibeProj)|\.(?:workbuddy|trae|zcode)[\\/]') { throw ('Private computer path found in: ' + $Rel) }
    if ($Text -match '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}|https?://[^/\s:@]+:[^/\s@]+@') { throw ('Credential pattern found in: ' + $Rel) }
}
try {
    $scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $env:WHALE_OPEN_PUBLISH_SCRIPT }
    if (-not $scriptPath) { throw 'Run the push BAT from the public repository.' }
    $script:RepoRoot = [IO.Path]::GetFullPath((Join-Path (Split-Path $scriptPath -Parent) '..')).TrimEnd('\','/')
    $localFile = Join-Path $RepoRoot '.open-source-local.json'
    if (-not (Test-Path -LiteralPath $localFile -PathType Leaf)) { throw 'Local publishing binding is missing. Configure .open-source-local.json locally before publishing.' }
    $local = Get-Content -LiteralPath $localFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $bound = [IO.Path]::GetFullPath([string]$local.root).TrimEnd('\','/')
    if (-not [string]::Equals($RepoRoot, $bound, [StringComparison]::OrdinalIgnoreCase)) { throw 'This script is bound to a different local folder. Nothing was staged or pushed.' }
    if ((Get-Item -LiteralPath $RepoRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'The public repository root cannot be a link.' }
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot '.git') -PathType Container)) { throw 'An independent repository with its own .git directory is required.' }
    $scope = Get-Content -LiteralPath (Join-Path $RepoRoot 'tools/open-source-publish.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ((Split-Path $RepoRoot -Leaf) -ne [string]$scope.folderName) { throw 'Unexpected public repository folder name.' }
    $script:GitExe = (Get-Command git.exe -ErrorAction Stop).Source
    $top = (Git-Run @('rev-parse','--show-toplevel')).Out.Trim()
    if (-not [string]::Equals([IO.Path]::GetFullPath($top).TrimEnd('\','/'), $RepoRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Git root is not the bound public folder.' }
    if ((Git-Run @('branch','--show-current')).Out.Trim() -ne 'main') { throw 'Only the public main branch can be pushed by this launcher.' }
    foreach ($argsForRemote in @(@('remote','get-url','--all','origin'),@('remote','get-url','--push','--all','origin'))) {
        $urls = @((Git-Run $argsForRemote).Out.Trim() -split '\r?\n')
        if ($urls.Count -ne 1 -or (Clean-Remote $urls[0]) -cne [string]$scope.remote) { throw 'Origin does not match the public repository. Nothing was pushed.' }
    }
    if ((Git-Run @('config','--get','remote.origin.mirror') -AllowFailure).Out.Trim() -eq 'true') { throw 'Mirror remotes are not allowed.' }
    $allowed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
    foreach ($rel in $scope.files) { Check-Path $rel; if (-not $allowed.Add([string]$rel)) { throw ('Duplicate allowlist entry: ' + $rel) } }
    foreach ($must in @('tools/open-source-publish.json','tools/push_open_source.ps1')) { if (-not $allowed.Contains($must)) { throw 'Publishing guard files must be allowlisted.' } }
    $tracked = @(Names (Git-Run @('ls-files','-z')).Out)
    $staged = @(Names (Git-Run @('diff','--cached','--name-only','-z')).Out)
    foreach ($rel in @($tracked) + @($staged)) { Check-Path $rel; if (-not $allowed.Contains($rel)) { throw ('Tracked or staged file is outside the allowlist: ' + $rel) } }
    foreach ($entry in (Names (Git-Run @('ls-files','--stage','-z')).Out)) { if ($entry -match '^(120000|160000) ') { throw 'Links/submodules cannot be published by this launcher.' } }
    $present = New-Object 'System.Collections.Generic.List[string]'
    foreach ($rel in $scope.files) {
        $path = Join-Path $RepoRoot $rel
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
        $node = Get-Item -LiteralPath $path -Force
        while ($node.FullName -ne $RepoRoot) {
            if ($node.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('Linked path cannot be published: ' + $rel) }
            $node = Get-Item -LiteralPath (Split-Path $node.FullName -Parent) -Force
        }
        $data = [IO.File]::ReadAllBytes($path)
        if ($data.Length -gt [int64]$scope.maxFileBytes) { throw ('File exceeds the configured size limit: ' + $rel) }
        Check-Content $rel ($Utf8.GetString($data))
        [void]$present.Add($rel)
    }
    $extra = @(Names (Git-Run @('ls-files','--others','--exclude-standard','-z')).Out | Where-Object { -not $allowed.Contains($_) })
    if ($extra.Count) { Write-Host ('Skipping ' + $extra.Count + ' unapproved new file(s). Add intentional files to tools/open-source-publish.json first.') }
    Write-Host ('Public scope checked: ' + $present.Count + ' files. Folder binding, main branch, origin, tracked/staged scope, links and credential scan passed.')
    if ($CheckOnly) { Write-Host 'Check only: no staging, commit, fetch or push.'; exit 0 }
    # Keep the public inventory synchronized only with present, approved paths.
    $resourceCsv = Join-Path $RepoRoot ([string]$scope.resourceInventory)
    $rows = @(Import-Csv -LiteralPath $resourceCsv -Encoding UTF8)
    $resourceRows = @{}
    foreach ($row in $rows) { $resourceRows[[string]$row.'文件'] = $row }
    $updatedRows = @()
    foreach ($rel in @($present | Where-Object { $_.StartsWith('resource/') } | Sort-Object)) {
        $file = Join-Path $RepoRoot $rel
        $row = $resourceRows[$rel]
        if (-not $row) { $row = [pscustomobject][ordered]@{'文件'=$rel;'字节'=0;'SHA256'='';'保留依据'='手动列入公开白名单';'直接引用文件'=''} }
        $row.'字节' = (Get-Item -LiteralPath $file).Length
        $row.'SHA256' = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        $updatedRows += $row
    }
    $csvText = ($updatedRows | ConvertTo-Csv -NoTypeInformation) -join "`r`n"
    [IO.File]::WriteAllText($resourceCsv, $csvText+"`r`n", (New-Object System.Text.UTF8Encoding($true)))
    $inventoryPath = Join-Path $RepoRoot ([string]$scope.fileInventory)
    $inventory = Get-Content -LiteralPath $inventoryPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $items = @(); $totalBytes = [int64]0
    foreach ($rel in @($present | Where-Object { $_ -ne [string]$scope.fileInventory } | Sort-Object)) {
        $file = Join-Path $RepoRoot $rel
        $length = (Get-Item -LiteralPath $file).Length
        $totalBytes += $length
        $items += [pscustomobject]@{path=$rel;bytes=$length;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}
    }
    $inventory.manifest = $items
    $inventory.sourceFiles = @($present | Sort-Object)
    $inventory.files = $present.Count
    $inventory.bytesExcludingManifest = $totalBytes
    $inventory.resources = $updatedRows.Count
    $inventory.resourceBytes = [int64](($updatedRows | Measure-Object -Property '字节' -Sum).Sum)
    [IO.File]::WriteAllText($inventoryPath, ($inventory | ConvertTo-Json -Depth 50)+"`n", $Utf8)
    # Use NUL-delimited literal paths: no shell wildcard expansion and no Windows command-length limit.
    $pathspec = [IO.Path]::GetTempFileName()
    try {
        $paths = @($scope.files | Where-Object { $present.Contains($_) -or $tracked -contains $_ })
        [IO.File]::WriteAllText($pathspec, (($paths -join [char]0) + [char]0), $Utf8)
        [void](Git-Run @('--literal-pathspecs','add','-A',('--pathspec-from-file='+$pathspec),'--pathspec-file-nul'))
    } finally { Remove-Item -LiteralPath $pathspec -Force }
    if ((Git-Run @('diff','--cached','--quiet') -AllowFailure).Code -ne 0) {
        $message = 'Update public game source ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')
        $committed = Git-Run @('commit','--quiet','-m',$message)
        Write-Host ('Committed approved public files: ' + (Git-Run @('rev-parse','--short','HEAD')).Out.Trim())
    } else { Write-Host 'No allowlisted changes to commit.' }
    if ($CommitOnly) { Write-Host 'Local commit only: no fetch or push.'; exit 0 }
    # Do not merge, rebase, overwrite remote commits, or force push automatically.
    $remote = Git-Run @('ls-remote','--heads','origin','refs/heads/main')
    $range = 'HEAD'
    if ($remote.Out.Trim()) {
        [void](Git-Run @('fetch','--no-tags','origin','main'))
        if ((Git-Run @('merge-base','--is-ancestor','FETCH_HEAD','HEAD') -AllowFailure).Code -ne 0) { throw 'The remote has changes missing locally. Review and integrate them before retrying; no force push was attempted.' }
        $range = 'FETCH_HEAD..HEAD'
    }
    # Inspect outgoing commits as well, so an already-created commit cannot bypass the scope guard.
    $commits = @((Git-Run @('rev-list',$range)).Out.Trim() -split '\r?\n' | Where-Object { $_ })
    foreach ($commit in $commits) {
        foreach ($rel in (Names (Git-Run @('diff-tree','--root','--no-commit-id','--name-only','-r','-z',$commit)).Out)) {
            Check-Path $rel
            if (-not $allowed.Contains($rel)) { throw ('Outgoing history contains an unapproved file: ' + $rel) }
            $blob = Git-Run @('show',($commit+':'+$rel)) -AllowFailure
            if ($blob.Code -eq 0) { Check-Content $rel $blob.Out }
        }
    }
    $pushed = Git-Run @('push','-u','origin','HEAD:refs/heads/main')
    Write-Host $pushed.Out.Trim()
    Write-Host $pushed.Error.Trim()
    Write-Host ('Published only the allowlisted public folder: ' + $scope.remote)
    exit 0
} catch {
    Write-Host ('Stopped: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No other repository or folder will be used as a fallback.'
    exit 1
}
