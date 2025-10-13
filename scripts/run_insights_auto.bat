@echo off
setlocal
REM Base do projeto (sem acentos é mais seguro usar %USERPROFILE%)
set "BASE=%USERPROFILE%\Desktop\spaco-da-jhusena"

REM Log
if not exist "%BASE%\logs" mkdir "%BASE%\logs"
set "LOG=%BASE%\logs\insights_auto.log"

REM Ativa venv e vai para a raiz do projeto
call "%BASE%\venv\Scripts\activate.bat"
cd /d "%BASE%"

REM (opcional) variáveis do Telegram, se não estiverem no sistema
REM set TELEGRAM_BOT_TOKEN=SEU_TOKEN_AQUI
REM set TELEGRAM_CHAT_ID=SEU_CHATID_AQUI

echo [%date% %time%] Iniciando... >> "%LOG%" 2>&1
python manage.py gerar_insights_auto --min-interval-days 7 >> "%LOG%" 2>&1
echo [%date% %time%] Finalizado. >> "%LOG%" 2>&1

deactivate
endlocal
