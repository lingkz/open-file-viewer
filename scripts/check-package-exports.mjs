import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packageDirs = ["packages/core", "packages/react", "packages/vue", "packages/svelte"];

let failed = false;

for (const packageDir of packageDirs) {
  const absolutePackageDir = join(root, packageDir);
  const packageJsonPath = join(absolutePackageDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const paths = new Set();

  for (const key of ["main", "module", "types"]) {
    if (packageJson[key]) {
      paths.add(packageJson[key]);
    }
  }

  collectExportPaths(packageJson.exports, paths);

  for (const path of paths) {
    if (typeof path !== "string" || !path.startsWith("./")) {
      continue;
    }
    const absolutePath = join(absolutePackageDir, path);
    if (!existsSync(absolutePath)) {
      failed = true;
      console.error(`${packageJson.name}: missing exported file ${path}`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
}

function collectExportPaths(value, paths) {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    paths.add(value);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      collectExportPaths(item, paths);
    }
  }
}
