// Список файлов (заполним вручную, автоматизация позже)
const files = [
    'test.json',
    'test_empty.json'
];

const fileListDiv = document.getElementById('file-list');
const fileContentDiv = document.getElementById('file-content');
const historyDiv = document.getElementById('history');
const historyContentDiv = document.getElementById('history-content');
const diffDiv = document.createElement('div');
diffDiv.id = 'diff-block';
diffDiv.style.marginTop = '2em';
diffDiv.style.background = '#f6f8fa';
diffDiv.style.padding = '1em';
diffDiv.style.borderRadius = '5px';
diffDiv.style.border = '1px solid #ddd';
diffDiv.style.fontFamily = 'monospace';
diffDiv.style.fontSize = '0.97em';

let historyData = null;
let selectedFile = null;
let selectedCommit = null;

async function loadHistory() {
    if (historyData) return historyData;
    try {
        const res = await fetch('history.json');
        if (!res.ok) throw new Error('history.json not found');
        historyData = await res.json();
        return historyData;
    } catch (e) {
        return {};
    }
}

function getLastModified(history) {
    if (!history || !history.length) return null;
    return history[0]; // git log --date=short сортирует по убыванию
}

function showFileList(selected) {
    fileListDiv.innerHTML = '<h2>Файлы</h2>' + files.map(f => `<div class="file-item${selected === f ? ' selected' : ''}" onclick="showFile('${f}')">${f}</div>`).join('');
}

async function showFile(filename) {
    selectedFile = filename;
    selectedCommit = null;
    showFileList(filename);
    fileContentDiv.innerHTML = 'Загрузка...';
    historyDiv.innerHTML = '';
    historyContentDiv.innerHTML = '';
    try {
        const res = await fetch(`files/${filename}`);
        if (!res.ok) throw new Error('Ошибка загрузки файла');
        const text = await res.text();
        // История
        const history = await loadHistory();
        const fileHistory = history[filename] || [];
        // Время последнего изменения
        let meta = '';
        if (fileHistory.length) {
            const last = getLastModified(fileHistory);
            meta = `<div class="file-meta">Последнее изменение: <b>${last.date}</b> (${last.author})</div>`;
        }
        fileContentDiv.innerHTML = `${meta}<h3>${filename}</h3><pre>${text}</pre>`;
        // История справа
        if (fileHistory.length) {
            historyDiv.innerHTML = '<h3>История изменений</h3>' + fileHistory.map((entry, idx) =>
                `<div class="history-entry">` +
                `<b>${entry.date}</b> [${entry.author}]: ${entry.message} <span style=\"color:#aaa\">(${entry.hash})</span>` +
                `<button class='history-btn' onclick='showHistoryVersion("${filename}", "${entry.hash}", ${idx})'>Показать версию</button>` +
                `</div>`
            ).join('');
        } else {
            historyDiv.innerHTML = '<h3>История изменений</h3><div class="history-entry">Нет изменений</div>';
        }
        historyContentDiv.innerHTML = '';
    } catch (e) {
        fileContentDiv.innerHTML = 'Ошибка: ' + e.message;
    }
}

function renderDiff(actual, historical) {
    if (!window.Diff) return '';
    const diff = Diff.diffLines(historical, actual);
    return diff.map(part => {
        let color = part.added ? '#d4fcdc' : part.removed ? '#ffecec' : 'inherit';
        let sign = part.added ? '+' : part.removed ? '-' : ' ';
        return `<div style="background:${color};display:block;white-space:pre;">${sign}${part.value.replace(/</g, '&lt;')}</div>`;
    }).join('');
}

async function showHistoryVersion(filename, commit, idx) {
    selectedCommit = commit;
    const owner = 'programist2000';
    const repo = 'files-vault';
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/files/${filename}`;
    historyContentDiv.innerHTML = 'Загрузка версии...';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Ошибка загрузки версии файла');
        const historicalText = await res.text();
        // Подсветка выбранной кнопки
        const history = await loadHistory();
        const fileHistory = history[filename] || [];
        const entry = fileHistory[idx];
        historyContentDiv.innerHTML = `<div class='file-meta'>Версия на <b>${entry.date}</b> (${entry.author})</div><h3>${filename} [${commit}]</h3><pre>${historicalText}</pre>`;
        document.querySelectorAll('.history-btn').forEach((btn, i) => {
            btn.classList.toggle('selected', i === idx);
        });
        // Получаем актуальную версию
        const actualRes = await fetch(`files/${filename}`);
        const actualText = await actualRes.text();
        // Показываем diff
        diffDiv.innerHTML = `<h3>Diff (выбранная версия vs актуальная)</h3>` + renderDiff(actualText, historicalText);
        if (!diffDiv.parentNode) {
            document.getElementById('main-layout').appendChild(diffDiv);
        }
    } catch (e) {
        historyContentDiv.innerHTML = 'Ошибка: ' + e.message;
        diffDiv.innerHTML = '';
    }
}

// Инициализация
window.showFile = showFile;
window.showHistoryVersion = showHistoryVersion;
showFileList(); 