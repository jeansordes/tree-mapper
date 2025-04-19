#!/usr/bin/env ts-node

import * as path from 'path';
import * as fs from 'fs';

interface FileLineInfo {
    path: string;
    lineCount: number;
    relativePath: string;
}

/**
 * Gets all files in a directory recursively
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
        } else {
            arrayOfFiles.push(filePath);
        }
    });

    return arrayOfFiles;
}

/**
 * Counts lines in a file
 */
function countLinesInFile(filePath: string): number {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return content.split('\n').length;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return 0;
    }
}

/**
 * Gets all files in the src directory sorted by line count
 */
function getFilesSortedByLineCount(basePath: string, srcPath: string): FileLineInfo[] {
    const allFiles = getAllFiles(srcPath);
    
    const fileInfos: FileLineInfo[] = allFiles.map(filePath => {
        const lineCount = countLinesInFile(filePath);
        return {
            path: filePath,
            relativePath: path.relative(basePath, filePath),
            lineCount
        };
    });
    
    // Sort by line count (descending)
    return fileInfos.sort((a, b) => b.lineCount - a.lineCount);
}

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

// Get files sorted by line count
const filesByLineCount = getFilesSortedByLineCount(projectRoot, srcDir);

// Display the results in a table format
console.log('\nFiles in src/ directory sorted by line count (highest to lowest):\n');
console.log('Line Count | File Path');
console.log('-'.repeat(100));

filesByLineCount.forEach((file: FileLineInfo) => {
    console.log(`${file.lineCount.toString().padEnd(10)} | ${file.relativePath}`);
});

// Display some statistics
const totalFiles = filesByLineCount.length;
const totalLines = filesByLineCount.reduce((sum: number, file: FileLineInfo) => sum + file.lineCount, 0);
const averageLines = Math.round(totalLines / totalFiles);

console.log('\nSummary:');
console.log(`Total files: ${totalFiles}`);
console.log(`Total lines: ${totalLines}`);
console.log(`Average lines per file: ${averageLines}`);

// Identify potentially large files that might need refactoring
const largeFiles = filesByLineCount.filter((file: FileLineInfo) => file.lineCount > 300);
if (largeFiles.length > 0) {
    console.log('\nLarge files (>300 lines) that might need refactoring:');
    largeFiles.forEach((file: FileLineInfo) => {
        console.log(`${file.lineCount} lines: ${file.relativePath}`);
    });
} 