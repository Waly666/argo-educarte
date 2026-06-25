Write-Host ""
Write-Host "=== ARGO - Enlaces en su red ===" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' }
foreach ($ip in $ips) {
  $a = $ip.IPAddress
  Write-Host "  App:     http://${a}:4200/login"
  Write-Host "  API:     http://${a}:3000"
  Write-Host ""
}
if (-not $ips) {
  Write-Host "  No se encontró IPv4 en la LAN. Ejecute: ipconfig"
}
