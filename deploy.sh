#!/bin/bash
# Script de optimización y deploy a Firebase Hosting
# Ejecutar desde la raíz del proyecto: bash deploy.sh

set -e  # Exit on error

echo "================================"
echo "🚀 DEPLOY A FIREBASE HOSTING"
echo "================================"

# 1. Remover recharts
echo ""
echo "1️⃣ Removiendo recharts (si existe)..."
npm uninstall recharts || true
echo "✅ Hecho"

# 2. Verificar build
echo ""
echo "2️⃣ Generando build optimizado..."
npm run build
echo "✅ Build completado"

# 3. Verificar tamaño
echo ""
echo "3️⃣ Verificando tamaño del build..."
BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1 || echo "N/A")
echo "📊 Tamaño del build: $BUILD_SIZE"

# 4. Deploy
echo ""
echo "4️⃣ Deployando a Firebase Hosting..."
firebase deploy --only hosting
echo "✅ Deploy completado"

echo ""
echo "================================"
echo "✅ ¡DEPLOYMENT COMPLETADO!"
echo "================================"
echo ""
echo "Tu aplicación está en vivo en:"
echo "https://kolbi-monitor-sells.web.app"
echo ""
