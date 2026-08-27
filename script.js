(() => {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => observer.observe(el));

  const menu = document.querySelector('.menu-button');
  const nav = document.querySelector('.nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('mobile-open');
      menu.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('mobile-open');
      menu.setAttribute('aria-expanded', 'false');
    }));
  }

  const form = document.getElementById('waitlist-form');
  const message = document.getElementById('form-message');
  if (form && message) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = new FormData(form).get('email')?.toString().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        message.textContent = 'Please enter a valid email address.';
        return;
      }
      message.textContent = 'Thanks — your early-access request is ready to be connected to the BTTP waitlist backend.';
      form.reset();
    });
  }

  const track = document.querySelector('.redemption-track');
  const dotsWrap = document.querySelector('.redemption-dots');
  const arrows = document.querySelectorAll('.redemption-arrow');
  if (track && dotsWrap && arrows.length) {
    const slides = Array.from(track.querySelectorAll('.redemption-slide'));
    const loop = slides.length > 1;
    const goTo = (index) => track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    const dots = slides.map((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'redemption-dot';
      dot.setAttribute('aria-label', `Go to redemption ${i + 1}`);
      dot.addEventListener('click', () => { goTo(i); restartAutoplay(); });
      dotsWrap.appendChild(dot);
      return dot;
    });

    let current = 0;
    const setActive = (index) => {
      current = index;
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
      if (!loop) {
        arrows.forEach(arrow => {
          const target = index + Number(arrow.dataset.dir);
          arrow.disabled = target < 0 || target >= slides.length;
        });
      }
    };

    const step = (dir) => {
      const target = (current + dir + slides.length) % slides.length;
      if (loop || (target >= 0 && target < slides.length)) goTo(target);
    };

    arrows.forEach(arrow => {
      arrow.addEventListener('click', () => { step(Number(arrow.dataset.dir)); restartAutoplay(); });
    });

    let scrollTimeout;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const index = Math.round(track.scrollLeft / track.clientWidth);
        setActive(Math.min(Math.max(index, 0), slides.length - 1));
      }, 100);
    });

    const carousel = track.closest('.redemption-carousel');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let autoplayTimer;
    const startAutoplay = () => {
      if (!loop || reducedMotion) return;
      autoplayTimer = setInterval(() => step(1), 5000);
    };
    const stopAutoplay = () => clearInterval(autoplayTimer);
    const restartAutoplay = () => { stopAutoplay(); startAutoplay(); };

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', startAutoplay);

    setActive(0);
    startAutoplay();
  }
})();