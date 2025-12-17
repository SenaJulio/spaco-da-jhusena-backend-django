#!/bin/bash

echo "==============================="
echo "🐶 Spaço da Jhuséna - Instalador"
echo "==============================="

# Verifica Python
if ! command -v python3 &> /dev/null
then
    echo "❌ Python3 não encontrado. Instale Python 3.10+."
    exit 1
fi

echo "✅ Python encontrado"

# Cria ambiente virtual
if [ ! -d "venv" ]; then
    echo "📦 Criando ambiente virtual..."
    python3 -m venv venv
else
    echo "ℹ️ Ambiente virtual já existe"
fi

# Ativa venv
source venv/bin/activate

echo "📚 Instalando dependências..."
pip install --upgrade pip
pip install -r requirements.txt

# Cria .env se não existir
if [ ! -f ".env" ]; then
    echo "🔐 Criando .env a partir do .env.example"
    cp .env.example .env
    echo "⚠️ Edite o arquivo .env e execute o script novamente."
    exit 0
fi

echo "🗄️ Aplicando migrações..."
python manage.py migrate

echo "👤 Criando usuário administrador..."
python manage.py createsuperuser

echo "🚀 Iniciando servidor..."
echo "Acesse: http://127.0.0.1:8000/"
python manage.py runserver

