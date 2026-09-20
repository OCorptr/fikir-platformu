# Production build + preview — tüm interface'lere bind (0.0.0.0) IPv4/IPv6 sorunları için
$proc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c","pnpm preview --host 0.0.0.0 --port 4173" `
  -WorkingDirectory "D:\Coding\Fikir_Platformu\frontend" `
  -RedirectStandardOutput "D:\Coding\Fikir_Platformu\.dev\preview.log" `
  -RedirectStandardError "D:\Coding\Fikir_Platformu\.dev\preview.err.log" `
  -NoNewWindow -PassThru
Write-Host "Preview başlatıldı: PID $($proc.Id) (0.0.0.0:4173)"
