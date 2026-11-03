Write-Host 'Downloading Mosquitto installer...'
$installerPath = "$env:TEMP\mosquitto-installer.exe"
Invoke-WebRequest -Uri "https://mosquitto.org/files/binary/win64/mosquitto-2.0.18-install-windows-x64.exe" -OutFile $installerPath

Write-Host 'Installing Mosquitto...'
Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait

Write-Host 'Configuring Mosquitto...'
$configPath = 'C:\Program Files\mosquitto\mosquitto.conf'
$configContent = "
listener 1883
allow_anonymous false
password_file C:\Program Files\mosquitto\passwd"
Add-Content -Path $configPath -Value $configContent -Force

Write-Host 'Creating user password...'
Set-Location 'C:\Program Files\mosquitto'
.\mosquitto_passwd.exe -b -c 'C:\Program Files\mosquitto\passwd' aerosense_node aerosense123

Write-Host 'Starting background service...'
Restart-Service mosquitto -ErrorAction SilentlyContinue
Start-Service mosquitto -ErrorAction SilentlyContinue

Write-Host 'Done!'
