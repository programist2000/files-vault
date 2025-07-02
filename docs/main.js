// Список файлов (заполним вручную, автоматизация позже)
const files = [
    'test.json',
    'test_empty.json'
];

const fileListDiv = document.getElementById('file-list');
const fileContentDiv = document.getElementById('file-content');
const historyDiv = document.getElementById('history');
const historyContentDiv = document.getElementById('history-content');
const compareColumns = document.getElementById('compare-columns');

const comparePanel = document.getElementById('compare-panel');
let compareSelection = [null, null]; // [idx1, idx2]

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

function showFileList(selected) {
    fileListDiv.innerHTML = files.map(f => `<div class="file-item${selected === f ? ' selected' : ''}" onclick="showFile('${f}')"><span>📄</span>${f}</div>`).join('');
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

async function showFile(filename) {
    selectedFile = filename;
    selectedCommit = null;
    showFileList(filename);
    fileContentDiv.innerHTML = '';
    historyDiv.innerHTML = '';
    historyContentDiv.innerHTML = '';
    comparePanel.innerHTML = '';
    compareColumns.innerHTML = '';
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
            meta = `<div class="file-meta">Последнее изменение: <b>${formatDateTime(last.date)}</b> (${last.author})</div>`;
        }
        fileContentDiv.innerHTML = `<div class='version-block'><div class="file-meta">${meta}</div><h3>Актуальная версия ${renderDownloadButton(filename, null)}</h3><pre>${text.replace(/</g, '&lt;')}</pre></div>`;
        // История справа
        if (fileHistory.length) {
            historyDiv.innerHTML = fileHistory.map((entry, idx) =>
                `<div class="history-entry">` +
                `<span><b>${formatDateTime(entry.date)}</b> <span style='color:#888'>[${entry.author}]</span><br>${entry.message}</span>` +
                `<button class='history-btn' onclick='showHistoryVersion("${filename}", "${entry.hash}", ${idx})'>Показать версию</button>` +
                renderDownloadButton(filename, entry.hash) +
                `</div>`
            ).join('');
        } else {
            historyDiv.innerHTML = '<div class="history-entry">Нет изменений</div>';
        }
        historyContentDiv.innerHTML = '';
        comparePanel.innerHTML = renderComparePanel(filename, fileHistory, text);
        compareColumns.innerHTML = '';
        setTimeout(() => {
            const btn = document.getElementById('cmpBtn');
            if (btn) btn.onclick = () => compareAnyVersionsSideBySide(filename, fileHistory, text);
        }, 0);
    } catch (e) {
        fileContentDiv.innerHTML = 'Ошибка: ' + e.message;
    }
}

function renderSideBySide(leftText, rightText) {
    // Diff-подсветка только в правой колонке
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
        result += `<div class='diff-line ${cls}'>${r.replace(/</g, '&lt;')}</div>`;
    }
    return result;
}

async function compareAnyVersionsSideBySide(filename, fileHistory, actualText) {
    const idx1 = parseInt(document.getElementById('cmp1').value);
    const idx2 = parseInt(document.getElementById('cmp2').value);
    let text1 = '';
    let text2 = '';
    let label1 = '';
    let label2 = '';
    let commit1 = null;
    let commit2 = null;
    if (idx1 === -1) {
        text1 = actualText;
        label1 = 'Актуальная версия';
    } else {
        commit1 = fileHistory[idx1].hash;
        const url1 = getDownloadLink(filename, commit1);
        text1 = await (await fetch(url1)).text();
        label1 = `${formatDateTime(fileHistory[idx1].date)} (${fileHistory[idx1].author})`;
    }
    if (idx2 === -1) {
        text2 = actualText;
        label2 = 'Актуальная версия';
    } else {
        commit2 = fileHistory[idx2].hash;
        const url2 = getDownloadLink(filename, commit2);
        text2 = await (await fetch(url2)).text();
        label2 = `${formatDateTime(fileHistory[idx2].date)} (${fileHistory[idx2].author})`;
    }
    compareColumns.innerHTML = `
    <div style='flex:1;min-width:0;'>
      <div class='version-block'><div class='file-meta'><b>Слева:</b> ${label1} ${renderDownloadButton(filename, commit1)}</div><h3>Версия 1</h3><pre>${text1.replace(/</g, '&lt;')}</pre></div>
    </div>
    <div style='flex:1;min-width:0;'>
      <div class='version-block'><div class='file-meta'><b>Справа:</b> ${label2} ${renderDownloadButton(filename, commit2)}</div><h3>Версия 2 (с подсветкой diff)</h3><pre>${renderSideBySide(text1, text2)}</pre></div>
    </div>
  `;
}

async function showHistoryVersion(filename, commit, idx) {
    selectedCommit = commit;
    const owner = 'programist2000';
    const repo = 'files-vault';
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/files/${filename}`;
    historyContentDiv.innerHTML = '<div class="version-block">Загрузка версии...</div>';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Ошибка загрузки версии файла');
        const historicalText = await res.text();
        // Подсветка выбранной кнопки
        const history = await loadHistory();
        const fileHistory = history[filename] || [];
        const entry = fileHistory[idx];
        historyContentDiv.innerHTML = `<div class='version-block'><div class='file-meta'>Версия на <b>${formatDateTime(entry.date)}</b> (${entry.author}) ${renderDownloadButton(filename, commit)}</div><h3>Выбранная версия</h3><pre>${historicalText.replace(/</g, '&lt;')}</pre></div>`;
        document.querySelectorAll('.history-btn').forEach((btn, i) => {
            btn.classList.toggle('selected', i === idx);
        });
        // Получаем актуальную версию
        const actualRes = await fetch(`files/${filename}`);
        const actualText = await actualRes.text();
        // Показываем diff
        compareColumns.innerHTML = `<h3>Сравнение версий (Diff)</h3>` + renderSideBySide(actualText, historicalText);
    } catch (e) {
        historyContentDiv.innerHTML = '<div class="version-block">Ошибка: ' + e.message + '</div>';
        compareColumns.innerHTML = '';
    }
}

// Инициализация
window.showFile = showFile;
window.showHistoryVersion = showHistoryVersion;
showFileList(); 