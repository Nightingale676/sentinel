FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates libgomp1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
COPY --chown=node:node . ./
COPY --from=frontend-build --chown=node:node /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-build --chown=node:node /app/frontend/dist ./frontend/dist
RUN mkdir -p /app/private_runtime /app/saved_checks \
    && chown -R node:node /app/private_runtime /app/saved_checks
ENV NODE_ENV=production \
    PORT=3000 \
    SENTINEL_PYTHON=/opt/venv/bin/python \
    HF_HOME=/tmp/huggingface \
    PYTHONUNBUFFERED=1
USER node
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "start"]
