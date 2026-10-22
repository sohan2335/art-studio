Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if ($nodeCommand) { $studioNode = $nodeCommand.Source }
elseif (Test-Path -LiteralPath $bundledNode) { $studioNode = $bundledNode }
else { throw 'Install Node.js 24 or newer, reopen PowerShell and run this script again.' }
& $studioNode --env-file-if-exists=.env server.js
