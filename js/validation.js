/**
 * validation.js — клієнтська валідація форми зворотного зв'язку Via Europe.
 * Підключається на сторінці contacts.html. Сторонні бібліотеки не використовуються.
 *
 * ВАЖЛИВО: дані на сервер не надсилаються. Це демонстрація клієнтської валідації.
 */

'use strict';

/* =========================================================
   1. Регулярні вирази та константи правил
   ========================================================= */

// Телефон: +380 і рівно 9 цифр, без пробілів, дужок, дефісів і літер
const REGEX_PHONE = /^\+380\d{9}$/;

// Email: локальна частина @ домен (можливі піддомени) . зона з мінімум 2 літер
const REGEX_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

const MIN_NAME_LENGTH = 2;      // мінімальна довжина імені
const MIN_MESSAGE_LENGTH = 10;  // мінімальна довжина повідомлення

/* =========================================================
   2. Tailwind-класи для станів полів
   Набори замінюють один одного, щоб кольори рамок не конфліктували.
   ========================================================= */

const STATE_CLASSES = {
    normal: [
        'border-muted/60',
        'hover:border-muted',
        'focus-visible:border-primary',
        'focus-visible:outline-primary'
    ],
    error: [
        'border-red-500',
        'hover:border-red-500',
        'focus-visible:border-red-500',
        'focus-visible:outline-red-500'
    ],
    success: [
        'border-green-500',
        'hover:border-green-500',
        'focus-visible:border-green-500',
        'focus-visible:outline-primary'
    ]
};

// Чекбокс браузер майже не стилізує, тому помилку показуємо червоним контуром
const CHECKBOX_ERROR_CLASSES = ['outline', 'outline-2', 'outline-offset-2', 'outline-red-500'];

/* =========================================================
   3. Елементи сторінки
   ========================================================= */

const form = document.getElementById('feedbackForm');

const nameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const messageInput = document.getElementById('message');
const agreementInput = document.getElementById('agreement');

const nameError = document.getElementById('usernameError');
const emailError = document.getElementById('emailError');
const phoneError = document.getElementById('phoneError');
const messageError = document.getElementById('messageError');
const agreementError = document.getElementById('agreementError');

const phoneHint = document.getElementById('phoneHint');

const successModal = document.getElementById('successModal');
const closeModalButton = document.getElementById('closeModalButton');

/* =========================================================
   4. Функції керування станами інтерфейсу
   ========================================================= */

/** Застосовує набір класів стану ('normal' | 'error' | 'success') до текстового поля. */
function setFieldState(input, state) {
    Object.values(STATE_CLASSES).forEach((classes) => input.classList.remove(...classes));
    input.classList.add(...STATE_CLASSES[state]);
}

/** Показує помилку: червона рамка, текст під полем, aria-invalid="true". */
function showError(input, errorElement) {
    if (input.type === 'checkbox') {
        input.classList.add(...CHECKBOX_ERROR_CLASSES);
    } else {
        setFieldState(input, 'error');
    }
    errorElement.classList.remove('hidden');
    input.setAttribute('aria-invalid', 'true');
}

/** Показує успіх: зелена рамка, помилка прихована, aria-invalid="false". */
function showSuccess(input, errorElement) {
    if (input.type === 'checkbox') {
        input.classList.remove(...CHECKBOX_ERROR_CLASSES);
    } else {
        setFieldState(input, 'success');
    }
    errorElement.classList.add('hidden');
    input.setAttribute('aria-invalid', 'false');
}

/** Повертає поле до звичайного стану (без помилки й без успіху). */
function clearError(input, errorElement) {
    if (input.type === 'checkbox') {
        input.classList.remove(...CHECKBOX_ERROR_CLASSES);
    } else {
        setFieldState(input, 'normal');
    }
    errorElement.classList.add('hidden');
    input.setAttribute('aria-invalid', 'false');
}

/* =========================================================
   5. Правила (чисті перевірки без зміни інтерфейсу)
   ========================================================= */

const isNameValid = () => nameInput.value.trim().length >= MIN_NAME_LENGTH;
const isEmailValid = () => REGEX_EMAIL.test(emailInput.value);
const isPhoneValid = () => REGEX_PHONE.test(phoneInput.value);
const isMessageValid = () => messageInput.value.trim().length >= MIN_MESSAGE_LENGTH;
const isAgreementValid = () => agreementInput.checked;

/* =========================================================
   5.1. UX-функція: автоперетворення телефону 0XXXXXXXXX -> +380XXXXXXXXX
   Це НЕ правило валідації (REGEX_PHONE лишається суворим), а зручність для користувача.
   ========================================================= */

// Рівно 10 цифр, що починаються з 0 (український національний формат, напр. 0501234567)
const REGEX_PHONE_LOCAL = /^0\d{9}$/;

const PHONE_HINT_DEFAULT = phoneHint ? phoneHint.textContent : '';
const PHONE_HINT_CONVERTED = 'Номер автоматично приведено до формату +380XXXXXXXXX.';

/** Повертає звичайний текст підказки під полем телефону. */
function resetPhoneHint() {
    if (phoneHint && phoneHint.textContent !== PHONE_HINT_DEFAULT) {
        phoneHint.textContent = PHONE_HINT_DEFAULT;
    }
}

/**
 * Якщо в полі рівно 10 цифр і вони починаються з 0, додає код країни: 0501234567 -> +380501234567.
 * Інші значення (пробіли, літери, інша довжина) не змінюються, щоб не приховувати помилку.
 */
function normalizePhone() {
    if (REGEX_PHONE_LOCAL.test(phoneInput.value)) {
        phoneInput.value = '+38' + phoneInput.value;
        if (phoneHint) {
            phoneHint.textContent = PHONE_HINT_CONVERTED;
        }
    }
}

/* =========================================================
   6. Функції валідації (перевіряють і оновлюють інтерфейс; повертають true/false)
   ========================================================= */

/** Застосовує результат перевірки до інтерфейсу й повертає його. */
function applyResult(isValid, input, errorElement) {
    if (isValid) {
        showSuccess(input, errorElement);
    } else {
        showError(input, errorElement);
    }
    return isValid;
}

/** Ім'я: не порожнє, мінімум 2 символи (пробіли по краях не враховуються). */
function validateName() {
    return applyResult(isNameValid(), nameInput, nameError);
}

/** Email: коректний формат. */
function validateEmail() {
    return applyResult(isEmailValid(), emailInput, emailError);
}

/** Телефон: строго +380XXXXXXXXX. */
function validatePhone() {
    return applyResult(isPhoneValid(), phoneInput, phoneError);
}

/** Повідомлення: мінімум 10 символів (пробіли по краях не враховуються). */
function validateMessage() {
    return applyResult(isMessageValid(), messageInput, messageError);
}

/** Згода: чекбокс має бути вибраний. */
function validateAgreement() {
    return applyResult(isAgreementValid(), agreementInput, agreementError);
}

/* =========================================================
   7. Динамічна валідація (input, blur, change)
   ========================================================= */

// Опис усіх полів у порядку, у якому вони розташовані у формі
const fields = [
    { input: nameInput, error: nameError, isValid: isNameValid, validate: validateName },
    { input: emailInput, error: emailError, isValid: isEmailValid, validate: validateEmail },
    { input: phoneInput, error: phoneError, isValid: isPhoneValid, validate: validatePhone, normalize: normalizePhone },
    { input: messageInput, error: messageError, isValid: isMessageValid, validate: validateMessage },
    { input: agreementInput, error: agreementError, isValid: isAgreementValid, validate: validateAgreement }
];

// Поля, з якими користувач уже «попрацював» (вийшов із них або спробував надіслати форму)
const touchedFields = new Set();

/**
 * Подія input.
 * - Поле вже «торкнуте»: повна перевірка на кожен символ (помилка зникає одразу після виправлення).
 * - Ще не «торкнуте»: помилку не показуємо передчасно; лише підсвічуємо успіх, якщо значення вже правильне.
 */
function handleInput(field) {
    if (touchedFields.has(field.input)) {
        field.validate();
    } else if (field.isValid()) {
        showSuccess(field.input, field.error);
    } else {
        clearError(field.input, field.error);
    }
}

/** Подія blur (вихід із поля): за потреби нормалізуємо значення, поле стає «торкнутим», показуємо підсумок перевірки. */
function handleBlur(field) {
    touchedFields.add(field.input);
    if (field.normalize) {
        field.normalize();
    }
    field.validate();
}

/* =========================================================
   7.1. Очищення форми та модальне вікно
   ========================================================= */

// Елемент, який мав фокус до відкриття вікна (туди повертаємо фокус після закриття)
let lastFocusedElement = null;

/** Чи відкрите модальне вікно. */
function isModalOpen() {
    return Boolean(successModal) && !successModal.classList.contains('hidden');
}

/** Очищає поля, повертає їх до звичайного стану й скидає «торкнуті» поля. */
function resetForm() {
    form.reset();
    fields.forEach((field) => clearError(field.input, field.error));
    touchedFields.clear();
    resetPhoneHint();
}

/** Відкриває модальне вікно, блокує прокрутку сторінки й переносить фокус на кнопку «Закрити». */
function openSuccessModal() {
    lastFocusedElement = document.activeElement;
    successModal.classList.remove('hidden');
    successModal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    closeModalButton.focus();
}

/** Закриває модальне вікно й повертає фокус туди, де він був. */
function closeSuccessModal() {
    successModal.classList.add('hidden');
    successModal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
        lastFocusedElement.focus();
    }
}

if (successModal && closeModalButton) {
    closeModalButton.addEventListener('click', closeSuccessModal);

    document.addEventListener('keydown', (event) => {
        if (!isModalOpen()) {
            return;
        }
        if (event.key === 'Escape') {
            // Escape закриває вікно
            closeSuccessModal();
        } else if (event.key === 'Tab') {
            // У вікні лише одна кнопка, тому фокус не покидає діалог (Tab і Shift + Tab)
            event.preventDefault();
            closeModalButton.focus();
        }
    });
}

if (form) {
    fields.forEach((field) => {
        if (field.input.type === 'checkbox') {
            // Клік по чекбоксу — свідома дія, тому перевіряємо одразу
            field.input.addEventListener('change', () => {
                touchedFields.add(field.input);
                field.validate();
            });
        } else {
            field.input.addEventListener('input', () => handleInput(field));
        }
        field.input.addEventListener('blur', () => handleBlur(field));
    });

    // Під час нового редагування телефону повертаємо звичайну підказку
    phoneInput.addEventListener('input', resetPhoneHint);

    /* =========================================================
       8. Обробка надсилання форми
       ========================================================= */

    form.addEventListener('submit', (event) => {
        // Забороняємо стандартне надсилання й перезавантаження сторінки
        event.preventDefault();

        // Поки модальне вікно відкрите, повторні надсилання ігноруємо
        if (isModalOpen()) {
            return;
        }

        // Під час submit усі поля вважаються «торкнутими»; за потреби нормалізуємо значення
        // (потрібно, якщо користувач натиснув Enter у полі й blur не відбувся)
        fields.forEach((field) => {
            touchedFields.add(field.input);
            if (field.normalize) {
                field.normalize();
            }
        });

        // Перевіряємо ВСІ поля (не зупиняємось на першій помилці),
        // щоб користувач одразу побачив усі проблеми.
        const results = fields.map((field) => ({ isValid: field.validate(), input: field.input }));

        // Якщо є помилки — форму не «надсилаємо», фокус на перше помилкове поле
        const firstInvalid = results.find((result) => !result.isValid);
        if (firstInvalid) {
            firstInvalid.input.focus();
            return;
        }

        // Усі поля пройшли перевірку. Реального надсилання на сервер немає:
        // це імітація успішного надсилання (очищаємо поля й показуємо модальне вікно).
        resetForm();
        if (successModal) {
            openSuccessModal();
        }
    });
}
