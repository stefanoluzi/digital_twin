@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js en esta PC.
  echo Instale Node.js LTS desde https://nodejs.org/ y vuelva a ejecutar este archivo.
  pause
  exit /b 1
)

echo Iniciando Planner de Mantenimiento General...
node servidor-planner.mjs
