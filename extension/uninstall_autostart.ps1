$ErrorActionPreference = "Stop"

$taskName = "FlowBridge"

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "FlowBridge auto-start removed."
} else {
    Write-Host "FlowBridge auto-start was not installed."
}
