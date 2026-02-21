#!/usr/bin/env node
/**
 * Post-install script: sets up symlinks and copies needed to run the app.
 * Run automatically by npm install (postinstall), or run: node scripts/restore-generated.js
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const publicJs = path.join(root, 'public', 'js');
const releaseDir = path.join(publicJs, 'release');

// Ensure release dir exists
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
  console.log('Created public/js/release');
}

// Copy real dagre.min.js (public/js/dagre.js is otherwise a path pointer, which breaks when served as JS)
var dagreSrc = path.join(root, 'node_modules', 'dagre', 'dist', 'dagre.min.js');
var dagreDest = path.join(publicJs, 'dagre.js');
var dagreRelease = path.join(releaseDir, 'dagre.js');
if (fs.existsSync(dagreSrc)) {
  fs.copyFileSync(dagreSrc, dagreDest);
  fs.copyFileSync(dagreSrc, dagreRelease);
  console.log('Copied dagre.min.js to public/js/dagre.js and release/dagre.js');
}

// Run post_install.sh (symlinks for jbrowse.repo, MultiBigWig, copy dagre.js, and /js/ npm packages)
const scriptPath = path.join(root, 'post_install.sh');
if (fs.existsSync(scriptPath)) {
  try {
    execSync(`sh "${scriptPath}"`, { cwd: root, stdio: 'inherit' });
    console.log('post_install.sh completed.');
  } catch (e) {
    console.warn('post_install.sh failed (will try Node symlinks):', e.message);
    linkNpmPackagesToPublicJs();
  }
} else {
  console.warn('post_install.sh not found; creating npm package symlinks only.');
  linkNpmPackagesToPublicJs();
}

// If post_install.sh didn't run (e.g. no sh on Windows), at least link packages needed for /js/
function linkNpmPackagesToPublicJs() {
  const packages = ['bvbrc_js_client', 'cytoscape-context-menus', 'html2canvas'];
  const nodeModules = path.join(root, 'node_modules');
  packages.forEach(function (pkg) {
    const target = path.join(nodeModules, pkg);
    const linkPath = path.join(publicJs, pkg);
    if (fs.existsSync(target) && !fs.existsSync(linkPath)) {
      try {
        fs.symlinkSync(target, linkPath, 'dir');
        console.log('Linked public/js/' + pkg + ' -> node_modules/' + pkg);
      } catch (err) {
        console.warn('Could not symlink ' + pkg + ':', err.message);
      }
    }
  });
}
