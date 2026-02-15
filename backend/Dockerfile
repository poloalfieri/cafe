FROM python:3.11-slim

WORKDIR /app

# Copiá SOLO el requirements.txt primero
COPY requirements.txt .

# Instalá dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Ahora copiá el resto del código
COPY . .

# Puerto configurable via env (Render/Railway lo setean automáticamente)
ENV PORT=5001

EXPOSE ${PORT}

# Gunicorn para producción (mismo comando que el Procfile)
CMD gunicorn -w 2 -k gthread --threads 8 --timeout 120 --access-logfile - --error-logfile - -b 0.0.0.0:${PORT} "app.main:create_app()"
