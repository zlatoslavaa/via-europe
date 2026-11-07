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
   5. Функції валідації (кожна повертає true або false)
   ========================================================= */

/** Ім'я: не порожнє, мінімум 2 символи (пробіли по краях не враховуються). */
function validateName() {
    const isValid = nameInput.value.trim().length >= MIN_NAME_LENGTH;
    if (isValid) {
        showSuccess(nameInput, nameError);
    } else {
        showError(nameInput, nameError);
    }
    return isValid;
}

/** Email: коректний формат. */
function validateEmail() {
    const isValid = REGEX_EMAIL.test(emailInput.value);
    if (isValid) {
        showSuccess(emailInput, emailError);
    } else {
        showError(emailInput, emailError);
    }
    return isValid;
}

/** Телефон: строго +380XXXXXXXXX. */
function validatePhone() {
    const isValid = REGEX_PHONE.test(phoneInput.value);
    if (isValid) {
        showSuccess(phoneInput, phoneError);
    } else {
        showError(phoneInput, phoneError);
    }
    return isValid;
}

/** Повідомлення: мінімум 10 символів (пробіли по краях не враховуються). */
function validateMessage() {
    const isValid = messageInput.value.trim().length >= MIN_MESSAGE_LENGTH;
    if (isValid) {
        showSuccess(messageInput, messageError);
    } else {
        showError(messageInput, messageError);
    }
    return isValid;
}

/** Згода: чекбокс має бути вибраний. */
function validateAgreement() {
    const isValid = agreementInput.checked;
    if (isValid) {
        showSuccess(agreementInput, agreementError);
    } else {
        showError(agreementInput, agreementError);
    }
    return isValid;
}

/* =========================================================
   6. Обробка надсилання форми
   ========================================================= */

if (form) {
    form.addEventListener('submit', (event) => {
        // Забороняємо стандартне надсилання й перезавантаження сторінки
        event.preventDefault();

        // Перевіряємо ВСІ поля (не зупиняємось на першій помилці),
        // щоб користувач одразу побачив усі проблеми. Порядок збігається з порядком у формі.
        const results = [
            { isValid: validateName(), input: nameInput },
            { isValid: validateEmail(), input: emailInput },
            { isValid: validatePhone(), input: phoneInput },
            { isValid: validateMessage(), input: messageInput },
            { isValid: validateAgreement(), input: agreementInput }
        ];

        // Якщо є помилки — форму не «надсилаємо», фокус на перше помилкове поле
        const firstInvalid = results.find((result) => !result.isValid);
        if (firstInvalid) {
            firstInvalid.input.focus();
            return;
        }

        // Усі поля пройшли перевірку. Реального надсилання на сервер немає.
        // (Модальне вікно та очищення полів додамо на наступних етапах.)
        console.log('Форма пройшла клієнтську валідацію.');
    });
}
