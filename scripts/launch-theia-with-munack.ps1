$ErrorActionPreference = "Stop"

$theiaExe = "C:\Users\balka\AppData\Local\Programs\TheiaIDE\TheiaIDE.exe"
$vsixPath = "C:\Users\balka\Desktop\Munack\packages\munack-vscode\dist\munack-0.1.1.vsix"
$workspacePath = "C:\Users\balka\Desktop\Munack"
$pluginRoot = "C:\Users\balka\Desktop\Munack\.theia-plugins"
$pluginDir = Join-Path $pluginRoot "munack-vscode"
$zipCopy = Join-Path $pluginRoot "munack-vscode.zip"

if (-not (Test-Path $theiaExe)) {
  throw "TheiaIDE.exe not found at $theiaExe"
}

if (-not (Test-Path $vsixPath)) {
  throw "Munack VSIX not found at $vsixPath"
}

New-Item -ItemType Directory -Force -Path $pluginRoot | Out-Null
if (Test-Path $pluginDir) {
  Remove-Item -LiteralPath $pluginDir -Recurse -Force
}
if (Test-Path $zipCopy) {
  Remove-Item -LiteralPath $zipCopy -Force
}

Copy-Item -LiteralPath $vsixPath -Destination $zipCopy
Expand-Archive -LiteralPath $zipCopy -DestinationPath $pluginDir -Force
$env:THEIA_DEFAULT_PLUGINS = "local-dir://$pluginRoot"

Write-Host "Launching Theia with THEIA_DEFAULT_PLUGINS=$env:THEIA_DEFAULT_PLUGINS"
Start-Process -FilePath $theiaExe -ArgumentList $workspacePath
