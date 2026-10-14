FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node public ./public
COPY --chown=node:node serve.mjs package.json ./
USER node
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["node", "serve.mjs"]
