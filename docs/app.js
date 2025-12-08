// === Инициализация Supabase ===
let supabase = null;

// Попытка подключения к Supabase
function initSupabase() {
    const supabaseUrl = localStorage.getItem('supabaseUrl') || '';
    const supabaseKey = localStorage.getItem('supabaseKey') || '';

    if (supabaseUrl && supabaseKey) {
        try {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log('Supabase подключен');
        } catch (err) {
            console.error('Ошибка подключения к Supabase:', err);
        }
    } else {
        console.warn('Supabase не настроен. Используются локальные данные.');
    }
}

// === Переменная для хранения текущей часовой ставки ===
let currentHourlyRate = 700; // значение по умолчанию

// === Переменная для хранения загруженных камней ===
let availableStones = [];

// === Начальные мастера для локального режима (когда workLog пустой) ===
const DEFAULT_LOCAL_MASTERS = [
    { id: null, name: 'Иванов И.И.' },
    { id: null, name: 'Петров П.П.' },
    { id: null, name: 'Сидоров С.С.' }
];

// === Загрузка дефолтной часовой ставки из Supabase ===
async function loadDefaultHourlyRate() {
    if (!supabase) {
        console.warn('Supabase не подключен, используется ставка по умолчанию: 700');
        return 700;
    }

    try {
        // Попытка получить дефолтную ставку (is_default = true)
        const { data, error } = await supabase
            .from('hourly_rates')
            .select('rate_value')
            .eq('is_default', true)
            .limit(1)
            .single();

        if (error) {
            // Если не нашли дефолтную, берём первую попавшуюся
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('hourly_rates')
                .select('rate_value')
                .limit(1)
                .single();

            if (fallbackError) {
                console.error('Ошибка загрузки ставки из Supabase:', fallbackError);
                return 700;
            }

            if (fallbackData && fallbackData.rate_value) {
                console.log('Загружена ставка из Supabase:', fallbackData.rate_value);
                return parseFloat(fallbackData.rate_value);
            }
        }

        if (data && data.rate_value) {
            console.log('Загружена дефолтная ставка из Supabase:', data.rate_value);
            return parseFloat(data.rate_value);
        }

        console.warn('Нет данных в таблице hourly_rates, используется ставка по умолчанию: 700');
        return 700;
    } catch (err) {
        console.error('Ошибка при загрузке ставки:', err);
        return 700;
    }
}

// === Загрузка списка камней из Supabase ===
async function loadStones() {
    if (!supabase) {
        console.warn('Supabase не подключен, камни не загружены');
        return [];
    }

    try {
        // Загружаем камни с JOIN к hourly_rates для получения ставки
        const { data, error } = await supabase
            .from('stones')
            .select(`
                id,
                name,
                hourly_rate_id,
                hourly_rates:hourly_rate_id (
                    rate_value
                )
            `)
            .eq('is_active', true)
            .order('name');

        if (error) {
            console.error('Ошибка загрузки камней из Supabase:', error);
            return [];
        }

        if (data && data.length > 0) {
            // Преобразуем данные в удобный формат
            const stones = data.map(stone => ({
                id: stone.id,
                name: stone.name,
                hourlyRateValue: stone.hourly_rates ? parseFloat(stone.hourly_rates.rate_value) : null
            }));

            console.log(`Загружено камней: ${stones.length}`);
            return stones;
        }

        console.warn('Нет активных камней в таблице stones');
        return [];
    } catch (err) {
        console.error('Ошибка при загрузке камней:', err);
        return [];
    }
}

// === Заполнение селекта камнями ===
function populateStoneSelect() {
    const stoneSelect = document.getElementById('stoneSelect');
    if (!stoneSelect) return;

    // Очищаем селект, оставляя только дефолтную опцию
    stoneSelect.innerHTML = '<option value="">Выберите камень</option>';

    // Добавляем опции для каждого камня
    availableStones.forEach(stone => {
        const option = document.createElement('option');
        option.value = stone.id;
        option.textContent = stone.name;
        stoneSelect.appendChild(option);
    });
}

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
    currentRate: 700, // будет обновлено после загрузки из Supabase
    selectedStoneId: null, // ID выбранного камня
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

// === Активные сессии работы (многозадачность) ===
let activeSessions = {};
// Структура:
// {
//   [masterName]: {  // ключ первого уровня - имя мастера
//     [orderName]: {  // ключ второго уровня - название заказа
//       startTime: Date,
//       endTime: Date | null,
//       pauses: [
//         { pauseStart: Date, pauseEnd: Date, reasonText: string }
//       ],
//       lastPauseStart: Date | null,
//       lastPauseReason: string | null,
//       masterName: string,
//       masterId: string | null,
//       orderId: string | null,
//       orderName: string
//     }
//   }
// }

// Глобальный интервал для обновления всех активных таймеров
let globalTimerInterval = null;

// === Вспомогательные функции для работы с сессиями ===

// Получить конкретную сессию
function getActiveSession(masterName, orderName) {
    if (!activeSessions[masterName]) return null;
    return activeSessions[masterName][orderName] || null;
}

// Получить все сессии мастера
function getActiveMasterSessions(masterName) {
    return activeSessions[masterName] || {};
}

// Подсчитать активные (не завершённые) сессии мастера
function countActiveSessionsForMaster(masterName) {
    const sessions = getActiveMasterSessions(masterName);
    return Object.values(sessions).filter(s => !s.endTime).length;
}

// Получить все активные сессии (без endTime) из всех мастеров
function getAllActiveSessions() {
    const result = [];
    for (const masterName in activeSessions) {
        for (const orderName in activeSessions[masterName]) {
            const session = activeSessions[masterName][orderName];
            if (!session.endTime) {
                result.push({ masterName, orderName, session });
            }
        }
    }
    return result;
}

// === Асинхронная инициализация приложения ===
async function initApp() {
    // Инициализируем Supabase
    initSupabase();

    // Загружаем ставку из Supabase
    currentHourlyRate = await loadDefaultHourlyRate();
    state.currentRate = currentHourlyRate;

    // Загружаем камни из Supabase
    availableStones = await loadStones();
    populateStoneSelect();

    // Загружаем мастеров из Supabase или из локального workLog
    await populateMasterSelect();

    // Обновляем UI с загруженной ставкой
    const currentRateEl = document.getElementById('currentRate');
    if (currentRateEl) {
        currentRateEl.textContent = state.currentRate;
    }

    // Остальная инициализация
    loadFromStorage();
    initTabs();
    initOperationsTable();
    initOrderParams();
    initTimerControls();
    initTrackingUI();
    initModalControls();
    initExportImport();
    await initAnalysisFilters(); // Инициализация фильтров анализа
    await initWorkLogFilters(); // Инициализация фильтров журнала работ
    updateUI();
    setDefaultDate();
}

// Запуск приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);

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
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }

            if (tabId === 'tracking') {
                updateOrderSelects();
            } else if (tabId === 'analysis') {
                updateAnalysis();
            } else if (tabId === 'admin') {
                initAdminPanel();
            }
        });
    });
}

// === Таблица операций ===
function initOperationsTable() {
    const tbody = document.getElementById('operationsTable');
    if (!tbody) return;

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

    const clearBtn = document.getElementById('clearForm');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
}

// === Параметры заказа ===
function initOrderParams() {
    // Обработчик выбора камня
    const stoneSelect = document.getElementById('stoneSelect');
    if (stoneSelect) {
        stoneSelect.addEventListener('change', (e) => {
            const stoneId = e.target.value;
            state.selectedStoneId = stoneId || null;

            if (stoneId) {
                // Находим выбранный камень
                const selectedStone = availableStones.find(s => s.id === stoneId);

                if (selectedStone && selectedStone.hourlyRateValue) {
                    // Обновляем текущую ставку на ставку камня
                    currentHourlyRate = selectedStone.hourlyRateValue;

                    // Если не множественный заказ, обновляем state.currentRate
                    const ordersCountEl = document.getElementById('ordersCount');
                    const count = ordersCountEl ? parseInt(ordersCountEl.value) || 1 : 1;

                    if (count === 1) {
                        state.currentRate = currentHourlyRate;

                        // Обновляем отображение ставки
                        const currentRateEl = document.getElementById('currentRate');
                        if (currentRateEl) {
                            currentRateEl.textContent = state.currentRate;
                        }

                        // Пересчитываем стоимость
                        calculateAll();
                    }

                    console.log(`Камень "${selectedStone.name}" выбран, ставка: ${currentHourlyRate} руб/час`);
                }
            }
        });
    }

    // Обработчик количества заказов
    const ordersCountEl = document.getElementById('ordersCount');
    if (ordersCountEl) {
        ordersCountEl.addEventListener('input', (e) => {
            const count = parseInt(e.target.value) || 1;
            // Используем currentHourlyRate как базовую ставку
            state.currentRate = count > 1 ? MULTI_ORDER_RATE : currentHourlyRate;
            const currentRateEl = document.getElementById('currentRate');
            if (currentRateEl) {
                currentRateEl.textContent = state.currentRate;
            }
            calculateAll();
        });
    }

    const saveBtn = document.getElementById('saveCalculation');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCalculation);
    }

    const loadBtn = document.getElementById('loadCalculation');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            updateSavedCalculationsList();
            const modal = document.getElementById('loadModal');
            if (modal) {
                modal.classList.add('active');
            }
        });
    }
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('orderDate');
    if (dateEl) {
        dateEl.value = today;
    }
}

// === Расчеты ===
function calculateAll() {
    let totalTime = 0;
    let totalAutoCost = 0;
    let totalManualCost = 0;
    let totalFinalCost = 0;

    const thicknessEl = document.getElementById('volume_22');
    const thicknessValue = thicknessEl ? parseFloat(thicknessEl.value) || 0 : 0;
    const thicknessExtra = thicknessValue > THICKNESS_THRESHOLD ? THICKNESS_EXTRA_PER_MP : 0;

    OPERATIONS.forEach(op => {
        const volumeEl = document.getElementById(`volume_${op.id}`);
        const volume = volumeEl ? parseFloat(volumeEl.value) || 0 : 0;
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
        const manualCostInputEl = document.getElementById(`manualCost_${op.id}`);
        const manualCostInput = manualCostInputEl ? manualCostInputEl.value : '';
        const manualCost = manualCostInput ? parseFloat(manualCostInput) : 0;
        const finalSelectEl = document.getElementById(`finalSelect_${op.id}`);
        const useManual = finalSelectEl ? finalSelectEl.value === 'manual' : false;
        const finalCost = useManual && manualCostInput ? manualCost : autoCost;

        const timeEl = document.getElementById(`time_${op.id}`);
        if (timeEl) timeEl.textContent = Math.round(time);

        const autoCostEl = document.getElementById(`autoCost_${op.id}`);
        if (autoCostEl) autoCostEl.textContent = formatCurrency(autoCost);

        const finalCostEl = document.getElementById(`finalCost_${op.id}`);
        if (finalCostEl) finalCostEl.textContent = formatCurrency(finalCost);

        state.operationValues[op.id] = { volume, time, autoCost, manualCost, finalCost, useManual };

        totalTime += time;
        totalAutoCost += autoCost;
        totalManualCost += manualCost;
        totalFinalCost += finalCost;
    });

    // Обновление итогов
    const totalTimeEl = document.getElementById('totalTime');
    if (totalTimeEl) totalTimeEl.textContent = Math.round(totalTime);

    const totalAutoCostEl = document.getElementById('totalAutoCost');
    if (totalAutoCostEl) totalAutoCostEl.textContent = formatCurrency(totalAutoCost);

    const totalManualCostEl = document.getElementById('totalManualCost');
    if (totalManualCostEl) totalManualCostEl.textContent = formatCurrency(totalManualCost);

    const totalFinalCostEl = document.getElementById('totalFinalCost');
    if (totalFinalCostEl) totalFinalCostEl.textContent = formatCurrency(totalFinalCost);

    // Сводка
    const hours = Math.floor(totalTime / 60);
    const minutes = Math.round(totalTime % 60);

    const summaryTimeEl = document.getElementById('summaryTime');
    if (summaryTimeEl) summaryTimeEl.textContent = `${hours} ч ${minutes} мин`;

    const summaryAutoCostEl = document.getElementById('summaryAutoCost');
    if (summaryAutoCostEl) summaryAutoCostEl.textContent = formatCurrency(totalAutoCost) + ' ₽';

    const summaryFinalCostEl = document.getElementById('summaryFinalCost');
    if (summaryFinalCostEl) summaryFinalCostEl.textContent = formatCurrency(totalFinalCost) + ' ₽';
}

function formatCurrency(value) {
    return value.toLocaleString('ru-RU');
}

function clearForm() {
    document.querySelectorAll('.volume-input').forEach(input => input.value = 0);
    document.querySelectorAll('.manual-cost-input').forEach(input => input.value = '');
    document.querySelectorAll('.final-select').forEach(select => select.value = 'auto');

    const orderNumberEl = document.getElementById('orderNumber');
    if (orderNumberEl) orderNumberEl.value = '';

    const ordersCountEl = document.getElementById('ordersCount');
    if (ordersCountEl) ordersCountEl.value = 1;

    // Сбрасываем выбор камня
    const stoneSelect = document.getElementById('stoneSelect');
    if (stoneSelect) stoneSelect.value = '';
    state.selectedStoneId = null;

    // Сбрасываем тип мойки и слива
    const sinkTypeSelect = document.getElementById('sinkType');
    if (sinkTypeSelect) sinkTypeSelect.value = '';

    const drainTypeSelect = document.getElementById('drainType');
    if (drainTypeSelect) drainTypeSelect.value = '';

    state.currentRate = currentHourlyRate; // используем загруженную ставку

    const currentRateEl = document.getElementById('currentRate');
    if (currentRateEl) currentRateEl.textContent = currentHourlyRate;

    setDefaultDate();
    calculateAll();
}

// === Валидация моек и сливов ===
// Типы моек, для которых обязателен выбор слива
const REQUIRED_DRAIN_SINK_TYPES = ['ВН', 'К0', 'КГ', 'КГР', 'КР'];

function validateSinkAndDrainBeforeSave() {
    const sinkTypeSelect = document.getElementById('sinkType');
    const drainTypeSelect = document.getElementById('drainType');

    const sinkType = sinkTypeSelect ? sinkTypeSelect.value : '';
    const drainType = drainTypeSelect ? drainTypeSelect.value : '';

    // Проверяем, требует ли выбранный тип мойки обязательного слива
    const sinkRequiresDrain = REQUIRED_DRAIN_SINK_TYPES.includes(sinkType);

    if (sinkRequiresDrain && (!drainType || drainType === '')) {
        console.warn('[SINK_DRAIN] Обязателен выбор слива для мойки типа:', sinkType);
        alert('Для выбранного типа мойки обязательно нужно указать слив.');
        return false;
    }

    console.log('[SINK_DRAIN] Валидация пройдена. Тип мойки:', sinkType, 'Слив:', drainType);
    return true;
}

// === Сохранение/загрузка расчетов ===
async function saveCalculation() {
    // ВАЛИДАЦИЯ: проверка обязательности слива для определённых типов моек
    if (!validateSinkAndDrainBeforeSave()) {
        console.log('[SAVE] Сохранение прервано из-за не пройденной валидации моек/сливов');
        return; // Прерываем сохранение
    }

    const orderNumberEl = document.getElementById('orderNumber');
    let orderNumber = orderNumberEl ? orderNumberEl.value.trim() : '';

    // Предупреждение, если номер заказа не заполнен
    if (!orderNumber) {
        const useAutoNumber = confirm(
            'Номер заказа не указан.\n\n' +
            'Будет использован автоматический номер.\n\n' +
            'Продолжить?'
        );

        if (!useAutoNumber) {
            // Фокусируем поле номера заказа для заполнения
            if (orderNumberEl) {
                orderNumberEl.focus();
            }
            return; // Прерываем сохранение
        }

        orderNumber = `Заказ-${Date.now()}`;
        console.log('[SAVE] Использован автоматический номер:', orderNumber);
    }

    const orderDateEl = document.getElementById('orderDate');
    const orderDate = orderDateEl ? orderDateEl.value : '';

    const ordersCountEl = document.getElementById('ordersCount');
    const ordersCount = ordersCountEl ? parseInt(ordersCountEl.value) || 1 : 1;

    const totalTimeEl = document.getElementById('totalTime');
    const totalTime = totalTimeEl ? parseInt(totalTimeEl.textContent) : 0;

    const totalFinalCostEl = document.getElementById('totalFinalCost');
    const totalFinalCost = totalFinalCostEl ? parseInt(totalFinalCostEl.textContent.replace(/\s/g, '')) : 0;

    // Получаем тип мойки и слива для сохранения
    const sinkTypeSelect = document.getElementById('sinkType');
    const drainTypeSelect = document.getElementById('drainType');
    const sinkType = sinkTypeSelect ? sinkTypeSelect.value : '';
    const drainType = drainTypeSelect ? drainTypeSelect.value : '';

    const calculation = {
        id: Date.now(),
        orderNumber,
        orderDate,
        ordersCount,
        rate: state.currentRate,
        hourly_rate: state.currentRate, // для сохранения в Supabase
        stone_id: state.selectedStoneId || null, // ID выбранного камня
        sinkType, // Тип мойки
        drainType, // Тип слива
        operations: { ...state.operationValues },
        totalTime,
        totalFinalCost,
        createdAt: new Date().toISOString()
    };

    // Локальное сохранение (как было раньше)
    state.calculations.push(calculation);
    saveToStorage();
    updateOrderSelects();

    // === СОХРАНЕНИЕ В SUPABASE ===
    if (!supabase) {
        console.warn('[SAVE] Supabase не настроен, заказ сохранён только локально');
        alert('Расчёт сохранён локально.\n\nДля сохранения в базу данных настройте подключение к Supabase.');
        return;
    }

    try {
        console.log('[SAVE] Начинаем сохранение в Supabase...');

        // 1. Формируем payload для таблицы orders
        const orderPayload = {
            order_number: orderNumber,
            calculator_type: 'acrylic_countertop', // фиксированный тип для акриловых столешниц
            calculator_version: 'v1.0', // версия калькулятора
            hourly_rate: parseFloat(state.currentRate),
            theoretical_time_calc_hours: parseFloat((totalTime / 60).toFixed(2)), // конвертация минут в часы
            additional_work_cost: null, // пока не используется
            additional_work_time_hours: null, // пока не используется
            theoretical_time_total_hours: parseFloat((totalTime / 60).toFixed(2)), // конвертация минут в часы
            complexity_level: null, // пока не рассчитывается
            is_training_data: false,
            is_outlier: false,
            stone_id: state.selectedStoneId || null
        };

        console.log('[SAVE] Payload для orders:', orderPayload);

        // 2. Сохраняем заказ в таблицу orders
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert([orderPayload])
            .select()
            .single();

        if (orderError) {
            throw new Error(`Ошибка сохранения заказа: ${orderError.message}`);
        }

        console.log('[SAVE] Заказ сохранён, order_id:', orderData.id);

        // 3. Формируем payload для таблицы order_parameters
        // Извлекаем значения операций из state.operationValues
        const operations = state.operationValues;

        // Маппинг операций на поля БД:
        // id: 1 — Столешница (м²) → countertop_sqm
        // id: 4 — Рад. кромки (м.п.) → edge_radius_m
        // id: 22 — Толщина столешницы (мм) → thickness_mm
        // Мойки (id: 16-19) — пока не мапим, т.к. неясно круглые/прямоугольные

        const parametersPayload = {
            order_id: orderData.id,
            countertop_sqm: operations[1]?.volume || 0,
            edge_radius_m: operations[4]?.volume || 0,
            sink_round_pcs: 0, // TODO: уточнить маппинг моек
            sink_rect_pcs: 0, // TODO: уточнить маппинг моек
            thickness_mm: Math.round(operations[22]?.volume || 0)
        };

        console.log('[SAVE] Payload для order_parameters:', parametersPayload);

        // 4. Сохраняем параметры в таблицу order_parameters
        const { error: paramsError } = await supabase
            .from('order_parameters')
            .insert([parametersPayload]);

        if (paramsError) {
            throw new Error(`Ошибка сохранения параметров: ${paramsError.message}`);
        }

        console.log('[SAVE] Параметры заказа сохранены успешно');

        alert('Расчёт успешно сохранён в базу данных!');

    } catch (err) {
        console.error('[SAVE] Ошибка при сохранении в Supabase:', err);
        alert(`Ошибка сохранения в базу данных:\n${err.message}\n\nРасчёт сохранён только локально.`);
    }
}

// === Синхронизация журнала работ в Supabase ===

// Найти или создать мастера по имени
async function findOrCreateMaster(masterName) {
    if (!supabase) return null;
    if (!masterName || !masterName.trim()) return null;

    try {
        // Ищем существующего мастера
        const { data: existingMasters, error: searchError } = await supabase
            .from('masters')
            .select('id, name')
            .eq('name', masterName.trim())
            .limit(1);

        if (searchError) {
            console.error('[WORKLOG_SYNC] Ошибка поиска мастера:', searchError);
            return null;
        }

        if (existingMasters && existingMasters.length > 0) {
            console.log('[WORKLOG_SYNC] Мастер найден:', existingMasters[0].id);
            return existingMasters[0].id;
        }

        // Мастер не найден - создаём нового
        // TODO: qualification_level по умолчанию = 1, в будущем брать из справочника
        const { data: newMaster, error: insertError } = await supabase
            .from('masters')
            .insert([{
                name: masterName.trim(),
                qualification_level: 1,
                is_active: true
            }])
            .select()
            .single();

        if (insertError) {
            console.error('[WORKLOG_SYNC] Ошибка создания мастера:', insertError);
            return null;
        }

        console.log('[WORKLOG_SYNC] Мастер создан:', newMaster.id, newMaster.name);
        return newMaster.id;

    } catch (err) {
        console.error('[WORKLOG_SYNC] Ошибка в findOrCreateMaster:', err);
        return null;
    }
}

// Найти order_id по номеру заказа
async function findOrderId(orderNumber) {
    if (!supabase) return null;
    if (!orderNumber || !orderNumber.trim()) return null;

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id')
            .eq('order_number', orderNumber.trim())
            .limit(1);

        if (error) {
            console.error('[WORKLOG_SYNC] Ошибка поиска заказа:', error);
            return null;
        }

        if (orders && orders.length > 0) {
            console.log('[WORKLOG_SYNC] Заказ найден:', orders[0].id);
            return orders[0].id;
        }

        console.warn('[WORKLOG_SYNC] Заказ не найден в БД:', orderNumber);
        return null;

    } catch (err) {
        console.error('[WORKLOG_SYNC] Ошибка в findOrderId:', err);
        return null;
    }
}

// Синхронизация записи журнала работ в Supabase
async function syncWorkLogEntryToSupabase(entry) {
    // Проверка настроек Supabase
    if (!supabase) {
        console.warn('[WORKLOG_SYNC] Supabase не настроен, запись остаётся только локально', entry);
        return;
    }

    try {
        // Получаем order_id
        const orderId = await findOrderId(entry.orderName || entry.orderId);
        if (!orderId) {
            console.warn('[WORKLOG_SYNC] Не удалось найти order_id для заказа:', entry.orderName);
            // Не падаем с ошибкой, просто не синхронизируем
            return;
        }

        // Получаем master_id - приоритет у entry.masterId
        let masterId = entry.masterId || null;
        if (!masterId) {
            // Fallback: пытаемся найти или создать мастера по имени
            masterId = await findOrCreateMaster(entry.masterName);
            if (!masterId) {
                console.warn('[WORKLOG_SYNC] Не удалось найти/создать master_id для мастера:', entry.masterName);
                return;
            }
        } else {
            console.log('[WORKLOG_SYNC] Используем masterId из entry:', masterId);
        }

        // Вычисляем рабочие минуты и минуты пауз
        const workMinutes = entry.minutes || 0;
        const pauseMinutes = (entry.pauses || []).reduce((sum, p) => {
            return sum + (p.durationMinutes || 0);
        }, 0);

        // Подготовка данных для order_execution
        // TODO: fact_start_at и fact_end_at - пока берём из entry.timestamp или текущее время
        // В будущем можно брать из activeSessions если сохраняем startTime/endTime
        const now = new Date();
        const entryTimestamp = entry.timestamp ? new Date(entry.timestamp) : now;

        const executionPayload = {
            order_id: orderId,
            master_id: masterId,
            fact_start_at: entryTimestamp.toISOString(),
            fact_end_at: entryTimestamp.toISOString(), // TODO: брать реальное время окончания
            status: 'completed',
            comment: pauseMinutes > 0 ? `Работа с паузами (${pauseMinutes} мин)` : null
        };

        console.log('[WORKLOG_SYNC] Payload for order_execution:', executionPayload);

        // INSERT в order_execution
        const { data: executionData, error: executionError } = await supabase
            .from('order_execution')
            .insert([executionPayload])
            .select()
            .single();

        if (executionError) {
            console.error('[WORKLOG_SYNC] Error inserting order_execution', executionError);
            return;
        }

        console.log('[WORKLOG_SYNC] order_execution inserted, id:', executionData.id);

        // INSERT в pauses (если есть)
        if (entry.pauses && entry.pauses.length > 0) {
            const pausesPayload = entry.pauses.map(pause => {
                // TODO: paused_at и resumed_at - пока используем timestamp записи
                // В будущем можно сохранять реальные pauseStart/pauseEnd из activeSessions
                return {
                    order_execution_id: executionData.id,
                    paused_at: entryTimestamp.toISOString(),
                    resumed_at: entryTimestamp.toISOString(),
                    reason: pause.reasonText || 'Не указана',
                    duration_min: pause.durationMinutes || 0
                };
            });

            console.log('[WORKLOG_SYNC] Payload for pauses:', pausesPayload);

            const { error: pausesError } = await supabase
                .from('pauses')
                .insert(pausesPayload);

            if (pausesError) {
                console.error('[WORKLOG_SYNC] Error inserting pauses', pausesError);
            } else {
                console.log('[WORKLOG_SYNC] Pauses inserted:', pausesPayload.length);
            }
        }

    } catch (err) {
        console.error('[WORKLOG_SYNC] Unexpected error', err);
    }
}

function updateSavedCalculationsList() {
    const list = document.getElementById('savedCalculationsList');
    if (!list) return;

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
            const modal = document.getElementById('loadModal');
            if (modal) {
                modal.classList.remove('active');
            }
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

    const orderNumberEl = document.getElementById('orderNumber');
    if (orderNumberEl) orderNumberEl.value = calc.orderNumber;

    const orderDateEl = document.getElementById('orderDate');
    if (orderDateEl) orderDateEl.value = calc.orderDate;

    const ordersCountEl = document.getElementById('ordersCount');
    if (ordersCountEl) ordersCountEl.value = calc.ordersCount;

    // Восстанавливаем выбор камня
    const stoneSelect = document.getElementById('stoneSelect');
    if (stoneSelect && calc.stone_id) {
        stoneSelect.value = calc.stone_id;
        state.selectedStoneId = calc.stone_id;
    }

    // Восстанавливаем тип мойки и слива
    const sinkTypeSelect = document.getElementById('sinkType');
    if (sinkTypeSelect && calc.sinkType !== undefined) {
        sinkTypeSelect.value = calc.sinkType;
    }

    const drainTypeSelect = document.getElementById('drainType');
    if (drainTypeSelect && calc.drainType !== undefined) {
        drainTypeSelect.value = calc.drainType;
    }

    state.currentRate = calc.rate;

    const currentRateEl = document.getElementById('currentRate');
    if (currentRateEl) currentRateEl.textContent = calc.rate;

    OPERATIONS.forEach(op => {
        const opData = calc.operations[op.id];
        if (opData) {
            const volumeEl = document.getElementById(`volume_${op.id}`);
            if (volumeEl) volumeEl.value = opData.volume;

            const manualCostEl = document.getElementById(`manualCost_${op.id}`);
            if (manualCostEl) manualCostEl.value = opData.manualCost || '';

            const finalSelectEl = document.getElementById(`finalSelect_${op.id}`);
            if (finalSelectEl) finalSelectEl.value = opData.useManual ? 'manual' : 'auto';
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

    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (stopBtn) stopBtn.addEventListener('click', stopTimer);
    if (addManualBtn) addManualBtn.addEventListener('click', addManualTime);
}

function initTrackingUI() {
    const searchInput = document.getElementById('trackingOrderSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterTrackingOrders);
        console.log('[TRACKING] Инициализирован поиск по заказам');
    }
}

function startTimer() {
    // Получаем данные из UI
    const workMasterSelect = document.getElementById('workMasterSelect');
    const trackingOrderEl = document.getElementById('trackingOrder');

    let masterName = '';
    let masterId = null;

    if (workMasterSelect && workMasterSelect.value) {
        const selectedOption = workMasterSelect.options[workMasterSelect.selectedIndex];
        masterId = selectedOption.dataset.masterId || null;
        masterName = selectedOption.dataset.masterName || selectedOption.text;
    }

    const orderId = trackingOrderEl ? trackingOrderEl.value : '';
    const orderName = trackingOrderEl && orderId
        ? trackingOrderEl.options[trackingOrderEl.selectedIndex].text
        : '';

    if (!masterName) {
        alert('Выберите мастера перед началом работы');
        return;
    }
    if (!orderId || !orderName) {
        alert('Выберите заказ перед началом работы');
        return;
    }

    // Проверяем существующую сессию
    let session = getActiveSession(masterName, orderName);

    if (!session) {
        // Проверяем лимит 4 заказа на мастера
        const activeCount = countActiveSessionsForMaster(masterName);
        if (activeCount >= 4) {
            alert(`У мастера "${masterName}" уже ${activeCount} активных заказов. Завершите один из них перед запуском нового.`);
            return;
        }

        // Создаём новую сессию
        if (!activeSessions[masterName]) {
            activeSessions[masterName] = {};
        }

        session = {
            startTime: new Date(),
            endTime: null,
            pauses: [],
            lastPauseStart: null,
            lastPauseReason: null,
            masterName: masterName,
            masterId: masterId,
            orderId: orderId,
            orderName: orderName
        };

        activeSessions[masterName][orderName] = session;
        console.log('[TIMER] Начата новая сессия:', masterName, orderName);
    } else if (session.lastPauseStart) {
        // Возобновление после паузы
        const pauseEnd = new Date();
        const reasonText = session.lastPauseReason || '';

        session.pauses.push({
            pauseStart: session.lastPauseStart,
            pauseEnd: pauseEnd,
            reasonText: reasonText
        });

        session.lastPauseStart = null;
        session.lastPauseReason = null;

        console.log('[TIMER] Возобновление:', masterName, orderName, 'Пауз:', session.pauses.length);
    } else {
        console.log('[TIMER] Сессия уже активна:', masterName, orderName);
    }

    // Запускаем глобальный тикер если ещё не запущен
    startGlobalTicker();

    // Обновляем таблицу активных работ
    updateActiveSessionsTable();
}

function pauseTimer() {
    // Получаем текущую выбранную сессию из UI
    const masterNameEl = document.getElementById('masterName');
    const trackingOrderEl = document.getElementById('trackingOrder');

    const masterName = masterNameEl ? masterNameEl.value.trim() : '';
    const orderName = trackingOrderEl && trackingOrderEl.value
        ? trackingOrderEl.options[trackingOrderEl.selectedIndex].text
        : '';

    if (!masterName || !orderName) {
        alert('Выберите мастера и заказ');
        return;
    }

    const session = getActiveSession(masterName, orderName);
    if (!session) {
        alert('Нет активной сессии для выбранного мастера и заказа');
        return;
    }

    if (session.lastPauseStart) {
        alert('Пауза уже идёт для этой работы');
        return;
    }

    // Проверяем наличие причины паузы
    const reasonInput = document.getElementById('pauseReasonInput');
    const reasonText = reasonInput ? reasonInput.value.trim() : '';

    if (!reasonText) {
        alert('Укажите причину паузы.');
        return;
    }

    // Записываем время начала паузы и причину
    const now = new Date();
    session.lastPauseStart = now;
    session.lastPauseReason = reasonText;

    console.log('[TIMER] Пауза:', masterName, orderName, 'Причина:', reasonText);

    // Очищаем поле причины
    if (reasonInput) reasonInput.value = '';

    // Обновляем таблицу
    updateActiveSessionsTable();
}

function stopTimer() {
    // Получаем текущую выбранную сессию из UI
    const masterNameEl = document.getElementById('masterName');
    const trackingOrderEl = document.getElementById('trackingOrder');

    const masterName = masterNameEl ? masterNameEl.value.trim() : '';
    const orderName = trackingOrderEl && trackingOrderEl.value
        ? trackingOrderEl.options[trackingOrderEl.selectedIndex].text
        : '';

    if (!masterName || !orderName) {
        alert('Выберите мастера и заказ');
        return;
    }

    const session = getActiveSession(masterName, orderName);
    if (!session) {
        alert('Нет активной сессии для выбранного мастера и заказа');
        return;
    }

    // Вызываем общую функцию остановки
    handleStopForSession(masterName, orderName);
}

// === Функции для управления конкретными сессиями (из таблицы) ===

function handlePauseForSession(masterName, orderName) {
    const session = getActiveSession(masterName, orderName);
    if (!session) {
        alert('Сессия не найдена');
        return;
    }

    if (session.lastPauseStart) {
        alert('Пауза уже идёт для этой работы');
        return;
    }

    const reasonText = prompt('Укажите причину паузы:');
    if (!reasonText || !reasonText.trim()) {
        return;
    }

    const now = new Date();
    session.lastPauseStart = now;
    session.lastPauseReason = reasonText.trim();

    console.log('[TIMER] Пауза:', masterName, orderName, 'Причина:', reasonText);
    updateActiveSessionsTable();
}

function handleResumeForSession(masterName, orderName) {
    const session = getActiveSession(masterName, orderName);
    if (!session) {
        alert('Сессия не найдена');
        return;
    }

    if (!session.lastPauseStart) {
        alert('Пауза не активна для этой работы');
        return;
    }

    const pauseEnd = new Date();
    const reasonText = session.lastPauseReason || '';

    session.pauses.push({
        pauseStart: session.lastPauseStart,
        pauseEnd: pauseEnd,
        reasonText: reasonText
    });

    session.lastPauseStart = null;
    session.lastPauseReason = null;

    console.log('[TIMER] Возобновление:', masterName, orderName);
    updateActiveSessionsTable();
}

function handleStopForSession(masterName, orderName) {
    const session = getActiveSession(masterName, orderName);
    if (!session) {
        alert('Сессия не найдена');
        return;
    }

    // Фиксируем время окончания
    session.endTime = new Date();

    // Если сейчас на паузе, закрываем последнюю паузу
    if (session.lastPauseStart) {
        const reasonText = session.lastPauseReason || '';
        session.pauses.push({
            pauseStart: session.lastPauseStart,
            pauseEnd: session.endTime,
            reasonText: reasonText
        });
        session.lastPauseStart = null;
        session.lastPauseReason = null;
    }

    // Вычисляем общее время работы
    const totalMillis = session.endTime - session.startTime;

    // Вычисляем суммарное время пауз
    const pauseMillis = session.pauses.reduce((sum, pause) => {
        return sum + (pause.pauseEnd - pause.pauseStart);
    }, 0);

    // Фактическое рабочее время = общее время - паузы
    const workMillis = totalMillis - pauseMillis;
    const totalMinutes = Math.max(0, Math.round(workMillis / 60000));

    console.log('[TIMER] Сессия завершена:', masterName, orderName);
    console.log('[TIMER] Общее время:', Math.round(totalMillis / 60000), 'мин');
    console.log('[TIMER] Время пауз:', Math.round(pauseMillis / 60000), 'мин');
    console.log('[TIMER] Рабочее время:', totalMinutes, 'мин');

    // Логируем причины пауз
    session.pauses.forEach((pause, idx) => {
        const duration = Math.round((pause.pauseEnd - pause.pauseStart) / 60000);
        console.log(`[TIMER] Пауза ${idx + 1}: ${duration} мин - "${pause.reasonText}"`);
    });

    // Добавляем запись в журнал
    addWorkLogEntry(
        totalMinutes,
        session.masterName,
        session.orderName,
        session.orderId,
        session.pauses,
        session.masterId
    );

    // Удаляем сессию
    delete activeSessions[masterName][orderName];
    if (Object.keys(activeSessions[masterName]).length === 0) {
        delete activeSessions[masterName];
    }

    // Обновляем таблицу
    updateActiveSessionsTable();

    // Останавливаем глобальный тикер если нет активных сессий
    if (getAllActiveSessions().length === 0) {
        stopGlobalTicker();
    }
}

// === Глобальный тикер для всех активных сессий ===

function startGlobalTicker() {
    if (globalTimerInterval) return; // Уже запущен

    globalTimerInterval = setInterval(() => {
        updateActiveSessionsTable();
        updateTimerDisplay(); // Обновляем верхний блок таймера для выбранной сессии
    }, 1000);

    console.log('[TIMER] Глобальный тикер запущен');
}

function stopGlobalTicker() {
    if (globalTimerInterval) {
        clearInterval(globalTimerInterval);
        globalTimerInterval = null;
        console.log('[TIMER] Глобальный тикер остановлен');
    }
}

// === Вычисление времени для сессий ===

function computeSessionWorkTime(session) {
    if (!session) return 0;

    const now = new Date();
    const endTime = session.endTime || now;
    const totalMillis = endTime - session.startTime;

    // Суммарное время завершённых пауз
    let pauseMillis = session.pauses.reduce((sum, pause) => {
        return sum + (pause.pauseEnd - pause.pauseStart);
    }, 0);

    // КРИТИЧЕСКИ ВАЖНО: Если сейчас идёт пауза, тоже вычитаем её из рабочего времени
    // Иначе рабочее время будет расти во время паузы!
    if (session.lastPauseStart && !session.endTime) {
        pauseMillis += (now.getTime() - session.lastPauseStart.getTime());
    }

    const workMillis = totalMillis - pauseMillis;
    return Math.max(0, workMillis);
}

function computeSessionPauseTime(session) {
    if (!session) return 0;

    // Суммарное время завершённых пауз
    let total = session.pauses.reduce((sum, pause) => {
        return sum + (pause.pauseEnd - pause.pauseStart);
    }, 0);

    // Если сейчас идёт пауза, добавляем её текущую длительность
    if (session.lastPauseStart) {
        total += (Date.now() - session.lastPauseStart.getTime());
    }

    return total;
}

function formatTimeMillis(millis) {
    const totalSeconds = Math.floor(millis / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// === Обновление таблицы активных работ ===

function updateActiveSessionsTable() {
    const tbody = document.getElementById('activeSessionsTable');
    if (!tbody) return;

    const allActive = getAllActiveSessions();

    if (allActive.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Нет активных работ</td></tr>';
        return;
    }

    tbody.innerHTML = allActive.map(({ masterName, orderName, session }) => {
        const workMillis = computeSessionWorkTime(session);
        const pauseMillis = computeSessionPauseTime(session);

        const workTimeStr = formatTimeMillis(workMillis);
        const pauseTimeStr = formatTimeMillis(pauseMillis);

        const isPaused = !!session.lastPauseStart;
        const statusText = isPaused ? '⏸️ На паузе' : '▶️ Работает';

        // Логи для отладки (каждую секунду только для изменений статуса)
        if (session._lastLoggedPause !== isPaused) {
            console.log('[TIMER_TICK]', masterName, orderName, {
                workMinutes: Math.round(workMillis / 60000),
                pauseMinutes: Math.round(pauseMillis / 60000),
                onPause: isPaused
            });
            session._lastLoggedPause = isPaused;
        }

        // Экранируем имена для безопасности
        const safeМasterName = masterName.replace(/'/g, "\\'");
        const safeOrderName = orderName.replace(/'/g, "\\'");

        return `
            <tr>
                <td>${masterName}</td>
                <td>${orderName}</td>
                <td>${workTimeStr}</td>
                <td>${pauseTimeStr}</td>
                <td>${statusText}</td>
                <td>
                    ${isPaused
                        ? `<button class="btn btn-success" onclick="handleResumeForSession('${safeМasterName}', '${safeOrderName}')">▶️ Продолжить</button>`
                        : `<button class="btn btn-warning" onclick="handlePauseForSession('${safeМasterName}', '${safeOrderName}')">⏸️ Пауза</button>`
                    }
                    <button class="btn btn-danger" onclick="handleStopForSession('${safeМasterName}', '${safeOrderName}')">⏹️ Стоп</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Старые функции таймера - теперь показывают данные выбранной сессии
function updateTimerDisplay() {
    const hoursEl = document.getElementById('timerHours');
    const minutesEl = document.getElementById('timerMinutes');
    const secondsEl = document.getElementById('timerSeconds');

    // Получаем выбранную сессию из UI
    const masterNameEl = document.getElementById('masterName');
    const trackingOrderEl = document.getElementById('trackingOrder');

    const masterName = masterNameEl ? masterNameEl.value.trim() : '';
    const orderName = trackingOrderEl && trackingOrderEl.value
        ? trackingOrderEl.options[trackingOrderEl.selectedIndex].text
        : '';

    if (masterName && orderName) {
        const session = getActiveSession(masterName, orderName);
        if (session) {
            const workMillis = computeSessionWorkTime(session);
            const totalSeconds = Math.floor(workMillis / 1000);

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
            if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
            if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');

            updatePauseTimeDisplay();
            return;
        }
    }

    // Сброс если нет активной сессии
    if (hoursEl) hoursEl.textContent = '00';
    if (minutesEl) minutesEl.textContent = '00';
    if (secondsEl) secondsEl.textContent = '00';
    updatePauseTimeDisplay();
}

// Обновляет отображение счётчика пауз для выбранной сессии
function updatePauseTimeDisplay() {
    const pauseTimeEl = document.getElementById('pauseTimeDisplay');
    if (!pauseTimeEl) return;

    // Получаем выбранную сессию из UI
    const masterNameEl = document.getElementById('masterName');
    const trackingOrderEl = document.getElementById('trackingOrder');

    const masterName = masterNameEl ? masterNameEl.value.trim() : '';
    const orderName = trackingOrderEl && trackingOrderEl.value
        ? trackingOrderEl.options[trackingOrderEl.selectedIndex].text
        : '';

    if (masterName && orderName) {
        const session = getActiveSession(masterName, orderName);
        if (session) {
            const pauseMillis = computeSessionPauseTime(session);
            const totalPauseSeconds = Math.floor(pauseMillis / 1000);

            const minutes = Math.floor(totalPauseSeconds / 60);
            const seconds = totalPauseSeconds % 60;

            pauseTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            return;
        }
    }

    // Сброс если нет активной сессии
    pauseTimeEl.textContent = '00:00';
}

function addManualTime() {
    const hoursEl = document.getElementById('manualHours');
    const minutesEl = document.getElementById('manualMinutes');
    const pauseMinutesEl = document.getElementById('manualPauseMinutes');
    const pauseReasonEl = document.getElementById('manualPauseReason');

    const hours = hoursEl ? parseInt(hoursEl.value) || 0 : 0;
    const minutes = minutesEl ? parseInt(minutesEl.value) || 0 : 0;
    const totalMinutes = hours * 60 + minutes;

    const pauseMinutes = pauseMinutesEl ? parseInt(pauseMinutesEl.value) || 0 : 0;
    const pauseReason = pauseReasonEl ? pauseReasonEl.value.trim() : '';

    if (totalMinutes > 0) {
        // Формируем массив пауз для ручного ввода
        let pausesArray = null;
        if (pauseMinutes > 0) {
            pausesArray = [{
                durationMinutes: pauseMinutes,
                reasonText: pauseReason
            }];
        }

        // Передаём данные о паузах как массив
        addWorkLogEntry(totalMinutes, null, null, null, pausesArray);

        // Очищаем поля
        if (hoursEl) hoursEl.value = 0;
        if (minutesEl) minutesEl.value = 0;
        if (pauseMinutesEl) pauseMinutesEl.value = 0;
        if (pauseReasonEl) pauseReasonEl.value = '';
    }
}

function addWorkLogEntry(minutes, masterNameParam, orderNameParam, orderIdParam, pausesParam, masterIdParam) {
    // Используем переданные параметры (из activeWorkSession) или читаем из UI
    let masterName, orderName, orderId, masterId;

    if (masterNameParam && orderNameParam) {
        // Данные переданы из activeWorkSession
        masterName = masterNameParam;
        orderName = orderNameParam;
        orderId = orderIdParam || '';
        masterId = masterIdParam || null;
    } else {
        // Читаем из UI (для ручного ввода времени)
        const workMasterSelect = document.getElementById('workMasterSelect');
        if (workMasterSelect && workMasterSelect.value) {
            const selectedOption = workMasterSelect.options[workMasterSelect.selectedIndex];
            masterId = selectedOption.dataset.masterId || null;
            masterName = selectedOption.dataset.masterName || selectedOption.text;
        } else {
            masterId = null;
            masterName = 'Не указан';
        }

        const orderSelect = document.getElementById('trackingOrder');
        orderId = orderSelect ? orderSelect.value : '';
        orderName = orderSelect && orderSelect.options[orderSelect.selectedIndex]
            ? orderSelect.options[orderSelect.selectedIndex].text
            : 'Не выбран';
    }

    const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        orderId,
        orderName,
        masterId,
        masterName,
        minutes
    };

    // Добавляем информацию о паузах
    // pausesParam может быть:
    // - массивом пауз от таймера [{pauseStart: Date, pauseEnd: Date, reasonText: string}]
    // - null/undefined
    if (pausesParam && Array.isArray(pausesParam) && pausesParam.length > 0) {
        // Преобразуем паузы в формат для сохранения
        entry.pauses = pausesParam.map(pause => {
            // Если это пауза от таймера (с pauseStart и pauseEnd)
            if (pause.pauseStart && pause.pauseEnd) {
                const durationMinutes = Math.round((pause.pauseEnd - pause.pauseStart) / 60000);
                return {
                    durationMinutes,
                    reasonText: pause.reasonText || ''
                };
            }
            // Если это уже готовая пауза (от ручного ввода с durationMinutes)
            return pause;
        });
    }

    state.workLog.push(entry);
    saveToStorage();
    updateWorkLogTable();

    // Синхронизация с Supabase (не блокирует UI)
    syncWorkLogEntryToSupabase(entry).catch(err => {
        console.error('[WORKLOG_SYNC] Unexpected error', err);
    });
}

function updateWorkLogTable() {
    const tbody = document.getElementById('workLogTable');
    if (!tbody) return;

    if (state.workLog.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Нет записей</td></tr>';
        return;
    }

    tbody.innerHTML = state.workLog.slice().reverse().map(entry => {
        // Логируем причины пауз в консоль
        if (entry.pauses && entry.pauses.length > 0) {
            console.log('[WORK_LOG_ENTRY]', entry.id, 'minutes:', entry.minutes, 'pauses:', entry.pauses);
        }

        return `
        <tr>
            <td>${formatDateTime(entry.timestamp)}</td>
            <td>${entry.orderName}</td>
            <td>${entry.masterName}</td>
            <td>${entry.minutes} мин</td>
            <td>
                <button class="btn btn-danger" onclick="deleteWorkLogEntry(${entry.id})">🗑️</button>
            </td>
        </tr>
        `;
    }).join('');
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

    const orderOptions = '<option value="">Выберите заказ</option>' +
        state.calculations.map(c => {
            // Показываем номер заказа + дату для лучшей идентификации
            const displayText = c.orderDate
                ? `${c.orderNumber} (${c.orderDate})`
                : c.orderNumber;
            return `<option value="${c.id}">${displayText}</option>`;
        }).join('');

    if (trackingOrder) {
        trackingOrder.innerHTML = orderOptions;
    }

    if (analysisOrder) {
        analysisOrder.innerHTML = '<option value="">Все заказы</option>' +
            state.calculations.map(c => `<option value="${c.id}">${c.orderNumber}</option>`).join('');

        // Обработчик изменения заказа в анализе
        analysisOrder.removeEventListener('change', updateAnalysis);
        analysisOrder.addEventListener('change', updateAnalysis);
    }
}

// === Фильтрация заказов по поисковому запросу ===
function filterTrackingOrders() {
    const searchInput = document.getElementById('trackingOrderSearch');
    const trackingOrder = document.getElementById('trackingOrder');

    if (!searchInput || !trackingOrder) return;

    const searchTerm = searchInput.value.toLowerCase().trim();
    const options = trackingOrder.querySelectorAll('option');

    options.forEach(option => {
        if (option.value === '') {
            // Оставляем опцию "Выберите заказ" всегда видимой
            option.style.display = '';
            return;
        }

        const orderText = option.textContent.toLowerCase();
        if (orderText.includes(searchTerm)) {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
    });

    console.log('[TRACKING] Фильтрация заказов по запросу:', searchTerm);
}

// === Вычисление фактического времени по заказу из журнала работ ===
function computeActualTimeForOrder(orderId, masterName = null) {
    console.log('[DEBUG] computeActualTimeForOrder вызвана с orderId:', orderId, 'masterName:', masterName);
    console.log('[DEBUG] Всего записей в журнале:', state.workLog.length);

    // Если orderId не задан (пустая строка или null), считаем по всем записям
    if (!orderId) {
        const totalMinutes = state.workLog.reduce((sum, entry) => {
            const matchesMaster = !masterName || entry.masterName === masterName;
            if (!matchesMaster) return sum;
            const minutes = entry.minutes || 0;
            console.log('[DEBUG] Запись без фильтра:', entry.orderName, 'мастер:', entry.masterName, 'минут:', minutes);
            return sum + minutes;
        }, 0);
        console.log('[DEBUG] Итого минут (все заказы):', totalMinutes);
        return totalMinutes;
    }

    // Фильтруем по заказу и мастеру, суммируем минуты
    const relevantEntries = state.workLog.filter(entry => {
        const matchesOrder = entry.orderId && entry.orderId === orderId;
        const matchesMaster = !masterName || entry.masterName === masterName;
        console.log('[DEBUG] Запись:', entry.orderName, 'orderId:', entry.orderId, 'мастер:', entry.masterName, 'matchesOrder:', matchesOrder, 'matchesMaster:', matchesMaster, 'минут:', entry.minutes);
        return matchesOrder && matchesMaster;
    });

    const totalMinutes = relevantEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0);

    console.log('[DEBUG] Найдено записей для заказа:', relevantEntries.length);
    console.log('[DEBUG] Итого минут:', totalMinutes);

    return totalMinutes;
}

// === Проверка настройки Supabase для анализа ===
function isSupabaseConfigured() {
    const supabaseUrl = localStorage.getItem('supabaseUrl') || '';
    const supabaseKey = localStorage.getItem('supabaseKey') || '';
    return !!(supabaseUrl && supabaseKey && supabase);
}

// === Загрузка данных анализа из Supabase ===
async function loadAnalysisDataFromSupabase(filters) {
    // filters: { dateFrom, dateTo, masterId, masterName, orderNumber }

    try {
        console.log('[ANALYSIS_SUPABASE] Загрузка данных с фильтрами:', filters);

        // Формируем запрос к order_execution с JOIN'ами
        let query = supabase
            .from('order_execution')
            .select(`
                id,
                order_id,
                master_id,
                fact_start_at,
                fact_end_at,
                status,
                orders (
                    id,
                    order_number,
                    theoretical_time_total_hours
                ),
                masters (
                    id,
                    name
                )
            `);

        // Применяем фильтры
        if (filters.dateFrom) {
            query = query.gte('fact_start_at', filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
            query = query.lte('fact_end_at', filters.dateTo.toISOString());
        }
        if (filters.masterId) {
            query = query.eq('master_id', filters.masterId);
        }

        const { data: executions, error: execError } = await query;
        if (execError) throw execError;

        console.log('[ANALYSIS_SUPABASE] Загружено записей order_execution:', executions.length);

        // Дополнительная фильтрация по имени мастера (если не по ID)
        let filteredExecutions = executions;

        if (filters.masterName && !filters.masterId) {
            // Локальный режим фильтрации по имени
            filteredExecutions = filteredExecutions.filter(exec =>
                exec.masters?.name === filters.masterName
            );
        }

        // Загружаем паузы для всех найденных execution
        const executionIds = filteredExecutions.map(e => e.id);
        let pausesMap = {};

        if (executionIds.length > 0) {
            const { data: pauses, error: pausesError } = await supabase
                .from('pauses')
                .select('order_execution_id, duration_min, reason')
                .in('order_execution_id', executionIds);

            if (pausesError) {
                console.warn('[ANALYSIS_SUPABASE] Ошибка загрузки пауз:', pausesError);
            } else {
                // Группируем паузы по order_execution_id
                pauses.forEach(pause => {
                    if (!pausesMap[pause.order_execution_id]) {
                        pausesMap[pause.order_execution_id] = [];
                    }
                    pausesMap[pause.order_execution_id].push(pause);
                });
            }
        }

        // Обрабатываем данные
        // 1. Агрегируем данные по заказам
        const ordersMap = {};

        filteredExecutions.forEach(exec => {
            const orderNumber = exec.orders?.order_number;
            if (!orderNumber) return;

            if (!ordersMap[orderNumber]) {
                ordersMap[orderNumber] = {
                    orderNumber: orderNumber,
                    theoryMinutes: (exec.orders.theoretical_time_total_hours || 0) * 60,
                    actualMinutes: 0,
                    pauseMinutes: 0
                };
            }

            // Вычисление фактического времени из интервала (fact_end_at - fact_start_at)
            let workMinutes = 0;
            if (exec.fact_start_at && exec.fact_end_at) {
                const start = new Date(exec.fact_start_at);
                const end = new Date(exec.fact_end_at);
                const durationMinutes = (end - start) / 60000;
                workMinutes = durationMinutes;
            }

            // Суммируем паузы для этого execution
            const execPauses = pausesMap[exec.id] || [];
            const pauseSum = execPauses.reduce((sum, p) => sum + (p.duration_min || 0), 0);

            ordersMap[orderNumber].actualMinutes += workMinutes;
            ordersMap[orderNumber].pauseMinutes += pauseSum;
        });

        // Формируем массив заказов (вычитаем паузы из факта)
        const ordersArray = Object.values(ordersMap).map(order => {
            const workMinutes = order.actualMinutes - order.pauseMinutes;
            const deviationPercent = order.theoryMinutes > 0
                ? ((workMinutes - order.theoryMinutes) / order.theoryMinutes * 100).toFixed(1)
                : 0;

            return {
                orderNumber: order.orderNumber,
                theoryMinutes: Math.round(order.theoryMinutes),
                actualMinutes: Math.round(workMinutes),
                deviationPercent: parseFloat(deviationPercent),
                status: getDeviationStatus(deviationPercent)
            };
        });

        // 2. Агрегируем данные по мастерам (УТОЧНЕНИЕ 2: с учетом фильтров)
        const mastersMap = {};

        filteredExecutions.forEach(exec => {
            const masterName = exec.masters?.name;
            const orderId = exec.order_id;
            if (!masterName) return;

            if (!mastersMap[masterName]) {
                mastersMap[masterName] = {
                    masterName: masterName,
                    totalWorkMinutes: 0,
                    totalPauseMinutes: 0,
                    entries: 0,
                    uniqueOrders: new Set()
                };
            }

            // Фактическое время
            let workMinutes = 0;
            if (exec.fact_start_at && exec.fact_end_at) {
                const start = new Date(exec.fact_start_at);
                const end = new Date(exec.fact_end_at);
                workMinutes = (end - start) / 60000;
            }

            // Паузы для этого execution
            const execPauses = pausesMap[exec.id] || [];
            const pauseMinutes = execPauses.reduce((sum, p) => sum + (p.duration_min || 0), 0);

            mastersMap[masterName].totalWorkMinutes += (workMinutes - pauseMinutes);
            mastersMap[masterName].totalPauseMinutes += pauseMinutes;
            mastersMap[masterName].entries += 1;

            if (orderId) {
                mastersMap[masterName].uniqueOrders.add(orderId);
            }
        });

        const mastersArray = Object.values(mastersMap).map(master => ({
            masterName: master.masterName,
            totalWorkMinutes: Math.round(master.totalWorkMinutes),
            totalPauseMinutes: Math.round(master.totalPauseMinutes),
            entries: master.entries,
            ordersCount: master.uniqueOrders.size
        }));

        console.log('[ANALYSIS_SUPABASE] Обработано:', {
            orders: ordersArray.length,
            masters: mastersArray.length
        });

        return {
            orders: ordersArray,
            mastersStats: mastersArray
        };

    } catch (error) {
        console.error('[ANALYSIS_SUPABASE] Ошибка загрузки данных:', error);
        return null;
    }
}

// === Загрузка списка мастеров для фильтра ===
async function loadMastersListFromSupabase(onlyActive = true) {
    if (!supabase) return [];

    try {
        let query = supabase
            .from('masters')
            .select('id, name, qualification_level, is_active, created_at')
            .order('name');

        // Фильтрация только активных, если требуется
        if (onlyActive) {
            query = query.eq('is_active', true);
        }

        const { data: masters, error } = await query;

        if (error) throw error;

        console.log('[MASTERS_SUPABASE] Загружено мастеров:', masters.length, onlyActive ? '(только активные)' : '(все)');
        return masters || [];
    } catch (error) {
        console.error('[MASTERS_SUPABASE] Ошибка загрузки списка мастеров:', error);
        return [];
    }
}

// === Заполнение выпадающего списка мастеров ===
async function populateMasterSelect() {
    const workMasterSelect = document.getElementById('workMasterSelect');
    if (!workMasterSelect) return;

    let masters = [];

    // Попытка загрузки из Supabase
    if (isSupabaseConfigured()) {
        console.log('[MASTERS] Загрузка мастеров из Supabase');
        masters = await loadMastersListFromSupabase();
    }

    // Fallback: извлечение из локального workLog
    if (masters.length === 0) {
        console.log('[MASTERS] Fallback: извлечение мастеров из локального workLog');
        const uniqueMasterNames = new Set();
        state.workLog.forEach(entry => {
            if (entry.masterName) {
                uniqueMasterNames.add(entry.masterName);
            }
        });

        if (uniqueMasterNames.size > 0) {
            // Если есть мастера в workLog, используем их
            masters = Array.from(uniqueMasterNames).sort((a, b) => a.localeCompare(b, 'ru')).map(name => ({
                id: null,
                name: name
            }));
        } else {
            // Если workLog пустой, используем начальных мастеров
            console.log('[MASTERS] WorkLog пустой, используем начальных мастеров');
            masters = [...DEFAULT_LOCAL_MASTERS];
        }
    }

    // Очистка и заполнение select
    workMasterSelect.innerHTML = '<option value="">Выберите мастера</option>';
    masters.forEach(master => {
        const option = document.createElement('option');
        option.value = master.id || master.name; // Если есть ID из Supabase, используем его, иначе имя
        option.dataset.masterId = master.id || '';
        option.dataset.masterName = master.name;
        option.textContent = master.name;
        workMasterSelect.appendChild(option);
    });

    console.log('[MASTERS] Загружено мастеров в select:', masters.length);
}

// === Загрузка журнала работ из Supabase с фильтрами ===
async function loadWorkLogFromSupabase(filters) {
    if (!supabase) return null;

    try {
        console.log('[WORKLOG_SUPABASE] Загрузка журнала работ с фильтрами:', filters);

        // Базовый запрос с JOIN к masters, orders, и pauses
        let query = supabase
            .from('order_execution')
            .select(`
                id,
                fact_start_at,
                fact_end_at,
                master_id,
                order_id,
                masters (id, name),
                orders (id, order_number),
                pauses (id, reason, duration_min)
            `)
            .order('fact_start_at', { ascending: false });

        // Применение фильтров
        if (filters.dateFrom) {
            query = query.gte('fact_start_at', filters.dateFrom);
        }
        if (filters.dateTo) {
            const dateToEnd = new Date(filters.dateTo);
            dateToEnd.setHours(23, 59, 59, 999);
            query = query.lte('fact_start_at', dateToEnd.toISOString());
        }
        if (filters.masterId) {
            query = query.eq('master_id', filters.masterId);
        }
        if (filters.orderId) {
            query = query.eq('order_id', filters.orderId);
        }

        const { data: executionRecords, error } = await query;

        if (error) throw error;

        console.log('[WORKLOG_SUPABASE] Получено записей:', executionRecords.length);

        // Преобразование в формат workLog entries
        const workLogEntries = executionRecords.map(record => {
            // Вычисление рабочего времени из интервала (fact_end_at - fact_start_at)
            let workMinutes = 0;
            if (record.fact_start_at && record.fact_end_at) {
                const start = new Date(record.fact_start_at);
                const end = new Date(record.fact_end_at);
                workMinutes = Math.round((end - start) / 60000);
            }

            // Подсчет пауз
            const pauseMinutes = (record.pauses || []).reduce((sum, p) => sum + (p.duration_min || 0), 0);
            const pauseReasons = (record.pauses || []).map(p => p.reason || 'Не указана').join('; ');

            return {
                id: record.id,
                timestamp: record.fact_start_at,
                masterId: record.master_id,
                masterName: record.masters?.name || 'Неизвестен',
                orderId: record.order_id,
                orderName: record.orders?.order_number || 'Не указан',
                minutes: workMinutes,
                pauseMinutes: pauseMinutes,
                pauseReasons: pauseReasons || '-',
                pauses: record.pauses || []
            };
        });

        return workLogEntries;

    } catch (error) {
        console.error('[WORKLOG_SUPABASE] Ошибка загрузки журнала работ:', error);
        return null;
    }
}

// === Отрисовка таблицы журнала работ ===
function renderWorkLogTable(workLogEntries) {
    const tbody = document.getElementById('workLogTableBody');
    if (!tbody) return;

    if (!workLogEntries || workLogEntries.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Нет данных</td></tr>';
        return;
    }

    tbody.innerHTML = workLogEntries.map(entry => {
        const datetime = formatDateTime(entry.timestamp);
        const pauseMinutes = entry.pauseMinutes || 0;
        const pauseReasons = entry.pauseReasons || '-';

        return `
            <tr>
                <td>${datetime}</td>
                <td>${entry.masterName}</td>
                <td>${entry.orderName}</td>
                <td>${entry.minutes}</td>
                <td>${pauseMinutes}</td>
                <td>${pauseReasons}</td>
            </tr>
        `;
    }).join('');

    console.log('[WORKLOG] Отрисовано записей:', workLogEntries.length);
}

// === Получение фильтров журнала работ ===
function getWorkLogFilters() {
    const dateFromEl = document.getElementById('workLogDateFrom');
    const dateToEl = document.getElementById('workLogDateTo');
    const masterSelectEl = document.getElementById('workLogMasterSelect');
    const orderSearchEl = document.getElementById('workLogOrderSearch');

    const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value).toISOString() : null;
    const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value + 'T23:59:59').toISOString() : null;
    const masterValue = masterSelectEl ? masterSelectEl.value : '';
    const orderNumber = orderSearchEl ? orderSearchEl.value.trim() : '';

    // Определяем, это ID мастера или имя (в Supabase режиме - ID, в локальном - имя)
    const isSupabaseMode = isSupabaseConfigured();
    const filters = {
        dateFrom,
        dateTo,
        masterId: isSupabaseMode && masterValue ? masterValue : null,
        masterName: !isSupabaseMode && masterValue ? masterValue : null,
        orderNumber: orderNumber || null,
        orderId: null // будет заполнено в updateWorkLog, если нужно
    };

    console.log('[WORKLOG] Фильтры:', filters);
    return filters;
}

// === Сброс фильтров журнала работ ===
function clearWorkLogFilters() {
    const dateFromEl = document.getElementById('workLogDateFrom');
    const dateToEl = document.getElementById('workLogDateTo');
    const masterSelectEl = document.getElementById('workLogMasterSelect');
    const orderSearchEl = document.getElementById('workLogOrderSearch');

    if (dateFromEl) dateFromEl.value = '';
    if (dateToEl) dateToEl.value = '';
    if (masterSelectEl) masterSelectEl.value = '';
    if (orderSearchEl) orderSearchEl.value = '';

    updateWorkLog();
}

// === Применение фильтров к локальному workLog ===
function applyFiltersToLocalWorkLog(filters) {
    let filtered = state.workLog.slice();

    // Фильтр по дате
    if (filters.dateFrom) {
        const dateFromTime = new Date(filters.dateFrom).getTime();
        filtered = filtered.filter(entry => {
            const entryTime = new Date(entry.timestamp).getTime();
            return entryTime >= dateFromTime;
        });
    }
    if (filters.dateTo) {
        const dateToTime = new Date(filters.dateTo).getTime();
        filtered = filtered.filter(entry => {
            const entryTime = new Date(entry.timestamp).getTime();
            return entryTime <= dateToTime;
        });
    }

    // Фильтр по мастеру (по имени в локальном режиме)
    if (filters.masterName) {
        filtered = filtered.filter(entry => entry.masterName === filters.masterName);
    }

    // Фильтр по номеру заказа
    if (filters.orderNumber) {
        const searchLower = filters.orderNumber.toLowerCase();
        filtered = filtered.filter(entry =>
            entry.orderName && entry.orderName.toLowerCase().includes(searchLower)
        );
    }

    // Сортировка по времени (новые первые)
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Преобразование в формат для renderWorkLogTable
    return filtered.map(entry => {
        const pauseMinutes = (entry.pauses || []).reduce((sum, p) => sum + (p.durationMinutes || 0), 0);
        const pauseReasons = (entry.pauses || []).map(p => p.reasonText || 'Не указана').join('; ');

        return {
            id: entry.id,
            timestamp: entry.timestamp,
            masterId: entry.masterId || null,
            masterName: entry.masterName || 'Не указан',
            orderId: entry.orderId || null,
            orderName: entry.orderName || 'Не указан',
            minutes: entry.minutes || 0,
            pauseMinutes: pauseMinutes,
            pauseReasons: pauseReasons || '-'
        };
    });
}

// === Заполнение выпадающего списка мастеров для фильтра журнала работ ===
async function populateWorkLogMasterSelect() {
    const masterSelect = document.getElementById('workLogMasterSelect');
    if (!masterSelect) return;

    masterSelect.innerHTML = '<option value="">Все мастера</option>';

    if (isSupabaseConfigured()) {
        // Supabase режим - загружаем из таблицы masters
        const masters = await loadMastersListFromSupabase();
        masters.forEach(master => {
            const option = document.createElement('option');
            option.value = master.id;
            option.textContent = master.name;
            masterSelect.appendChild(option);
        });
        console.log('[WORKLOG] Список мастеров загружен из Supabase:', masters.length);
    } else {
        // Локальный режим - из workLog
        const uniqueMasters = [...new Set(state.workLog.map(e => e.masterName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
        uniqueMasters.forEach(name => {
            const option = document.createElement('option');
            option.value = name; // В локальном режиме используем имя как значение
            option.textContent = name;
            masterSelect.appendChild(option);
        });
        console.log('[WORKLOG] Список мастеров загружен из workLog:', uniqueMasters.length);
    }
}

// === Инициализация фильтров журнала работ ===
async function initWorkLogFilters() {
    console.log('[WORKLOG] Инициализация фильтров');

    // Обработчик кнопки "Применить"
    const applyBtn = document.getElementById('workLogApplyFiltersButton');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            console.log('[WORKLOG] Применение фильтров');
            updateWorkLog();
        });
    }

    // Обработчик кнопки "Сбросить"
    const clearBtn = document.getElementById('workLogClearFiltersButton');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearWorkLogFilters);
    }

    // Заполнение списка мастеров
    await populateWorkLogMasterSelect();
}

// === Обновление журнала работ ===
async function updateWorkLog() {
    console.log('[WORKLOG] Начало updateWorkLog');

    let workLogEntries = [];
    let isSupabaseMode = false;

    // Проверяем, настроен ли Supabase
    if (isSupabaseConfigured()) {
        console.log('[WORKLOG] Supabase режим активен');
        isSupabaseMode = true;

        const filters = getWorkLogFilters();

        // Если задан номер заказа, ищем orderId
        if (filters.orderNumber) {
            try {
                const { data: orders, error } = await supabase
                    .from('orders')
                    .select('id')
                    .ilike('order_number', `%${filters.orderNumber}%`);

                if (!error && orders && orders.length > 0) {
                    filters.orderId = orders[0].id;
                }
            } catch (err) {
                console.error('[WORKLOG] Ошибка поиска orderId:', err);
            }
        }

        try {
            const supabaseData = await loadWorkLogFromSupabase(filters);
            if (supabaseData) {
                workLogEntries = supabaseData;
            } else {
                isSupabaseMode = false;
            }
        } catch (error) {
            console.error('[WORKLOG] Ошибка загрузки из Supabase:', error);
            isSupabaseMode = false;
        }
    }

    // Fallback: локальный режим
    if (!isSupabaseMode) {
        console.log('[WORKLOG] Локальный режим');
        const filters = getWorkLogFilters();
        workLogEntries = applyFiltersToLocalWorkLog(filters);
    }

    renderWorkLogTable(workLogEntries);
}

// === Построение данных анализа по заказам ===
function buildOrderAnalysisData(selectedOrderIdOrNull, filters = {}) {
    console.log('[ANALYSIS] buildOrderAnalysisData вызвана с orderId:', selectedOrderIdOrNull, 'filters:', filters);

    // Определяем, какие заказы нужно анализировать
    let ordersToAnalyze = [];
    if (selectedOrderIdOrNull) {
        const calc = state.calculations.find(c => c.id === parseInt(selectedOrderIdOrNull));
        if (calc) {
            ordersToAnalyze = [calc];
        }
    } else {
        ordersToAnalyze = state.calculations;
    }

    console.log('[ANALYSIS] Заказов для анализа:', ordersToAnalyze.length);

    // Формируем массив объектов с данными по каждому заказу
    const orderAnalysisArray = ordersToAnalyze.map(calc => {
        // Подсчет теоретического времени (сумма времени всех операций)
        const theoryMinutes = Object.values(calc.operations).reduce((sum, opData) => {
            return sum + (opData.time || 0);
        }, 0);

        // Подсчет фактического времени из журнала работ
        const actualMinutes = computeActualTimeForOrder(String(calc.id), filters.masterName);

        // Расчет отклонения
        const deviationPercent = theoryMinutes > 0
            ? ((actualMinutes - theoryMinutes) / theoryMinutes * 100).toFixed(1)
            : 0;

        // Определение статуса
        const status = getDeviationStatus(deviationPercent);

        console.log('[ANALYSIS] Заказ:', calc.orderNumber, {
            theoryMinutes: Math.round(theoryMinutes),
            actualMinutes: Math.round(actualMinutes),
            deviationPercent,
            status: status.text
        });

        // Формируем массив операций для заказа
        const operations = Object.entries(calc.operations).map(([opId, opData]) => {
            const operation = OPERATIONS.find(op => op.id === parseInt(opId));
            return {
                operationId: parseInt(opId),
                operationName: operation ? operation.name : 'Неизвестная операция',
                volume: opData.volume || 0,
                time: opData.time || 0,
                autoCost: opData.autoCost || 0,
                manualCost: opData.manualCost || 0,
                finalCost: opData.finalCost || 0,
                useManual: opData.useManual || false
            };
        });

        return {
            orderId: calc.id,
            orderNumber: calc.orderNumber,
            orderDate: calc.orderDate,
            theoryMinutes: Math.round(theoryMinutes),
            actualMinutes: Math.round(actualMinutes),
            deviationPercent: parseFloat(deviationPercent),
            status: status,
            operations: operations
        };
    });

    return orderAnalysisArray;
}

// === Состояние сортировки для таблицы мастеров ===
let mastersSortColumn = 'totalWorkMinutes'; // по умолчанию сортировка по рабочему времени
let mastersSortDirection = 'desc'; // по убыванию

// === Функция сортировки статистики мастеров ===
function sortMastersStats(mastersStats, column, direction) {
    return mastersStats.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        // Для колонки pauseShare вычисляем значение на лету
        if (column === 'pauseShare') {
            const aTotalTime = (a.totalWorkMinutes || 0) + (a.totalPauseMinutes || 0);
            const bTotalTime = (b.totalWorkMinutes || 0) + (b.totalPauseMinutes || 0);
            aVal = aTotalTime > 0 ? (a.totalPauseMinutes / aTotalTime * 100) : 0;
            bVal = bTotalTime > 0 ? (b.totalPauseMinutes / bTotalTime * 100) : 0;
        }

        // Сортировка для текста (с поддержкой кириллицы)
        if (column === 'masterName') {
            const comparison = (aVal || '').localeCompare(bVal || '', 'ru');
            return direction === 'asc' ? comparison : -comparison;
        }

        // Сортировка для чисел
        if (direction === 'asc') {
            return (aVal || 0) - (bVal || 0);
        } else {
            return (bVal || 0) - (aVal || 0);
        }
    });
}

// === Построение статистики по мастерам из журнала работ ===
// === Построение статистики по мастерам из журнала работ ===
function buildMasterStatsFromWorkLog(filters = {}) {
    console.log('[MASTERS_STATS] buildMasterStatsFromWorkLog вызвана с filters:', filters);

    // Берём копию журнала, чтобы не трогать оригинал
    let filteredWorkLog = state.workLog.slice();

    // 1) Фильтр по датам — по timestamp, а не по startTime
    if (filters.dateFrom) {
        const fromTime = filters.dateFrom instanceof Date
            ? filters.dateFrom.getTime()
            : new Date(filters.dateFrom).getTime();

        filteredWorkLog = filteredWorkLog.filter(entry => {
            if (!entry.timestamp) return false;
            const entryTime = new Date(entry.timestamp).getTime();
            return entryTime >= fromTime;
        });
    }

    if (filters.dateTo) {
        const toTime = filters.dateTo instanceof Date
            ? filters.dateTo.getTime()
            : new Date(filters.dateTo).getTime();

        filteredWorkLog = filteredWorkLog.filter(entry => {
            if (!entry.timestamp) return false;
            const entryTime = new Date(entry.timestamp).getTime();
            return entryTime <= toTime;
        });
    }

    // 2) Фильтр по заказу (selectedOrderId приходит из updateAnalysis)
    if (filters.selectedOrderId) {
        const selectedIdStr = String(filters.selectedOrderId);
        filteredWorkLog = filteredWorkLog.filter(entry =>
            entry.orderId && String(entry.orderId) === selectedIdStr
        );
    }

    // 3) Фильтр по мастеру (локальный режим — по имени)
    if (filters.masterName) {
        filteredWorkLog = filteredWorkLog.filter(entry =>
            entry.masterName === filters.masterName
        );
    }

    console.log('[MASTERS_STATS] После применения фильтров записей:', filteredWorkLog.length);

    // 4) Группировка по мастерам
    const masterStatsMap = {};

    filteredWorkLog.forEach(entry => {
        const masterName = entry.masterName || 'Не указан';
        const minutes = parseFloat(entry.minutes) || 0;

        // Считаем время пауз из массива entry.pauses
        let pauseMinutes = 0;
        if (entry.pauses && Array.isArray(entry.pauses)) {
            pauseMinutes = entry.pauses.reduce((sum, pause) => {
                return sum + (parseFloat(pause.durationMinutes) || 0);
            }, 0);
        }

        if (!masterStatsMap[masterName]) {
            masterStatsMap[masterName] = {
                master: masterName,
                totalWorkMinutes: 0,
                totalPauseMinutes: 0,
                entries: 0,
                uniqueOrders: new Set()
            };
        }

        masterStatsMap[masterName].totalWorkMinutes += minutes;
        masterStatsMap[masterName].totalPauseMinutes += pauseMinutes;
        masterStatsMap[masterName].entries += 1;

        if (entry.orderId) {
            masterStatsMap[masterName].uniqueOrders.add(entry.orderId);
        }
    });

    // 5) Преобразуем в массив
    const masterStatsArray = Object.values(masterStatsMap).map(stats => ({
        masterName: stats.master,
        totalWorkMinutes: Math.round(stats.totalWorkMinutes),
        totalPauseMinutes: Math.round(stats.totalPauseMinutes),
        entries: stats.entries,
        ordersCount: stats.uniqueOrders.size
    }));

    // Сортировка по убыванию общего рабочего времени
    masterStatsArray.sort((a, b) => b.totalWorkMinutes - a.totalWorkMinutes);

    return masterStatsArray;
}


// === Рендер статистики по мастерам в DOM ===
function renderMastersStats(mastersStats) {
    const section = document.getElementById('mastersStatsSection');
    const table = document.getElementById('mastersStatsTable');
    const tbody = table ? table.querySelector('tbody') : null;
    const empty = document.getElementById('mastersStatsEmpty');
    const masterFilter = document.getElementById('masterFilter');

    if (!section || !table || !tbody || !empty) {
        console.warn('[MASTERS_STATS] DOM elements not found');
        return;
    }

    // Очистить старые строки
    tbody.innerHTML = '';

    if (!mastersStats || mastersStats.length === 0) {
        // Показать «нет данных»
        empty.style.display = 'block';
        table.style.display = 'none';
        return;
    }

    // Скрыть сообщение "нет данных", показать таблицу
    empty.style.display = 'none';
    table.style.display = '';

    // Заполняем фильтр уникальными именами мастеров
    if (masterFilter) {
        const currentFilter = masterFilter.value; // Сохраняем текущий выбор
        const uniqueMasters = [...new Set(mastersStats.map(m => m.masterName))].sort((a, b) => a.localeCompare(b, 'ru'));

        masterFilter.innerHTML = '<option value="">Все мастера</option>';
        uniqueMasters.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            masterFilter.appendChild(option);
        });

        // Восстанавливаем выбор
        masterFilter.value = currentFilter;

        // Добавляем обработчик изменения фильтра (один раз)
        const clone = masterFilter.cloneNode(true);
        masterFilter.parentNode.replaceChild(clone, masterFilter);

        const newFilter = document.getElementById('masterFilter');
        if (newFilter) {
            newFilter.value = currentFilter;
            newFilter.addEventListener('change', () => {
                const masterStats = buildMasterStatsFromWorkLog();
                renderMastersStats(masterStats);
            });
        }
    }

    // Применяем фильтр
    let filteredStats = mastersStats;
    const filterValue = masterFilter ? masterFilter.value : '';
    if (filterValue) {
        filteredStats = mastersStats.filter(stat => stat.masterName === filterValue);
    }

    // Применяем сортировку к отфильтрованным данным
    const sortedStats = sortMastersStats([...filteredStats], mastersSortColumn, mastersSortDirection);

    // Обновляем индикаторы сортировки в заголовках
    const headers = table.querySelectorAll('th.sortable');
    headers.forEach(th => {
        th.classList.remove('asc', 'desc');
        if (th.dataset.column === mastersSortColumn) {
            th.classList.add(mastersSortDirection);
        }
    });

    // Добавляем обработчики клика на заголовки (один раз)
    headers.forEach(th => {
        // Удаляем старые обработчики, если есть
        const clone = th.cloneNode(true);
        th.parentNode.replaceChild(clone, th);
    });

    // Добавляем новые обработчики
    table.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;

            // Если кликнули на ту же колонку — меняем направление
            if (mastersSortColumn === column) {
                mastersSortDirection = mastersSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                // Новая колонка — сортируем по убыванию для чисел, по возрастанию для текста
                mastersSortColumn = column;
                mastersSortDirection = th.dataset.sort === 'text' ? 'asc' : 'desc';
            }

            // Пересчитываем и рендерим заново
            const masterStats = buildMasterStatsFromWorkLog();
            renderMastersStats(masterStats);
        });
    });

    // Генерируем строки таблицы
    sortedStats.forEach(item => {
        const tr = document.createElement('tr');

        // 1. Мастер
        const tdMaster = document.createElement('td');
        tdMaster.textContent = item.masterName ?? 'Не указан';

        // 2. Заказов
        const tdOrders = document.createElement('td');
        tdOrders.textContent = item.ordersCount ?? 0;

        // 3. Записей
        const tdEntries = document.createElement('td');
        tdEntries.textContent = item.entries ?? 0;

        // 4. Рабочее время (мин)
        const tdWork = document.createElement('td');
        tdWork.textContent = item.totalWorkMinutes ?? 0;

        // 5. Время пауз (мин)
        const tdPause = document.createElement('td');
        tdPause.textContent = item.totalPauseMinutes ?? 0;

        // 6. Доля пауз (%)
        const tdPauseShare = document.createElement('td');
        const totalTime = (item.totalWorkMinutes || 0) + (item.totalPauseMinutes || 0);
        const pauseSharePercent = totalTime > 0
            ? ((item.totalPauseMinutes || 0) / totalTime * 100).toFixed(1)
            : '0.0';
        tdPauseShare.textContent = pauseSharePercent + '%';

        // Цветовая индикация строки по доле пауз
        const pauseShareValue = parseFloat(pauseSharePercent);
        if (pauseShareValue > 40) {
            tr.classList.add('pause-danger');
        } else if (pauseShareValue > 20) {
            tr.classList.add('pause-warning');
        }

        // Обработчик клика на строку — открывает детализацию
        tr.style.cursor = 'pointer';
        tr.title = `Кликните чтобы увидеть историю работ мастера "${item.masterName}"`;
        tr.addEventListener('click', () => {
            showMasterDetails(item.masterName);
        });

        tr.appendChild(tdMaster);
        tr.appendChild(tdOrders);
        tr.appendChild(tdEntries);
        tr.appendChild(tdWork);
        tr.appendChild(tdPause);
        tr.appendChild(tdPauseShare);

        tbody.appendChild(tr);
    });
}

// === Детализация по мастеру ===
function showMasterDetails(masterName) {
    const modal = document.getElementById('masterDetailsModal');
    const title = document.getElementById('masterDetailsTitle');
    const summary = document.getElementById('masterDetailsSummary');
    const tbody = document.getElementById('masterDetailsTable');

    if (!modal || !title || !summary || !tbody) {
        console.warn('[MASTER_DETAILS] DOM elements not found');
        return;
    }

    // Фильтруем workLog по мастеру
    const masterEntries = state.workLog.filter(entry => entry.masterName === masterName);

    if (masterEntries.length === 0) {
        alert(`Нет записей для мастера "${masterName}"`);
        return;
    }

    // Вычисляем статистику
    const totalWorkMinutes = masterEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
    const totalPauseMinutes = masterEntries.reduce((sum, e) => {
        if (e.pauses && Array.isArray(e.pauses)) {
            return sum + e.pauses.reduce((pSum, p) => pSum + (p.durationMinutes || 0), 0);
        }
        return sum;
    }, 0);
    const uniqueOrders = new Set(masterEntries.map(e => e.orderId || e.orderName)).size;

    // Заголовок
    title.textContent = `История работ: ${masterName}`;

    // Сводка
    summary.innerHTML = `
        <strong>Всего записей:</strong> ${masterEntries.length} |
        <strong>Уникальных заказов:</strong> ${uniqueOrders} |
        <strong>Рабочее время:</strong> ${totalWorkMinutes} мин |
        <strong>Время пауз:</strong> ${totalPauseMinutes} мин
    `;

    // Таблица записей
    tbody.innerHTML = '';
    masterEntries.slice().reverse().forEach(entry => {
        const tr = document.createElement('tr');

        // Дата/время
        const tdDateTime = document.createElement('td');
        tdDateTime.textContent = formatDateTime(entry.timestamp);

        // Заказ
        const tdOrder = document.createElement('td');
        tdOrder.textContent = entry.orderName || 'Не указан';

        // Время работы
        const tdWork = document.createElement('td');
        tdWork.textContent = entry.minutes || 0;

        // Время пауз
        const tdPause = document.createElement('td');
        const pauseMinutes = entry.pauses && Array.isArray(entry.pauses)
            ? entry.pauses.reduce((sum, p) => sum + (p.durationMinutes || 0), 0)
            : 0;
        tdPause.textContent = pauseMinutes;

        // Причины пауз
        const tdReasons = document.createElement('td');
        if (entry.pauses && entry.pauses.length > 0) {
            const reasons = entry.pauses.map(p => `${p.reasonText || 'Не указана'} (${p.durationMinutes} мин)`).join(', ');
            tdReasons.textContent = reasons;
        } else {
            tdReasons.textContent = '—';
        }

        tr.appendChild(tdDateTime);
        tr.appendChild(tdOrder);
        tr.appendChild(tdWork);
        tr.appendChild(tdPause);
        tr.appendChild(tdReasons);

        tbody.appendChild(tr);
    });

    // Открываем модальное окно
    modal.classList.add('active');
}

function closeMasterDetailsModal() {
    const modal = document.getElementById('masterDetailsModal');
    if (modal) modal.classList.remove('active');
}

// === Вспомогательные функции для фильтров анализа ===

// Получение значений фильтров из UI
function getAnalysisFilters() {
    const dateFromEl = document.getElementById('analysisDateFrom');
    const dateToEl = document.getElementById('analysisDateTo');
    const masterSelectEl = document.getElementById('analysisMasterSelect');

    const dateFrom = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
    const dateTo = dateToEl && dateToEl.value ? new Date(dateToEl.value + 'T23:59:59') : null;
    const masterValue = masterSelectEl ? masterSelectEl.value : '';

    // Определяем, это ID мастера или имя (в Supabase режиме - ID, в локальном - имя)
    const isSupabaseMode = isSupabaseConfigured();
    const filters = {
        dateFrom,
        dateTo,
        masterId: isSupabaseMode && masterValue ? masterValue : null,
        masterName: !isSupabaseMode && masterValue ? masterValue : null
    };

    console.log('[ANALYSIS] Фильтры:', filters);
    return filters;
}

// Сброс фильтров
function clearAnalysisFilters() {
    const dateFromEl = document.getElementById('analysisDateFrom');
    const dateToEl = document.getElementById('analysisDateTo');
    const masterSelectEl = document.getElementById('analysisMasterSelect');

    if (dateFromEl) dateFromEl.value = '';
    if (dateToEl) dateToEl.value = '';
    if (masterSelectEl) masterSelectEl.value = '';

    updateAnalysis();
}

// Инициализация фильтров анализа
async function initAnalysisFilters() {
    console.log('[ANALYSIS] Инициализация фильтров');

    // Обработчик кнопки "Применить"
    const applyBtn = document.getElementById('analysisApplyFiltersButton');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            console.log('[ANALYSIS] Применение фильтров');
            updateAnalysis();
        });
    }

    // Обработчик кнопки "Сбросить"
    const clearBtn = document.getElementById('analysisClearFiltersButton');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAnalysisFilters);
    }

    // Заполнение списка мастеров
    await populateMastersFilter();
}

// Заполнение выпадающего списка мастеров для фильтра
async function populateMastersFilter() {
    const masterSelect = document.getElementById('analysisMasterSelect');
    if (!masterSelect) return;

    masterSelect.innerHTML = '<option value="">Все мастера</option>';

    if (isSupabaseConfigured()) {
        // Supabase режим - загружаем из таблицы masters
        const masters = await loadMastersListFromSupabase();
        masters.forEach(master => {
            const option = document.createElement('option');
            option.value = master.id;
            option.textContent = master.name;
            masterSelect.appendChild(option);
        });
        console.log('[ANALYSIS] Список мастеров загружен из Supabase:', masters.length);
    } else {
        // Локальный режим - из workLog
        const uniqueMasters = [...new Set(state.workLog.map(e => e.masterName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
        uniqueMasters.forEach(name => {
            const option = document.createElement('option');
            option.value = name; // В локальном режиме используем имя как значение
            option.textContent = name;
            masterSelect.appendChild(option);
        });
        console.log('[ANALYSIS] Список мастеров загружен из workLog:', uniqueMasters.length);
    }
}

// ========================================
// === АДМИН-ПАНЕЛЬ МАСТЕРОВ ===
// ========================================

// === Глобальное состояние админ-панели ===
let adminMastersList = [];

// === Инициализация админ-панели ===
async function initAdminPanel() {
    console.log('[ADMIN] Инициализация админ-панели');

    // Проверка Supabase
    if (!isSupabaseConfigured()) {
        console.log('[ADMIN] Supabase не настроен, показываем предупреждение');
        document.getElementById('adminNoSupabaseWarning').style.display = 'block';
        document.getElementById('adminMastersSection').style.display = 'none';
        return;
    }

    // Supabase настроен - показываем секцию мастеров
    document.getElementById('adminNoSupabaseWarning').style.display = 'none';
    document.getElementById('adminMastersSection').style.display = 'block';

    // Загрузка списка мастеров
    await loadAdminMasters();

    // Инициализация обработчиков событий
    initAdminEventHandlers();

    // Инициализация секции ставок
    await initAdminRates();
}

// === Инициализация обработчиков событий ===
function initAdminEventHandlers() {
    // Кнопка "Добавить мастера"
    const addBtn = document.getElementById('adminAddMasterBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showAdminMasterForm();
        });
    }

    // Форма мастера - отправка
    const masterForm = document.getElementById('adminMasterForm');
    if (masterForm) {
        masterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveAdminMaster();
        });
    }

    // Форма мастера - отмена
    const cancelBtn = document.getElementById('adminMasterFormCancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideAdminMasterForm();
        });
    }
}

// === Загрузка списка мастеров для админки ===
async function loadAdminMasters() {
    try {
        console.log('[ADMIN] Загрузка всех мастеров');
        adminMastersList = await loadMastersListFromSupabase(false); // false = загружаем всех, не только активных
        renderAdminMastersTable();
    } catch (error) {
        console.error('[ADMIN] Ошибка загрузки мастеров:', error);
        alert('Ошибка загрузки списка мастеров');
    }
}

// === Рендер таблицы мастеров ===
function renderAdminMastersTable() {
    const tbody = document.getElementById('adminMastersTable');
    if (!tbody) return;

    if (adminMastersList.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Нет мастеров</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminMastersList.forEach(master => {
        const row = document.createElement('tr');
        if (!master.is_active) {
            row.style.backgroundColor = '#f0f0f0';
            row.style.opacity = '0.7';
        }

        const createdDate = master.created_at
            ? new Date(master.created_at).toLocaleDateString('ru-RU')
            : '-';

        // Создаем ячейки
        const nameCell = document.createElement('td');
        nameCell.textContent = master.name;

        const qualCell = document.createElement('td');
        qualCell.textContent = master.qualification_level || 1;

        const statusCell = document.createElement('td');
        const statusSpan = document.createElement('span');
        statusSpan.style.color = master.is_active ? 'green' : 'gray';
        statusSpan.textContent = master.is_active ? '✓ Активен' : '✗ Неактивен';
        statusCell.appendChild(statusSpan);

        const dateCell = document.createElement('td');
        dateCell.textContent = createdDate;

        const actionsCell = document.createElement('td');

        // Кнопка редактирования
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.textContent = '✏️ Редактировать';
        editBtn.dataset.masterId = master.id;
        editBtn.addEventListener('click', () => {
            editAdminMaster(master.id);
        });

        // Кнопка активации/деактивации
        const toggleBtn = document.createElement('button');
        toggleBtn.className = `btn ${master.is_active ? 'btn-warning' : 'btn-success'} btn-small`;
        toggleBtn.textContent = master.is_active ? '⏸️ Деактивировать' : '▶️ Активировать';
        toggleBtn.dataset.masterId = master.id;
        toggleBtn.addEventListener('click', () => {
            toggleAdminMasterStatus(master.id);
        });

        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(document.createTextNode(' ')); // Пробел между кнопками
        actionsCell.appendChild(toggleBtn);

        // Добавляем все ячейки в строку
        row.appendChild(nameCell);
        row.appendChild(qualCell);
        row.appendChild(statusCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });
}

// === Показать форму добавления/редактирования мастера ===
function showAdminMasterForm(master = null) {
    const formCard = document.getElementById('adminMasterFormCard');
    const formTitle = document.getElementById('adminMasterFormTitle');
    const form = document.getElementById('adminMasterForm');

    if (master) {
        // Режим редактирования
        formTitle.textContent = 'Редактировать мастера';
        document.getElementById('adminMasterId').value = master.id;
        document.getElementById('adminMasterName').value = master.name;
        document.getElementById('adminMasterQualification').value = master.qualification_level || 1;
        document.getElementById('adminMasterIsActive').checked = master.is_active;
    } else {
        // Режим добавления
        formTitle.textContent = 'Добавить мастера';
        form.reset();
        document.getElementById('adminMasterId').value = '';
        document.getElementById('adminMasterQualification').value = 1;
        document.getElementById('adminMasterIsActive').checked = true;
    }

    formCard.style.display = 'block';
    formCard.scrollIntoView({ behavior: 'smooth' });
}

// === Скрыть форму ===
function hideAdminMasterForm() {
    const formCard = document.getElementById('adminMasterFormCard');
    formCard.style.display = 'none';
}

// === Сохранение мастера (создание или обновление) ===
async function saveAdminMaster() {
    const masterId = document.getElementById('adminMasterId').value;
    const name = document.getElementById('adminMasterName').value.trim();
    const qualificationLevel = parseInt(document.getElementById('adminMasterQualification').value);
    const isActive = document.getElementById('adminMasterIsActive').checked;

    if (!name) {
        alert('Введите имя мастера');
        return;
    }

    if (qualificationLevel < 1 || isNaN(qualificationLevel)) {
        alert('Уровень квалификации должен быть целым числом >= 1');
        return;
    }

    try {
        if (masterId) {
            // Обновление существующего мастера
            console.log('[ADMIN] Обновление мастера:', masterId);
            const { error } = await supabase
                .from('masters')
                .update({
                    name: name,
                    qualification_level: qualificationLevel,
                    is_active: isActive
                })
                .eq('id', masterId)
                .select();

            if (error) throw error;
            console.log('[ADMIN] Мастер обновлён');
        } else {
            // Создание нового мастера
            console.log('[ADMIN] Создание нового мастера');
            const { error } = await supabase
                .from('masters')
                .insert([{
                    name: name,
                    qualification_level: qualificationLevel,
                    is_active: isActive
                }]);

            if (error) throw error;
            console.log('[ADMIN] Мастер создан');
        }

        // Перезагрузка списка мастеров
        await loadAdminMasters();

        // Обновление селектов мастеров в других вкладках
        await refreshAllMasterSelects();

        // Скрытие формы
        hideAdminMasterForm();

        alert('Мастер успешно сохранён');
    } catch (error) {
        console.error('[ADMIN] Ошибка сохранения мастера:', error);
        alert(`Ошибка сохранения мастера: ${error.message}`);
    }
}

// === Редактирование мастера ===
function editAdminMaster(masterId) {
    const master = adminMastersList.find(m => m.id === masterId);
    if (master) {
        showAdminMasterForm(master);
    }
}

// === Переключение статуса активности мастера ===
async function toggleAdminMasterStatus(masterId) {
    const master = adminMastersList.find(m => m.id === masterId);
    if (!master) return;

    const newStatus = !master.is_active;
    const action = newStatus ? 'активировать' : 'деактивировать';

    if (!confirm(`Вы уверены, что хотите ${action} мастера "${master.name}"?`)) {
        return;
    }

    try {
        console.log(`[ADMIN] Изменение статуса мастера ${masterId} на ${newStatus}`);
        const { error } = await supabase
            .from('masters')
            .update({ is_active: newStatus })
            .eq('id', masterId)
            .select();

        if (error) throw error;

        // Перезагрузка списка мастеров
        await loadAdminMasters();

        // Обновление селектов мастеров в других вкладках
        await refreshAllMasterSelects();

        console.log('[ADMIN] Статус мастера изменён');
    } catch (error) {
        console.error('[ADMIN] Ошибка изменения статуса мастера:', error);
        alert(`Ошибка изменения статуса: ${error.message}`);
    }
}

// === Обновление всех селектов мастеров ===
async function refreshAllMasterSelects() {
    console.log('[ADMIN] Обновление всех селектов мастеров');
    await populateMasterSelect();
    await populateWorkLogMasterSelect();
    await populateMastersFilter();
}

// ========================================
// === УПРАВЛЕНИЕ СТАВКАМИ ===
// ========================================

// === Глобальное состояние ставок ===
let adminRatesList = [];

// === Инициализация секции ставок ===
async function initAdminRates() {
    console.log('[ADMIN_RATES] Инициализация секции ставок');

    // Загрузка списка ставок
    await loadAdminRates();

    // Инициализация обработчиков событий
    initAdminRatesEventHandlers();
}

// === Инициализация обработчиков событий для ставок ===
function initAdminRatesEventHandlers() {
    // Кнопка "Добавить ставку"
    const addBtn = document.getElementById('adminAddRateBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            showAdminRateForm();
        });
    }

    // Форма ставки - отправка
    const rateForm = document.getElementById('adminRateForm');
    if (rateForm) {
        rateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveAdminRate();
        });
    }

    // Форма ставки - отмена
    const cancelBtn = document.getElementById('adminRateFormCancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideAdminRateForm();
        });
    }
}

// === Загрузка списка ставок ===
async function loadAdminRates() {
    if (!supabase) {
        console.warn('[ADMIN_RATES] Supabase не настроен');
        return;
    }

    try {
        console.log('[ADMIN_RATES] Загрузка ставок');
        const { data: rates, error } = await supabase
            .from('hourly_rates')
            .select('*')
            .order('rate_value', { ascending: false });

        if (error) throw error;

        adminRatesList = rates || [];
        renderAdminRatesTable();
    } catch (error) {
        console.error('[ADMIN_RATES] Ошибка загрузки ставок:', error);
        alert('Ошибка загрузки списка ставок');
    }
}

// === Рендер таблицы ставок ===
function renderAdminRatesTable() {
    const tbody = document.getElementById('adminRatesTable');
    if (!tbody) return;

    if (adminRatesList.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4">Нет ставок</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminRatesList.forEach((rate, index) => {
        const row = document.createElement('tr');

        // Порядковый номер вместо UUID
        const nameCell = document.createElement('td');
        nameCell.textContent = `#${index + 1}`;

        // Стоимость
        const valueCell = document.createElement('td');
        valueCell.textContent = `${rate.rate_value} ₽/час`;

        // По умолчанию
        const defaultCell = document.createElement('td');
        const defaultSpan = document.createElement('span');
        defaultSpan.style.color = rate.is_default ? 'green' : 'gray';
        defaultSpan.textContent = rate.is_default ? '✓ Да' : '—';
        defaultCell.appendChild(defaultSpan);

        // Действия
        const actionsCell = document.createElement('td');

        // Кнопка редактирования
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-small';
        editBtn.textContent = '✏️ Редактировать';
        editBtn.addEventListener('click', () => {
            editAdminRate(rate.id);
        });

        // Кнопка "Сделать по умолчанию" (только если не дефолтная)
        if (!rate.is_default) {
            const setDefaultBtn = document.createElement('button');
            setDefaultBtn.className = 'btn btn-success btn-small';
            setDefaultBtn.textContent = '⭐ По умолчанию';
            setDefaultBtn.addEventListener('click', () => {
                setDefaultRate(rate.id);
            });
            actionsCell.appendChild(setDefaultBtn);
            actionsCell.appendChild(document.createTextNode(' '));
        }

        actionsCell.appendChild(editBtn);

        // Добавляем все ячейки в строку
        row.appendChild(nameCell);
        row.appendChild(valueCell);
        row.appendChild(defaultCell);
        row.appendChild(actionsCell);

        tbody.appendChild(row);
    });
}

// === Показать форму добавления/редактирования ставки ===
function showAdminRateForm(rate = null) {
    const formCard = document.getElementById('adminRateFormCard');
    const formTitle = document.getElementById('adminRateFormTitle');
    const form = document.getElementById('adminRateForm');

    if (rate) {
        // Режим редактирования
        formTitle.textContent = 'Редактировать ставку';
        document.getElementById('adminRateId').value = rate.id;
        document.getElementById('adminRateValue').value = rate.rate_value || 0;
        document.getElementById('adminRateIsDefault').checked = rate.is_default || false;
    } else {
        // Режим добавления
        formTitle.textContent = 'Добавить ставку';
        form.reset();
        document.getElementById('adminRateId').value = '';
        document.getElementById('adminRateIsDefault').checked = false;
    }

    formCard.style.display = 'block';
    formCard.scrollIntoView({ behavior: 'smooth' });
}

// === Скрыть форму ставки ===
function hideAdminRateForm() {
    const formCard = document.getElementById('adminRateFormCard');
    formCard.style.display = 'none';
}

// === Сохранение ставки (создание или обновление) ===
async function saveAdminRate() {
    const rateId = document.getElementById('adminRateId').value;
    const rateValue = parseFloat(document.getElementById('adminRateValue').value);
    const isDefault = document.getElementById('adminRateIsDefault').checked;

    if (rateValue <= 0 || isNaN(rateValue)) {
        alert('Стоимость должна быть положительным числом');
        return;
    }

    try {
        // Если устанавливаем новую дефолтную ставку, снимаем флаг у других
        if (isDefault) {
            const { error: updateError } = await supabase
                .from('hourly_rates')
                .update({ is_default: false })
                .neq('id', rateId || 0)
                .select();

            if (updateError) throw updateError;
        }

        if (rateId) {
            // Обновление существующей ставки
            console.log('[ADMIN_RATES] Обновление ставки:', rateId);
            const { error } = await supabase
                .from('hourly_rates')
                .update({
                    rate_value: rateValue,
                    is_default: isDefault
                })
                .eq('id', rateId)
                .select();

            if (error) throw error;
            console.log('[ADMIN_RATES] Ставка обновлена');
        } else {
            // Создание новой ставки
            console.log('[ADMIN_RATES] Создание новой ставки');
            const { error } = await supabase
                .from('hourly_rates')
                .insert([{
                    rate_value: rateValue,
                    is_default: isDefault
                }]);

            if (error) throw error;
            console.log('[ADMIN_RATES] Ставка создана');
        }

        // Перезагрузка списка ставок
        await loadAdminRates();

        // Обновление отображения текущей ставки
        if (isDefault) {
            await updateCurrentRateDisplay();
        }

        // Скрытие формы
        hideAdminRateForm();

        alert('Ставка успешно сохранена');
    } catch (error) {
        console.error('[ADMIN_RATES] Ошибка сохранения ставки:', error);
        alert(`Ошибка сохранения ставки: ${error.message}`);
    }
}

// === Редактирование ставки ===
function editAdminRate(rateId) {
    const rate = adminRatesList.find(r => r.id === rateId);
    if (rate) {
        showAdminRateForm(rate);
    }
}

// === Установить ставку по умолчанию ===
async function setDefaultRate(rateId) {
    try {
        console.log(`[ADMIN_RATES] Установка ставки ${rateId} как дефолтной`);

        // Снимаем флаг у всех ставок
        const { error: updateError } = await supabase
            .from('hourly_rates')
            .update({ is_default: false })
            .neq('id', 0)
            .select();

        if (updateError) throw updateError;

        // Устанавливаем флаг для выбранной ставки
        const { error } = await supabase
            .from('hourly_rates')
            .update({ is_default: true })
            .eq('id', rateId)
            .select();

        if (error) throw error;

        // Перезагрузка списка ставок
        await loadAdminRates();

        // Обновление отображения текущей ставки
        await updateCurrentRateDisplay();

        console.log('[ADMIN_RATES] Дефолтная ставка изменена');
    } catch (error) {
        console.error('[ADMIN_RATES] Ошибка изменения дефолтной ставки:', error);
        alert(`Ошибка изменения дефолтной ставки: ${error.message}`);
    }
}

// === Обновление отображения текущей ставки на всех вкладках ===
async function updateCurrentRateDisplay() {
    console.log('[ADMIN_RATES] Обновление отображения текущей ставки');

    // Загружаем актуальную ставку
    currentHourlyRate = await loadDefaultHourlyRate();
    state.currentRate = currentHourlyRate;

    // Обновляем UI
    const currentRateEl = document.getElementById('currentRate');
    if (currentRateEl) {
        currentRateEl.textContent = state.currentRate;
    }

    console.log('[ADMIN_RATES] Текущая ставка обновлена:', currentHourlyRate);
}

// ========================================
// === КОНЕЦ УПРАВЛЕНИЯ СТАВКАМИ ===
// ========================================

// ========================================
// === КОНЕЦ АДМИН-ПАНЕЛИ МАСТЕРОВ ===
// ========================================

// === Рендер таблицы анализа заказов ===
function renderOrderAnalysisTable(orderAnalysisData) {
    // Подсчет общих итогов
    const totalTheory = orderAnalysisData.reduce((sum, order) => sum + order.theoryMinutes, 0);
    const totalFact = orderAnalysisData.reduce((sum, order) => sum + order.actualMinutes, 0);
    const totalDeviation = totalTheory > 0
        ? ((totalFact - totalTheory) / totalTheory * 100).toFixed(1)
        : 0;

    // Обновление сводки
    const theoryTimeEl = document.getElementById('analysisTheoryTime');
    if (theoryTimeEl) theoryTimeEl.textContent = `${totalTheory} мин`;

    const factTimeEl = document.getElementById('analysisFactTime');
    if (factTimeEl) factTimeEl.textContent = `${totalFact} мин`;

    const deviationEl = document.getElementById('analysisDeviation');
    if (deviationEl) {
        deviationEl.textContent = `${totalDeviation > 0 ? '+' : ''}${totalDeviation}%`;
        deviationEl.className = 'analysis-value ' + getDeviationClass(totalDeviation);
    }

    // Таблица по заказам
    const tbody = document.getElementById('analysisTable');
    if (!tbody) return;

    if (orderAnalysisData.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Нет данных для анализа</td></tr>';
        return;
    }

    const rows = orderAnalysisData.map(order => {
        return `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${order.theoryMinutes}</td>
                <td>${order.actualMinutes}</td>
                <td class="${getDeviationClass(order.deviationPercent)}">${order.deviationPercent > 0 ? '+' : ''}${order.deviationPercent}%</td>
                <td><span class="status ${order.status.class}">${order.status.text}</span></td>
            </tr>
        `;
    });

    tbody.innerHTML = rows.join('');
}

// === Анализ ===
async function updateAnalysis() {
    console.log('[ANALYSIS] Начало updateAnalysis');

    let orderAnalysisData = [];
    let masterStats = [];
    let isSupabaseMode = false;

    // Проверяем, настроен ли Supabase
    if (isSupabaseConfigured()) {
        console.log('[ANALYSIS] Supabase режим активен');
        isSupabaseMode = true;

        // Собираем фильтры из UI
        const filters = getAnalysisFilters();

        // Загружаем данные из Supabase
        try {
            const supabaseData = await loadAnalysisDataFromSupabase(filters);

            if (supabaseData) {
                orderAnalysisData = supabaseData.orders;
                masterStats = supabaseData.mastersStats;
                console.log('[ANALYSIS] Данные загружены из Supabase:', {
                    orders: orderAnalysisData.length,
                    masters: masterStats.length
                });
            } else {
                console.warn('[ANALYSIS] Ошибка загрузки из Supabase, fallback на локальный режим');
                isSupabaseMode = false;
            }
        } catch (error) {
            console.error('[ANALYSIS] Ошибка в Supabase режиме:', error);
            isSupabaseMode = false;
        }
    }

    // Локальный режим (fallback)
        // Локальный режим (fallback)
    if (!isSupabaseMode) {
        console.log('[ANALYSIS] Локальный режим анализа');
        const filters = getAnalysisFilters();
        const selectedOrderId = document.getElementById('analysisOrder')?.value || '';

        // ВАЖНО: пробрасываем выбранный заказ в фильтры для статистики мастеров
        filters.selectedOrderId = selectedOrderId || null;

        orderAnalysisData = buildOrderAnalysisData(selectedOrderId, filters);
        masterStats = buildMasterStatsFromWorkLog(filters);
    }


    // Рендер таблицы заказов
    renderOrderAnalysisTable(orderAnalysisData);

    // Рендер статистики мастеров
    console.log('[MASTERS_STATS]', masterStats);
    renderMastersStats(masterStats);
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
    const closeBtn = document.getElementById('closeModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const modal = document.getElementById('loadModal');
            if (modal) modal.classList.remove('active');
        });
    }

    const modal = document.getElementById('loadModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'loadModal') {
                modal.classList.remove('active');
            }
        });
    }

    // Обработчики для модального окна детализации мастера
    const closeMasterDetailsBtn = document.getElementById('closeMasterDetailsModal');
    if (closeMasterDetailsBtn) {
        closeMasterDetailsBtn.addEventListener('click', closeMasterDetailsModal);
    }

    const masterDetailsModal = document.getElementById('masterDetailsModal');
    if (masterDetailsModal) {
        masterDetailsModal.addEventListener('click', (e) => {
            if (e.target.id === 'masterDetailsModal') {
                closeMasterDetailsModal();
            }
        });
    }
}

// === Экспорт/Импорт ===
function initExportImport() {
    const exportJSONBtn = document.getElementById('exportJSON');
    const exportCSVBtn = document.getElementById('exportCSV');
    const importDataBtn = document.getElementById('importData');
    const importFileInput = document.getElementById('importFile');
    const clearLogBtn = document.getElementById('clearWorkLog');

    if (exportJSONBtn) exportJSONBtn.addEventListener('click', exportJSON);
    if (exportCSVBtn) exportCSVBtn.addEventListener('click', exportCSV);
    if (importDataBtn) {
        importDataBtn.addEventListener('click', () => {
            if (importFileInput) importFileInput.click();
        });
    }
    if (importFileInput) importFileInput.addEventListener('change', importData);
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            if (confirm('Очистить весь журнал работ?')) {
                state.workLog = [];
                saveToStorage();
                updateWorkLogTable();
                updateAnalysis();
            }
        });
    }
}

// Экспорт JSON с данными анализа заказов (для глубокой аналитики, включая операции)
function exportJSON() {
    // Получаем данные анализа по всем заказам
    const orderAnalysisData = buildOrderAnalysisData(null);

    // Получаем статистику по мастерам
    const masterStats = buildMasterStatsFromWorkLog();

    // Формируем структуру экспорта
    const data = {
        generatedAt: new Date().toISOString(),
        orders: orderAnalysisData.map(order => ({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            theoryMinutes: order.theoryMinutes,
            actualMinutes: order.actualMinutes,
            deviationPercent: order.deviationPercent,
            status: order.status.text,
            operations: order.operations
        })),
        mastersStats: masterStats.map(stat => {
            const totalTime = stat.totalWorkMinutes + stat.totalPauseMinutes;
            const pauseSharePercent = totalTime > 0
                ? ((stat.totalPauseMinutes / totalTime) * 100).toFixed(1)
                : '0.0';
            return {
                masterName: stat.masterName,
                ordersCount: stat.ordersCount,
                entries: stat.entries,
                totalWorkMinutes: stat.totalWorkMinutes,
                totalPauseMinutes: stat.totalPauseMinutes,
                pauseSharePercent: pauseSharePercent
            };
        })
    };

    downloadFile(JSON.stringify(data, null, 2), 'countertop-analysis.json', 'application/json');
}

function exportCSV() {
    // Экспорт расчетов
    let csv = 'Номер заказа;Дата;Общее время (мин);Итоговая стоимость (руб)\n';
    state.calculations.forEach(calc => {
        csv += `${calc.orderNumber};${calc.orderDate};${calc.totalTime};${calc.totalFinalCost}\n`;
    });

    csv += '\nЖурнал работ\n';
    csv += 'Дата/Время;Заказ;Мастер;Время (мин)\n';
    state.workLog.forEach(entry => {
        csv += `${formatDateTime(entry.timestamp)};${entry.orderName};${entry.masterName};${entry.minutes}\n`;
    });

    // Экспорт статистики по мастерам
    const masterStats = buildMasterStatsFromWorkLog();
    csv += '\nСтатистика по мастерам\n';
    csv += 'Мастер;Заказов;Записей;Рабочее время (мин);Время пауз (мин);Доля пауз (%)\n';
    masterStats.forEach(stat => {
        const totalTime = stat.totalWorkMinutes + stat.totalPauseMinutes;
        const pauseShare = totalTime > 0 ? ((stat.totalPauseMinutes / totalTime) * 100).toFixed(1) : '0.0';
        csv += `${stat.masterName};${stat.ordersCount};${stat.entries};${stat.totalWorkMinutes};${stat.totalPauseMinutes};${pauseShare}\n`;
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
