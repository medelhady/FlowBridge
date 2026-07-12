$ErrorActionPreference = "Stop"

$bridgePath = Join-Path $PSScriptRoot "dist\bridge_server\bridge_server.exe"
$taskName = "FlowBridge"

if (!(Test-Path $bridgePath)) {
    Write-Host "FlowBridge server not found:"
    Write-Host $bridgePath
    exit 1
}

$action = New-ScheduledTaskAction -Execute $bridgePath
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Starts FlowBridge local bridge server at Windows logon." -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "FlowBridge auto-start installed and started."
