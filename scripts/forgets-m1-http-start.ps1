param(
  [int]$Port = 43101,
  [switch]$NoCompile
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OutDir = Join-Path $RepoRoot ".forgets/m1-http"
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
  throw "Perry CLI not found. Run npm install or build .forgets/perry-github-main."
}

Write-Host "Using Perry: $PerryLabel"

if (-not $NoCompile) {
  Write-Host "== native-http-smoke: perry check =="
  & $Perry check $Fixture
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Write-Host "== native-http-smoke: perry compile =="
  & $Perry compile $Fixture -o $Binary
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} elseif (-not (Test-Path $Binary)) {
  throw "Binary not found: $Binary. Run without -NoCompile first."
}

Write-Host "== native-http-smoke: start server =="
Write-Host "Listening command: $Binary $Port"
Write-Host "Health check: curl.exe -sS http://127.0.0.1:$Port/healthz"
Write-Host ('Echo check: curl.exe -sS -X POST -H "content-type: text/plain" -H "x-test: native" --data "hello" "http://127.0.0.1:{0}/echo?name=Ada"' -f $Port)
Write-Host "Press Ctrl+C to stop."

& $Binary $Port
