FROM node:20-bullseye AS builder

WORKDIR /usr/src/app

# Install app dependencies (including auspice) to run builds
COPY package*.json ./
COPY post_install.sh ./
RUN npm install

# Copy full source into the builder image
COPY . .

# Build embedded Auspice/Nextstrain viewer into ./dist
RUN npm run build:nextstrain


FROM node:20-bullseye AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install only production dependencies for smaller runtime image
COPY package*.json ./
COPY post_install.sh ./
RUN npm install --omit=dev

# Copy server-side code and assets from the builder image
COPY --from=builder /usr/src/app/app.js ./app.js
COPY --from=builder /usr/src/app/bin ./bin
COPY --from=builder /usr/src/app/routes ./routes
COPY --from=builder /usr/src/app/views ./views
COPY --from=builder /usr/src/app/public ./public

# Auspice build and datasets used by the embedded Nextstrain viewer
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/datasets ./datasets

# Config loader and default config files
COPY --from=builder /usr/src/app/config.js ./config.js
COPY --from=builder /usr/src/app/p3-web.conf.sample ./p3-web.conf.sample

# If a p3-web.conf was present at build time, copy it as the default runtime config.
# This can be overridden at runtime by bind-mounting a different p3-web.conf into /usr/src/app.
COPY --from=builder /usr/src/app/p3-web.conf ./p3-web.conf

# HTTP port exposed by the Express app (see config.js / p3-web.conf)
EXPOSE 3000

# Start the BV-BRC web application
CMD ["node", "./bin/p3-web"]

