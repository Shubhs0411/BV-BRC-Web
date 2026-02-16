# Phylogeny Tab Workflow (Taxonomy Viewer)

This document describes how the **Phylogeny** tab is shown and what it displays in the Taxonomy viewer:

- **Bacteria:** The Phylogeny tab is **always** shown.
- **Viruses:** The Phylogeny tab is shown **only when** the current taxon has a tree: Nextstrain config or phyloxml entry in taxon_tree_dict.

---

## 1. When is the Phylogeny tab visible?

| Domain | Visibility |
|--------|------------|
| **Bacteria** | Phylogeny tab is **always** visible. |
| **Viruses** | Phylogeny tab is visible **only if** the taxon has at least one of: **Nextstrain config** (see below) or **phyloxml (taxon_tree_dict)**. |

**Sources used for viruses (and for what the tab shows for bacteria):**

| Source | Description |
|--------|-------------|
| **Nextstrain config** | The taxon (or an alias) is listed in `/public/config/taxon_nextstrain.json` with a `dataset.paths.nextstrain_path` (e.g. `"zika"`). The tab then shows the Nextstrain/Auspice iframe for that dataset. |
| **Phyloxml tree (taxon_tree_dict)** | The taxon ID is a key in the BV-BRC **taxon_tree_dict** (see below). The tab then shows the legacy phyloxml tree. |

---

## 2. taxon_tree_dict (phyloxml)

- **URL:** `https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json?version=012324`
- **Shape:** A JSON object whose **keys are taxon IDs as strings** (e.g. `"562"`, `"3052345"`). Each value is the **phyloxml filename** (no path) for that taxon.
- **Example:** `{ "562": "some_file.xml", "1234": "other.xml" }`
- **Usage:** The legacy Phylogeny widget (and our visibility logic) checks `Object.prototype.hasOwnProperty.call(dict, taxonId)` with `taxonId` as `String(state.taxon_id)` so that string keys match.

The phyloxml files are served from:
`https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/phyloxml/<filename>`

---

## 3. Nextstrain config

- **File:** `public/config/taxon_nextstrain.json`
- **Shape:** Array of entries, e.g.:

```json
[
  {
    "taxon_id": 64320,
    "alias_ids": ["64320"],
    "dataset": {
      "name": "Zika virus genomic surveillance",
      "paths": { "nextstrain_path": "zika" }
    }
  }
]
```

- **Matching:** For the current `state.taxon_id` we check:
  - `String(taxon_id) === String(entry.taxon_id)`, or
  - `entry.alias_ids` contains `String(taxon_id)`.
- **Effect:** If there is a match and `dataset.paths.nextstrain_path` exists, we show the Phylogeny tab and the wrapper loads the Nextstrain iframe for that path (e.g. `/nextstrain-viewer/zika`).

---

## 4. Flow in the Taxonomy viewer

**Initial load:** The Phylogeny tab **is** added in `postCreate` at position 1 (so it is present when the initial taxon is a bacterium). For viruses, the tab is removed and then conditionally re-added by `_addPhylogenyTabIfHasTree()` when the taxon has a tree.

1. **Navigation**  
   User opens e.g. `/view/Taxonomy/<id>`. State is set with `pathname`, then `buildTaxonIdByState(state)` resolves to a numeric `taxon_id` and we fetch `GET {dataAPI}/taxonomy/{id}` to get `taxonomy` (lineage, lineage_names, lineage_ids, etc.).

2. **Context (bacteria vs virus)**  
   From lineage we set `context`:
   - `lineage_names` includes `"Bacteria"` → `context = 'bacteria'`, call `changeToBacteriaContext()` (which adds the Phylogeny tab at position 1).
   - `lineage_names` includes `"Viruses"` → `context = 'virus'`, call `changeToVirusContext()` (which removes the Phylogeny tab), or if already in virus context, remove the Phylogeny tab.

3. **Phylogeny tab visibility**  
   - **Bacteria (just switched from virus):** `changeToBacteriaContext()` adds the Phylogeny tab; we do **not** call `_addPhylogenyTabIfHasTree()` (bacteria always have the tab).
   - **Bacteria (already in bacteria, navigated to another bacterium):** We do **not** remove or re-add the Phylogeny tab; it stays visible.
   - **Viruses:** After removing the Phylogeny tab (via `changeToVirusContext()` or explicit remove), we call **`_addPhylogenyTabIfHasTree()`** so the tab is added only when the virus has a tree.

4. **`_addPhylogenyTabIfHasTree()`**  
   Used **only for viruses**. Uses cached **Nextstrain config** and, when needed, cached **taxon_tree_dict**.
   - If the current taxon has a Nextstrain config entry → `viewer.addChild(phylogeny, 1)`.
   - Else if the current taxon is a key in taxon_tree_dict → `viewer.addChild(phylogeny, 1)`.
   - Otherwise the Phylogeny tab is not added (virus with no tree has no Phylogeny tab).

5. **What the tab shows (PhylogenyNextstrainOrTree wrapper)**  
   When the user selects the Phylogeny tab, the **wrapper** receives `state`:
   - If the taxon has a **Nextstrain config** → show an iframe with `src = origin + '/nextstrain-viewer/' + nextstrain_path` (e.g. zika). The embedded Auspice app loads that dataset via the Charon API (see below).
   - Otherwise → show the **legacy Phylogeny widget**, which uses taxon_tree_dict and phyloxml as before (no Nextstrain, no FASTA).

---

## 5. Charon API and direct dataset load

- The iframe loads e.g. `https://yoursite/nextstrain-viewer/zika`. The Auspice app requests e.g. `GET /charon/getDataset?prefix=nextstrain-viewer/zika`.
- In **`routes/auspice.js`** we rewrite the query so the prefix becomes **`zika`** (strip the `nextstrain-viewer/` part), because the Auspice server helpers interpret `req.url` and expect a dataset prefix like `zika`, not `nextstrain-viewer/zika`.
- The handler then serves the matching file from the **`datasets/`** directory (e.g. `datasets/zika.json`). These are **pre-built Nextstrain JSON** files; the app does not build them from FASTA or metadata.

---

## 6. FASTA and metadata (not implemented in this app)

- **Current behaviour:** The app does **not** read or process FASTA files. It only:
  - Serves pre-built Nextstrain JSON from `datasets/` (e.g. `zika.json`).
  - Uses pre-built phyloxml from BV-BRC for the legacy tree.
- **Future (e.g. H3N2, segment_x.fasta + BVBRC_genome.txt):**  
  A separate conversion step (outside this app) would:
  - Map metadata (e.g. BVBRC_genome.txt) to Nextstrain-style **metadata.tsv** (columns: strain, virus, accession, date, region, country, division, city, db, segment, authors, url, title, journal, paper_url).
  - Use segment FASTA files as sequence inputs.
  - Run the Nextstrain build pipeline to produce JSON.
  - Place the JSON in `datasets/` and add an entry to `public/config/taxon_nextstrain.json`.  
  After that, the same workflow above applies (Phylogeny tab and Nextstrain iframe for that taxon).

---

## 7. File roles (summary)

| File / URL | Role |
|------------|------|
| `public/js/p3/widget/viewer/Taxonomy.js` | Bacteria always get Phylogeny tab (postCreate + changeToBacteriaContext); viruses get it only when `_addPhylogenyTabIfHasTree()` finds Nextstrain config or taxon_tree_dict. |
| `public/config/taxon_nextstrain.json` | Lists taxon_id (and optional alias_ids) and `dataset.paths.nextstrain_path` for Nextstrain datasets. |
| `public/js/p3/widget/PhylogenyNextstrainOrTree.js` | Wrapper: shows Nextstrain iframe if taxon in config, else shows legacy Phylogeny widget. |
| `public/js/p3/widget/Phylogeny.js` | Legacy phyloxml tree: fetches taxon_tree_dict and phyloxml from BV-BRC, renders tree. |
| `routes/auspice.js` | Charon `/getDataset`: rewrites `prefix=nextstrain-viewer/zika` → `prefix=zika`, then serves `datasets/zika.json`. |
| BV-BRC `taxon_tree_dict.json` | Map of taxon_id (string) → phyloxml filename; used for both visibility and legacy tree content. |

---

## 8. Summary

- **Bacteria** always show the Phylogeny tab. **Viruses** show it only when the taxon has a tree (Nextstrain config or **taxon_tree_dict**).
- **taxon_tree_dict** keys are taxon IDs as strings; we use the same string form for matching.
- **Nextstrain** tab content is the iframe to `/nextstrain-viewer/<path>`; Charon serves pre-built JSON from `datasets/`.
- **FASTA** and metadata conversion are not part of this app; they belong in a separate pipeline whose output is placed in `datasets/` and in `taxon_nextstrain.json`.

---

## 9. Function-by-function reference (line numbers and details)

Every function and call site involved in the Phylogeny tab workflow, with file paths and line numbers. Line numbers are for the current codebase and may shift with edits.

---

### 9.1 `public/js/p3/widget/viewer/Taxonomy.js`

| Line(s) | Function or code | Purpose |
|--------|------------------|--------|
| **1–8** | `define([...], function(...){ ... })` | Module declaration. Imports `PhylogenyNextstrainOrTree`, `PathJoin`, `TaxonomyTreeGrid`, `TaxonomyOverview`, etc. |
| **10** | `return declare([GenomeList], { ... })` | Taxonomy viewer extends `GenomeList`; inherits viewer, state, overview, and tab infrastructure. |
| **14–16** | `apiServiceUrl`, `taxonomy`, `context: 'bacteria'` | Defaults. `context` is `'bacteria'` or `'virus'`; drives which tabs (including Phylogeny) are shown. |
| **17–36** | **`postCreate`** | Runs once after the widget DOM is created. **Lines 20–24:** Instantiates `PhylogenyNextstrainOrTree` as `this.phylogeny` with `title: 'Phylogeny'`, viewer-scoped `id`, and `state`. **Lines 26–30:** Creates `TaxonomyTreeGrid` as `this.taxontree`. **Lines 31–32:** Adds Phylogeny at index **1** (right after Overview) and taxontree at **2** so bacteria see the Phylogeny tab on initial load. **Line 34:** Watches `taxonomy` and calls `onSetTaxonomy` when it changes. |
| **37–51** | **`_setTaxon_idAttr`** | Attribute setter for `taxon_id`. Fetches `GET {apiServiceUrl}/taxonomy/{id}` and then `this.set('taxonomy', taxonomy)` so `onSetTaxonomy` runs with the new lineage/lineage_names/lineage_ids. |
| **54–67** | **`changeToBacteriaContext`** | Switches UI to bacteria context. **Line 55:** Sets overview context to `'bacteria'`. **Lines 58–59:** Adds Phylogeny at index **1** (bacteria always have the tab). **Lines 59–66:** Adds AMR, Sequences, Specialty Genes, Pathways, Subsystems, Interactions at their indices. |
| **69–79** | **`changeToVirusContext`** | Switches UI to virus context. **Line 70:** Removes the Phylogeny tab. **Lines 71–78:** Removes bacteria-only tabs (AMR, Sequences, Specialty Genes, Pathways, Subsystems, Interactions). |
| **80–149** | **`onSetTaxonomy`** | Watcher callback when `this.taxonomy` is set (after taxonomy fetch). **Lines 82–83:** Updates header and perspective label. **Lines 85–122:** Virus-only customizations when `context === 'bacteria'` (Surveillance, Serology, SFVT, Strains). **Lines 124–136:** **Line 125–127:** If lineage is Bacteria and context was virus → set context to `'bacteria'` and call `changeToBacteriaContext()` (adds Phylogeny; no `_addPhylogenyTabIfHasTree`). **Lines 128–136:** If lineage is Viruses → if coming from bacteria, set context to `'virus'` and call `changeToVirusContext()` (removes Phylogeny); else remove Phylogeny with `try { this.viewer.removeChild(this.phylogeny); } catch (e) {}`. Then call **`_addPhylogenyTabIfHasTree()`** so the virus gets the Phylogeny tab only when a tree exists. **Lines 138–139:** Store taxonomy on state and call `setActivePanelState()`. |
| **144–210** | **`_addPhylogenyTabIfHasTree`** | Adds the Phylogeny tab only when the current taxon has a tree (Nextstrain config or taxon_tree_dict). Used **only for viruses**. **Line 146:** `taxonId = String(state.taxon_id || this.taxon_id || '')`. **Lines 150–152:** `addPhylogenyTab` does `self.viewer.addChild(self.phylogeny, 1)`. **Lines 153–161:** `hasNextstrain(config)` finds an entry where `String(entry.taxon_id) === taxonId` or `alias_ids` contains `taxonId`, and returns whether `entry.dataset.paths.nextstrain_path` exists. **Lines 162–164:** `hasPhyloxmlTree(dict)` returns whether `dict` has own property `taxonId`. **Lines 165–179:** `tryAddFromNextstrain` / `tryAddFromPhyloxmlDict` call `addPhylogenyTab()` when the corresponding source has a match. **Lines 181–211:** If cached Nextstrain config exists and matches, add tab and return. Else if config not loaded, **line 185:** `xhr.get('/public/config/taxon_nextstrain.json')`; in success (**189–195**) cache config, try Nextstrain then phyloxml (or fetch taxon_tree_dict via `_fetchTaxonTreeDictThenAdd`); in error (**196–203**) cache empty config and try phyloxml path. If config was already loaded but no Nextstrain match (**205–210**), try phyloxml from cache or fetch dict then add. |
| **212–220** | **`_fetchTaxonTreeDictThenAdd`** | Fetches BV-BRC **taxon_tree_dict** and then runs the given callback (e.g. `tryAddFromPhyloxmlDict`). **Line 213:** URL `https://www.bv-brc.org/api/content/bvbrc_phylogeny_tab/taxon_tree_dict.json?version=012324`. **Lines 214–219:** On success, cache dict and call `tryAddFromPhyloxmlDict(this._taxonTreeDictCache)`; on error, cache `{}`. |
| **325–396** | **`setActivePanelState`** | Syncs the active tab with `state.hashParams.view_tab` and passes state into each tab. **Lines 327–328:** Resolve `active` from `state.hashParams.view_tab` or default `'overview'`. **Lines 339–341:** When active tab is **`phylogeny`**, calls `activeTab.set('state', lang.mixin({}, this.state))` so the Phylogeny tab (wrapper) receives current state (including `taxon_id`) and can choose Nextstrain vs phyloxml. |
| **254–322** | **`onSetState`** | Called when the viewer's `state` is set (e.g. on route load). **Line 260:** `buildTaxonIdByState(state)` resolves `taxon_id` from pathname. **Lines 261–262:** Sets `state.taxon_id` and `this.taxon_id`. **Line 296:** Sets `state.search`. **Lines 305–314:** Ensures `state.hashParams.view_tab`; selects that tab if it exists. **Line 316:** Calls `setActivePanelState()` so the Phylogeny tab (when visible) gets the correct state. |
| **226–253** | **`buildTaxonIdByState`** | Parses `state.pathname` to get taxon id or name; if numeric, returns it; else POSTs to taxonomy API and returns `taxon_id`. Used so `state.taxon_id` is set before taxonomy fetch and before `onSetTaxonomy` / Phylogeny logic. |
| **431–436** | **`createOverviewPanel`** | Returns the Overview panel (TaxonomyOverview). Overview is added by the parent GenomeList at index 0; Phylogeny is at index 1. |

---

### 9.2 `public/js/p3/widget/PhylogenyNextstrainOrTree.js`

| Line(s) | Function or code | Purpose |
|--------|------------------|--------|
| **6–24** | `define([...], function(...){ ... })` | Imports ContentPane, BorderContainer, Phylogeny (legacy phyloxml widget). |
| **24–25** | `return declare([BorderContainer], { ... })` | Wrapper is a BorderContainer; it holds either the Nextstrain ContentPane or the legacy Phylogeny widget. |
| **27–28** | `state`, `configUrl: '/public/config/taxon_nextstrain.json'` | State holds `taxon_id`; config URL is the Nextstrain taxon→path mapping. |
| **33–38** | **`constructor`** | Initializes `configCache`, `_phyloxmlWidget`, `_nextstrainPane`, `_iframeNode` to null. |
| **40–61** | **`_setStateAttr`** | Setter for `state`. **Line 41:** Normalizes `taxonId = String(state.taxon_id)` (or `''`). **Lines 43–46:** If no taxonId, show phyloxml and return. **Lines 48–58:** If `configCache` is null, **line 49:** `xhr.get(this.configUrl)`; on success (**53**) cache config and call `_applyMode(taxonId)`; on error (**56**) cache `[]` and call `_applyMode(taxonId)`. If cache exists (**59–60**), call `_applyMode(taxonId)` directly. |
| **64–76** | **`_applyMode`** | Decides Nextstrain vs phyloxml. **Lines 65–69:** Finds config entry where `String(entry.taxon_id) === taxonId` or `alias_ids` contains `taxonId`. **Line 70:** `path = entry?.dataset?.paths?.nextstrain_path`. **Lines 71–75:** If `path` exists, call `_showNextstrain(path)`; else call `_showPhyloxml()`. |
| **78–109** | **`_showNextstrain`** | Shows the Nextstrain iframe and hides phyloxml. **Lines 79–83:** If legacy Phylogeny widget exists, remove and destroy it. **Lines 84–85:** Build iframe URL `origin + '/nextstrain-viewer/' + path` (e.g. `/nextstrain-viewer/zika`). **Lines 86–104:** Create or reuse a ContentPane and set its styles; create or reuse an iframe with `src: url` and place it in the pane. **Line 106:** Set iframe `src` if reusing. **Line 109:** `this.addChild(this._nextstrainPane)` to display the iframe. |
| **111–131** | **`_showPhyloxml`** | Shows the legacy Phylogeny (phyloxml) widget and hides Nextstrain. **Lines 112–116:** Remove and clear `_nextstrainPane` if present. **Lines 117–124:** If no `_phyloxmlWidget`, create `new Phylogeny({ title, id, state, region: 'center' })`. **Line 125:** Update widget state. **Line 126:** `this.addChild(this._phyloxmlWidget)`. **Lines 127–129:** Start the widget if not yet started. |
| **133–143** | **`postCreate`** / **`startup`** | **postCreate:** calls inherited. **startup:** calls inherited then, if `this.state` is set, calls `this._setStateAttr(this.state)` so the first display (Nextstrain vs phyloxml) is applied when the user opens the Phylogeny tab. |

---

### 9.3 `routes/auspice.js`

| Line(s) | Function or code | Purpose |
|--------|------------------|--------|
| **1–22** | Module setup | Requires `path`, `express`, and Auspice handlers `getAvailable`, `getDataset`, `getNarrative` configured with `datasetsPath` and `narrativesPath` (e.g. `datasets/`, `datasets/narratives/`). |
| **25–42** | **`router.get('/getDataset', ...)`** | Charon getDataset handler. **Line 26:** Reads `req.query.prefix` (e.g. `nextstrain-viewer/zika`). **Lines 27–29:** Strips leading/trailing slashes; **lines 30–32:** if prefix starts with `'nextstrain-viewer/'`, strip that so `p` becomes e.g. `zika`. **Lines 34–39:** Rewrite `req.url` so the query string has `prefix=zika` instead of `prefix=nextstrain-viewer/zika`, because Auspice's `interpretRequest()` uses `req.url` and expects a dataset prefix like `zika`. **Line 41:** Call `getDatasetAuspice(req, res, next)` to serve the JSON from `datasets/` (e.g. `datasets/zika.json`). |
| **43–44** | **`router.get('/getAvailable', ...)`** / **`router.get('/getNarrative', ...)`** | Delegate to Auspice handlers for listing datasets and serving narratives. |
| **51** | **`module.exports = router`** | Exports the router for the app to mount (e.g. at `/charon`). |

---

### 9.4 `public/js/p3/widget/Phylogeny.js` (legacy phyloxml)

| Line(s) | Function or code | Purpose |
|--------|------------------|--------|
| **1–21** | `define([...], ...)` | Legacy Phylogeny widget: PhyloTree, TreeNavSVG, PathJoin, templates, etc. |
| **43–61** | Declare, `state`, `apiServer`, `phylogram`, etc. | Widget state includes `taxon_id`; uses BV-BRC API and phyloxml date. **Line 61:** `startup` builds the layout (container pane, action bars, item detail panel). The widget fetches **taxon_tree_dict** and phyloxml URL from BV-BRC (elsewhere in the file) and renders the tree. Used by **PhylogenyNextstrainOrTree** when the taxon is **not** in the Nextstrain config (see **PhylogenyNextstrainOrTree** `_showPhyloxml` **lines 118–124**). |

---

### 9.5 Call flow summary

1. **Route load** → state set → **Taxonomy.js** `onSetState` (254) → `buildTaxonIdByState` (260) → `set('taxon_id')` → **`_setTaxon_idAttr`** (37) → GET taxonomy → **`set('taxonomy', taxonomy)`** → **`onSetTaxonomy`** (80).
2. **`onSetTaxonomy`** (80): For bacteria: **`changeToBacteriaContext`** (54) adds Phylogeny at 1; for viruses: **`changeToVirusContext`** (69) or remove phylogeny, then **`_addPhylogenyTabIfHasTree`** (145) which may **`_fetchTaxonTreeDictThenAdd`** (212) and eventually **`viewer.addChild(phylogeny, 1)`** (152).
3. **User selects Phylogeny tab** → **`setActivePanelState`** (325) → **`activeTab.set('state', this.state)`** (347) for `active === 'phylogeny'` → **PhylogenyNextstrainOrTree** **`_setStateAttr`** (40) → **`_applyMode`** (64) → **`_showNextstrain`** (78) or **`_showPhyloxml`** (111).
4. **Nextstrain iframe** loads `/nextstrain-viewer/zika` → Auspice requests **`/charon/getDataset?prefix=nextstrain-viewer/zika`** → **routes/auspice.js** **router.get('/getDataset')** (25) rewrites prefix to `zika` and calls **getDatasetAuspice** (41) → serves `datasets/zika.json`.
 