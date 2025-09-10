import { readFileSync, writeFileSync, existsSync } from "fs";
import debug from "debug";
import process from "process";

const log = debug("dot-navigator:version-bump");

// Get version type from command line arguments (patch, minor, major)
// Default to patch if not specified
const args = process.argv.slice(2);
const versionType = args[0] || "patch";
const validTypes = [
	"patch",
	"minor",
	"major",
	"prepatch",
	"preminor",
	"premajor",
	"prerelease",
	"beta",
];

if (!validTypes.includes(versionType)) {
	log(
		`Error: Invalid version type "${versionType}". Valid types are: ${validTypes.join(
			", "
		)}`
	);
	process.exit(1);
}

// Get current version from package.json
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const currentVersion = packageJson.version;

// Calculate new version
let [major, minor, patch] = currentVersion.split(".").map(Number);
let betaNumber = 0;

// Handle beta versions
if (versionType === "beta") {
	// If current version is already a beta, increment beta number
	if (currentVersion.includes("-beta.")) {
		const betaMatch = currentVersion.match(/-beta\.(\d+)$/);
		if (betaMatch) {
			betaNumber = parseInt(betaMatch[1]) + 1;
		}
	} else {
		// If not a beta, increment patch and start beta at 0
		patch++;
		betaNumber = 0;
	}
} else {
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
}

const targetVersion =
	versionType === "beta"
		? `${major}.${minor}.${patch}-beta.${betaNumber}`
		: `${major}.${minor}.${patch}`;

log(`Bumping version from ${currentVersion} to ${targetVersion}...`);

// Update package.json
packageJson.version = targetVersion;
writeFileSync("package.json", JSON.stringify(packageJson, null, "\t") + "\n");

// Update package-lock.json
const packageLockJson = JSON.parse(readFileSync("package-lock.json", "utf8"));
packageLockJson.version = targetVersion;
packageLockJson.packages[""].version = targetVersion;
writeFileSync("package-lock.json", JSON.stringify(packageLockJson, null, "\t") + "\n");

// Read minAppVersion from manifest.json
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;

if (versionType === "beta") {
	// For beta releases, update beta-manifest.json
	let betaManifest = {
		version: targetVersion,
		minAppVersion: minAppVersion,
		isBeta: true,
	};

	// If beta-manifest.json exists, read it and update
	if (existsSync("beta-manifest.json")) {
		betaManifest = JSON.parse(readFileSync("beta-manifest.json", "utf8"));
		betaManifest.version = targetVersion;
		betaManifest.minAppVersion = minAppVersion;
	}

	writeFileSync(
		"beta-manifest.json",
		JSON.stringify(betaManifest, null, "\t") + "\n"
	);
	log(`Updated beta-manifest.json with version ${targetVersion}`);
} else {
	// For regular releases, update manifest.json
	manifest.version = targetVersion;
	writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
	log(`Updated manifest.json with version ${targetVersion}`);
}

// Update versions.json with target version and minAppVersion
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");

log(
	`Updated version to ${targetVersion} in package.json, package-lock.json and versions.json`
);
log(`Min app version is set to ${minAppVersion}`);
