# Serve over HTTP (required for fetch-based loading) + global analytics API
Set-Location $PSScriptRoot
$port = 8080
Write-Host ("Serving http://localhost:{0}/ - press Ctrl+C to stop" -f $port)
$env:PORT = $port
python server.py
