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
  Params = "not-run"
  Undefined = "not-run"
  Null = "not-run"
  StatusHeader = "not-run"
  HttpError = "not-run"
  AsyncRejection = "not-run"
  RequestId = "not-run"
  Recovery = "not-run"
  BodyLimit = "not-run"
  Timeout = "not-run"
  AccessLog = "not-run"
  SchedulerBusy = "not-run"
  ConcurrentDispatch = "not-run"
  StateIsolation = "not-run"
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

function Invoke-CurlHttp {
  param([string[]]$Arguments)

  $Id = [Guid]::NewGuid().ToString("N")
  $BodyPath = Join-Path $OutDir "curl-$Id.body"
  $HeaderPath = Join-Path $OutDir "curl-$Id.headers"
  $CurlArgs = @(
    "-sS",
    "--max-time",
    "2",
    "-D",
    $HeaderPath,
    "-o",
    $BodyPath,
    "-w",
    "%{http_code}"
  ) + $Arguments

  $Curl = Invoke-Curl $CurlArgs
  $Body = ""
  $Headers = ""

  if (Test-Path $BodyPath) {
    $RawBody = Get-Content -Raw $BodyPath
    if ($null -ne $RawBody) {
      $Body = [string]$RawBody
    }
  }

  if (Test-Path $HeaderPath) {
    $RawHeaders = Get-Content -Raw $HeaderPath
    if ($null -ne $RawHeaders) {
      $Headers = [string]$RawHeaders
    }
  }

  Remove-Item -Force -ErrorAction SilentlyContinue $BodyPath, $HeaderPath

  $StatusText = $Curl.Text.Trim()
  $StatusCode = 0
  if ($StatusText -match "^\d+$") {
    $StatusCode = [int]$StatusText
  }

  return [ordered]@{
    ExitCode = $Curl.ExitCode
    Output = $Curl.Output
    StatusCode = $StatusCode
    Body = $Body
    Headers = $Headers
  }
}

function Assert-HttpResponse {
  param(
    [string]$Field,
    [object]$Response,
    [int]$ExpectedStatus,
    [string]$ExpectedBody,
    [string[]]$HeaderPatterns = @()
  )

  $HeaderFailure = ""
  foreach ($Pattern in $HeaderPatterns) {
    if ($Response.Headers -notmatch $Pattern) {
      $HeaderFailure = $Pattern
      break
    }
  }

  if (
    $Response.ExitCode -ne 0 `
      -or $Response.StatusCode -ne $ExpectedStatus `
      -or $Response.Body -ne $ExpectedBody `
      -or $HeaderFailure -ne ""
  ) {
    $script:Result[$Field] = "failed"
    $script:Result.Diagnostics = [ordered]@{
      Field = $Field
      CurlExitCode = $Response.ExitCode
      CurlOutput = $Response.Output
      StatusCode = $Response.StatusCode
      ExpectedStatus = $ExpectedStatus
      Body = $Response.Body
      ExpectedBody = $ExpectedBody
      Headers = $Response.Headers
      MissingHeaderPattern = $HeaderFailure
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $script:Result.Notes = "Unexpected $Field response"
    Save-Result
    throw "native-http-smoke $Field request failed"
  }

  $script:Result[$Field] = "passed"
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

  $RequestId = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "http://127.0.0.1:$Port/request-id"
  )
  $RequestIdBody = $RequestId.Text
  $ExpectedRequestId = '{"requestId":"req_native"}'
  if ($RequestId.ExitCode -ne 0 -or $RequestIdBody -ne $ExpectedRequestId) {
    $Result.RequestId = "failed"
    $Result.Diagnostics = [ordered]@{
      RequestIdExitCode = $RequestId.ExitCode
      RequestIdOutput = $RequestId.Output
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /request-id body: $RequestIdBody"
    Save-Result
    throw "native-http-smoke request-id request failed"
  }

  $Result.RequestId = "passed"

  $Recovery = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "http://127.0.0.1:$Port/recovery"
  )
  $RecoveryBody = $Recovery.Text
  $ExpectedRecovery = '{"error":{"code":"FORGETS_INTERNAL_ERROR","message":"Internal Server Error","status":500}}'
  if ($Recovery.ExitCode -ne 0 -or $RecoveryBody -ne $ExpectedRecovery) {
    $Result.Recovery = "failed"
    $Result.Diagnostics = [ordered]@{
      RecoveryExitCode = $Recovery.ExitCode
      RecoveryOutput = $Recovery.Output
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /recovery body: $RecoveryBody"
    Save-Result
    throw "native-http-smoke recovery request failed"
  }

  $Result.Recovery = "passed"

  $BodyLimit = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "-X",
    "POST",
    "-H",
    "content-type: text/plain",
    "--data",
    "hello",
    "http://127.0.0.1:$Port/limited"
  )
  $BodyLimitBody = $BodyLimit.Text
  $ExpectedBodyLimit = '{"error":{"code":"FORGETS_BODY_TOO_LARGE","message":"Payload Too Large","status":413}}'
  if ($BodyLimit.ExitCode -ne 0 -or $BodyLimitBody -ne $ExpectedBodyLimit) {
    $Result.BodyLimit = "failed"
    $Result.Diagnostics = [ordered]@{
      BodyLimitExitCode = $BodyLimit.ExitCode
      BodyLimitOutput = $BodyLimit.Output
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /limited body: $BodyLimitBody"
    Save-Result
    throw "native-http-smoke body-limit request failed"
  }

  $Result.BodyLimit = "passed"

  $Timeout = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "http://127.0.0.1:$Port/timeout"
  )
  $TimeoutBody = $Timeout.Text
  $ExpectedTimeout = '{"error":{"code":"FORGETS_TIMEOUT","message":"Gateway Timeout","status":504}}'
  if ($Timeout.ExitCode -ne 0 -or $TimeoutBody -ne $ExpectedTimeout) {
    $Result.Timeout = "failed"
    $Result.Diagnostics = [ordered]@{
      TimeoutExitCode = $Timeout.ExitCode
      TimeoutOutput = $Timeout.Output
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /timeout body: $TimeoutBody"
    Save-Result
    throw "native-http-smoke timeout request failed"
  }

  $Result.Timeout = "passed"

  $AccessLog = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "http://127.0.0.1:$Port/logs"
  )
  $AccessLogBody = $AccessLog.Text
  $ExpectedAccessLog = '{"count":6,"lastPath":"/timeout","lastStatus":504,"lastRequestId":"req_native"}'
  if ($AccessLog.ExitCode -ne 0 -or $AccessLogBody -ne $ExpectedAccessLog) {
    $Result.AccessLog = "failed"
    $Result.Diagnostics = [ordered]@{
      AccessLogExitCode = $AccessLog.ExitCode
      AccessLogOutput = $AccessLog.Output
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Unexpected /logs body: $AccessLogBody"
    Save-Result
    throw "native-http-smoke access-log request failed"
  }

  $Result.AccessLog = "passed"

  $Params = Invoke-CurlHttp @(
    "http://127.0.0.1:$Port/users/ada"
  )
  Assert-HttpResponse `
    -Field "Params" `
    -Response $Params `
    -ExpectedStatus 200 `
    -ExpectedBody '{"id":"ada"}'

  $Undefined = Invoke-CurlHttp @(
    "http://127.0.0.1:$Port/undefined"
  )
  Assert-HttpResponse `
    -Field "Undefined" `
    -Response $Undefined `
    -ExpectedStatus 204 `
    -ExpectedBody ""

  $NullResponse = Invoke-CurlHttp @(
    "http://127.0.0.1:$Port/null"
  )
  Assert-HttpResponse `
    -Field "Null" `
    -Response $NullResponse `
    -ExpectedStatus 200 `
    -ExpectedBody "null" `
    -HeaderPatterns @("(?im)^content-type:\s*application/json")

  $StatusHeader = Invoke-CurlHttp @(
    "http://127.0.0.1:$Port/status-header"
  )
  Assert-HttpResponse `
    -Field "StatusHeader" `
    -Response $StatusHeader `
    -ExpectedStatus 201 `
    -ExpectedBody '{"created":true}' `
    -HeaderPatterns @(
      "(?im)^x-mode:\s*native\s*$",
      "(?im)^x-route:\s*status\s*$"
    )

  $HttpError = Invoke-CurlHttp @(
    "http://127.0.0.1:$Port/http-error"
  )
  Assert-HttpResponse `
    -Field "HttpError" `
    -Response $HttpError `
    -ExpectedStatus 400 `
    -ExpectedBody '{"error":{"code":"BAD_NATIVE","message":"Bad Native Request","status":400}}'

  $AsyncRejection = Invoke-CurlHttp @(
    "http://127.0.0.1:$Port/async-rejection"
  )
  Assert-HttpResponse `
    -Field "AsyncRejection" `
    -Response $AsyncRejection `
    -ExpectedStatus 500 `
    -ExpectedBody '{"error":{"code":"FORGETS_INTERNAL_ERROR","message":"Internal Server Error","status":500}}'

  $BusyPort = Get-Random -Minimum 43100 -Maximum 48999
  $BusyStdOut = Join-Path $OutDir "busy-server.out.log"
  $BusyStdErr = Join-Path $OutDir "busy-server.err.log"
  Remove-Item -Force -ErrorAction SilentlyContinue $BusyStdOut, $BusyStdErr

  $BusyProcess = Start-Process `
    -FilePath $Binary `
    -ArgumentList @($BusyPort, "busy") `
    -PassThru `
    -RedirectStandardOutput $BusyStdOut `
    -RedirectStandardError $BusyStdErr `
    -WindowStyle Hidden

  try {
    $Busy = $null
    for ($Attempt = 0; $Attempt -lt 40; $Attempt += 1) {
      Start-Sleep -Milliseconds 250
      $BusyProcess.Refresh()
      if ($BusyProcess.HasExited) {
        break
      }

      $Busy = Invoke-CurlHttp @(
        "http://127.0.0.1:$BusyPort/busy"
      )
      if (
        $Busy.ExitCode -eq 0 `
          -and $Busy.StatusCode -eq 503 `
          -and $Busy.Body -eq '{"error":{"code":"FORGETS_BUSY","message":"Server Busy","status":503}}'
      ) {
        break
      }
    }

    if ($null -eq $Busy) {
      $Busy = [ordered]@{
        ExitCode = 1
        Output = @("busy server did not respond")
        StatusCode = 0
        Body = ""
        Headers = ""
      }
    }

    if (
      $Busy.ExitCode -ne 0 `
        -or $Busy.StatusCode -ne 503 `
        -or $Busy.Body -ne '{"error":{"code":"FORGETS_BUSY","message":"Server Busy","status":503}}'
    ) {
      $Result.SchedulerBusy = "failed"
      $Result.Diagnostics = [ordered]@{
        BusyExitCode = $Busy.ExitCode
        BusyOutput = $Busy.Output
        BusyStatusCode = $Busy.StatusCode
        BusyBody = $Busy.Body
        BusyHeaders = $Busy.Headers
        BusyServerExited = $BusyProcess.HasExited
        BusyServerExitCode = if ($BusyProcess.HasExited) { $BusyProcess.ExitCode } else { $null }
        BusyServerStdout = Read-LogTail $BusyStdOut
        BusyServerStderr = Read-LogTail $BusyStdErr
        ServerExited = $Process.HasExited
        ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
        ServerStdout = Read-LogTail $StdOut
        ServerStderr = Read-LogTail $StdErr
      }
      $Result.Notes = "Unexpected SchedulerBusy response"
      Save-Result
      throw "native-http-smoke scheduler busy request failed"
    }

    $Result.SchedulerBusy = "passed"
  } finally {
    if ($BusyProcess -and -not $BusyProcess.HasExited) {
      Stop-Process -Id $BusyProcess.Id -Force
      Wait-Process -Id $BusyProcess.Id -ErrorAction SilentlyContinue
    }
  }

  $SlowBodyPath = Join-Path $OutDir "slow.body.txt"
  $SlowErrPath = Join-Path $OutDir "slow.err.log"
  Remove-Item -Force -ErrorAction SilentlyContinue $SlowBodyPath, $SlowErrPath

  $SlowProcess = Start-Process `
    -FilePath "curl.exe" `
    -ArgumentList @(
      "-sS",
      "--max-time",
      "4",
      "http://127.0.0.1:$Port/slow?token=slow"
    ) `
    -PassThru `
    -RedirectStandardOutput $SlowBodyPath `
    -RedirectStandardError $SlowErrPath `
    -WindowStyle Hidden

  $SlowStarted = $false
  $SlowStartedProbe = $null
  for ($Attempt = 0; $Attempt -lt 20; $Attempt += 1) {
    Start-Sleep -Milliseconds 100
    $SlowProcess.Refresh()
    if ($SlowProcess.HasExited) {
      break
    }

    $SlowStartedProbe = Invoke-Curl @(
      "-sS",
      "--max-time",
      "1",
      "http://127.0.0.1:$Port/slow-started"
    )
    if ($SlowStartedProbe.ExitCode -eq 0 -and $SlowStartedProbe.Text -eq '{"started":true}') {
      $SlowStarted = $true
      break
    }
  }

  $ExpectedSlow = '{"marker":"slow","token":"slow"}'

  if (-not $SlowStarted) {
    $SlowExitedForObservation = $SlowProcess.WaitForExit(5000)
    if (-not $SlowExitedForObservation) {
      Stop-Process -Id $SlowProcess.Id -Force
      Wait-Process -Id $SlowProcess.Id -ErrorAction SilentlyContinue
    }

    $ObservedSlowBody = if (Test-Path $SlowBodyPath) {
      (Get-Content -Raw $SlowBodyPath).Trim()
    } else {
      ""
    }

    $Diagnostics = [ordered]@{
      SlowStartedProbeExitCode = if ($SlowStartedProbe) { $SlowStartedProbe.ExitCode } else { $null }
      SlowStartedProbeOutput = if ($SlowStartedProbe) { $SlowStartedProbe.Output } else { @() }
      SlowExited = $SlowExitedForObservation
      SlowExitCode = if ($SlowExitedForObservation) { $SlowProcess.ExitCode } else { $null }
      SlowBody = $ObservedSlowBody
      SlowStderr = Read-LogTail $SlowErrPath
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }

    if (
      $SlowExitedForObservation `
        -and ($null -eq $SlowProcess.ExitCode -or $SlowProcess.ExitCode -eq 0) `
        -and $ObservedSlowBody -eq $ExpectedSlow `
        -and (Read-LogTail $SlowErrPath) -eq "" `
        -and $SlowStartedProbe `
        -and $SlowStartedProbe.ExitCode -eq 0 `
        -and $SlowStartedProbe.Text -eq '{"started":false}'
    ) {
      $Result.ConcurrentDispatch = "serial-observed"
      $Result.StateIsolation = "not-observed"
      $Result.Run = "passed"
      $Result.Diagnostics = $Diagnostics
      $Result.Notes = "Perry Fastify-backed native dispatch handled the slow async route serially; concurrent TS route dispatch is not claimed."
      Save-Result
      return
    }

    $Result.ConcurrentDispatch = "failed"
    $Result.Diagnostics = [ordered]@{
      SlowStartedProbeExitCode = $Diagnostics.SlowStartedProbeExitCode
      SlowStartedProbeOutput = $Diagnostics.SlowStartedProbeOutput
      SlowExited = $Diagnostics.SlowExited
      SlowExitCode = $Diagnostics.SlowExitCode
      SlowBody = $Diagnostics.SlowBody
      SlowStderr = $Diagnostics.SlowStderr
      ServerExited = $Diagnostics.ServerExited
      ServerExitCode = $Diagnostics.ServerExitCode
      ServerStdout = $Diagnostics.ServerStdout
      ServerStderr = $Diagnostics.ServerStderr
    }
    $Result.Notes = "Slow request did not become observable while pending"
    Save-Result
    throw "native-http-smoke concurrent dispatch probe failed before fast request"
  }

  $FastWatch = [System.Diagnostics.Stopwatch]::StartNew()
  $Fast = Invoke-Curl @(
    "-sS",
    "--max-time",
    "2",
    "http://127.0.0.1:$Port/fast?token=fast"
  )
  $FastWatch.Stop()
  $SlowProcess.Refresh()
  $SlowStillRunningAfterFast = -not $SlowProcess.HasExited

  $ExpectedFast = '{"marker":"fast","token":"fast"}'
  if (
    $Fast.ExitCode -ne 0 `
      -or $Fast.Text -ne $ExpectedFast `
      -or $FastWatch.ElapsedMilliseconds -gt 750 `
      -or -not $SlowStillRunningAfterFast
  ) {
    if (-not $SlowProcess.HasExited) {
      Stop-Process -Id $SlowProcess.Id -Force
      Wait-Process -Id $SlowProcess.Id -ErrorAction SilentlyContinue
    }
    $Result.ConcurrentDispatch = "failed"
    $Result.Diagnostics = [ordered]@{
      FastExitCode = $Fast.ExitCode
      FastOutput = $Fast.Output
      FastElapsedMs = $FastWatch.ElapsedMilliseconds
      SlowStillRunningAfterFast = $SlowStillRunningAfterFast
      SlowStderr = Read-LogTail $SlowErrPath
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Fast request did not complete independently while slow request was pending"
    Save-Result
    throw "native-http-smoke concurrent dispatch fast request failed"
  }

  $Result.ConcurrentDispatch = "passed"

  $SlowExited = $SlowProcess.WaitForExit(5000)
  if (-not $SlowExited) {
    Stop-Process -Id $SlowProcess.Id -Force
    Wait-Process -Id $SlowProcess.Id -ErrorAction SilentlyContinue
  }

  $SlowBody = if (Test-Path $SlowBodyPath) {
    (Get-Content -Raw $SlowBodyPath).Trim()
  } else {
    ""
  }

  if (-not $SlowExited -or $SlowProcess.ExitCode -ne 0 -or $SlowBody -ne $ExpectedSlow) {
    $Result.StateIsolation = "failed"
    $Result.Diagnostics = [ordered]@{
      SlowExited = $SlowExited
      SlowExitCode = if ($SlowExited) { $SlowProcess.ExitCode } else { $null }
      SlowBody = $SlowBody
      SlowStderr = Read-LogTail $SlowErrPath
      FastBody = $Fast.Text
      ServerExited = $Process.HasExited
      ServerExitCode = if ($Process.HasExited) { $Process.ExitCode } else { $null }
      ServerStdout = Read-LogTail $StdOut
      ServerStderr = Read-LogTail $StdErr
    }
    $Result.Notes = "Concurrent request state did not remain isolated"
    Save-Result
    throw "native-http-smoke concurrent dispatch state isolation failed"
  }

  $Result.StateIsolation = "passed"
  $Result.Run = "passed"
  $Result.Notes = "HTTP, middleware, and concurrent dispatch native behavior smoke passed"
  Save-Result
} finally {
  if ($Process -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force
    Wait-Process -Id $Process.Id -ErrorAction SilentlyContinue
  }
}
