# Nextstrain datasets

Put Nextstrain v2 JSON files here (e.g. **zika.json**). The embedded Auspice viewer at **/nextstrain-viewer** reads from this folder via the Charon API—no separate Auspice server is required.

**To view them:**

1. Start the BV-BRC app as usual.
2. Open **Outbreak Tracker → Measles 2025** → **Nextstrain** tab.
3. In the tab, select the **zika** (or any listed) dataset to display the tree.

Optional: to run a standalone Auspice server (e.g. for local debugging), use `npm run nextstrain` and set `window.App.nextstrainUrl = 'http://localhost:4000'` so the tab uses it instead of the built-in viewer.
