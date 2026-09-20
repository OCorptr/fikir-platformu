# Kalıcı şekilde frontend'i başlatır (timeout'tan etkilenmez).
# --host 127.0.0.1 IPv4 localhost'a bind olur (Windows IPv6/IPv4 çakışmasını önler)
$proc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c","pnpm dev --host 127.0.0.1 --port 5173" `
  -WorkingDirectory "D:\Coding\Fikir_Platformu\frontend" `
  -RedirectStandardOutput "D:\Coding\Fikir_Platformu\.dev\frontend.log" `
  -RedirectStandardError "D:\Coding\Fikir_Platformu\.dev\frontend.err.log" `
  -NoNewWindow -PassThru
Write-Host "Frontend başlatıldı: PID $($proc.Id) (127.0.0.1:5173)"
