# Best-effort "Pin to Start" / "Pin to taskbar" for Astro Code after install.
# Windows may block verbs from elevated or automated contexts; failures are ignored.
param(
  [switch]$PinStart,
  [switch]$PinTaskbar
)
$ErrorActionPreference = 'SilentlyContinue'
$lnkName = 'Astro Code.lnk'
$bases = @(
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
)
foreach ($base in $bases) {
  $lnk = Join-Path $base $lnkName
  if (-not (Test-Path -LiteralPath $lnk)) { continue }
  try {
    $shell = New-Object -ComObject Shell.Application
    $dir = $shell.Namespace((Split-Path -LiteralPath $lnk))
    if (-not $dir) { continue }
    $item = $dir.ParseName((Split-Path -LiteralPath $lnk -Leaf))
    if (-not $item) { continue }
    foreach ($v in $item.Verbs()) {
      $n = $v.Name
      if ($PinStart -and $n -match 'Pin to Start') {
        $v.DoIt()
        break
      }
      if ($PinTaskbar -and $n -match 'taskbar') {
        $v.DoIt()
        break
      }
    }
  } catch { }
}
