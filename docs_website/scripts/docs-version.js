#!/usr/bin/env node
/**
 * Wraps `docusaurus docs:version <version>` and then rewrites ApiLink path
 * attributes in the newly created versioned_docs/version-<version>/ directory,
 * prepending the version string to every path.
 *
 * Before: <ApiLink path="/stores/class/AppStore">
 * After:  <ApiLink path="/6.0.0/stores/class/AppStore">
 *
 * Usage:  node scripts/docs-version.js <version>
 *         npm run docs:version -- <version>
 */

const {execSync} = require("child_process");
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version) {
    console.error("Usage: node scripts/docs-version.js <version>");
    process.exit(1);
}

// 1. Run the standard Docusaurus versioning command
console.log(`[docs:version] Tagging version ${version}...`);
execSync(`npx docusaurus docs:version ${version}`, {stdio: "inherit"});

// 2. Rewrite ApiLink paths in the versioned docs directory
const versionedDir = path.join(__dirname, "..", "versioned_docs", `version-${version}`);
if (!fs.existsSync(versionedDir)) {
    console.error(`[docs:version] Directory not found: ${versionedDir}`);
    process.exit(1);
}

// Match: path="/..." or path='...' (with or without leading slash)
// Replace leading slash (if any) with "<version>/"
const APILINK_RE = /(<ApiLink\s+path=["'])(\/)?(.*?)(["'])/g;

let totalFiles = 0;
let totalReplacements = 0;

function processDir(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            processDir(fullPath);
        } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
            const original = fs.readFileSync(fullPath, "utf8");
            let count = 0;
            const updated = original.replace(APILINK_RE, (_, prefix, slash, rest, quote) => {
                count++;
                return `${prefix}/${version}/${rest}${quote}`;
            });
            if (count > 0) {
                fs.writeFileSync(fullPath, updated, "utf8");
                console.log(`[docs:version] Rewrote ${count} ApiLink path(s) in ${path.relative(versionedDir, fullPath)}`);
                totalFiles++;
                totalReplacements += count;
            }
        }
    }
}

console.log(`[docs:version] Rewriting ApiLink paths in versioned_docs/version-${version}/...`);
processDir(versionedDir);
console.log(`[docs:version] Done. Updated ${totalReplacements} path(s) across ${totalFiles} file(s).`);

// 3. Tag the API version
console.log(`[docs:version] Tagging API version ${version}...`);
execSync(`npm run docusaurus api:version ${version}`, {stdio: "inherit"});
