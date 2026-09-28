# syntax=docker/dockerfile:1

# =====================================================================
# Stage 1 - build: instala TODAS as dependências (com cache do npm ci)
# a partir do lockfile, isolando a construção do runtime enxuto.
# =====================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copia apenas os manifests primeiro para aproveitar o cache de camadas
COPY package.json package-lock.json ./

# Instalação reprodutível a partir do lockfile
RUN npm ci

# Copia o restante do código-fonte da aplicação
COPY . .

# =====================================================================
# Stage 2 - runtime: imagem final enxuta apenas com dependências de
# produção e usuário não-root para reduzir a superfície de ataque.
# =====================================================================
FROM node:20-alpine AS runtime

# Ambiente de produção por padrão
ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Instala SOMENTE as dependências de produção usando o lockfile
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia o código-fonte já disponível no stage de build
COPY --from=build /app/src ./src
COPY --from=build /app/init.sql ./init.sql

# Executa como usuário não-root (usuário "node" já existe na imagem oficial)
USER node

# Porta HTTP exposta pela API
EXPOSE 3000

# Sobe o servidor da API
CMD ["node", "src/server.js"]
