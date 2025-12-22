@echo off
setlocal

REM >>> Ajuste este caminho para a pasta do seu projeto
cd /d "C:\Users\Júlio\Desktop\spaco-da-jhusena"

REM Opcional: quantidade de backups a manter
set KEEP=14

REM Rodar via Git Bash (vem com Git instalado)
"C:\Program Files\Git\bin\bash.exe" -lc "bash tools/backup_db.sh"

endlocal
