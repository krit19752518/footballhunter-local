Plan: Linux-16GB-80GB
Hostname: modvm-krit-7h
IP Address : 103.169.67.62
Remote User : ubuntu
Password : Kr1t@12342518

Backend
cd backend
npm run dev

FrontEnd
cd frontend
flutter build web --release
flutter run -d web-server --web-port=8080 --release

Log test
$OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Path "D:\FootballHunter2\footballhunter2\backend\testbot.log" -Wait -Tail 20 -Encoding utf8