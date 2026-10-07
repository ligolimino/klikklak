param(
    [Parameter(Mandatory = $true)]
    [string]$MapMetOpnames,

    [Parameter(Mandatory = $true)]
    [string]$LetterlabMap,

    # Gebruik -Nonsens om opnames van nonsenswoorden in de map 'nonsens' te zetten.
    [switch]$Nonsens
)

# Deze map hoort in de GitHub-versie van Letterlab te staan.
$doelHoofdmap = Join-Path $LetterlabMap "assets\audio\woorden"

Get-ChildItem -Path $MapMetOpnames -Filter "*.mp3" -File | ForEach-Object {
    $woord = $_.BaseName.ToLower()

    if ($woord -notmatch "^[a-z]+$") {
        Write-Warning "Overgeslagen: $($_.Name). Gebruik alleen kleine letters in de bestandsnaam."
        return
    }

    if ($Nonsens) {
        $doelmap = Join-Path $doelHoofdmap "nonsens"
    }
    else {
        $eersteLetter = $woord.Substring(0, 1)
        $doelmap = Join-Path $doelHoofdmap $eersteLetter
    }

    New-Item -ItemType Directory -Path $doelmap -Force | Out-Null
    Copy-Item -Path $_.FullName -Destination (Join-Path $doelmap "$woord.mp3") -Force

    Write-Host "Toegevoegd: $woord.mp3 -> $(Split-Path $doelmap -Leaf)"
}

Write-Host "Klaar. Upload daarna de bijgewerkte map assets/audio/woorden naar GitHub."
