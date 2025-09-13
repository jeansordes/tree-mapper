#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script to analyze TypeScript files for functions over 100 lines long
 *
 * Usage: node scripts/analyze-functions.cjs
 *        ./scripts/analyze-functions.cjs (if executable)
 *
 * This script scans all .ts and .tsx files in the src/ directory and reports
 * functions that exceed 100 lines in length, sorted by line count.
 */

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const functions = [];

    // Simple line-by-line analysis
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for function declarations (more specific)
        let funcName = null;
        let isFunction = false;

        // Check for different function patterns
        if (line.includes('function ') && !line.startsWith('if ') && !line.startsWith('for ')) {
            // Regular function: function name(
            const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
            if (funcMatch) {
                funcName = funcMatch[1];
                isFunction = true;
            }
        } else if (line.includes('static ') && line.includes('(')) {
            // Static method: static name(
            const staticMatch = line.match(/(?:export\s+)?(?:public\s+|private\s+|protected\s+)?static\s+(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
            if (staticMatch) {
                funcName = staticMatch[1];
                isFunction = true;
            }
        } else if ((line.includes('const ') || line.includes('let ') || line.includes('var ')) && line.includes('=') && line.includes('(')) {
            // Arrow function: const name = (
            const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\s*\(/);
            if (arrowMatch) {
                funcName = arrowMatch[1];
                isFunction = true;
            }
        } else if (line.includes('(') && line.includes('{') && !line.includes('=') && !line.includes('=>')) {
            // Method definition: name( {
            const methodMatch = line.match(/(?:export\s+)?(?:async\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*{/);
            if (methodMatch && !['if', 'for', 'while', 'switch', 'catch', 'try', 'else'].includes(methodMatch[1])) {
                funcName = methodMatch[1];
                isFunction = true;
            }
        }

        if (!isFunction || !funcName) {
            continue;
        }

        // Find the function body start (opening brace)
        let braceStart = i;
        while (braceStart < lines.length && !lines[braceStart].includes('{')) {
            braceStart++;
        }

        if (braceStart >= lines.length) continue;

        // Count lines until matching closing brace
        let braceCount = 0;
        let endLine = braceStart;

        for (let j = braceStart; j < lines.length; j++) {
            const currentLine = lines[j];
            braceCount += (currentLine.match(/{/g) || []).length;
            braceCount -= (currentLine.match(/}/g) || []).length;

            if (braceCount === 0) {
                endLine = j;
                break;
            }
        }

        const lineCount = endLine - i + 1;

        if (lineCount > 100) {
            functions.push({
                name: funcName,
                file: filePath,
                startLine: i + 1,
                endLine: endLine + 1,
                lineCount: lineCount
            });
        }

        // Skip to end of function to avoid double-counting
        i = endLine;
    }

    return functions;
}

function findAllFiles(dirPath) {
    const files = [];

    function walk(dir) {
        const items = fs.readdirSync(dir);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                walk(fullPath);
            } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
                files.push(fullPath);
            }
        }
    }

    walk(dirPath);
    return files;
}

function main() {
    const srcDir = path.join(process.cwd(), 'src');

    if (!fs.existsSync(srcDir)) {
        console.error('Error: src directory not found. Run this script from the project root.');
        process.exit(1);
    }

    console.log('🔍 Analyzing TypeScript files for functions over 100 lines...\n');

    const tsFiles = findAllFiles(srcDir);
    const allFunctions = [];

    for (const file of tsFiles) {
        try {
            const functions = analyzeFile(file);
            allFunctions.push(...functions);
        } catch (error) {
            console.error(`Error analyzing ${file}: ${error.message}`);
        }
    }

    // Sort by line count descending
    allFunctions.sort((a, b) => b.lineCount - a.lineCount);

    console.log(`📊 Analysis Complete!`);
    console.log(`📈 Total functions found: ${allFunctions.length}`);

    if (allFunctions.length === 0) {
        console.log('✅ No functions over 100 lines found!');
        return;
    }

    console.log(`🎯 Functions over 100 lines: ${allFunctions.length}\n`);

    console.log('='.repeat(80));
    console.log('📋 FUNCTIONS OVER 100 LINES (sorted by length):');
    console.log('='.repeat(80));

    allFunctions.forEach((func, index) => {
        const relativePath = path.relative(process.cwd(), func.file);
        console.log(`${index + 1}. **${func.name}** (${func.lineCount} lines)`);
        console.log(`   📁 ${relativePath}:${func.startLine}`);
        console.log(`   📍 Lines: ${func.startLine} - ${func.endLine}`);
        console.log('');
    });

    console.log('='.repeat(80));
    console.log(`📊 Summary:`);
    console.log(`   • Total long functions: ${allFunctions.length}`);
    if (allFunctions.length > 0) {
        console.log(`   • Longest function: ${allFunctions[0].name} (${allFunctions[0].lineCount} lines)`);
    }
}

// Run the analysis
main();
