// === Конфигурация операций ===
const OPERATIONS = [
    { id: 1, name: 'Столешница', unit: 'м²', norm: 117, extraCondition: { threshold: 2.5, extraTime: 60 } },
    { id: 2, name: 'Стеновая', unit: 'м²', norm: 80 },
    { id: 3, name: 'Кромки', unit: 'м.п.', norm: 45, affectedByThickness: true },
    { id: 4, name: 'Рад. кромки', unit: 'м.п.', norm: 100 },
    { id: 5, name: 'Подворот', unit: 'м.п.', norm: 35 },
    { id: 6, name: 'Проф З,6,9', unit: 'шт', norm: 8 },
    { id: 7, name: 'Проф Ф1,Ф2', unit: 'шт', norm: 25 },
    { id: 8, name: 'Непрол прямая', unit: 'шт', norm: 30 },
    { id: 9, name: 'Непрол рад', unit: 'шт', norm: 90 },
    { id: 10, name: 'Борт накл боч гал', unit: 'м.п.', norm: 15 },
    { id: 11, name: 'Борт накл пр', unit: 'м.п.', norm: 20 },
    { id: 12, name: 'Борт накл фигур', unit: 'м.п.', norm: 40 },
    { id: 13, name: 'Борт врез пр', unit: 'шт', norm: 50 },
    { id: 14, name: 'Борт врез крив', unit: 'шт', norm: 150 },
    { id: 15, name: 'Борт врез угол', unit: 'шт', norm: 30 },
    { id: 16, name: 'Раковина VN', unit: 'шт', norm: 300 },
    { id: 17, name: 'Мойка КО', unit: 'шт', norm: 350 },
    { id: 18, name: 'Мойка КГ,КГР', unit: 'шт', norm: 450 },
    { id: 19, name: 'Мойка KR', unit: 'шт', norm: 500 },
    { id: 20, name: 'Обнижение', unit: 'шт', norm: 60 },
    { id: 21, name: 'Подклейка', unit: 'шт', norm: 50 },
    { id: 22, name: 'Толщина столешницы', unit: 'мм', norm: 0, isThickness: true }
];

const BASE_RATE = 700;
const MULTI_ORDER_RATE = 770;
const THICKNESS_THRESHOLD = 40;
const THICKNESS_EXTRA_PER_MP = 200;

// === Состояние приложения ===
let state = {
    currentRate: BASE_RATE,
    operationValues: {},
    calculations: [],
    workLog: [],
    timer: {
        running: false,
        paused: false,
        seconds: 0,
        interval: null
    }
};

// === Инициализация ===
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    initTabs();
    initOperationsTable();
    initOrderParams();
    initTimerControls();
    initModalControls();
    initExportImport();
    updateUI();
    setDefaultDate();
});

// === Загрузка из LocalStorage ===
function loadFromStorage() {
    const saved = localStorage.getItem('countertopTracker');
    if (saved) {
        const data = JSON.parse(saved);
        state.calculations = data.calculations || [];
        state.workLog = data.workLog || [];
    }
}

// === Сохранение в LocalStorage ===
function saveToStorage() {
    localStorage.setItem('countertopTracker', JSON.stringify({
        calculations: state.calculations,
        workLog: state.workLog
    }));
}

// === Вкладки ===
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'tracking') {
                updateOrderSelects();
            } else if (tabId === 'analysis') {
                updateAnalysis();
            }
        });
    });
}

// === Таблица операций ===
function initOperationsTable() {
    const tbody = document.getElementById('operationsTable');
    tbody.innerHTML = '';

    OPERATIONS.forEach(op => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="col-num">${op.id}</td>
            <td class="col-name">${op.name}</td>
            <td class="col-unit">${op.unit}</td>
            <td class="col-norm">${op.norm}${op.extraCondition ? '*' : ''}</td>
            <td class="col-volume">
                <input type="number" id="volume_${op.id}" min="0" step="0.1" value="0"
                       data-operation="${op.id}" class="volume-input">
            </td>
            <td class="col-time" id="time_${op.id}">0</td>
            <td class="col-auto-cost" id="autoCost_${op.id}">0</td>
            <td class="col-manual-cost">
                <input type="number" id="manualCost_${op.id}" min="0" step="1" value=""
                       data-operation="${op.id}" class="manual-cost-input" placeholder="—">
            </td>
            <td class="col-final">
                <select id="finalSelect_${op.id}" class="final-select" data-operation="${op.id}">
                    <option value="auto">Авто</option>
                    <option value="manual">Вручную</option>
                </select>
                <div id="finalCost_${op.id}">0</div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Обработчики событий
    document.querySelectorAll('.volume-input').forEach(input => {
        input.addEventListener('input', () => calculateAll());
    });

    document.querySelectorAll('.manual-cost-input').forEach(input => {
        input.addEventListener('input', () => calculateAll());
    });

    document.querySelectorAll('.final-select').forEach(select => {
        select.addEventListener('change', () => calculateAll());
    });

    document.getElementById('clearForm').addEventListener('click', clearForm);
}

// === Параметры заказа ===
function initOrderParams() {
    document.getElementById('ordersCount').addEventListener('input', (e) => {
        const count = parseInt(e.target.value) || 1;
        state.currentRate = count > 1 ? MULTI_ORDER_RATE : BASE_RATE;
        document.getElementById('currentRate').textContent = state.currentRate;
        calculateAll();
    });

    document.getElementById('saveCalculation').addEventListener('click', saveCalculation);
    document.getElementById('loadCalculation').addEventListener('click', () => {
        updateSavedCalculationsList();
        document.getElementById('loadModal').classList.add('active');
    });
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
}

// === Расчеты ===
function calculateAll() {
    let totalTime = 0;
    let totalAutoCost = 0;
    let totalManualCost = 0;
    let totalFinalCost = 0;

    const thicknessValue = parseFloat(document.getElementById('volume_22').value) || 0;
    const thicknessExtra = thicknessValue > THICKNESS_THRESHOLD ? THICKNESS_EXTRA_PER_MP : 0;

    OPERATIONS.forEach(op => {
        const volume = parseFloat(document.getElementById(`volume_${op.id}`).value) || 0;
        let time = 0;

        if (op.isThickness) {
            // Толщина влияет на кромки, не имеет своего времени
            time = 0;
        } else {
            time = volume * op.norm;

            // Дополнительное время для столешницы >2.5 м²
            if (op.extraCondition && volume > op.extraCondition.threshold) {
                time += op.extraCondition.extraTime;
            }

            // Дополнительное время для кромок при толщине >40мм
            if (op.affectedByThickness && thicknessExtra > 0) {
                time += volume * thicknessExtra;
            }
        }

        const autoCost = Math.round((time / 60) * state.currentRate);
        const manualCostInput = document.getElementById(`manualCost_${op.id}`).value;
        const manualCost = manualCostInput ? parseFloat(manualCostInput) : 0;
        const useManual = document.getElementById(`finalSelect_${op.id}`).value === 'manual';
        const finalCost = useManual && manualCostInput ? manualCost : autoCost;

        document.getElementById(`time_${op.id}`).textContent = Math.round(time);
        document.getElementById(`autoCost_${op.id}`).textContent = formatCurrency(autoCost);
        document.getElementById(`finalCost_${op.id}`).textContent = formatCurrency(finalCost);

        state.operationValues[op.id] = { volume, time, autoCost, manualCost, finalCost, useManual };

        totalTime += time;
        totalAutoCost += autoCost;
        totalManualCost += manualCost;
        totalFinalCost += finalCost;
    });

    // Обновление итогов
    document.getElementById('totalTime').textContent = Math.round(totalTime);
    document.getElementById('totalAutoCost').textContent = formatCurrency(totalAutoCost);
    document.getElementById('totalManualCost').textContent = formatCurrency(totalManualCost);
    document.getElementById('totalFinalCost').textContent = formatCurrency(totalFinalCost);

    // Сводка
    const hours = Math.floor(totalTime / 60);
    const minutes = Math.round(totalTime % 60);
    document.getElementById('summaryTime').textContent = `${hours} ч ${minutes} мин`;
    document.getElementById('summaryAutoCost').textContent = formatCurrency(totalAutoCost) + ' ₽';
    document.getElementById('summaryFinalCost').textContent = formatCurrency(totalFinalCost) + ' ₽';
}

function formatCurrency(value) {
    return value.toLocaleString('ru-RU');
}

function clearForm() {
    document.querySelectorAll('.volume-input').forEach(input => input.value = 0);
    document.querySelectorAll('.manual-cost-input').forEach(input => input.value = '');
    document.querySelectorAll('.final-select').forEach(select => select.value = 'auto');
    document.getElementById('orderNumber').value = '';
    document.getElementById('ordersCount').value = 1;
    state.currentRate = BASE_RATE;
    document.getElementById('currentRate').textContent = BASE_RATE;
    setDefaultDate();
    calculateAll();
}

// === Сохранение/загрузка расчетов ===
function saveCalculation() {
    const orderNumber = document.getElementById('orderNumber').value || `Заказ ${Date.now()}`;
    const orderDate = document.getElementById('orderDate').value;
    const ordersCount = parseInt(document.getElementById('ordersCount').value) || 1;

    const calculation = {
        id: Date.now(),
        orderNumber,
        orderDate,
        ordersCount,
        rate: state.currentRate,
        operations: { ...state.operationValues },
        totalTime: parseInt(document.getElementById('totalTime').textContent),
        totalFinalCost: parseInt(document.getElementById('totalFinalCost').textContent.replace(/\s/g, '')),
        createdAt: new Date().toISOString()
    };

    state.calculations.push(calculation);
    saveToStorage();
    updateOrderSelects();
    alert('Расчет сохранен!');
}

function updateSavedCalculationsList() {
    const list = document.getElementById('savedCalculationsList');

    if (state.calculations.length === 0) {
        list.innerHTML = '<p class="empty-message">Нет сохраненных расчетов</p>';
        return;
    }

    list.innerHTML = state.calculations.map(calc => `
        <div class="saved-calculation-item" data-id="${calc.id}">
            <div class="info">
                <h4>${calc.orderNumber}</h4>
                <small>${formatDate(calc.orderDate)} | ${calc.totalTime} мин | ${formatCurrency(calc.totalFinalCost)} ₽</small>
            </div>
            <button class="delete-btn" data-id="${calc.id}">🗑️</button>
        </div>
    `).join('');

    // Загрузка расчета
    list.querySelectorAll('.saved-calculation-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) return;
            loadCalculation(parseInt(item.dataset.id));
            document.getElementById('loadModal').classList.remove('active');
        });
    });

    // Удаление расчета
    list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Удалить этот расчет?')) {
                deleteCalculation(parseInt(btn.dataset.id));
                updateSavedCalculationsList();
            }
        });
    });
}

function loadCalculation(id) {
    const calc = state.calculations.find(c => c.id === id);
    if (!calc) return;

    document.getElementById('orderNumber').value = calc.orderNumber;
    document.getElementById('orderDate').value = calc.orderDate;
    document.getElementById('ordersCount').value = calc.ordersCount;
    state.currentRate = calc.rate;
    document.getElementById('currentRate').textContent = calc.rate;

    OPERATIONS.forEach(op => {
        const opData = calc.operations[op.id];
        if (opData) {
            document.getElementById(`volume_${op.id}`).value = opData.volume;
            document.getElementById(`manualCost_${op.id}`).value = opData.manualCost || '';
            document.getElementById(`finalSelect_${op.id}`).value = opData.useManual ? 'manual' : 'auto';
        }
    });

    calculateAll();
}

function deleteCalculation(id) {
    state.calculations = state.calculations.filter(c => c.id !== id);
    saveToStorage();
    updateOrderSelects();
}

// === Таймер ===
function initTimerControls() {
    const startBtn = document.getElementById('startTimer');
    const pauseBtn = document.getElementById('pauseTimer');
    const stopBtn = document.getElementById('stopTimer');
    const addManualBtn = document.getElementById('addManualTime');

    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    stopBtn.addEventListener('click', stopTimer);
    addManualBtn.addEventListener('click', addManualTime);
}

function startTimer() {
    if (state.timer.running && !state.timer.paused) return;

    state.timer.running = true;
    state.timer.paused = false;

    state.timer.interval = setInterval(() => {
        state.timer.seconds++;
        updateTimerDisplay();
    }, 1000);

    document.getElementById('startTimer').disabled = true;
    document.getElementById('pauseTimer').disabled = false;
    document.getElementById('stopTimer').disabled = false;
}

function pauseTimer() {
    if (!state.timer.running) return;

    state.timer.paused = true;
    clearInterval(state.timer.interval);

    document.getElementById('startTimer').disabled = false;
    document.getElementById('pauseTimer').disabled = true;
}

function stopTimer() {
    if (!state.timer.running) return;

    clearInterval(state.timer.interval);

    const totalMinutes = Math.round(state.timer.seconds / 60);
    addWorkLogEntry(totalMinutes);

    state.timer.running = false;
    state.timer.paused = false;
    state.timer.seconds = 0;
    updateTimerDisplay();

    document.getElementById('startTimer').disabled = false;
    document.getElementById('pauseTimer').disabled = true;
    document.getElementById('stopTimer').disabled = true;
}

function updateTimerDisplay() {
    const hours = Math.floor(state.timer.seconds / 3600);
    const minutes = Math.floor((state.timer.seconds % 3600) / 60);
    const seconds = state.timer.seconds % 60;

    document.getElementById('timerHours').textContent = String(hours).padStart(2, '0');
    document.getElementById('timerMinutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('timerSeconds').textContent = String(seconds).padStart(2, '0');
}

function addManualTime() {
    const hours = parseInt(document.getElementById('manualHours').value) || 0;
    const minutes = parseInt(document.getElementById('manualMinutes').value) || 0;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes > 0) {
        addWorkLogEntry(totalMinutes);
        document.getElementById('manualHours').value = 0;
        document.getElementById('manualMinutes').value = 0;
    }
}

function addWorkLogEntry(minutes) {
    const masterName = document.getElementById('masterName').value || 'Не указан';
    const orderSelect = document.getElementById('trackingOrder');
    const operationSelect = document.getElementById('trackingOperation');

    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        orderId: orderSelect.value,
        orderName: orderSelect.options[orderSelect.selectedIndex]?.text || 'Не выбран',
        operationId: operationSelect.value,
        operationName: operationSelect.options[operationSelect.selectedIndex]?.text || 'Не выбрана',
        masterName,
        minutes
    };

    state.workLog.push(entry);
    saveToStorage();
    updateWorkLogTable();
}

function updateWorkLogTable() {
    const tbody = document.getElementById('workLogTable');

    if (state.workLog.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = state.workLog.slice().reverse().map(entry => `
        <tr>
            <td>${formatDateTime(entry.timestamp)}</td>
            <td>${entry.orderName}</td>
            <td>${entry.operationName}</td>
            <td>${entry.masterName}</td>
            <td>${entry.minutes} мин</td>
            <td>
                <button class="btn btn-danger" onclick="deleteWorkLogEntry(${entry.id})">🗑️</button>
            </td>
        </tr>
    `).join('');
}

function deleteWorkLogEntry(id) {
    state.workLog = state.workLog.filter(e => e.id !== id);
    saveToStorage();
    updateWorkLogTable();
    updateAnalysis();
}

// Глобальная функция для inline onclick
window.deleteWorkLogEntry = deleteWorkLogEntry;

function updateOrderSelects() {
    const trackingOrder = document.getElementById('trackingOrder');
    const analysisOrder = document.getElementById('analysisOrder');
    const operationSelect = document.getElementById('trackingOperation');

    const orderOptions = '<option value="">Выберите заказ</option>' +
        state.calculations.map(c => `<option value="${c.id}">${c.orderNumber}</option>`).join('');

    trackingOrder.innerHTML = orderOptions;
    analysisOrder.innerHTML = '<option value="">Все заказы</option>' +
        state.calculations.map(c => `<option value="${c.id}">${c.orderNumber}</option>`).join('');

    // Обновление списка операций
    const opOptions = '<option value="">Выберите операцию</option>' +
        OPERATIONS.filter(op => !op.isThickness).map(op => `<option value="${op.id}">${op.name}</option>`).join('');
    operationSelect.innerHTML = opOptions;

    // Обработчик изменения заказа в анализе
    analysisOrder.removeEventListener('change', updateAnalysis);
    analysisOrder.addEventListener('change', updateAnalysis);
}

// === Анализ ===
function updateAnalysis() {
    const selectedOrderId = document.getElementById('analysisOrder').value;

    let theoryData = {};
    let factData = {};

    // Собираем теоретические данные
    if (selectedOrderId) {
        const calc = state.calculations.find(c => c.id === parseInt(selectedOrderId));
        if (calc) {
            Object.entries(calc.operations).forEach(([opId, data]) => {
                theoryData[opId] = data.time;
            });
        }
    } else {
        state.calculations.forEach(calc => {
            Object.entries(calc.operations).forEach(([opId, data]) => {
                theoryData[opId] = (theoryData[opId] || 0) + data.time;
            });
        });
    }

    // Собираем фактические данные
    const relevantLogs = selectedOrderId
        ? state.workLog.filter(e => e.orderId === selectedOrderId)
        : state.workLog;

    relevantLogs.forEach(entry => {
        factData[entry.operationId] = (factData[entry.operationId] || 0) + entry.minutes;
    });

    // Подсчет итогов
    const totalTheory = Object.values(theoryData).reduce((sum, v) => sum + v, 0);
    const totalFact = Object.values(factData).reduce((sum, v) => sum + v, 0);
    const deviation = totalTheory > 0 ? ((totalFact - totalTheory) / totalTheory * 100).toFixed(1) : 0;

    document.getElementById('analysisTheoryTime').textContent = `${Math.round(totalTheory)} мин`;
    document.getElementById('analysisFactTime').textContent = `${Math.round(totalFact)} мин`;

    const deviationEl = document.getElementById('analysisDeviation');
    deviationEl.textContent = `${deviation > 0 ? '+' : ''}${deviation}%`;
    deviationEl.className = 'analysis-value ' + getDeviationClass(deviation);

    // Таблица по операциям
    const tbody = document.getElementById('analysisTable');
    const rows = OPERATIONS.filter(op => !op.isThickness && (theoryData[op.id] || factData[op.id])).map(op => {
        const theory = Math.round(theoryData[op.id] || 0);
        const fact = Math.round(factData[op.id] || 0);
        const opDeviation = theory > 0 ? ((fact - theory) / theory * 100).toFixed(1) : 0;
        const status = getDeviationStatus(opDeviation);

        return `
            <tr>
                <td>${op.name}</td>
                <td>${theory}</td>
                <td>${fact}</td>
                <td class="${getDeviationClass(opDeviation)}">${opDeviation > 0 ? '+' : ''}${opDeviation}%</td>
                <td><span class="status ${status.class}">${status.text}</span></td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.length > 0 ? rows.join('') : '<tr class="empty-row"><td colspan="5">Нет данных для анализа</td></tr>';
}

function getDeviationClass(deviation) {
    const d = parseFloat(deviation);
    if (d <= 5 && d >= -5) return 'text-success';
    if (d <= 15 && d >= -15) return 'text-warning';
    return 'text-danger';
}

function getDeviationStatus(deviation) {
    const d = parseFloat(deviation);
    if (d <= 5 && d >= -5) return { class: 'status-good', text: 'Норма' };
    if (d <= 15 && d >= -15) return { class: 'status-warning', text: 'Отклонение' };
    return { class: 'status-danger', text: 'Критично' };
}

// === Модальное окно ===
function initModalControls() {
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('loadModal').classList.remove('active');
    });

    document.getElementById('loadModal').addEventListener('click', (e) => {
        if (e.target.id === 'loadModal') {
            document.getElementById('loadModal').classList.remove('active');
        }
    });
}

// === Экспорт/Импорт ===
function initExportImport() {
    document.getElementById('exportJSON').addEventListener('click', exportJSON);
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('importData').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('clearWorkLog').addEventListener('click', () => {
        if (confirm('Очистить весь журнал работ?')) {
            state.workLog = [];
            saveToStorage();
            updateWorkLogTable();
            updateAnalysis();
        }
    });
}

function exportJSON() {
    const data = {
        calculations: state.calculations,
        workLog: state.workLog,
        exportDate: new Date().toISOString()
    };

    downloadFile(JSON.stringify(data, null, 2), 'countertop-data.json', 'application/json');
}

function exportCSV() {
    // Экспорт расчетов
    let csv = 'Номер заказа;Дата;Общее время (мин);Итоговая стоимость (руб)\n';
    state.calculations.forEach(calc => {
        csv += `${calc.orderNumber};${calc.orderDate};${calc.totalTime};${calc.totalFinalCost}\n`;
    });

    csv += '\nЖурнал работ\n';
    csv += 'Дата/Время;Заказ;Операция;Мастер;Время (мин)\n';
    state.workLog.forEach(entry => {
        csv += `${formatDateTime(entry.timestamp)};${entry.orderName};${entry.operationName};${entry.masterName};${entry.minutes}\n`;
    });

    downloadFile(csv, 'countertop-data.csv', 'text/csv;charset=utf-8');
}

function downloadFile(content, filename, type) {
    const blob = new Blob(['\ufeff' + content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.calculations) state.calculations = data.calculations;
            if (data.workLog) state.workLog = data.workLog;
            saveToStorage();
            updateUI();
            alert('Данные успешно импортированы!');
        } catch (err) {
            alert('Ошибка при импорте данных: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// === Вспомогательные функции ===
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
}

function formatDateTime(isoStr) {
    const date = new Date(isoStr);
    return date.toLocaleString('ru-RU');
}

function updateUI() {
    calculateAll();
    updateWorkLogTable();
    updateOrderSelects();
    updateAnalysis();
}
