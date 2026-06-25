# Ejecutar PowerShell COMO ADMINISTRADOR
# Permite ARGO en la red local (puertos 3000 y 4200)

$rules = @(
  @{ Name = 'ARGO Backend 3000'; Port = 3000 },
  @{ Name = 'ARGO Frontend 4200'; Port = 4200 }
)

foreach ($r in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Regla ya existe: $($r.Name)"
    continue
  }
  New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $r.Port | Out-Null
  Write-Host "OK: $($r.Name) puerto $($r.Port)"
}

Write-Host ""
Write-Host "Listo. Pruebe desde otro PC: http://SU_IP:4200/login"
