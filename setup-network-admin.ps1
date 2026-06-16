# Run this script once as Administrator to expose the ModTube container
# on the LAN (ports 80, 443, 4000).  WSL2 mirrored networking makes the
# container reachable at 127.0.0.1 from Windows; this script forwards
# traffic arriving on the Windows Ethernet IP to that loopback address
# and opens the Windows Firewall.
#
# Usage (in an elevated PowerShell prompt):
#   .\setup-network-admin.ps1

$LanIp = "172.22.111.86"
$Ports  = @(80, 443, 4000)

Write-Host "Configuring port proxy and firewall for ModTube on $LanIp ..."

foreach ($port in $Ports) {
    # Remove stale rule if it exists
    netsh interface portproxy delete v4tov4 `
        listenport=$port listenaddress=$LanIp 2>$null

    # Forward LAN IP:port → 127.0.0.1:port (WSL mirrored loopback)
    netsh interface portproxy add v4tov4 `
        listenport=$port listenaddress=$LanIp `
        connectport=$port connectaddress=127.0.0.1

    # Firewall: allow inbound on this port
    $ruleName = "ModTube-port-$port"
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    New-NetFirewallRule `
        -DisplayName $ruleName `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort $port `
        -Action Allow | Out-Null

    Write-Host "  port $port -> OK"
}

Write-Host ""
Write-Host "Done.  Current port proxy rules:"
netsh interface portproxy show v4tov4
Write-Host ""
Write-Host "Test from another machine: https://$LanIp"
Write-Host "(Accept the self-signed cert warning to use camera/mic.)"
