#!/usr/bin/env node
/**
 * Removes a docs/API version, undoing what `npm run versioning <version>` does.
 * Deletes:
 *   - versioned_docs/version-<version>/
 *   - versioned_sidebars/version-<version>-sidebars.json
 *   - the entry from versions.json
 *
 * Usage:  node scripts/docs-unversion.js <version>
 *         npm run unversioning -- <version>
 */

const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version) {
    console.error("Usage: node scripts/docs-unversion.js <version>");
    process.exit(1);
}

const root = path.join(__dirname, "..");

// 1. Remove versioned_docs/version-<version>/
const versionedDir = path.join(root, "versioned_docs", `version-${version}`);
if (fs.existsSync(versionedDir)) {
    fs.rmSync(versionedDir, {recursive: true, force: true});
    console.log(`[unversioning] Removed ${path.relative(root, versionedDir)}`);
} else {
    console.warn(`[unversioning] Not found: ${path.relative(root, versionedDir)}`);
}

// 2. Remove versioned_sidebars/version-<version>-sidebars.json
const sidebarFile = path.join(root, "versioned_sidebars", `version-${version}-sidebars.json`);
if (fs.existsSync(sidebarFile)) {
    fs.rmSync(sidebarFile);
    console.log(`[unversioning] Removed ${path.relative(root, sidebarFile)}`);
} else {
    console.warn(`[unversioning] Not found: ${path.relative(root, sidebarFile)}`);
}

// 3. Remove from versions.json
const versionsFile = path.join(root, "versions.json");
const versions = JSON.parse(fs.readFileSync(versionsFile, "utf8"));
const filtered = versions.filter(v => v !== version);
if (filtered.length === versions.length) {
    console.warn(`[unversioning] Version "${version}" not found in versions.json`);
} else {
    fs.writeFileSync(versionsFile, JSON.stringify(filtered, null, 2) + "\n", "utf8");
    console.log(`[unversioning] Removed "${version}" from versions.json`);
}

console.log(`[unversioning] Done.`);
