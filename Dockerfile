FROM node:20-bullseye AS builder

WORKDIR /usr/src/app

# Copy deps and files needed for postinstall (restore-generated.js, post_install.sh, public for dagre/release)
COPY package*.json ./
COPY post_install.sh ./
COPY scripts ./scripts
COPY public ./public
RUN npm install

# Copy full source (postinstall already ran; restore again so COPY does not overwrite generated public/js)
COPY . .
RUN node scripts/restore-generated.js

# Build embedded Auspice/Nextstrain viewer into ./dist
RUN npm run build:nextstrain


FROM node:20-bullseye AS runtime

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Install only production dependencies; need scripts/ for postinstall and public/ from builder (generated dagre, jbrowse, etc.)
COPY package*.json ./
COPY post_install.sh ./
COPY --from=builder /usr/src/app/scripts ./scripts
COPY --from=builder /usr/src/app/public ./public
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

# Config loader; write valid JSON so nconf never fails (app defaults from config.js)
COPY --from=builder /usr/src/app/config.js ./config.js
COPY --from=builder /usr/src/app/p3-web.conf.sample ./p3-web.conf.sample
RUN echo '{}' > p3-web.conf

# HTTP port exposed by the Express app (see config.js / p3-web.conf)
EXPOSE 3000

# Start the BV-BRC web application
CMD ["node", "./bin/p3-web"]

