// Autocomplete suggestions for PowerShell terminal
window.PowerShellAutocomplete = [
  // Get cmdlets
  'Get-Process', 'Get-Service', 'Get-EventLog', 'Get-Content', 'Get-ChildItem',
  'Get-Item', 'Get-ItemProperty', 'Get-Location', 'Get-PSDrive', 'Get-PSProvider',
  'Get-Command', 'Get-Help', 'Get-Member', 'Get-Module', 'Get-Package',
  'Get-Variable', 'Get-Alias', 'Get-Culture', 'Get-Date', 'Get-Host',
  'Get-History', 'Get-Job', 'Get-Random', 'Get-UICulture', 'Get-Unique',
  'Get-WmiObject', 'Get-CimInstance', 'Get-ComputerInfo', 'Get-Event',
  'Get-WinEvent', 'Get-Counter', 'Get-Credential', 'Get-ExecutionPolicy',
  'Get-FileHash', 'Get-FormatData', 'Get-ItemProperty', 'Get-PfxCertificate',
  'Get-Process', 'Get-PSBreakpoint', 'Get-PSCallStack', 'Get-PSReadlineOption',
  'Get-PSSession', 'Get-PSSessionConfiguration', 'Get-PSSnapin', 'Get-Runspace',
  'Get-TraceSource', 'Get-TypeData', 'Get-Verb', 'Get-WinEvent',
  
  // Set cmdlets
  'Set-Location', 'Set-Content', 'Set-Item', 'Set-ItemProperty', 'Set-Variable',
  'Set-Alias', 'Set-Date', 'Set-ExecutionPolicy', 'Set-PSBreakpoint',
  'Set-PSReadlineOption', 'Set-PSSessionConfiguration', 'Set-StrictMode',
  'Set-TraceSource', 'Set-WmiInstance', 'Set-CimInstance',
  
  // New cmdlets
  'New-Item', 'New-Object', 'New-Variable', 'New-Alias', 'New-Event',
  'New-EventLog', 'New-FileSystemDrive', 'New-Guid', 'New-JobTrigger',
  'New-Module', 'New-ModuleManifest', 'New-Object', 'New-PSDrive',
  'New-PSSession', 'New-PSSessionConfigurationFile', 'New-PSSessionOption',
  'New-PSTransportOption', 'New-Service', 'New-TimeSpan', 'New-TemporaryFile',
  'New-WebServiceProxy', 'New-WinEvent',
  
  // Remove cmdlets
  'Remove-Item', 'Remove-Variable', 'Remove-Alias', 'Remove-Event',
  'Remove-EventLog', 'Remove-ItemProperty', 'Remove-Job', 'Remove-Module',
  'Remove-PSBreakpoint', 'Remove-PSDrive', 'Remove-PSSession', 'Remove-PSSnapin',
  'Remove-TypeData', 'Remove-WmiObject', 'Remove-CimInstance',
  
  // Test cmdlets
  'Test-Path', 'Test-Connection', 'Test-ModuleManifest', 'Test-Path',
  'Test-WSMan', 'Test-NetConnection',
  
  // Start/Stop cmdlets
  'Start-Process', 'Start-Service', 'Start-Job', 'Start-Sleep', 'Start-Transcript',
  'Start-Transaction', 'Stop-Process', 'Stop-Service', 'Stop-Job', 'Stop-Transcript',
  'Stop-Computer', 'Stop-DscConfiguration',
  
  // Invoke cmdlets
  'Invoke-Command', 'Invoke-Expression', 'Invoke-Item', 'Invoke-RestMethod',
  'Invoke-WebRequest', 'Invoke-History', 'Invoke-WmiMethod', 'Invoke-CimMethod',
  
  // Select cmdlets
  'Select-Object', 'Select-String', 'Select-Xml', 'Select-Case',
  
  // Sort cmdlets
  'Sort-Object', 'Sort-Object -Property', 'Sort-Object -Descending',
  
  // Where cmdlets
  'Where-Object', 'Where-Object -FilterScript',
  
  // Measure cmdlets
  'Measure-Object', 'Measure-Command',
  
  // Format cmdlets
  'Format-List', 'Format-Table', 'Format-Wide', 'Format-Custom',
  
  // Export/Import cmdlets
  'Export-Csv', 'Export-Clixml', 'Export-FormatData', 'Export-ModuleMember',
  'Export-PSSession', 'Import-Csv', 'Import-Clixml', 'Import-Module',
  'Import-PSSession', 'Import-LocalizedData',
  
  // Convert cmdlets
  'ConvertTo-Csv', 'ConvertTo-Html', 'ConvertTo-Json', 'ConvertTo-Xml',
  'ConvertFrom-Csv', 'ConvertFrom-Json', 'ConvertFrom-StringData',
  'ConvertFrom-SecureString', 'ConvertTo-SecureString',
  
  // Out cmdlets
  'Out-File', 'Out-String', 'Out-Host', 'Out-Null', 'Out-Printer',
  'Out-GridView', 'Out-Default',
  
  // Clear cmdlets
  'Clear-Host', 'Clear-Content', 'Clear-Item', 'Clear-ItemProperty',
  'Clear-Variable', 'Clear-EventLog', 'Clear-History',
  
  // Write cmdlets
  'Write-Host', 'Write-Output', 'Write-Error', 'Write-Warning',
  'Write-Verbose', 'Write-Debug', 'Write-Information', 'Write-Progress',
  
  // Read cmdlets
  'Read-Host', 'Read-Line',
  
  // Other useful cmdlets
  'Add-Content', 'Add-Member', 'Add-Type', 'Compare-Object', 'Copy-Item',
  'Copy-ItemProperty', 'Disable-PSBreakpoint', 'Enable-PSBreakpoint',
  'Enter-PSSession', 'Exit-PSSession', 'ForEach-Object', 'Get-Acl',
  'Get-AuthenticodeSignature', 'Get-Command', 'Get-Content', 'Get-Credential',
  'Get-Culture', 'Get-Date', 'Get-Event', 'Get-EventLog', 'Get-ExecutionPolicy',
  'Get-Help', 'Get-History', 'Get-Host', 'Get-Item', 'Get-Job', 'Get-Location',
  'Get-Member', 'Get-Module', 'Get-Process', 'Get-PSBreakpoint', 'Get-PSCallStack',
  'Get-PSDrive', 'Get-PSProvider', 'Get-PSSession', 'Get-PSSnapin', 'Get-Random',
  'Get-Service', 'Get-TraceSource', 'Get-UICulture', 'Get-Unique', 'Get-Variable',
  'Get-WmiObject', 'Group-Object', 'Import-Csv', 'Import-Module', 'Invoke-Command',
  'Invoke-Expression', 'Invoke-History', 'Invoke-Item', 'Invoke-RestMethod',
  'Invoke-WebRequest', 'Join-Path', 'Limit-EventLog', 'Move-Item', 'Move-ItemProperty',
  'New-Alias', 'New-Event', 'New-EventLog', 'New-Item', 'New-ItemProperty',
  'New-Module', 'New-ModuleManifest', 'New-Object', 'New-PSDrive', 'New-PSSession',
  'New-Service', 'New-TimeSpan', 'New-Variable', 'Out-Default', 'Out-File',
  'Out-GridView', 'Out-Host', 'Out-Null', 'Out-Printer', 'Out-String',
  'Pop-Location', 'Push-Location', 'Receive-Job', 'Register-EngineEvent',
  'Register-ObjectEvent', 'Register-WmiEvent', 'Remove-Event', 'Remove-Item',
  'Remove-ItemProperty', 'Remove-Job', 'Remove-Module', 'Remove-PSBreakpoint',
  'Remove-PSDrive', 'Remove-PSSession', 'Remove-PSSnapin', 'Remove-Variable',
  'Remove-WmiObject', 'Rename-Item', 'Rename-ItemProperty', 'Resolve-Path',
  'Restart-Computer', 'Restart-Service', 'Resume-Service', 'Save-Help',
  'Select-Object', 'Select-String', 'Select-Xml', 'Send-MailMessage',
  'Set-Acl', 'Set-Alias', 'Set-AuthenticodeSignature', 'Set-Content',
  'Set-Date', 'Set-ExecutionPolicy', 'Set-Item', 'Set-ItemProperty',
  'Set-Location', 'Set-PSBreakpoint', 'Set-PSReadlineOption', 'Set-Service',
  'Set-StrictMode', 'Set-TraceSource', 'Set-Variable', 'Set-WmiInstance',
  'Show-Command', 'Show-EventLog', 'Sort-Object', 'Split-Path', 'Start-Process',
  'Start-Service', 'Start-Sleep', 'Start-Transcript', 'Stop-Computer',
  'Stop-Process', 'Stop-Service', 'Stop-Transcript', 'Suspend-Service',
  'Tee-Object', 'Test-Connection', 'Test-ModuleManifest', 'Test-Path',
  'Trace-Command', 'Unregister-Event', 'Update-FormatData', 'Update-List',
  'Update-TypeData', 'Wait-Event', 'Wait-Job', 'Where-Object', 'Write-Debug',
  'Write-Error', 'Write-Host', 'Write-Output', 'Write-Progress', 'Write-Verbose',
  'Write-Warning',
    'git', 'git status', 'git add', 'git commit', 'git push', 'git pull',
    'git clone', 'git branch', 'git checkout', 'git merge', 'git log',
    'git diff', 'git stash', 'git reset', 'git revert', 'git remote',
    'git fetch', 'git rebase', 'git tag', 'git init', 'git config',
];
