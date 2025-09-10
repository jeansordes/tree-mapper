#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import process from 'process';
import debug from 'debug';

const log = debug('dot-navigator:generate-changelog');

// Get command line arguments
const args = process.argv.slice(2);
const fromVersion = args[0];
const toVersion = args[1];
const outputFile = args[2] || 'CHANGELOG.md';

if (!fromVersion) {
    log('Usage: node generate-changelog.mjs <from-version> [to-version] [output-file]');
    log('Examples:');
    log('  node generate-changelog.mjs 1.9.1                    # From 1.9.1 to latest');
    log('  node generate-changelog.mjs 1.9.1 1.10.0            # From 1.9.1 to 1.10.0');
    log('  node generate-changelog.mjs 1.9.1 1.10.0 custom.md  # Custom output file');
    process.exit(1);
}

try {
    let command = `npx conventional-changelog -p angular --from ${fromVersion}`;
    
    if (toVersion) {
        command += ` --to ${toVersion}`;
    }
    
    log(`Generating changelog from ${fromVersion}${toVersion ? ` to ${toVersion}` : ' to latest'}...`);
    
    // Generate changelog
    const changelog = execSync(command, { encoding: 'utf8' });
    
    if (changelog.trim()) {
        // Write to file
        writeFileSync(outputFile, changelog);
        log(`✅ Changelog generated and saved to ${outputFile}`);
        log('\nGenerated changelog:');
        log('─'.repeat(50));
        log(changelog);
    } else {
        log('ℹ️  No commits found in the specified range');
    }
    
} catch (error) {
    log('❌ Error generating changelog:', error.message);
    process.exit(1);
}
