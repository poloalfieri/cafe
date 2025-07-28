FROM python:3.11-slim

WORKDIR /app

# Copiá SOLO el requirements.txt primero
COPY requirements.txt .

# Instalá dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Ahora copiá el resto del código
COPY . .

# Comando para ejecutar la app
CMD ["python", "-m", "app.main"]
