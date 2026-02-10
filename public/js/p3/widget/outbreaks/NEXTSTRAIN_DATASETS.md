# How the Zika virus is shown through Nextstrain

This explains how the **zika** dataset is displayed in the **Nextstrain** tab (e.g. in the Measles outbreak page).

## Flow (step by step)

1. **Dataset file**  
   `datasets/zika.json` is a single JSON file in [Nextstrain v2 format](https://docs.nextstrain.org/en/latest/reference/data-formats.html). It contains the phylogenetic tree and metadata (`version`, `meta`, `tree`, `nodes`).

2. **Auspice server**  
   When you run `npm run nextstrain`, the script runs:
   ```bash
   npx auspice view --datasetDir ./datasets
   ```
   Auspice starts a small HTTP server (default: **http://localhost:4000**) and scans the `datasets/` directory. Every `.json` file there is treated as a dataset. It builds a list of available datasets (e.g. “zika”) and serves the tree UI and data for each.

3. **Nextstrain tab in the app**  
   The Measles outbreak page includes a **Nextstrain** tab. That tab is implemented by [OutbreaksNextstrainTab.js](OutbreaksNextstrainTab.js): it creates an **iframe** whose `src` is the Auspice URL.  
   - When you open the app from **localhost**, the tab uses **http://localhost:4000** (or `window.App.nextstrainPort` if set).  
   - So the content of the tab is exactly the Auspice app running in that iframe.

4. **Selecting Zika**  
   Inside the iframe, Auspice shows its own UI: a dataset list (splash) and then the tree view. You choose **zika** from that list. Auspice then loads `zika.json` (via its own API from the same server), parses the v2 JSON, and renders the phylogenetic tree, map, and metadata. All of that happens inside the iframe; the BV-BRC app only provides the iframe and its URL.

## Summary diagram

```
datasets/zika.json
       │
       ▼
  npm run nextstrain  →  Auspice server (localhost:4000)
       │                        │
       │                        │ scans datasets/, serves UI + data
       │                        ▼
       │                 User opens: Measles outbreak → Nextstrain tab
       │                        │
       │                        ▼
       │                 Tab = iframe src="http://localhost:4000"
       │                        │
       │                        ▼
       └──────────────► User selects "zika" in iframe
                                │
                                ▼
                        Auspice loads zika.json, renders tree
```

## Why it works

- **Auspice** is the official Nextstrain viewer. It knows how to read v2 JSON and draw the tree.  
- **zika.json** is already in the correct v2 format, so Auspice can use it as-is.  
- The **Nextstrain tab** does not parse or render the tree itself; it only embeds Auspice. So “how it manages to show it” is: the tab points the iframe at the Auspice server that is serving `datasets/`, and you select the zika dataset inside that viewer.

## Config (optional)

- **Different port:** `PORT=4001 npm run nextstrain`, then set `window.App.nextstrainPort = 4001` so the tab uses port 4001.
- **Custom URL:** Set `window.App.nextstrainUrl` (or `window.App.nextstrainMeaslesUrl`) to your Auspice URL so the tab loads that instead of localhost.
