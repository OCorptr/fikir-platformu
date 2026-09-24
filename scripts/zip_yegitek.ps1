# YEĞİTEK teslim ZIP paketi oluşturucu.
# Hariç tutulanlar: node_modules, bin, obj, dist, .git, .dev, TestResults
# Çıktı: C:\Users\OpusGate\Downloads\FikirPlatformu-v1.0.0-YEGITEK-<timestamp>.zip

$ErrorActionPreference = "Stop"
$projectRoot = "D:\Coding\Fikir_Platformu"
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipPath = Join-Path $env:USERPROFILE ("Downloads\FikirPlatformu-v1.0.0-YEGITEK-" + $timestamp + ".zip")

Set-Location $projectRoot

# Hariç tutulacak pattern'ler (regex)
$excludePatterns = @(
    'node_modules',
    '[\\/]bin[\\/]',
    '[\\/]obj[\\/]',
    '[\\/]dist[\\/]',
    '[\\/]\.git[\\/]',
    '[\\/]\.dev[\\/]',
    'TestResults',
    '[\\/]\.vs[\\/]'
)

Write-Host "Taranan klasor: $projectRoot"
Write-Host "Cikti ZIP: $zipPath"

# Dosyalari topla (klasor degil, PSIsContainer=false)
$files = Get-ChildItem -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { -not $_.PSIsContainer } |
    Where-Object {
        $fullPath = $_.FullName
        $excluded = $false
        foreach ($p in $excludePatterns) {
            if ($fullPath -match $p) { $excluded = $true; break }
        }
        -not $excluded
    }

Write-Host "Paketlenecek dosya: $($files.Count)"
Write-Host "Toplam boyut: $([Math]::Round(($files | Measure-Object -Property Length -Sum).Sum / 1MB, 2)) MB"

# ZIP olustur
$params = @{
    Path = $files.FullName
    DestinationPath = $zipPath
    CompressionLevel = "Optimal"
}
Compress-Archive @params -Force

Write-Host ""
Write-Host "[OK] ZIP olusturuldu:"
Get-Item $zipPath | Select-Object Name, Length, LastWriteTime | Format-List
