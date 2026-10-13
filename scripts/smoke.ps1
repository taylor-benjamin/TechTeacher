# Renders routes in headless Edge and reports the page heading plus any error text.
# Usage: npm run build; npm run preview (in another terminal); .\scripts\smoke.ps1
# With no arguments it checks every route. Pass -Routes a,b to check specific ones, -Quiet to list failures only.
param([string[]]$Routes = @(node "$PSScriptRoot\list-routes.mjs"), [switch]$Quiet)
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
$out = Join-Path $env:TEMP 'tt-dom.html'
$failed = 0
foreach ($r in $Routes) {
  # A separate profile keeps this from attaching to an already-open Edge window.
  $edgeArgs = '--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=$env:TEMP\tt-edge-profile",
    '--virtual-time-budget=6000', '--dump-dom', "http://localhost:4173/#/$r"
  Start-Process -FilePath $edge -ArgumentList $edgeArgs -RedirectStandardOutput $out -RedirectStandardError "$out.err" -Wait -WindowStyle Hidden
  $dom = [string](Get-Content $out -Raw)
  $h1 = if ($dom -match '<h1[^>]*>(.*?)</h1>') { $Matches[1] -replace '<[^>]+>', '' } else { '(no h1)' }
  $sections = ([regex]::Matches($dom, 'id="sec-\d"')).Count
  $bad = $dom -match 'Something went wrong|Unknown (visual|interactive) type' -or $h1 -eq '(no h1)'
  # A lesson route (tab/module/lesson) must render all six sections.
  if (($r -split '/').Count -eq 3 -and $sections -ne 6) { $bad = $true }
  if ($bad) { $failed++ }
  if ($bad -or -not $Quiet) { '{0,-55} {1} sections={2} h1={3}' -f "/$r", $(if ($bad) { 'FAIL' } else { 'ok  ' }), $sections, $h1 }
  if ($dom -match 'role="alert"[^>]*>(.{0,400})') { '   ' + ($Matches[1] -replace '<[^>]+>', ' ') }
}
"$failed failed of $($Routes.Count)"
