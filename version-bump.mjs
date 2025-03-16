import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// Get version type from command line arguments (patch, minor, major)
// Default to patch if not specified
const args = process.argv.slice(2);
const versionType = args[0] || "patch";
const validTypes = ["patch", "minor", "major", "prepatch", "preminor", "premajor", "prerelease"];

if (!validTypes.includes(versionType)) {
  console.error(`Error: Invalid version type "${versionType}". Valid types are: ${validTypes.join(", ")}`);
  process.exit(1);
}

// Get current version from package.json
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const currentVersion = packageJson.version;

// Calculate new version
let [major, minor, patch] = currentVersion.split(".").map(Number);
switch (versionType) {
  case "major":
    major++;
    minor = 0;
    patch = 0;
    break;
  case "minor":
    minor++;
    patch = 0;
    break;
  case "patch":
  default:
    patch++;
    break;
}
const targetVersion = `${major}.${minor}.${patch}`;

console.log(`Bumping version from ${currentVersion} to ${targetVersion}...`);

// Update package.json
packageJson.version = targetVersion;
writeFileSync("package.json", JSON.stringify(packageJson, null, "\t") + "\n");

// Read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// Update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

console.log(`Updated version to ${targetVersion} in package.json, manifest.json, and versions.json`);
console.log(`Min app version is set to ${minAppVersion}`);
