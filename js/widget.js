/**
 * widget.js — калькулятор орієнтовної вартості подорожі Via Europe (сторінка planner.html).
 *
 * Формула (усі суми в євро, за людину):
 *   добова вартість = (база країни + сума інтересів) × сезонний коефіцієнт
 *   ціна            = людей × днів × добова вартість
 *
 * Результат оновлюється автоматично при зміні будь-якого параметра (події input / change).
 * Бюджет не змінює ціну: він лише порівнюється з нею («У межах бюджету» / «Перевищує бюджет»).
 *
 * Захист від Edge Cases (Defensive Programming), три рівні:
 *   1. HTML5: type, min, max, step, required (у розмітці), min/max для дати виставляє цей скрипт.
 *   2. JavaScript: перевірка NaN, Infinity, порожніх, від'ємних, дробових і надмірно великих значень,
 *      невідомих значень списків; фінальна перевірка результату перед показом.
 *   3. Безпечне виведення: увесь текст вставляється через textContent, без innerHTML.
 *
 * Код ізольовано в IIFE, тому глобальні змінні не конфліктують з іншими скриптами сторінки.
 * Для перевірки з консолі браузера доступний window.ViaTripCalculator.
 */

(function () {
    'use strict';

    /* =========================================================
       1. Тарифи та правила (навчальні значення, не реальні ціни)
       ========================================================= */

    // Базова добова вартість країни за людину: житло, їжа, місцевий транспорт
    const COUNTRY_BASE = {
        portugal: 70,
        greece: 75,
        spain: 80,
        germany: 90,
        italy: 95,
        france: 105
    };

    // Додаток до добової вартості за кожен вибраний інтерес
    const INTEREST_ADD = {
        culture: 8,
        nature: 6,
        food: 12,
        sea: 10,
        night: 14,
        shop: 5
    };

    // Сезонний коефіцієнт у відсотках (цілі числа, щоб уникнути похибок дробів)
    const SEASON_LOW = { percent: 90, label: 'низький' };      // листопад–березень
    const SEASON_MID = { percent: 100, label: 'середній' };    // квітень–червень, вересень–жовтень
    const SEASON_HIGH = { percent: 120, label: 'високий' };    // липень–серпень
    const SEASON_NONE = { percent: 100, label: null };         // дату не вказано

    // Ліміт бюджету на одну людину за всю подорож (Infinity = без обмежень)
    const BUDGET_LIMIT = {
        eco: 800,
        mid: 1500,
        comfort: 3000,
        free: Infinity
    };

    // Допустимі діапазони введення
    const DAYS_MIN = 1;
    const DAYS_MAX = 365;
    const PEOPLE_MIN = 1;
    const PEOPLE_MAX = 100;
    const MAX_YEARS_AHEAD = 2;

    /* =========================================================
       2. Допоміжні функції
       ========================================================= */

    /** Перевіряє, що ключ справді належить об'єкту (захист від значень на кшталт «toString»). */
    const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

    /** Форматує число як «1 400 €». */
    function formatEuro(value) {
        return new Intl.NumberFormat('uk-UA').format(value) + '\u00A0€';
    }

    /** Повертає сезон за номером місяця (1–12). Без місяця — сезон не застосовується. */
    function getSeason(month) {
        if (!Number.isInteger(month) || month < 1 || month > 12) {
            return SEASON_NONE;
        }
        if (month === 7 || month === 8) {
            return SEASON_HIGH;
        }
        if (month >= 11 || month <= 3) {
            return SEASON_LOW;
        }
        return SEASON_MID;
    }

    /** Дата у форматі РРРР-ММ-ДД (локальний час). */
    function toIsoDate(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    /** Розбирає рядок РРРР-ММ-ДД; повертає null, якщо дата неіснуюча (наприклад, 2026-02-31). */
    function parseIsoDate(value) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) {
            return null;
        }
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        const isReal = check.getUTCFullYear() === year
            && check.getUTCMonth() === month - 1
            && check.getUTCDate() === day;
        return isReal ? { year, month, day } : null;
    }

    /* =========================================================
       3. Розрахунок (чиста функція без роботи з DOM)
       ========================================================= */

    /**
     * Рахує вартість подорожі.
     * @param {Object} params { country, days, people, interests: string[], month?: 1–12 }
     * @returns {Object|null} { total, perPerson, perDay, exactPerPerson, season } або null, якщо дані некоректні
     */
    function calculate(params) {
        const { country, days, people, interests = [], month = null } = params || {};

        // Страховка: навіть якщо виклик обійшов перевірку форми, неправильні дані дають null, а не NaN
        if (!has(COUNTRY_BASE, country)) return null;
        if (!Number.isInteger(days) || days < DAYS_MIN || days > DAYS_MAX) return null;
        if (!Number.isInteger(people) || people < PEOPLE_MIN || people > PEOPLE_MAX) return null;

        // Сума додатків за інтереси: невідомі значення та повтори ігноруємо
        const knownInterests = [...new Set(Array.isArray(interests) ? interests : [])]
            .filter((key) => has(INTEREST_ADD, key));
        const interestsSum = knownInterests.reduce((sum, key) => sum + INTEREST_ADD[key], 0);

        const season = getSeason(month);

        // Рахуємо в цілих числах: ×100 прибирає похибки дробів (наприклад, 0,9 або 1,2)
        const perDayScaled = (COUNTRY_BASE[country] + interestsSum) * season.percent;
        const totalScaled = people * days * perDayScaled;

        const total = Math.round(totalScaled / 100);
        const exactPerPerson = totalScaled / (100 * people);
        const result = {
            total,
            perPerson: Math.round(exactPerPerson),
            perDay: Math.round(perDayScaled / 100),
            exactPerPerson,
            season
        };

        // Остання лінія захисту: на екран не потрапляють NaN, Infinity та від'ємні суми
        if (![result.total, result.perPerson, result.perDay].every((n) => Number.isFinite(n) && n >= 0)) {
            return null;
        }
        return result;
    }

    /* =========================================================
       4. Перевірка полів (повертають { ok, empty?, value?, message? }, інтерфейс не змінюють)
       ========================================================= */

    /** Перевіряє ціле число в діапазоні: порожнє, нечислове, дробове, поза діапазоном. */
    function validateInteger(input, min, max, messages) {
        const raw = input.value.trim();

        if (raw === '') {
            // Порожнє значення в полі type="number" буває і при введенні нечислового тексту
            return input.validity && input.validity.badInput
                ? { ok: false, message: messages.range }
                : { ok: false, empty: true, message: messages.empty };
        }

        const number = Number(raw);
        if (!Number.isFinite(number)) {
            return { ok: false, message: messages.range };
        }
        if (!Number.isInteger(number)) {
            return { ok: false, message: messages.integer };
        }
        if (number < min || number > max) {
            return { ok: false, message: messages.range };
        }
        return { ok: true, value: number };
    }

    /** Перевіряє дату початку: необов'язкова, але якщо вказана, то не в минулому й не далі ніж за 2 роки. */
    function validateDate(input) {
        const raw = input.value;

        if (raw === '') {
            // Порожнє значення: або поле не заповнене (це дозволено), або дата введена не повністю
            return input.validity && input.validity.badInput
                ? { ok: false, message: 'Вкажіть коректну дату.' }
                : { ok: true, empty: true };
        }

        const parsed = parseIsoDate(raw);
        if (!parsed) {
            return { ok: false, message: 'Вкажіть коректну дату.' };
        }

        const today = new Date();
        const maxDate = new Date(today.getFullYear() + MAX_YEARS_AHEAD, today.getMonth(), today.getDate());
        if (raw < toIsoDate(today)) {
            return { ok: false, message: 'Оберіть дату не раніше сьогоднішньої.' };
        }
        if (raw > toIsoDate(maxDate)) {
            return { ok: false, message: 'Оберіть дату не пізніше ніж через 2 роки.' };
        }
        return { ok: true, value: parsed };
    }

    /* =========================================================
       5. Інтерфейс: стани полів (ті самі набори класів, що в destinations-picker.js)
       ========================================================= */

    const STATE_CLASSES = {
        normal: ['border-border', 'bg-white', 'focus-visible:outline-primary'],
        error: ['border-red-500', 'bg-white', 'focus-visible:outline-red-500'],
        success: ['border-muted/40', 'bg-secondary', 'focus-visible:outline-primary']
    };

    function setFieldState(input, state) {
        Object.values(STATE_CLASSES).forEach((classes) => input.classList.remove(...classes));
        input.classList.add(...STATE_CLASSES[state]);
    }

    /** Показує стан поля: звичайний, помилка (рамка й текст під полем) або правильне значення. */
    function showFieldState(field, state, message) {
        setFieldState(field.input, state);
        field.error.classList.toggle('hidden', state !== 'error');
        if (state === 'error') {
            field.error.textContent = message; // textContent — безпечне виведення
        }
        field.input.setAttribute('aria-invalid', String(state === 'error'));
    }

    /* =========================================================
       6. Ініціалізація віджета
       ========================================================= */

    function init() {
        const byId = (id) => document.getElementById(id);

        const daysInput = byId('days');
        const peopleInput = byId('people');
        const startInput = byId('start');
        const countryHidden = document.querySelector('input[name="destination"]');
        const budgetHidden = document.querySelector('input[name="budget"]');

        const ui = {
            total: byId('trip-total'),
            hint: byId('trip-hint'),
            details: byId('trip-details'),
            perPerson: byId('trip-per-person'),
            perDay: byId('trip-per-day'),
            budgetStatus: byId('trip-budget-status'),
            seasonNote: byId('trip-season-note')
        };

        const daysError = byId('days-error');
        const peopleError = byId('people-error');
        const startError = byId('start-error');

        // Захист: якщо потрібного елемента немає, віджет не запускається, а сторінка продовжує працювати
        const required = [daysInput, peopleInput, startInput, countryHidden, budgetHidden,
            daysError, peopleError, startError, ...Object.values(ui)];
        if (required.some((element) => !element)) {
            console.warn('Калькулятор: не знайдено частину елементів розмітки, віджет вимкнено.');
            return;
        }

        // Поля, що перевіряються з показом помилок під ними
        const fields = [
            {
                input: daysInput,
                error: daysError,
                validate: () => validateInteger(daysInput, DAYS_MIN, DAYS_MAX, {
                    empty: 'Вкажіть кількість днів.',
                    range: `Введіть кількість днів від ${DAYS_MIN} до ${DAYS_MAX}.`,
                    integer: 'Кількість днів має бути цілим числом.'
                })
            },
            {
                input: peopleInput,
                error: peopleError,
                validate: () => validateInteger(peopleInput, PEOPLE_MIN, PEOPLE_MAX, {
                    empty: 'Вкажіть кількість мандрівників.',
                    range: `Введіть кількість мандрівників від ${PEOPLE_MIN} до ${PEOPLE_MAX}.`,
                    integer: 'Кількість мандрівників має бути цілим числом.'
                })
            },
            { input: startInput, error: startError, validate: () => validateDate(startInput) }
        ];

        // Поля, з якими користувач уже попрацював (вийшов із них): для них показуємо й «порожньо» як помилку
        const touched = new Set();

        // Дата: обмежуємо вибір у календарі (перший рівень захисту)
        function updateDateLimits() {
            const today = new Date();
            startInput.min = toIsoDate(today);
            startInput.max = toIsoDate(new Date(today.getFullYear() + MAX_YEARS_AHEAD, today.getMonth(), today.getDate()));
        }
        updateDateLimits();

        /** Оновлює вигляд одного поля за результатом перевірки. */
        function refreshField(field) {
            const result = field.validate();
            if (result.ok) {
                showFieldState(field, result.empty ? 'normal' : 'success');
            } else if (result.empty && !touched.has(field.input)) {
                // Поле стерли, але з нього ще не вийшли: помилку поки не показуємо
                showFieldState(field, 'normal');
            } else {
                showFieldState(field, 'error', result.message);
            }
        }

        /* ---------- Показ результату ---------- */

        const HINT_NORMAL = 'text-text-light';
        const HINT_ERROR = 'text-red-300';
        const STATUS_WITHIN = ['bg-green-100', 'text-green-800'];
        const STATUS_OVER = ['bg-amber-100', 'text-amber-800'];

        function setHint(text, isError) {
            ui.hint.textContent = text;
            ui.hint.classList.toggle(HINT_ERROR, isError);
            ui.hint.classList.toggle(HINT_NORMAL, !isError);
            ui.hint.classList.remove('hidden');
        }

        /** Показує порожній стан: прочерк і підказку, інші блоки приховані. */
        function showEmpty(hintText, isError) {
            ui.total.textContent = '—';
            setHint(hintText, isError);
            ui.details.classList.add('hidden');
            ui.details.classList.remove('flex');
            ui.budgetStatus.classList.add('hidden');
            ui.seasonNote.classList.add('hidden');
        }

        /** Рахує та показує результат за поточним станом форми. */
        function render() {
            const results = fields.map((field) => ({ field, result: field.validate() }));
            const [daysResult, peopleResult, dateResult] = results.map((item) => item.result);

            // 1. Є проблема в одному з полів: ціну не показуємо
            const failed = results.filter((item) => !item.result.ok);
            if (failed.length) {
                // Червоне повідомлення лише тоді, коли помилку вже видно під полем;
                // якщо поле просто стерли й з нього ще не вийшли, підказка нейтральна
                const errorVisible = failed.some(({ field, result }) => !result.empty || touched.has(field.input));
                showEmpty(
                    errorVisible
                        ? 'Виправте виділені поля, щоб побачити розрахунок.'
                        : 'Заповніть порожні поля, щоб побачити розрахунок.',
                    errorVisible
                );
                return;
            }

            // 2. Країну не обрано або в приховане поле потрапило невідоме значення
            const country = countryHidden.value;
            if (country === '') {
                showEmpty('Оберіть країну, щоб побачити орієнтовну вартість.', false);
                return;
            }
            if (!has(COUNTRY_BASE, country)) {
                showEmpty('Оберіть країну зі списку.', true);
                return;
            }

            // 3. Інтереси: беремо вибрані чекбокси (невідомі значення відсіює calculate)
            const interests = [...document.querySelectorAll('input[name="interests"]:checked')]
                .map((checkbox) => checkbox.value);

            // 4. Місяць початку (якщо дату вказано)
            const month = dateResult.value ? dateResult.value.month : null;

            const result = calculate({
                country,
                days: daysResult.value,
                people: peopleResult.value,
                interests,
                month
            });

            if (!result) {
                // Не повинно траплятися, але якщо сталося, показуємо зрозуміле повідомлення, а не NaN
                showEmpty('Не вдалося обчислити вартість. Перевірте параметри.', true);
                return;
            }

            // 5. Показуємо суми
            ui.total.textContent = formatEuro(result.total);
            ui.perPerson.textContent = formatEuro(result.perPerson);
            ui.perDay.textContent = formatEuro(result.perDay);
            ui.hint.classList.add('hidden');
            ui.details.classList.remove('hidden');
            ui.details.classList.add('flex');

            // 6. Порівняння з бюджетом (невідоме значення списку трактуємо як «без обмежень»)
            const limit = has(BUDGET_LIMIT, budgetHidden.value) ? BUDGET_LIMIT[budgetHidden.value] : Infinity;
            ui.budgetStatus.classList.remove(...STATUS_WITHIN, ...STATUS_OVER);
            if (Number.isFinite(limit)) {
                const within = result.exactPerPerson <= limit;
                ui.budgetStatus.textContent = `${within ? 'У межах бюджету' : 'Перевищує бюджет'} (до ${formatEuro(limit)} на людину)`;
                ui.budgetStatus.classList.add(...(within ? STATUS_WITHIN : STATUS_OVER));
                ui.budgetStatus.classList.remove('hidden');
            } else {
                ui.budgetStatus.classList.add('hidden');
            }

            // 7. Примітка про сезон
            if (result.season.label) {
                const factor = (result.season.percent / 100).toFixed(2).replace('.', ',');
                ui.seasonNote.textContent = `Сезон: ${result.season.label} (коефіцієнт ${factor}).`;
            } else {
                ui.seasonNote.textContent = 'Дату не вказано, сезонний коефіцієнт не застосовано.';
            }
            ui.seasonNote.classList.remove('hidden');
        }

        /* ---------- Події ---------- */

        // Перерахунок не частіше одного разу на кадр: швидке введення не навантажує сторінку
        let renderScheduled = false;
        function scheduleRender() {
            if (renderScheduled) {
                return;
            }
            renderScheduled = true;
            requestAnimationFrame(() => {
                renderScheduled = false;
                render();
            });
        }

        fields.forEach((field) => {
            // input — миттєва реакція під час введення; change — для календаря й підстраховки
            field.input.addEventListener('input', () => {
                refreshField(field);
                scheduleRender();
            });
            field.input.addEventListener('change', () => {
                refreshField(field);
                scheduleRender();
            });
            field.input.addEventListener('blur', () => {
                touched.add(field.input);
                refreshField(field);
                scheduleRender();
            });
        });

        // Країна, бюджет (приховані поля) та інтереси (чекбокси) повідомляють про зміну подією change
        const form = daysInput.closest('form');
        if (form) {
            form.addEventListener('change', (event) => {
                const target = event.target;
                if (target === countryHidden || target === budgetHidden || target.name === 'interests') {
                    scheduleRender();
                }
            });
            // Форма не повинна перезавантажувати сторінку (наприклад, при натисканні Enter)
            form.addEventListener('submit', (event) => event.preventDefault());
        }

        // Початковий розрахунок: значення за замовчуванням (7 днів, 2 особи) вже коректні
        render();
    }

    // Доступ для перевірки з консолі браузера, наприклад:
    // ViaTripCalculator.calculate({ country: 'spain', days: 7, people: 2, interests: ['culture', 'food'] })
    window.ViaTripCalculator = { calculate, getSeason };

    document.addEventListener('DOMContentLoaded', init);
}());