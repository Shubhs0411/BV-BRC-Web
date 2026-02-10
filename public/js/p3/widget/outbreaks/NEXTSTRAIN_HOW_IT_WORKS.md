# How Nextstrain Works in BV-BRC (Full Explanation)

This document explains the entire Nextstrain integration so you can explain it to others.

---

## 1. What is Nextstrain / Auspice?

- **Nextstrain** is an open-source project for visualizing pathogen evolution (phylogenetic trees, maps, etc.).
- **Auspice** is the web app that powers the Nextstrain viewer: the tree, the map, the sidebar, and the logic to load datasets.
- Datasets are **JSON files** (Nextstrain v2 format) that describe a tree, metadata, and optional narratives. Example: `zika.json`, `measles.json`.

Normally you would run Auspice as a **separate** server (`auspice view --datasetDir ./datasets`), which starts a process on port 4000 and serves both the UI and the data. In BV-BRC we **do not** run that separate server. Instead, the **same** BV-BRC server serves both the Auspice UI and the data API. That is the core of the integration.

---

## 2. Where Do Users See Nextstrain?

- **Navigation:** Outbreak Tracker → **Measles 2025** (or the relevant outbreak) → **Nextstrain** tab.
- The Measles outbreak viewer has several tabs (Overview, Map, Phylogenetics, Data, Resources, **Nextstrain**, Command Line Tool). The Nextstrain tab is one of them.
- That tab is a **single iframe** that loads the Auspice viewer from the **same** BV-BRC server at the path `/nextstrain-viewer`. So the URL in the iframe is something like `http://localhost:3000/nextstrain-viewer` (same origin as the rest of the app).

---

## 3. One-Server Architecture (No localhost:4000)

We run **only** the BV-BRC server (e.g. `npm start` → port 3000). That one server:

1. **Serves the BV-BRC app** (outbreaks, Measles page, tabs, etc.).
2. **Serves the Auspice UI** (HTML + JavaScript) at `/nextstrain-viewer` and `/nextstrain-viewer/dist/*` (and `/dist/*` for chunk loading).
3. **Serves the Charon API** at `/charon/*`. Charon is the backend Auspice uses to list datasets and fetch dataset JSON. Our implementation reads from the `datasets/` folder at the project root.

So:

- **No separate Auspice process.** No `npm run nextstrain` or localhost:4000 unless someone explicitly runs that and overrides the tab URL.
- The iframe and the Charon API are **same-origin** (e.g. both on localhost:3000), so there are no CORS issues.

---

## 4. Request Flow (Step by Step)

When a user opens the **Nextstrain** tab:

1. **Tab creates an iframe**
   The iframe `src` is set to the **same origin** + `/nextstrain-viewer`, e.g. `http://localhost:3000/nextstrain-viewer`.
   (Code: `public/js/p3/widget/outbreaks/OutbreaksNextstrainTab.js`.)

2. **Browser requests the viewer page**
   `GET /nextstrain-viewer` hits the BV-BRC Express app.
   The app reads the **custom Auspice build** in the root `dist/` folder (produced by `npm run build:nextstrain`), fixes the favicon path, and sends that HTML.
   (Code: `app.js`, route for `/nextstrain-viewer`.)

3. **Browser loads Auspice assets**
   The HTML references scripts under `/dist/` (e.g. `/dist/auspice.main.bundle....js`).
   Those requests are served by Express from the root `dist/` folder at both `/dist` and `/nextstrain-viewer/dist`.
   (Code: `app.js`: `app.use('/dist', ...)` and `app.use('/nextstrain-viewer/dist', ...)`.)

4. **Auspice JavaScript runs inside the iframe**
   It looks at the current URL. The path is `/nextstrain-viewer`, so Auspice treats **"nextstrain-viewer"** as the **dataset name** (prefix) and calls the Charon API to load that dataset:
   `GET /charon/getDataset?prefix=nextstrain-viewer`

5. **Charon API: redirect when prefix is the viewer path**
   There is **no** dataset file named `nextstrain-viewer`. So in `routes/auspice.js` we intercept this:
   - If the requested prefix is exactly `nextstrain-viewer`, we **do not** look up a file.
   - We call Auspice’s `getAvailableDatasets(datasetsPath)` to get the list of datasets from the `datasets/` folder (e.g. `["zika"]` if only `zika.json` exists).
   - We take the **first** available dataset (e.g. `zika`) and **redirect** the request to:
     `GET /charon/getDataset?prefix=/zika`
   So the client then loads the **first available dataset** (no hardcoded name).
   (Code: `routes/auspice.js`, wrapper around `/getDataset`.)

6. **Charon API: serve the dataset**
   For `GET /charon/getDataset?prefix=/zika`, the normal Auspice handler runs. It finds `datasets/zika.json`, reads it, and streams it back as JSON.
   (Code: `routes/auspice.js` uses `auspice/cli/server/getDataset` with `datasetsPath`.)

7. **Auspice renders the tree**
   The client receives the JSON and draws the phylogenetic tree (and map, etc.) inside the iframe.

At no point does the app talk to localhost:4000 unless you explicitly point it there (see Overrides below).

---

## 5. Charon API in Detail

Charon is the backend API that Auspice expects. We implement it inside BV-BRC.

- **Base path:** All Charon routes are under `/charon` (e.g. `/charon/getAvailable`, `/charon/getDataset`).
  Mount: `app.use('/charon', auspice)` in `app.js`, where `auspice` is the router from `routes/auspice.js`.

- **`GET /charon/getAvailable`**
  Returns the list of available datasets (and narratives).
  Implemented by Auspice’s `setUpGetAvailableHandler({ datasetsPath, narrativesPath })`.
  It scans the `datasets/` directory for eligible `.json` files and returns their “request” names (e.g. `zika` for `zika.json`).
  **Nothing is hardcoded:** the list is built from the filesystem.

- **`GET /charon/getDataset?prefix=...`**
  Returns the JSON content of one dataset.
  Implemented by Auspice’s `setUpGetDatasetHandler({ datasetsPath })`.
  The `prefix` is the dataset name (e.g. `zika` or `/zika`). The handler maps that to a file in `datasets/` (e.g. `zika.json`) and streams the file.
  **Special case:** If `prefix` is exactly `nextstrain-viewer`, we do **not** look for a file; we redirect to the first available dataset (see step 5 above).

- **`GET /charon/getNarrative?prefix=...`**
  Used for narrative (markdown) content. We use the same Auspice handler; the narratives path points under `datasets/narratives`. If you don’t use narratives, this is unused.

All of this runs in the **same** Node process as the rest of BV-BRC; no second server.

---

## 6. Where the UI and Data Live

- **Auspice UI (HTML + JS):**
  Comes from a **custom Auspice build** produced by `npm run build:nextstrain`:
  - The build outputs into the project-root `dist/` directory.
  - `/nextstrain-viewer` and `/nextstrain-viewer/` → modified `dist/index.html`.
  - `/nextstrain-viewer/dist/*` and `/dist/*` → static files from the root `dist/` folder.
  - `/nextstrain-viewer/favicon.png` → served from `node_modules/auspice/favicon.png`.

- **Dataset files (e.g. zika.json):**
  Stored in the **`datasets/`** folder at the **project root** (same level as `app.js`, `package.json`).
  The Charon handlers are configured with `datasetsPath = path.resolve(__dirname, '..', 'datasets')` in `routes/auspice.js`, so they read from that folder.
  Adding a new dataset = adding a new Nextstrain v2 JSON file in `datasets/` (e.g. `measles.json`). The list and the “first dataset” redirect are both driven by what’s in that folder; nothing is hardcoded to `zika`.

---

## 7. Key Files (Summary)

| What | File | Role |
|------|------|------|
| Tab UI | `public/js/p3/widget/outbreaks/OutbreaksNextstrainTab.js` | Creates the iframe; sets `src` to same-origin + `/nextstrain-viewer` (or override). Handles resize when tab is shown. |
| Tab registration | `public/js/p3/widget/outbreaks/Measles/index.js` | Instantiates the Nextstrain tab and adds it to the Measles viewer. |
| Charon API | `routes/auspice.js` | Defines `/charon/getAvailable`, `/charon/getDataset`, `/charon/getNarrative`. Uses Auspice’s handlers + redirect for `prefix=nextstrain-viewer`. |
| Serving UI + Charon | `app.js` | Mounts `/charon`, serves `/nextstrain-viewer`, `/nextstrain-viewer/dist`, `/dist`, favicon. |
| Data | `datasets/*.json` | Nextstrain v2 JSON files; Charon lists and serves them. |

---

## 8. Why the Redirect (nextstrain-viewer → first dataset)?

Auspice infers the “dataset” from the **URL path**. When the iframe loads `http://localhost:3000/nextstrain-viewer`, the path is `/nextstrain-viewer`, so Auspice asks for the dataset named **"nextstrain-viewer"**. There is no such file in `datasets/`, so without special handling we would return 404 and the tree would not load.

So we special-case in `routes/auspice.js`: when the requested prefix is exactly `nextstrain-viewer`, we **redirect** the client to `getDataset?prefix=/<first-available-dataset>`. The first available dataset is whatever `getAvailableDatasets(datasetsPath)` returns first (e.g. `zika` if only `zika.json` exists). So the user always sees a tree when they have at least one dataset, and **no dataset name is hardcoded**.

---

## 9. Adding New Datasets

1. Put a Nextstrain v2 JSON file in the **`datasets/`** folder (e.g. `measles.json`).
2. Restart the BV-BRC server (so Charon rescans the folder).
3. Open the Nextstrain tab. The new dataset will appear in the list. The “first dataset” redirect will use the first in the list (order depends on how Auspice’s getAvailable returns them); users can always switch dataset in the Auspice UI.

No code changes are required to add a dataset; only the contents of `datasets/` matter.

---

## 10. Overrides (Optional)

- **Use an external Nextstrain URL (e.g. nextstrain.org or a separate Auspice on 4000):**
  Set `window.App.nextstrainUrl` or `window.App.nextstrainMeaslesUrl` to that URL (e.g. `'http://localhost:4000'`). The Nextstrain tab will then load that URL in the iframe instead of `/nextstrain-viewer`.
  So: **by default** nothing uses localhost:4000; it is only used if you run a separate Auspice and set this override.

- **Run standalone Auspice for debugging:**
  `npm run nextstrain` starts Auspice on port 4000 with `--datasetDir ./datasets`. The BV-BRC app does not use it unless you set `window.App.nextstrainUrl` (or `nextstrainMeaslesUrl`) as above.

---

## 11. One-Sentence Summary

**Nextstrain in BV-BRC:** The same server that runs the app also serves the Auspice viewer at `/nextstrain-viewer` and the Charon API at `/charon`, which lists and serves Nextstrain v2 JSON files from the `datasets/` folder; the Nextstrain tab is an iframe to `/nextstrain-viewer`, and when Auspice asks for the non-existent dataset "nextstrain-viewer" we redirect it to the first available dataset so a tree always loads without hardcoding any dataset name.
