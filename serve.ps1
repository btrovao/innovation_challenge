# Serve MVP over HTTP (needed if you add fetch-based loading later)
Set-Location $PSScriptRoot
$port = 8080
Write-Host "Serving http://localhost:$port/ — press Ctrl+C to stop"
python -m http.server $port
