// Список файлов (заполним вручную, автоматизация позже)
const files = [
    'test.json',
    'test_empty.json'
];

const fileListDiv = document.getElementById('file-list');
const fileContentDiv = document.getElementById('file-content');
const historyDiv = document.getElementById('history');

let historyData = null;

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

function showFileList() {
    fileListDiv.innerHTML = '<h2>Файлы</h2>' + files.map(f => `<div class="file-item" onclick="showFileContent('${f}')">${f}</div>`).join('');
    fileContentDiv.innerHTML = '';
    historyDiv.innerHTML = '';
}

async function showFileContent(filename) {
    fileContentDiv.innerHTML = 'Загрузка...';
    historyDiv.innerHTML = '';
    try {
        const res = await fetch(`files/${filename}`);
        if (!res.ok) throw new Error('Ошибка загрузки файла');
        const text = await res.text();
        fileContentDiv.innerHTML = `<h3>${filename}</h3><pre>${text}</pre>`;
        // Показываем историю
        const history = await loadHistory();
        const fileHistory = history[filename] || [];
        if (fileHistory.length) {
            historyDiv.innerHTML = '<h3>История изменений</h3>' + fileHistory.map(entry =>
                `<div class="history-entry"><b>${entry.date}</b> [${entry.author}]: ${entry.message} <span style="color:#aaa">(${entry.hash})</span></div>`
            ).join('');
        } else {
            historyDiv.innerHTML = '<h3>История изменений</h3><div class="history-entry">Нет изменений</div>';
        }
    } catch (e) {
        fileContentDiv.innerHTML = 'Ошибка: ' + e.message;
    }
}

showFileList(); 