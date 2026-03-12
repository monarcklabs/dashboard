#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const openclawRoot = process.argv[2] || "/usr/local/lib/node_modules/openclaw";
const distRoot = path.join(openclawRoot, "dist");

const helperBlock = `function collectTmpRoots(preferredTmpDir) {
\tconst roots = /* @__PURE__ */ new Set();
\tconst normalizedPreferred = path.resolve(preferredTmpDir);
\troots.add(normalizedPreferred);
\tconst preferredParent = path.dirname(normalizedPreferred);
\tif (preferredParent !== normalizedPreferred && preferredParent !== path.parse(preferredParent).root) {
\t\troots.add(preferredParent);
\t}
\treturn [...roots];
}
`;

function findLocalRootsFiles(rootDir) {
  const results = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile() && /^local-roots-.*\.js$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

function patchFile(filePath) {
  const original = readFileSync(filePath, "utf8");
  if (original.includes("function collectTmpRoots(preferredTmpDir)")) {
    return false;
  }

  const withTmpRoots = original.replace(
    /(\s*const resolvedStateDir = path\.resolve\(stateDir\);\s*const preferredTmpDir = options\.preferredTmpDir \?\? resolveCachedPreferredTmpDir\(\);\s*return \[)\s*preferredTmpDir,/,
    `$1\n\t\t...collectTmpRoots(preferredTmpDir),`,
  );

  if (withTmpRoots === original) {
    throw new Error(`Could not rewrite temp roots in ${filePath}`);
  }

  const patched = withTmpRoots.replace(
    /(function getDefaultMediaLocalRoots\(\) \{\s*return buildMediaLocalRoots\(resolveStateDir\(\)\);\s*\})/,
    `${helperBlock}$1`,
  );

  if (patched === withTmpRoots) {
    throw new Error(`Could not insert collectTmpRoots helper in ${filePath}`);
  }

  writeFileSync(filePath, patched, "utf8");
  return true;
}

const files = findLocalRootsFiles(distRoot);
if (files.length === 0) {
  throw new Error(`No local-roots bundles found under ${distRoot}`);
}

let patchedCount = 0;
for (const file of files) {
  if (patchFile(file)) {
    patchedCount += 1;
    console.log(`patched ${file}`);
  } else {
    console.log(`already patched ${file}`);
  }
}

console.log(`patched ${patchedCount} file(s) under ${openclawRoot}`);
