# Usar Node.js 20 como base
FROM node:20-slim

# Instalar dependencias del sistema necesarias para SQLite y otras utilidades
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de la app
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluyendo devDependencies para poder compilar)
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar TypeScript a JavaScript
RUN npm run build

# Exponer el puerto que usará Cloud Run (por defecto 8080)
EXPOSE 8080

# Comando para ejecutar el bot
# Usamos el modo producción desde la carpeta dist
CMD [ "node", "dist/index.js" ]
