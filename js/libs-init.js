/**
 * Via Europe — ініціалізація JS-бібліотек (Vanilla JS, без jQuery)
 *
 * Підключається в кінці <body> ПІСЛЯ CDN-скриптів:
 *   Swiper v11, Fancybox v5, AOS
 *
 * Кожна бібліотека ініціалізується окремою функцією.
 * Усі функції викликаються один раз після завантаження DOM.
 */

/* ------------------------------------------------------------------
   1. Swiper — слайдер відгуків (#reviews)
   ------------------------------------------------------------------ */
function initReviewsSlider() {
  const el = document.querySelector('.reviews-swiper');

  // Виходимо, якщо блоку немає або слайдер уже створено (захист від повторної ініціалізації)
  if (!el || el.swiper) return;

  new Swiper(el, {
    loop: true, // нескінченне прокручування
    spaceBetween: 20, // відстань між слайдами, px
    slidesPerView: 1, // мобільні: 1 слайд
    grabCursor: true, // курсор-«рука» при наведенні

    // Автопрокручування кожні 3,5 с; пауза при наведенні миші
    autoplay: {
      delay: 3500,
      disableOnInteraction: false, // автоплей не вимикається після свайпу
      pauseOnMouseEnter: true,
    },

    // Стрілки «назад / вперед»
    navigation: {
      nextEl: '.reviews-next',
      prevEl: '.reviews-prev',
    },

    // Клікабельні крапки пагінації
    pagination: {
      el: '.reviews-pagination',
      clickable: true,
    },

    // Адаптивність: скільки слайдів показувати залежно від ширини екрана
    breakpoints: {
      640: { slidesPerView: 2 }, // планшет
      1024: { slidesPerView: 3 }, // комп'ютер
    },
  });
}

/* ------------------------------------------------------------------
   2. Swiper — слайдер ідей подорожей (#ideas)
   ------------------------------------------------------------------ */
function initIdeasSlider() {
  const el = document.querySelector('.ideas-swiper');
  if (!el || el.swiper) return;

  new Swiper(el, {
    // loop: після останнього слайда плавно йде перший (без «перестрибування»).
    // Swiper створює копії слайдів (.swiper-slide-duplicate),
    // тому Fancybox нижче збирає фото тільки з оригіналів.
    loop: true,
    speed: 600, // тривалість зсуву, мс (плавніше за стандартні 300)
    spaceBetween: 20,
    slidesPerView: 1,
    grabCursor: true,

    // Автоплей вимкнено: картки перемикаються лише стрілками, крапками й свайпом
    navigation: { nextEl: '.ideas-next', prevEl: '.ideas-prev' },
    pagination: { el: '.ideas-pagination', clickable: true },

    breakpoints: {
      640: { slidesPerView: 2 },
      1024: { slidesPerView: 3 },
    },
  });
}

/* ------------------------------------------------------------------
   3. Fancybox — галерея фото ідей (посилання з data-fancybox="ideas-gallery")
   ------------------------------------------------------------------ */
function initIdeasGallery() {
  if (!window.Fancybox) return;

  const slider = document.querySelector('.ideas-swiper');
  if (!slider) return;

  // Параметри Fancybox: мініатюри, лічильник, керування зумом
  const options = {
    Hash: false, // не змінювати адресу сторінки

    // Ефект переходу між фото: плавне згасання (fade)
    Carousel: { transition: 'fade' },

    // Зум зображень: збільшення до 3× (колесо миші, подвійний клік, щипок на телефоні)
    Images: { Panzoom: { maxScale: 3 } },

    Thumbs: { type: 'classic' }, // мініатюри внизу
    Toolbar: {
      display: {
        left: ['counter'], // лічильник «1 / 6»
        middle: ['zoomIn', 'zoomOut', 'toggle1to1'], // керування зумом
        right: ['close'],
      },
    },
  };

  // Один обробник кліку на весь слайдер (делегування подій)
  slider.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-fancybox="ideas-gallery"]');
    if (!link) return;
    event.preventDefault(); // не переходити за посиланням

    // Альбом = лише оригінальні слайди, без копій, які створює loop
    const originals = [
      ...slider.querySelectorAll(
        '.swiper-slide:not(.swiper-slide-duplicate) a[data-fancybox="ideas-gallery"]'
      ),
    ];

    // Фото, на яке клікнули (навіть якщо це копія), знаходимо за адресою
    const startIndex = Math.max(
      originals.findIndex((a) => a.href === link.href),
      0
    );

    Fancybox.show(
      originals.map((a) => ({
        src: a.href,
        type: 'image',
        caption: a.dataset.caption || '',
      })),
      { ...options, startIndex }
    );
  });
}

/* ------------------------------------------------------------------
   4. AOS — анімація появи блоків при прокручуванні (атрибути data-aos)
   ------------------------------------------------------------------ */
function initScrollAnimations() {
  if (!window.AOS) return;

  AOS.init({
    duration: 700, // тривалість анімації, мс
    easing: 'ease-out-cubic', // плавне гальмування в кінці
    offset: 80, // анімація стартує, коли блок піднявся на 80px над нижнім краєм екрана
    once: true, // анімувати лише один раз, без повторів при прокручуванні назад
    // Поважаємо системне налаштування «зменшити рух»
    disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });

  // Tailwind (CDN) і зображення можуть змінити висоту сторінки після старту —
  // після повного завантаження перераховуємо позиції блоків
  window.addEventListener('load', () => AOS.refresh());
}

/* ------------------------------------------------------------------
   Запуск після завантаження DOM
   ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  initReviewsSlider();
  initIdeasSlider();
  initIdeasGallery();
  initScrollAnimations();
});