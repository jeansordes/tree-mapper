#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

// Get command line arguments
const args = process.argv.slice(2);
const fromVersion = args[0];
const toVersion = args[1];
const outputFile = args[2] || 'CHANGELOG.md';

if (!fromVersion) {
    console.error('Usage: node generate-changelog.mjs <from-version> [to-version] [output-file]');
    console.error('Examples:');
    console.error('  node generate-changelog.mjs 1.9.1                    # From 1.9.1 to latest');
    console.error('  node generate-changelog.mjs 1.9.1 1.10.0            # From 1.9.1 to 1.10.0');
    console.error('  node generate-changelog.mjs 1.9.1 1.10.0 custom.md  # Custom output file');
    process.exit(1);
}

try {
    let command = `npx conventional-changelog -p angular --from ${fromVersion}`;
    
    if (toVersion) {
        command += ` --to ${toVersion}`;
    }
    
    console.log(`Generating changelog from ${fromVersion}${toVersion ? ` to ${toVersion}` : ' to latest'}...`);
    
    // Generate changelog
    const changelog = execSync(command, { encoding: 'utf8' });
    
    if (changelog.trim()) {
        // Write to file
        writeFileSync(outputFile, changelog);
        console.log(`✅ Changelog generated and saved to ${outputFile}`);
        console.log('\nGenerated changelog:');
        console.log('─'.repeat(50));
        console.log(changelog);
    } else {
        console.log('ℹ️  No commits found in the specified range');
    }
    
} catch (error) {
    console.error('❌ Error generating changelog:', error.message);
    process.exit(1);
}
