## Running BV-BRC Web in Docker

This document explains how to run the BV-BRC web app (including the embedded Nextstrain/Auspice viewer) using the provided `Dockerfile`.

---

### 1. Build the image

From the project root:

```bash
docker build -t bvbrc-web .
```

This will:

- Install Node dependencies (including `auspice`).
- Run `npm run build:nextstrain` to produce the Auspice build in `dist/`.
- Build a runtime image with only production dependencies, plus:
  - `app.js`, `bin/`, `routes/`, `views/`, `public/`
  - `dist/` (Auspice build)
  - `datasets/` (Nextstrain JSON datasets)
  - `config.js`, `p3-web.conf.sample`, and `p3-web.conf` (if present at build time)

---

### 2. Run the container

Basic run (using the default `http_port` from `p3-web.conf` or `config.js`, usually 3000):

```bash
docker run --rm -p 3000:3000 bvbrc-web
```

Then open:

- Main app: `http://localhost:3000/`
- Nextstrain viewer (direct): `http://localhost:3000/nextstrain-viewer/zika` (or another dataset path).

The embedded Phylogeny tab uses `public/config/taxon_nextstrain.json` to decide which taxon has a Nextstrain dataset and points an iframe at `/nextstrain-viewer/<dataset>`. Inside the container:

- The Auspice build is served from `/dist` and `/nextstrain-viewer/dist`.
- The Auspice index is served for `/nextstrain-viewer/*` and some dataset-root paths (see `app.js`).
- The Charon API is available under `/charon` (see `routes/auspice.js`).

---

### 3. Mounting datasets (optional)

By default, the image includes whatever JSON files were in the `datasets/` directory at build time. To use an external or updated set of datasets without rebuilding:

```bash
docker run --rm \
  -p 3000:3000 \
  -v /absolute/path/to/datasets:/usr/src/app/datasets \
  bvbrc-web
```

This replaces the container’s `/usr/src/app/datasets` with your host directory, which the Charon API (`/charon/getDataset`, `/charon/getAvailable`) reads from.

---

### 4. Overriding configuration

The app reads configuration via `config.js`, which uses `nconf` to load (in order):

1. Command-line arguments
2. Environment variables
3. `p3-web.conf` in the project root
4. Built-in defaults

In the Docker image:

- `p3-web.conf.sample` is always present (for reference).
- If a `p3-web.conf` existed at build time, it is copied into the image as the default config.

To override at runtime, you can either:

- Bind-mount a different config file:

  ```bash
  docker run --rm \
    -p 3000:3000 \
    -v /absolute/path/to/p3-web.conf:/usr/src/app/p3-web.conf \
    bvbrc-web
  ```

- Or set environment variables that `config.js` / `nconf` will read (e.g. `HTTP_PORT`, `DATA_SERVICE_URL`, etc.).

---

### 5. Quick validation checklist

After starting the container, verify:

- **Base app**
  - Home page loads.
  - Key routes such as `/view/Taxonomy/<taxon_id>` and `/search` work.
- **Phylogeny tab**
  - For a bacterium, the Phylogeny tab appears and shows the legacy phyloxml tree.
  - For a virus with a Nextstrain dataset (e.g. Zika, Dengue, Measles), the Phylogeny tab appears, the Nextstrain iframe loads, and the tree is visible.
- **Charon API**
  - `/charon/getAvailable` returns a JSON list of datasets.
  - `/charon/getDataset?prefix=nextstrain-viewer/zika` returns the JSON for `datasets/zika.json`.
- **Routing**
  - URLs like `/nextstrain-viewer/zika` work in the browser.
  - Core BV-BRC routes (e.g. `/view/...`) behave as expected.

