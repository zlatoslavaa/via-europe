/**
 * destinations-picker.js — вибір країни та міста у формі планера Via Europe.
 *
 * Що робить:
 *  1. Поле «Країна» — поле з підказками під час введення (наприклад, «ф» → «Франція»).
 *  2. Поле «Місто» — недоступне, доки не обрано країну; після вибору країни
 *     показує лише міста цієї країни. Зміна країни скидає вибране місто.
 *  3. Для кожного поля є приховане значення (name="destination" та name="city"),
 *     і при його зміні подається подія change — на неї реагує калькулятор (js/widget.js).
 *
 * Бібліотеки не використовуються (Vanilla JS).
 */

(function () {
    'use strict';

    /* =========================================================
       1. Дані: країни та їхні міста (невелика «база даних» у вигляді таблиці)
       ========================================================= */

    const DESTINATIONS = [
        { value: 'italy', label: 'Італія', cities: [
            { value: 'rome', label: 'Рим' },
            { value: 'florence', label: 'Флоренція' },
            { value: 'venice', label: 'Венеція' },
            { value: 'milan', label: 'Мілан' }
        ] },
        { value: 'france', label: 'Франція', cities: [
            { value: 'paris', label: 'Париж' },
            { value: 'nice', label: 'Ніцца' },
            { value: 'lyon', label: 'Ліон' },
            { value: 'marseille', label: 'Марсель' }
        ] },
        { value: 'spain', label: 'Іспанія', cities: [
            { value: 'barcelona', label: 'Барселона' },
            { value: 'madrid', label: 'Мадрид' },
            { value: 'seville', label: 'Севілья' },
            { value: 'valencia', label: 'Валенсія' }
        ] },
        { value: 'greece', label: 'Греція', cities: [
            { value: 'athens', label: 'Афіни' },
            { value: 'thessaloniki', label: 'Салоніки' },
            { value: 'santorini', label: 'Санторіні' },
            { value: 'heraklion', label: 'Іракліон' }
        ] },
        { value: 'portugal', label: 'Португалія', cities: [
            { value: 'lisbon', label: 'Лісабон' },
            { value: 'porto', label: 'Порту' },
            { value: 'faro', label: 'Фару' },
            { value: 'sintra', label: 'Сінтра' }
        ] },
        { value: 'germany', label: 'Німеччина', cities: [
            { value: 'berlin', label: 'Берлін' },
            { value: 'munich', label: 'Мюнхен' },
            { value: 'hamburg', label: 'Гамбург' },
            { value: 'cologne', label: 'Кельн' }
        ] }
    ];

    /* =========================================================
       2. Tailwind-класи станів поля
       - normal  — звичайний стан
       - error   — помилка: червона рамка
       - success — правильне значення: рамка й заливка стають трохи темнішими
                   (спокійний акцент, без зміни стилістики сайту)
       Набори замінюють один одного, щоб кольори рамок не конфліктували.
       ========================================================= */

    const STATE_CLASSES = {
        normal: ['border-border', 'bg-white', 'focus-visible:outline-primary'],
        error: ['border-red-500', 'bg-white', 'focus-visible:outline-red-500'],
        success: ['border-muted/40', 'bg-secondary', 'focus-visible:outline-primary']
    };

    // Класи пунктів випадного списку
    const OPTION_CLASS = 'cursor-pointer rounded-lg px-3 py-2.5 text-sm text-primary hover:bg-secondary aria-selected:bg-secondary aria-selected:font-semibold';
    const EMPTY_CLASS = 'rounded-lg px-3 py-2.5 text-sm text-muted';

    /** Застосовує набір класів стану ('normal' | 'error' | 'success') до поля. */
    function setFieldState(input, state) {
        Object.values(STATE_CLASSES).forEach((classes) => input.classList.remove(...classes));
        input.classList.add(...STATE_CLASSES[state]);
    }

    /* =========================================================
       3. Універсальний combobox: поле + список підказок
       ========================================================= */

    /**
     * @param {HTMLElement} root — контейнер [data-combobox]
     * @param {Object} config
     *   getOptions() — повертає поточні варіанти [{ value, label }]
     *   errorEl      — елемент із текстом помилки
     *   hintEl       — (необов'язково) підказка, яка видима, поки поле вимкнене
     *   emptyText    — текст, коли нічого не знайдено
     *   onChange(o)  — викликається після зміни вибору (o = вибраний варіант або null)
     */
    function createCombobox(root, config) {
        const input = root.querySelector('[data-combobox-input]');
        const hidden = root.querySelector('[data-combobox-value]');
        const list = root.querySelector('[role="listbox"]');
        const toggle = root.querySelector('[data-combobox-toggle]');

        let options = [];       // усі варіанти поля
        let visible = [];       // варіанти, що відповідають введеному тексту
        let activeIndex = -1;   // підсвічений пункт (для керування стрілками)
        let selected = null;    // вибраний варіант

        // Порівнюємо без урахування регістру та зайвих пробілів
        const norm = (text) => text.trim().toLocaleLowerCase('uk');

        /** Спочатку назви, що починаються з введених літер, потім ті, що їх містять. */
        function filterOptions(query) {
            const q = norm(query);
            if (!q) {
                return options.slice();
            }
            const starts = [];
            const contains = [];
            options.forEach((option) => {
                const label = norm(option.label);
                if (label.startsWith(q)) {
                    starts.push(option);
                } else if (label.includes(q)) {
                    contains.push(option);
                }
            });
            return starts.concat(contains);
        }

        /** Показує стан поля й повідомлення про помилку. */
        function showState(state) {
            setFieldState(input, state);
            config.errorEl.classList.toggle('hidden', state !== 'error');
            input.setAttribute('aria-invalid', String(state === 'error'));
        }

        function isOpen() {
            return !list.classList.contains('hidden');
        }

        /** Малює пункти списку. Текст вставляємо через textContent (безпечно). */
        function render() {
            list.textContent = '';

            if (!visible.length) {
                const empty = document.createElement('li');
                empty.setAttribute('role', 'option');
                empty.setAttribute('aria-disabled', 'true');
                empty.className = EMPTY_CLASS;
                empty.textContent = config.emptyText;
                list.appendChild(empty);
                return;
            }

            visible.forEach((option, index) => {
                const item = document.createElement('li');
                item.id = `${list.id}-option-${index}`;
                item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', String(index === activeIndex));
                item.className = OPTION_CLASS;
                item.textContent = option.label;
                // Не відбираємо фокус у поля, поки користувач клікає по пункту
                item.addEventListener('mousedown', (event) => event.preventDefault());
                item.addEventListener('click', () => choose(option));
                list.appendChild(item);
            });
        }

        /** Оновлює підсвічування пункту та aria-activedescendant. */
        function updateActive() {
            [...list.children].forEach((item, index) => {
                item.setAttribute('aria-selected', String(index === activeIndex));
            });
            if (activeIndex >= 0 && list.children[activeIndex]) {
                input.setAttribute('aria-activedescendant', list.children[activeIndex].id);
                list.children[activeIndex].scrollIntoView({ block: 'nearest' });
            } else {
                input.removeAttribute('aria-activedescendant');
            }
        }

        function open(showAll) {
            if (input.disabled) {
                return;
            }
            options = config.getOptions();
            visible = showAll ? options.slice() : filterOptions(input.value);
            activeIndex = selected ? visible.findIndex((o) => o.value === selected.value) : -1;
            render();
            list.classList.remove('hidden');
            input.setAttribute('aria-expanded', 'true');
            updateActive();
        }

        function close() {
            list.classList.add('hidden');
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            activeIndex = -1;
        }

        /** Повідомляє інші скрипти про зміну значення (калькулятор слухає подію change). */
        function notifyChange() {
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
            config.onChange(selected);
        }

        /** Вибір варіанта зі списку. */
        function choose(option) {
            selected = option;
            input.value = option.label;
            hidden.value = option.value;
            showState('success');
            close();
            notifyChange();
        }

        /** Скидає вибір, якщо користувач змінив текст. */
        function clearSelection() {
            if (!selected) {
                return;
            }
            selected = null;
            hidden.value = '';
            notifyChange();
        }

        // --- Введення тексту ---
        input.addEventListener('input', () => {
            options = config.getOptions();

            // Якщо введено повну назву, вибираємо її автоматично
            const exact = options.find((o) => norm(o.label) === norm(input.value));
            if (exact) {
                choose(exact);
                return;
            }

            // Інакше вибір скасовується, а список показує збіги
            clearSelection();
            showState('normal'); // помилку не показуємо, поки користувач друкує
            open(false);
        });

        // Клік по полю відкриває список
        input.addEventListener('click', () => {
            if (!isOpen()) {
                open(Boolean(selected));
            }
        });

        // --- Клавіатура ---
        input.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!isOpen()) {
                    open(Boolean(selected) || !input.value.trim());
                    return;
                }
                if (!visible.length) {
                    return;
                }
                const step = event.key === 'ArrowDown' ? 1 : -1;
                activeIndex = activeIndex === -1
                    ? (step === 1 ? 0 : visible.length - 1)
                    : (activeIndex + step + visible.length) % visible.length;
                updateActive();
            } else if (event.key === 'Enter') {
                event.preventDefault(); // Enter у полі не повинен надсилати форму
                if (!isOpen()) {
                    return;
                }
                if (activeIndex >= 0) {
                    choose(visible[activeIndex]);
                } else if (visible.length === 1) {
                    choose(visible[0]); // єдиний збіг вибираємо одразу
                }
            } else if (event.key === 'Escape' && isOpen()) {
                event.stopPropagation();
                close();
            } else if (event.key === 'Tab') {
                close();
            }
        });

        // Кнопка зі стрілкою показує всі варіанти
        toggle.addEventListener('mousedown', (event) => event.preventDefault());
        toggle.addEventListener('click', () => {
            if (isOpen()) {
                close();
            } else {
                input.focus();
                open(true);
            }
        });

        // Вихід із поля: закриваємо список і перевіряємо введене
        root.addEventListener('focusout', (event) => {
            if (root.contains(event.relatedTarget)) {
                return;
            }
            close();
            if (input.disabled) {
                return;
            }
            if (!input.value.trim()) {
                showState('normal');
            } else if (!selected) {
                showState('error'); // текст є, але такого варіанта немає в списку
            }
        });

        // Клік поза полем закриває список (запасний варіант для дотикових екранів)
        document.addEventListener('click', (event) => {
            if (!root.contains(event.target)) {
                close();
            }
        });

        /** Повністю очищає поле й повертає його у звичайний стан. */
        function reset() {
            selected = null;
            input.value = '';
            hidden.value = '';
            showState('normal');
            close();
        }

        /** Вмикає або вимикає поле (місто недоступне без країни). */
        function setDisabled(disabled, placeholder) {
            input.disabled = disabled;
            toggle.disabled = disabled;
            if (placeholder) {
                input.placeholder = placeholder;
            }
            if (config.hintEl) {
                config.hintEl.classList.toggle('hidden', !disabled);
            }
            if (disabled) {
                close();
            }
        }

        return { reset, setDisabled };
    }

    /* =========================================================
       4. Підключення полів «Країна» та «Місто»
       ========================================================= */

    function init() {
        const countryRoot = document.querySelector('[data-combobox="country"]');
        const cityRoot = document.querySelector('[data-combobox="city"]');

        // Захист: якщо розмітки немає, тихо виходимо, щоб не ламати сторінку
        if (!countryRoot || !cityRoot) {
            return;
        }

        const countryValue = countryRoot.querySelector('[data-combobox-value]');

        const CITY_PLACEHOLDER_OFF = 'Спершу оберіть країну';
        const CITY_PLACEHOLDER_ON = 'Почніть вводити місто';

        // Місто: список залежить від вибраної країни
        const cityBox = createCombobox(cityRoot, {
            getOptions: () => {
                const country = DESTINATIONS.find((d) => d.value === countryValue.value);
                return country ? country.cities : [];
            },
            errorEl: document.getElementById('city-error'),
            hintEl: document.getElementById('city-hint'),
            emptyText: 'Такого міста немає в списку',
            onChange: () => {}
        });

        // Країна: після зміни скидаємо місто й вмикаємо/вимикаємо його поле
        createCombobox(countryRoot, {
            getOptions: () => DESTINATIONS.map(({ value, label }) => ({ value, label })),
            errorEl: document.getElementById('country-error'),
            emptyText: 'Такої країни немає в списку',
            onChange: (country) => {
                cityBox.reset();
                cityBox.setDisabled(!country, country ? CITY_PLACEHOLDER_ON : CITY_PLACEHOLDER_OFF);
            }
        });

        // Початковий стан: країни немає, тому місто вимкнене
        // (також скидаємо значення, які браузер міг відновити після перезавантаження)
        countryRoot.querySelector('[data-combobox-input]').value = '';
        countryValue.value = '';
        cityBox.reset();
        cityBox.setDisabled(true, CITY_PLACEHOLDER_OFF);
    }

    document.addEventListener('DOMContentLoaded', init);
}());