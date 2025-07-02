const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const FILES_DIR = 'files';
const OUTPUT = 'docs/history.json';

function getFiles(dir) {
    return fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isFile());
}

function getHistoryForFile(file) {
    const logFormat = '%h|%an|%ad|%s';
    const cmd = `git log --pretty=format:"${logFormat}" --date=short -- ${FILES_DIR}/${file}`;
    try {
        const output = execSync(cmd, { encoding: 'utf8' });
        return output.split('\n').filter(Boolean).map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
        });
    } catch (e) {
        return [];
    }
}

function main() {
    const files = getFiles(FILES_DIR);
    const history = {};
    files.forEach(file => {
        history[file] = getHistoryForFile(file);
    });
    fs.writeFileSync(OUTPUT, JSON.stringify(history, null, 2), 'utf8');
    console.log('History saved to', OUTPUT);
}

main(); 