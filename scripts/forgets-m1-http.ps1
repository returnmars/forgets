$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $RepoRoot ".forgets/m1-http"
$ResultsPath = Join-Path $OutDir "results.json"
$Fixture = Join-Path $RepoRoot "test-files/forgets-m1/native-http-smoke.ts"
$Binary = Join-Path $OutDir "native-http-smoke.exe"
$DefaultPerry = Join-Path $RepoRoot "node_modules/.bin/perry.cmd"
$SourcePerryDir = Join-Path $RepoRoot ".forgets/perry-github-main/target/release"
$SourcePerry = Join-Path $SourcePerryDir "perry.exe"
$SourceRuntime = Join-Path $SourcePerryDir "perry_runtime.lib"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

if ($env:PERRY) {
  $Perry = $env:PERRY
  $PerryLabel = "PERRY=$env:PERRY"
} elseif ((Test-Path $SourcePerry) -and (Test-Path $SourceRuntime)) {
  $Perry = $SourcePerry
  $env:PERRY_RUNTIME_DIR = $SourcePerryDir
  $env:PERRY_LIB_DIR = $SourcePerryDir
  $PerryLabel = "source-built Perry: $SourcePerry"
} elseif (Test-Path $DefaultPerry) {
  $Perry = $DefaultPerry
  $PerryLabel = "project-local @perryts/perry"
} else {
  throw "project-local Perry CLI not found. Run npm install."
}

Write-Host "Using Perry: $PerryLabel"

$Port = Get-Random -Minimum 43100 -Maximum 48999
$Result = [ordered]@{
  Case = "native-http-smoke"
  Port = $Port
  Check = "not-run"
  Compile = "not-run"
  Run = "not-run"
  Healthz = "not-run"
  Echo = "not-run"
  Notes = ""
  Diagnostics = [ordered]@{}
}

function Save-Result {
  @($script:Result) | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $script:ResultsPath
}

function Read-LogTail {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return ""
  }

  return ((Get-Content -Tail 40 $Path) -join "`n")
}

function Invoke-Perry {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & $script:Perry @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
    if ($null -eq $ExitCode) {
      $ExitCode = 0
    }

    $Lines = @($Output | ForEach-Object {
      if ($_ -is [System.Management.Automation.ErrorRecord]) {
        $_.Exception.Message
      } else {
        $_.ToString()
      }
    } | Where-Object { $_ -and $_ -ne "System.Management.Automation.RemoteException" })

    return [ordered]@{
      ExitCode = $ExitCode
      Output = $Lines
    }
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }
}

function Invoke-Curl {
  param([string[]]$Arguments)

  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $Output = & curl.exe @Arguments 2>&1
    $ExitCode = $LASTEXITCODE
    if ($null -eq $ExitCode) {
      $ExitCode = 0
    }

    $Lines = @($Output | ForEach-Object {
      if ($_ -is [System.Management.Automation.ErrorRecord]) {
        $_.Exception.Message
      } else {
        $_.ToString()
      }
    } | Where-Object { $_ -and $_ -ne "System.Management.Automation.RemoteException" })

    return [ordered]@{
      ExitCode = $ExitCode
      Output = $Lines
      Text = ($Lines -join "`n")
    }
  } finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
  }
}

Write-Host "== native-http-smoke: perry check =="
$Check = Invoke-Perry @("check", $Fixture)
$Check.Output | ForEach-Object { Write-Host $_ }

if ($Check.ExitCode -ne 0) {
  $Result.Check = "failed"
  $Result.Notes = ($Check.Output -join "`n")
  Save-Result
  throw "native-http-smoke failed perry check"
}

$Result.Check = "passed"

Write-Host "== native-http-smoke: perry compile =="
$Compile = Invoke-Perry @("compile", $Fixture, "-o", $Binary)
$Compile.Output | ForEach-Object { Write-Host $_ }

if ($Compile.ExitCode -ne 0) {
  $Result.Compile = "failed"
  $Result.Notes = ($Compile.Output -join "`n")
  Save-Result
  throw "native-http-smoke failed perry compile"
}

$Result.Compile = "passed"

$StdOut = Join-Path $OutDir "server.out.log"
$StdErr = Join-Path $OutDir "server.err.log"
Remove-Item -Force -ErrorAction SilentlyContinue $StdOut, $StdErr

Write-Host "== native-http-smoke: start server =="
$Process = Start-Process `
  -FilePath $Binary `
  -ArgumentList @($Port) `
  -PassThru `
  -RedirectStandardOutput $StdOut `
  -RedirectStandardError $StdErr `
  -WindowStyle Hidden

$Result.Run = "started"

try {
  $HealthBody = $null
  $LastHealth = $null
  for ($Attempt = 0; $Attempt -lt 40; $Attempt += 1) {
    Start-Sleep -Milliseconds 250
    $Process.Refresh()
    if ($Process.HasExited) {
      break
    }

    $LastHealth = Invoke-Curl @("-sS", "--max-time", "2", "http://127.0.0.1:$Port/healthz")
    $HealthBody = $LastHealth.Text
    if ($LastHealth.ExitCode -eq 0 -and $HealthBody) {
      break
    }
  }

  if ($HealthBody -ne '{"ok":true,"runtime":"forgets"}') {
    $Result.Healthz = "failed"
    $Result.Diagnostics = [ordered]@{
      HealthExitCode = if ($LastHealth) { $LastHealth.ExitCode } else { $null }
      HealthOutput = if ($LastHealth) { $LastHealth.Output } else { @() }
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /healthz body: $HealthBody"
    Save-Result
    throw "native-http-smoke healthz request failed"
  }

  $Result.Healthz = "passed"

  $Echo = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "-X",
    "POST",
    "-H",
    "content-type: text/plain",
    "-H",
    "x-test: native",
    "--data",
    "hello",
    "http://127.0.0.1:$Port/echo?name=Ada"
  )
  $EchoBody = $Echo.Text

  $ExpectedEcho = '{"method":"POST","path":"/echo","query":"Ada","header":"native","body":"hello"}'
  if ($Echo.ExitCode -ne 0 -or $EchoBody -ne $ExpectedEcho) {
    $Result.Echo = "failed"
    $Result.Diagnostics = [ordered]@{
      EchoExitCode = $Echo.ExitCode
      EchoOutput = $Echo.Output
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /echo body: $EchoBody"
    Save-Result
    throw "native-http-smoke echo request failed"
  }

  $Result.Echo = "passed"
  $Result.Run = "passed"
  $Result.Notes = "GET /healthz and POST /echo passed"
  Save-Result
} finally {
  if ($Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force
    Wait-Process -Id $Process.Id -ErrorAction SilentlyContinue
  }
}
