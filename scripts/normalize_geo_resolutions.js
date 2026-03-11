#!/usr/bin/env node
// Converts meta.geo_resolutions fields from object form to array form across datasets.
// Usage: node scripts/normalize_geo_resolutions.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const datasetsDir = path.resolve(__dirname, '..', 'datasets');

function convertGeoResolutions(meta) {
  if (!meta || !meta.geo_resolutions) return false;
  const gr = meta.geo_resolutions;
  if (Array.isArray(gr)) return false; // already good
  if (typeof gr === 'object') {
    // convert map->array
    const arr = Object.keys(gr).map((key) => {
      const entry = gr[key];
      // if the value already has a key field, avoid overwriting
      if (entry && typeof entry === 'object' && entry.key === undefined) {
        return Object.assign({ key }, entry);
      }
      // otherwise just add key property
      return { key, ...(entry || {}) };
    });
    meta.geo_resolutions = arr;
    return true;
  }
  // anything else (string/number) is unexpected; just wrap
  meta.geo_resolutions = [{ key: String(gr), demes: {} }];
  return true;
}

function processFile(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  let json;
  try {
    json = JSON.parse(data);
  } catch (e) {
    console.error(`failed to parse ${filePath}: ${e.message}`);
    return;
  }
  if (!json.meta) return;
  const changed = convertGeoResolutions(json.meta);
  if (changed) {
    console.log(`converted geo_resolutions in ${path.basename(filePath)}`);
    fs.writeFileSync(filePath, JSON.stringify(json));
    // Skip compression for now
    // try {
    //   const compressed = zlib.gzipSync(JSON.stringify(json));
    //   fs.writeFileSync(gzPath, compressed);
    //   console.log(`re-wrote gzip ${path.basename(gzPath)}`);
    // } catch (e) {
    //   console.warn(`failed to write gzip for ${filePath}: ${e.message}`);
    // }
  }
}

function main() {
  const entries = fs.readdirSync(datasetsDir);
  entries.forEach((entry) => {
    if (!entry.endsWith('.json')) return;
    const full = path.join(datasetsDir, entry);
    processFile(full);
  });
}

main();
