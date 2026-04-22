# Serve over HTTP (required for fetch-based loading)
Set-Location $PSScriptRoot
$port = 8080
Write-Host "Serving http://localhost:$port/ — press Ctrl+C to stop"
python -m http.server $port
