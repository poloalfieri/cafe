#!/bin/bash
# Script de setup inicial del proyecto

echo "🔧 Setup Inicial - Backend Café/Restaurante"
echo "==========================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar Python
echo "1️⃣  Verificando Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ $PYTHON_VERSION instalado${NC}"
else
    echo -e "${RED}❌ Python 3 no está instalado${NC}"
    exit 1
fi
echo ""

# Verificar pip
echo "2️⃣  Verificando pip..."
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version)
    echo -e "${GREEN}✅ $PIP_VERSION${NC}"
else
    echo -e "${RED}❌ pip3 no está instalado${NC}"
    exit 1
fi
echo ""

# Instalar dependencias
echo "3️⃣  Instalando dependencias..."
echo "Esto puede tomar unos minutos..."
pip3 install -r requirements.txt
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencias instaladas${NC}"
else
    echo -e "${RED}❌ Error instalando dependencias${NC}"
    exit 1
fi
echo ""

# Crear archivo .env si no existe
echo "4️⃣  Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    cp env.example .env
    echo -e "${YELLOW}⚠️  Archivo .env creado desde env.example${NC}"
    echo ""
    echo "⚠️  IMPORTANTE: Debes configurar las siguientes variables:"
    echo "   📝 Edita el archivo .env y configura:"
    echo "      - SECRET_KEY (genera uno con: python3 -c 'import secrets; print(secrets.token_hex(32))')"
    echo "      - MERCADO_PAGO_ACCESS_TOKEN"
    echo "      - MERCADO_PAGO_PUBLIC_KEY"
    echo "      - CORS_ORIGINS"
    echo ""
else
    echo -e "${GREEN}✅ Archivo .env ya existe${NC}"
fi
echo ""

# Generar SECRET_KEY si es necesario
echo "5️⃣  Verificando SECRET_KEY..."
SECRET_KEY=$(grep "^SECRET_KEY=" .env | cut -d '=' -f2)
if [ -z "$SECRET_KEY" ] || [ "$SECRET_KEY" = "your-secret-key-here" ] || [ "$SECRET_KEY" = "dev" ]; then
    echo -e "${YELLOW}⚠️  Generando nuevo SECRET_KEY...${NC}"
    NEW_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
    
    # En macOS, sed funciona diferente
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^SECRET_KEY=.*/SECRET_KEY=$NEW_SECRET/" .env
    else
        sed -i "s/^SECRET_KEY=.*/SECRET_KEY=$NEW_SECRET/" .env
    fi
    
    echo -e "${GREEN}✅ Nuevo SECRET_KEY generado${NC}"
else
    echo -e "${GREEN}✅ SECRET_KEY ya configurado${NC}"
fi
echo ""

# Verificar/crear base de datos
echo "6️⃣  Configurando base de datos..."
if [ -f "cafe.db" ]; then
    echo -e "${GREEN}✅ Base de datos ya existe${NC}"
else
    if [ -f "create_tables.py" ]; then
        echo "Creando tablas..."
        python3 create_tables.py
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Base de datos creada${NC}"
        else
            echo -e "${YELLOW}⚠️  Error creando base de datos${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Script create_tables.py no encontrado${NC}"
    fi
fi
echo ""

# Inicializar mesas si existe el script
echo "7️⃣  Inicializando mesas..."
if [ -f "initialize_mesas.py" ]; then
    python3 initialize_mesas.py 10
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Mesas inicializadas${NC}"
    else
        echo -e "${YELLOW}⚠️  Error inicializando mesas (puede que ya existan)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Script initialize_mesas.py no encontrado${NC}"
fi
echo ""

# Hacer ejecutables los scripts
echo "8️⃣  Configurando permisos de scripts..."
chmod +x start.sh 2>/dev/null
chmod +x test.sh 2>/dev/null
chmod +x setup.sh 2>/dev/null
echo -e "${GREEN}✅ Scripts configurados${NC}"
echo ""

# Resumen
echo "==========================================="
echo -e "${GREEN}✅ Setup completado!${NC}"
echo "==========================================="
echo ""
echo "📝 Próximos pasos:"
echo ""
echo "1️⃣  Revisa tu archivo .env:"
echo "    nano .env"
echo ""
echo "2️⃣  Inicia el servidor:"
echo "    ./start.sh"
echo "    (o: python3 run.py)"
echo ""
echo "3️⃣  En otra terminal, prueba los endpoints:"
echo "    ./test.sh"
echo ""
echo "4️⃣  Accede al frontend:"
echo "    http://localhost:3000"
echo ""
echo "📚 Documentación útil:"
echo "    - CORS_ARREGLADO.md"
echo "    - AUDITORIA_SEGURIDAD.md"
echo "    - IMPLEMENTACION_SEGURIDAD.md"
echo ""
