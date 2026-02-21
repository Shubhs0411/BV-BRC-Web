#!/bin/sh
cd public/js/ || exit 1
cp ../../node_modules/dagre/dist/dagre.min.js ./dagre.js 2>/dev/null || true
cp ../../node_modules/dagre/dist/dagre.min.js ./release/dagre.js 2>/dev/null || true
rm -rf ./jbrowse.repo
ln -sf ../../node_modules/jbrowse ./jbrowse.repo
cd ./jbrowse.repo/plugins/ || exit 1
if [ ! -h MultiBigWig ]; then
  ln -s ../../../node_modules/MultiBigWig .
fi
cd ../.. || true
# bvbrc_js_client, cytoscape-context-menus, html2canvas are served from node_modules via app.js (no symlinks needed)
