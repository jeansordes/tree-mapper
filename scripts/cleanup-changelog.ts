/**
 * This script reads the CHANGELOG.md file and replaces any occurrences of 3 or more 
 * consecutive newlines with exactly 2 newlines, ensuring consistent spacing.
 */

import * as fs from 'fs';
import * as path from 'path';

// Path to the CHANGELOG.md file
const changelogPath = 'CHANGELOG.md';

// Read the contents of the file
try {
    let content = fs.readFileSync(changelogPath, 'utf8');

    // Replace 3 or more consecutive newlines with exactly 2 newlines
    const cleanedContent = content.replace(/\n{3,}/g, '\n\n');

    // Write the contents back to the file
    fs.writeFileSync(changelogPath, cleanedContent, 'utf8');

    console.log('Successfully cleaned up the CHANGELOG.md file');
} catch (error) {
    console.error('Error cleaning up the CHANGELOG.md file:', error);
    process.exit(1);
} 