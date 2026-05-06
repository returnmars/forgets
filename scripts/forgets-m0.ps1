$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $RepoRoot ".forgets/m0"
$ResultsPath = Join-Path $OutDir "results.json"
$RunRoot = Join-Path $OutDir ("work/" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null

$Cases = @(
  @{ Name = "decorators-fail"; File = "test-files/forgets-m0/decorators-fail.ts"; ExpectCheckFailure = $true; ExpectCompile = $false; ExpectRun = $false; Notes = "Perry rejects decorators at lowering" },
  @{ Name = "basic-runtime"; File = "test-files/forgets-m0/basic-runtime.ts"; ExpectCheckFailure = $false; ExpectCompile = $true; ExpectRun = $true; Notes = "Records class/private/TextEncoder/Map/Promise behavior" },
  @{ Name = "async-concurrency"; File = "test-files/forgets-m0/async-concurrency.ts"; ExpectCheckFailure = $false; ExpectCompile = $true; ExpectRun = $true; Notes = "Records Promise.all/timer async behavior" },
  @{ Name = "thread-spawn"; File = "test-files/forgets-m0/thread-spawn.ts"; ExpectCheckFailure = $false; ExpectCompile = $true; ExpectRun = $true; Notes = "Records perry/thread spawn and parallelMap behavior" },
  @{ Name = "abort-timeout"; File = "test-files/forgets-m0/abort-timeout.ts"; ExpectCheckFailure = $false; ExpectCompile = $true; ExpectRun = $true; Notes = "Records AbortController and AbortSignal.timeout behavior" }
)

$Results = @()
$Failures = New-Object System.Collections.Generic.List[string]

function Save-Results {
  $script:Results | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 $script:ResultsPath
}

function Add-Failure {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
}

function Resolve-Perry {
  $LocalPerry = Join-Path $script:RepoRoot "node_modules/.bin/perry.cmd"
  $SourcePerryWorkspace = Join-Path $script:RepoRoot "docs/perry-main-src/perry-main"

  if ($env:PERRY) {
    return [ordered]@{
      Mode = "command"
      Command = $env:PERRY
      Workspace = $script:RepoRoot
      Label = "PERRY=$env:PERRY"
    }
  }

  if (Test-Path $LocalPerry) {
    return [ordered]@{
      Mode = "command"
      Command = $LocalPerry
      Workspace = $script:RepoRoot
      Label = "project-local @perryts/perry"
    }
  }

  $GlobalPerry = Get-Command "perry" -ErrorAction SilentlyContinue
  if ($GlobalPerry) {
    return [ordered]@{
      Mode = "command"
      Command = $GlobalPerry.Source
      Workspace = $script:RepoRoot
      Label = "PATH perry"
    }
  }

  if ((Test-Path (Join-Path $SourcePerryWorkspace "Cargo.toml")) -and (Get-Command "cargo" -ErrorAction SilentlyContinue)) {
    return [ordered]@{
      Mode = "cargo"
      Command = "cargo"
      Workspace = $SourcePerryWorkspace
      Label = "local Perry source via cargo"
    }
  }

  return $null
}

function Invoke-Perry {
  param(
    [string[]]$Arguments,
    [string]$WorkingDirectory = $script:PerryInfo.Workspace
  )

  $InvocationDirectory = $WorkingDirectory
  if ($script:PerryInfo.Mode -eq "cargo") {
    $InvocationDirectory = $script:PerryInfo.Workspace
  }

  Push-Location $InvocationDirectory
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    if ($script:PerryInfo.Mode -eq "cargo") {
      $Output = & cargo run -q -p perry -- @Arguments 2>&1
    } else {
      $Output = & $script:PerryInfo.Command @Arguments 2>&1
    }

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
    Pop-Location
  }
}

function Write-RunOutput {
  param([object[]]$Output)

  foreach ($Line in $Output) {
    Write-Host $Line
  }
}

$PerryInfo = Resolve-Perry

if (-not $PerryInfo) {
  foreach ($Case in $Cases) {
    $Results += [ordered]@{
      Case = $Case.Name
      Check = "not-run"
      Compile = "not-run"
      Run = "not-run"
      Notes = "Perry CLI not found. Install project-local @perryts/perry, install global perry, set PERRY, or keep docs/perry-main-src/perry-main buildable with cargo."
    }
  }

  Save-Results
  throw "Perry CLI not found. Run npm install or install @perryts/perry."
}

Write-Host "Using Perry: $($PerryInfo.Label)"
$Version = Invoke-Perry @("--version")
Write-RunOutput $Version.Output

foreach ($Case in $Cases) {
  $File = (Resolve-Path (Join-Path $RepoRoot $Case.File)).Path
  $CaseWorkDir = Join-Path $RunRoot $Case.Name
  New-Item -ItemType Directory -Force -Path $CaseWorkDir | Out-Null

  $CaseInputName = Split-Path $File -Leaf
  $CaseInputPath = Join-Path $CaseWorkDir $CaseInputName
  Copy-Item -LiteralPath $File -Destination $CaseInputPath -Force

  $ThreadTypes = Join-Path $RepoRoot "test-files/forgets-m0/perry-thread.d.ts"
  if (Test-Path $ThreadTypes) {
    Copy-Item -LiteralPath $ThreadTypes -Destination (Join-Path $CaseWorkDir "perry-thread.d.ts") -Force
  }

  $PerryInput = $CaseInputName
  if ($PerryInfo.Mode -eq "cargo") {
    $PerryInput = $CaseInputPath
  }

  $Result = [ordered]@{
    Case = $Case.Name
    Check = "not-run"
    Compile = "not-run"
    Run = "not-run"
    CheckOutput = ""
    CompileOutput = ""
    Output = ""
    Notes = $Case.Notes
  }

  Write-Host "== $($Case.Name): perry check =="
  $Check = Invoke-Perry @("check", $PerryInput) -WorkingDirectory $CaseWorkDir
  Write-RunOutput $Check.Output
  $Result.CheckOutput = ($Check.Output -join "`n")

  if ($Case.ExpectCheckFailure -and $Check.ExitCode -eq 0) {
    $Result.Check = "unexpected-pass"
    $Result.Compile = "skipped"
    $Result.Run = "skipped"
    $Results += $Result
    Add-Failure "$($Case.Name) was expected to fail perry check"
    continue
  }

  if (-not $Case.ExpectCheckFailure -and $Check.ExitCode -ne 0) {
    $Result.Check = "failed"
    $Result.Compile = "skipped"
    $Result.Run = "skipped"
    $Results += $Result
    Add-Failure "$($Case.Name) was expected to pass perry check"
    continue
  }

  if ($Case.ExpectCheckFailure) {
    $Result.Check = "expected-failure"
    $Result.Compile = "skipped"
    $Result.Run = "skipped"
    $Results += $Result
    continue
  }

  $Result.Check = "passed"

  if ($Case.ExpectCompile) {
    $Binary = Join-Path $OutDir "$($Case.Name).exe"
    Write-Host "== $($Case.Name): perry compile =="
    $Compile = Invoke-Perry @("compile", $PerryInput, "-o", $Binary) -WorkingDirectory $CaseWorkDir
    Write-RunOutput $Compile.Output
    $Result.CompileOutput = ($Compile.Output -join "`n")

    if ($Compile.ExitCode -ne 0) {
      $Result.Compile = "failed"
      $Result.Run = "skipped"
      $Results += $Result
      Add-Failure "$($Case.Name) failed perry compile"
      continue
    }

    $Result.Compile = "passed"
  }

  if ($Case.ExpectRun) {
    Write-Host "== $($Case.Name): run =="
    $RunOutput = & $Binary 2>&1

    if ($LASTEXITCODE -ne 0) {
      $Result.Run = "failed"
      $Result.Output = ($RunOutput -join "`n")
      $Results += $Result
      Add-Failure "$($Case.Name) failed native run"
      continue
    }

    $Result.Run = "passed"
    $Result.Output = ($RunOutput -join "`n")
  }

  $Results += $Result
}

Save-Results

if ($Failures.Count -gt 0) {
  throw "M0 compatibility run failed. See $ResultsPath. Failures: $($Failures -join '; ')"
}
