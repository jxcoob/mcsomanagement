/**
 * Run this once with: node patch-pdf-converter.js
 * It patches pdf-to-png-converter's normalizePath.js to use forward slashes
 * on Windows, which pdfjs-dist requires for cMapUrl / standardFontDataUrl.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'node_modules', 'pdf-to-png-converter', 'out', 'normalizePath.js');

if (!fs.existsSync(filePath)) {
    console.error('Could not find normalizePath.js — is pdf-to-png-converter installed?');
    process.exit(1);
}

const original = fs.readFileSync(filePath, 'utf8');

const patchMarker = '// PATCHED FOR WINDOWS';
if (original.includes(patchMarker)) {
    console.log('Already patched, nothing to do.');
    process.exit(0);
}

// Replace the return line to always use forward slashes
const patched = original.replace(
    'return `${resolvedPath}${node_path_1.sep}`;',
    `${patchMarker}\n    return \`\${resolvedPath.replace(/\\\\\\\\/g, '/')}\${node_path_1.sep === '/' ? '/' : '/'}\`;`
).replace(
    'if (resolvedPath.endsWith(\'/\') || resolvedPath.endsWith(node_path_1.sep)) {\n        return resolvedPath;\n    }',
    `if (resolvedPath.endsWith('/') || resolvedPath.endsWith(node_path_1.sep)) {\n        return resolvedPath.replace(/\\\\/g, '/');\n    }`
);

if (patched === original) {
    console.error('Patch target not found — the library may have been updated. Check normalizePath.js manually.');
    process.exit(1);
}

fs.writeFileSync(filePath, patched, 'utf8');
console.log('Patched successfully:', filePath);
