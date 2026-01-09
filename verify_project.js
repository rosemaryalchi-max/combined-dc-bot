const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
let errorCount = 0;

function checkFile(filePath) {
    if (!filePath.endsWith('.js')) return;
    if (filePath.includes('node_modules')) return;
    if (filePath.includes('.git')) return;
    if (filePath === __filename) return;

    try {
        require(filePath);
        console.log(`✅ Loaded: ${path.relative(projectRoot, filePath)}`);
    } catch (error) {
        // Ignore errors related to missing env vars or discord client not being ready
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error(`❌ Missing Module in ${path.relative(projectRoot, filePath)}: ${error.message}`);
            errorCount++;
        } else if (error.message.includes('is not defined') || error instanceof SyntaxError) {
            console.error(`❌ Syntax/Reference Error in ${path.relative(projectRoot, filePath)}: ${error.message}`);
            errorCount++;
        } else {
            console.log(`⚠️  Runtime error (ignorable during static check) in ${path.relative(projectRoot, filePath)}: ${error.message}`);
        }
    }
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git') {
                traverseDir(fullPath);
            }
        } else {
            checkFile(fullPath);
        }
    }
}

console.log('Starting Static Verification...');
traverseDir(projectRoot);

if (errorCount === 0) {
    console.log('\n✅ Static verification passed! No syntax or missing module errors found.');
} else {
    console.error(`\n❌ Found ${errorCount} critical errors.`);
    process.exit(1);
}
