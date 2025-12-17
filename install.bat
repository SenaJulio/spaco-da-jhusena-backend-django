@echo off
echo ===============================
echo 🐶 Spaço da Jhuséna - Instalador
echo ===============================
echo.

REM Verifica Python
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ Python não encontrado.
    echo Instale o Python 3.10 ou 3.11 antes de continuar.
    pause
    exit /b
)

echo ✅ Python encontrado.
echo.

REM Cria ambiente virtual
IF NOT EXIST venv (
    echo 📦 Criando ambiente virtual...
    python -m venv venv
) ELSE (
    echo ℹ️ Ambiente virtual já existe.
)

echo.
echo 🔌 Ativando ambiente virtual...
call venv\Scripts\activate

echo.
echo 📚 Instalando dependências...
pip install --upgrade pip
pip install -r requirements.txt

echo.
IF NOT EXIST .env (
    echo 🔐 Criando arquivo .env a partir do .env.example
    copy .env.example .env
    echo ⚠️ ATENÇÃO: Edite o arquivo .env antes de continuar.
    echo Depois execute o install.bat novamente.
    pause
    exit /b
)

echo.
echo 🗄️ Aplicando migrações...
python manage.py migrate

echo.
echo 👤 Criando usuário administrador...
python manage.py createsuperuser

echo.
echo 🚀 Iniciando servidor...
echo Acesse: http://127.0.0.1:8000/
python manage.py runserver

pause
