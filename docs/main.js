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
      <button id="cmpBtn" class="history-btn" style="font-weight:600;">Показать diff</button>
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
    diffDiv.innerHTML = '';
    comparePanel.innerHTML = '';
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
        diffDiv.innerHTML = '';
        comparePanel.innerHTML = renderComparePanel(filename, fileHistory, text);
        // Навешиваем обработчик на кнопку сравнения
        setTimeout(() => {
            const btn = document.getElementById('cmpBtn');
            if (btn) btn.onclick = () => compareAnyVersions(filename, fileHistory, text);
        }, 0);
    } catch (e) {
        fileContentDiv.innerHTML = 'Ошибка: ' + e.message;
    }
}

function renderDiff(actual, historical) {
    if (!window.Diff) return '';
    const diff = Diff.diffLines(historical, actual);
    return diff.map(part => {
        let cls = part.added ? 'diff-add' : part.removed ? 'diff-remove' : 'diff-same';
        let sign = part.added ? '+' : part.removed ? '-' : ' ';
        return `<span class='diff-line ${cls}'>${sign}${part.value.replace(/</g, '&lt;')}</span>`;
    }).join('');
}

async function showHistoryVersion(filename, commit, idx) {
    selectedCommit = commit;
    const owner = 'programist2000';
    const repo = 'files-vault';
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/files/${filename}`;
    historyContentDiv.innerHTML = '<div class="version-block">Загрузка версии...</div>';
    diffDiv.innerHTML = '';
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
        diffDiv.innerHTML = `<h3>Сравнение версий (Diff)</h3>` + renderDiff(actualText, historicalText);
    } catch (e) {
        historyContentDiv.innerHTML = '<div class="version-block">Ошибка: ' + e.message + '</div>';
        diffDiv.innerHTML = '';
    }
}

async function compareAnyVersions(filename, fileHistory, actualText) {
    const idx1 = parseInt(document.getElementById('cmp1').value);
    const idx2 = parseInt(document.getElementById('cmp2').value);
    let text1 = '';
    let text2 = '';
    let label1 = '';
    let label2 = '';
    // -1 = актуальная версия
    if (idx1 === -1) {
        text1 = actualText;
        label1 = 'Актуальная версия';
    } else {
        const url1 = getDownloadLink(filename, fileHistory[idx1].hash);
        text1 = await (await fetch(url1)).text();
        label1 = `${formatDateTime(fileHistory[idx1].date)} (${fileHistory[idx1].author})`;
    }
    if (idx2 === -1) {
        text2 = actualText;
        label2 = 'Актуальная версия';
    } else {
        const url2 = getDownloadLink(filename, fileHistory[idx2].hash);
        text2 = await (await fetch(url2)).text();
        label2 = `${formatDateTime(fileHistory[idx2].date)} (${fileHistory[idx2].author})`;
    }
    diffDiv.innerHTML = `<h3>Сравнение версий (Diff)</h3><div style='margin-bottom:0.7em;'><b>Слева:</b> ${label1}<br><b>Справа:</b> ${label2}</div>` + renderDiff(text2, text1);
}

// Инициализация
window.showFile = showFile;
window.showHistoryVersion = showHistoryVersion;
showFileList(); 