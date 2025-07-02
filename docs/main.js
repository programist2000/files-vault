// Получаем список файлов из папки files (захардкожено, но можно заменить на динамическое получение)
const files = [
    'test.json',
    'test_empty.json'
];

// Для примера: структура файлов с подпапками
const fileTree = [
    { name: 'test.json', path: 'test.json', type: 'file' },
    { name: 'test_empty.json', path: 'test_empty.json', type: 'file' }
    // Для подпапок: { name: 'subfolder', type: 'dir', children: [ ... ] }
];

const leftContentDiv = document.getElementById('left-content');
const rightContentDiv = document.getElementById('right-content');
const historyDiv = document.getElementById('history');
const mainLayout = document.getElementById('main-layout');

const comparePanel = document.getElementById('compare-panel');
let compareSelection = [null, null]; // [idx1, idx2]

let historyData = null;
let selectedFile = null;
let selectedCommit = null;

const fileDropdownDiv = document.getElementById('file-dropdown');

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

function formatDateTime(dateStr) {
    // Ожидается YYYY-MM-DD или ISO
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getLastModified(history) {
    if (!history || !history.length) return null;
    return history[0];
}

function renderFileMenuTree(tree, selected, prefix = '') {
    return tree.map(item => {
        if (item.type === 'file') {
            return `<div class="file-item${selected === item.path ? ' selected' : ''}" onclick="selectFile('${item.path}')">${item.name}</div>`;
        } else if (item.type === 'dir') {
            return `<div class="file-item" style="font-weight:600;">${item.name}<div class='submenu'>${renderFileMenuTree(item.children, selected, prefix + item.name + '/')}</div></div>`;
        }
        return '';
    }).join('');
}

function getDownloadLink(filename, commit) {
    if (!commit) return `files/${filename}`;
    const owner = 'programist2000';
    const repo = 'files-vault';
    return `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/files/${filename}`;
}

function renderDownloadButton(filename, commit, label = 'Скачать') {
    const url = getDownloadLink(filename, commit);
    return `<a href="${url}" download target="_blank" class="history-btn" style="margin-left:0.7em;">${label}</a>`;
}

function renderComparePanel(filename, history, actualText) {
    if (!history || history.length === 0) return '';
    let options = `<option value="-1">Актуальная версия</option>`;
    history.forEach((entry, idx) => {
        options += `<option value="${idx}">${formatDateTime(entry.date)} — ${entry.author}</option>`;
    });
    return `
    <div style="margin-bottom:0.7em;font-weight:500;">Сравнить любые две версии:</div>
    <div style="display:flex;gap:1em;align-items:center;">
      <select id="cmp1">${options}</select>
      <span style="font-size:1.2em;">⇄</span>
      <select id="cmp2">${options}</select>
      <button id="cmpBtn" class="history-btn" style="font-weight:600;">Показать сравнение</button>
    </div>
  `;
}

window.selectFile = async function (filename) {
    fileDropdownDiv.innerHTML = renderFileMenuTree(fileTree, filename);
    mainLayout.style.display = '';
    leftContentDiv.innerHTML = 'Загрузка...';
    rightContentDiv.innerHTML = '';
    historyDiv.innerHTML = '';
    try {
        const res = await fetch(`files/${filename}`);
        if (!res.ok) throw new Error('Ошибка загрузки файла');
        const text = await res.text();
        leftContentDiv.innerHTML = `<div class='version-block'><div class='file-meta'>Актуальная версия</div><pre>${text.replace(/</g, '&lt;')}</pre></div>`;
        // Показываем историю справа
        const history = await loadHistory();
        const fileHistory = history[filename] || [];
        if (fileHistory.length) {
            historyDiv.innerHTML = fileHistory.map((entry, idx) =>
                `<div class="history-entry">` +
                `<span><b>${formatDateTime(entry.date)}</b> <span style='color:#888'>[${entry.author}]</span><br>${entry.message}</span>` +
                `<button class='history-btn' onclick='selectHistoryVersion(\'${filename}\', ${idx})'>Показать версию</button>` +
                `</div>`
            ).join('');
        }
        // Синхронизируем высоту блоков
        setTimeout(syncColHeights, 0);
    } catch (e) {
        leftContentDiv.innerHTML = 'Ошибка: ' + e.message;
    }
}

window.selectHistoryVersion = async function (filename, idx) {
    rightContentDiv.innerHTML = 'Загрузка...';
    const history = await loadHistory();
    const fileHistory = history[filename] || [];
    const entry = fileHistory[idx];
    const url = getDownloadLink(filename, entry.hash);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Ошибка загрузки версии файла');
        const text = await res.text();
        // Получаем актуальную версию для diff
        const actualRes = await fetch(`files/${filename}`);
        const actualText = await actualRes.text();
        rightContentDiv.innerHTML = `<div class='version-block'><div class='file-meta'>Версия на <b>${formatDateTime(entry.date)}</b> (${entry.author})</div><pre>${renderSideBySide(actualText, text, false)}</pre></div>`;
        setTimeout(syncColHeights, 0);
    } catch (e) {
        rightContentDiv.innerHTML = 'Ошибка: ' + e.message;
    }
}

function renderSideBySide(leftText, rightText, showAll = true) {
    // Diff-подсветка только в rightText (выбранная версия)
    const leftLines = leftText.split('\n');
    const rightLines = rightText.split('\n');
    const maxLen = Math.max(leftLines.length, rightLines.length);
    let result = '';
    for (let i = 0; i < maxLen; i++) {
        const l = leftLines[i] ?? '';
        const r = rightLines[i] ?? '';
        let cls = 'diff-same';
        if (l !== r) {
            if (!l && r) cls = 'diff-add';
            else if (l && !r) cls = 'diff-remove';
            else cls = 'diff-change';
        }
        if (showAll || cls !== 'diff-same')
            result += `<div class='diff-line ${cls}'>${r.replace(/</g, '&lt;')}</div>`;
    }
    return result;
}

function syncColHeights() {
    const l = leftContentDiv.querySelector('.version-block');
    const r = rightContentDiv.querySelector('.version-block');
    const h = Math.max(l ? l.offsetHeight : 0, r ? r.offsetHeight : 0, 500);
    if (l) l.style.minHeight = h + 'px';
    if (r) r.style.minHeight = h + 'px';
    document.getElementById('history-col').style.minHeight = h + 'px';
}

function renderFileMenu() {
    fileDropdownDiv.innerHTML = renderFileMenuTree(fileTree, null);
}

// Инициализация
renderFileMenu();

// Инициализация
window.showFile = showFile;
window.showHistoryVersion = showHistoryVersion;
showFileList(); 