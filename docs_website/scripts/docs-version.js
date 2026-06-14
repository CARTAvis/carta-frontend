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

const version = process.argv[2];
if (!version) {
    console.error("Usage: node scripts/docs-version.js <version>");
    process.exit(1);
}

// 1. Run the standard Docusaurus versioning command
console.log(`[docs:version] Tagging version ${version}...`);
execSync(`npx docusaurus docs:version ${version}`, {stdio: "inherit"});

// 2. Tag the API version
console.log(`[docs:version] Tagging API version ${version}...`);
execSync(`npm run docusaurus api:version ${version}`, {stdio: "inherit"});
