/**
 * Charon API for embedded Auspice/Nextstrain viewer.
 * Serves dataset list and dataset JSON from ./datasets so no separate Auspice server is needed.
 */
const path = require('path');
const express = require('express');
const router = express.Router();

const datasetsPath = path.resolve(__dirname, '..', 'datasets');
const narrativesPath = path.resolve(__dirname, '..', 'datasets', 'narratives');

const getAvailable = require('auspice/cli/server/getAvailable').setUpGetAvailableHandler({
  datasetsPath,
  narrativesPath
});
const getDatasetAuspice = require('auspice/cli/server/getDataset').setUpGetDatasetHandler({
  datasetsPath
});
const getNarrative = require('auspice/cli/server/getNarrative').setUpGetNarrativeHandler({
  narrativesPath
});

// Normalize prefixes that accidentally include the viewer path.
// Example: prefix="nextstrain-viewer/dengue/all" -> "/dengue/all"
router.get('/getDataset', (req, res, next) => {
  if (req.query && typeof req.query.prefix === 'string') {
    let p = req.query.prefix;
    // remove leading & trailing slashes
    p = p.replace(/^\/+|\/+$/g, '');
    const viewerPrefix = 'nextstrain-viewer/';
    if (p.startsWith(viewerPrefix)) {
      // strip the viewer path so Auspice sees just the dataset path
      req.query.prefix = '/' + p.slice(viewerPrefix.length);
    } else {
      // restore normalized value (with single leading slash) for other prefixes
      req.query.prefix = '/' + p;
    }
  }
  return getDatasetAuspice(req, res, next);
});
router.get('/getAvailable', getAvailable);
router.get('/getNarrative', getNarrative);

router.get('*', (req, res) => {
  res.status(500).type('text/plain').send('Query unhandled -- ' + req.originalUrl);
});

module.exports = router;
