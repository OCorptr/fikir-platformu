# Kalıcı şekilde backend'i başlatır (timeout'tan etkilenmez)
$proc = Start-Process -FilePath "dotnet" `
  -ArgumentList "run","--project","backend/src/FikirPlatformu.Api" `
  -WorkingDirectory "D:\Coding\Fikir_Platformu" `
  -RedirectStandardOutput "D:\Coding\Fikir_Platformu\.dev\backend.log" `
  -RedirectStandardError "D:\Coding\Fikir_Platformu\.dev\backend.err.log" `
  -NoNewWindow -PassThru
Write-Host "Backend başlatıldı: PID $($proc.Id)"
