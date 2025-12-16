# Script de optimización y deploy a Firebase Hosting (Windows PowerShell)
# Ejecutar desde la carpeta kolbi-monitor-web: .\deploy.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "🚀 DEPLOY A FIREBASE HOSTING" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 1. Remover recharts
Write-Host ""
Write-Host "1️⃣ Removiendo recharts (no se usa)..." -ForegroundColor Yellow
npm uninstall recharts
Write-Host "✅ Hecho" -ForegroundColor Green

# 2. Verificar build
Write-Host ""
Write-Host "2️⃣ Generando build optimizado..." -ForegroundColor Yellow
npm run build
Write-Host "✅ Build completado" -ForegroundColor Green

# 3. Verificar tamaño
Write-Host ""
Write-Host "3️⃣ Verificando tamaño del build..." -ForegroundColor Yellow
$buildSize = (Get-ChildItem "build" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "📊 Tamaño del build: $([math]::Round($buildSize, 2)) MB" -ForegroundColor Cyan

# 4. Verif ificar Firebase CLI
Write-Host ""
Write-Host "4️⃣ Verificando Firebase CLI..." -ForegroundColor Yellow
firebase --version
Write-Host "✅ Firebase CLI presente" -ForegroundColor Green

# 5. Deploy
Write-Host ""
Write-Host "5️⃣ Deployando a Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting
Write-Host "✅ Deploy completado" -ForegroundColor Green

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ ¡DEPLOYMENT COMPLETADO!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tu aplicación está en vivo en:" -ForegroundColor Cyan
Write-Host "https://kolbi-monitor-sells.web.app" -ForegroundColor Cyan
Write-Host ""

# Opcional: Abrir el navegador
$response = Read-Host "¿Abrir la app en el navegador? (s/n)"
if ($response -eq 's' -or $response -eq 'S') {
    Start-Process "https://kolbi-monitor-sells.web.app"
}
