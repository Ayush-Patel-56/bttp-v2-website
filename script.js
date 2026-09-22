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

  const navWrap = document.querySelector('.nav-wrap');
  const navEl = document.querySelector('.nav');
  if (navWrap && navEl) {
    let lastScrollY = window.scrollY;
    let navTicking = false;
    const updateNavVisibility = () => {
      navTicking = false;
      const y = window.scrollY;
      if (navEl.classList.contains('mobile-open')) { lastScrollY = y; return; }
      if (y <= 10 || y < lastScrollY - 2) {
        navWrap.classList.remove('nav-hidden');
      } else if (y > lastScrollY + 2) {
        navWrap.classList.add('nav-hidden');
      }
      lastScrollY = y;
    };
    window.addEventListener('scroll', () => {
      if (!navTicking) { navTicking = true; requestAnimationFrame(updateNavVisibility); }
    }, { passive: true });
  }

  const howSteps = Array.from(document.querySelectorAll('.how-step'));
  const howVisuals = Array.from(document.querySelectorAll('.how-visual-unit'));
  const howProgressDots = Array.from(document.querySelectorAll('.how-progress-dot'));
  const howPinWrap = document.querySelector('.how-pin-wrap');
  if (howSteps.length && howVisuals.length && howPinWrap) {
    const setActiveHowStep = (step) => {
      const activeNum = Number(step);
      howSteps.forEach(el => {
        const num = Number(el.dataset.howStep);
        el.classList.toggle('is-active', num === activeNum);
        el.classList.toggle('is-complete', num < activeNum);
      });
      howVisuals.forEach(el => el.classList.toggle('is-active', el.dataset.howStep === step));
      howProgressDots.forEach(el => el.classList.toggle('is-active', el.dataset.howStep === step));
    };
    const stepCount = howSteps.length;
    let howTicking = false;

    const updateHow = () => {
      howTicking = false;
      const vh = window.innerHeight;
      const stickyTop = 94;
      const wrapRect = howPinWrap.getBoundingClientRect();
      const childHeight = vh - stickyTop;
      const range = Math.max(wrapRect.height - childHeight, 1);
      const scrolled = stickyTop - wrapRect.top;
      const progress = Math.min(1, Math.max(0, scrolled / range));
      const idx = Math.min(stepCount - 1, Math.floor(progress * stepCount));
      setActiveHowStep(String(idx + 1));
    };
    const requestHowUpdate = () => {
      if (!howTicking) {
        howTicking = true;
        requestAnimationFrame(updateHow);
      }
    };
    window.addEventListener('scroll', requestHowUpdate, { passive: true });
    window.addEventListener('resize', requestHowUpdate);
    updateHow();
  }

  const timeline = document.querySelector('.problem-timeline');
  if (timeline) {
    const items = Array.from(timeline.querySelectorAll('.problem-item'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      items.forEach(item => item.classList.add('visible'));
    } else {
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            items.forEach(item => item.classList.add('visible'));
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      revealObserver.observe(timeline);
    }
  }

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

  // The browser only ever talks to our own /api/waitlist proxy now (see
  // api/waitlist.js). It holds the Google Apps Script URL and shared secret
  // server-side, verifies Turnstile, and returns a real JSON result instead
  // of the old opaque no-cors response (fixes BTTP-01 and BTTP-05).
  const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

  const form = document.getElementById('waitlist-form');
  const message = document.getElementById('form-message');
  if (form && message) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const email = formData.get('email')?.toString().trim();
      const comment = formData.get('comment')?.toString().trim() || '';
      const phone = formData.get('phone')?.toString().trim() || '';
      const website = formData.get('website')?.toString().trim() || ''; // honeypot
      const consent = form.querySelector('#waitlist-consent');
      const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value || '';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        message.textContent = 'Please enter a valid email address.';
        return;
      }
      if (phone && !PHONE_RE.test(phone)) {
        message.textContent = 'Please enter a valid phone number, or leave it blank.';
        return;
      }
      if (consent && !consent.checked) {
        message.textContent = 'Please agree to the Privacy Policy to continue.';
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalLabel = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      try {
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, comment, website, turnstileToken })
        });
        const result = await response.json().catch(() => null);

        if (response.ok && result?.ok) {
          message.textContent = "Thanks - you're on the BTTP early-access list!";
          form.reset();
          if (window.turnstile) window.turnstile.reset();
        } else if (result?.error === 'captcha_failed') {
          message.textContent = 'Please complete the verification checkbox and try again.';
        } else if (result?.error === 'rate_limited') {
          message.textContent = "You've already signed up recently - thanks!";
        } else {
          message.textContent = 'Something went wrong. Please try again.';
        }
      } catch (err) {
        message.textContent = 'Something went wrong. Please try again.';
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalLabel;
        }
      }
    });
  }

  const faqChips = document.querySelectorAll('.faq-chip');
  const faqQ = document.getElementById('faq-answer-q');
  const faqA = document.getElementById('faq-answer-a');
  const faqTyping = document.getElementById('faq-typing');
  if (faqChips.length && faqQ && faqA && faqTyping) {
    faqChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.classList.contains('is-active')) return;
        faqChips.forEach(c => c.classList.toggle('is-active', c === chip));
        faqQ.textContent = chip.textContent;
        faqA.classList.add('is-hidden');
        faqTyping.classList.add('is-visible');
        setTimeout(() => {
          faqA.textContent = chip.dataset.answer;
          faqTyping.classList.remove('is-visible');
          faqA.classList.remove('is-hidden');
        }, 700);
      });
    });
  }

  // Story form removed (BTTP-07): the section is commented out of the HTML
  // and its old handler only ever printed a fake thank-you without sending
  // the story anywhere. Re-add a real handler wired to /api/waitlist-style
  // storage if/when the story section comes back.

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

  // Privacy/Terms open as a modal instead of navigating away, on any page
  // that links to privacy.html or terms.html. Falls back to a normal
  // navigation if the fetch fails (e.g. opened via file://).
  const policyCache = new Map();
  let overlay, modal, modalBody, closeBtn, lastFocused;

  const buildOverlay = () => {
    overlay = document.createElement('div');
    overlay.className = 'policy-modal-overlay';
    overlay.innerHTML = `
      <div class="policy-modal" role="dialog" aria-modal="true">
        <button type="button" class="policy-modal-close" aria-label="Close">&times;</button>
        <div class="policy-content policy-modal-body"><div class="policy-modal-loading">Loading…</div></div>
      </div>`;
    document.body.appendChild(overlay);
    modal = overlay.querySelector('.policy-modal');
    modalBody = overlay.querySelector('.policy-modal-body');
    closeBtn = overlay.querySelector('.policy-modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });
  };

  const openModal = () => {
    if (!overlay) buildOverlay();
    lastFocused = document.activeElement;
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  };

  const closeModal = () => {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  };

  const loadPolicy = async (href) => {
    modalBody.innerHTML = '<div class="policy-modal-loading">Loading…</div>';
    try {
      let html = policyCache.get(href);
      if (!html) {
        const res = await fetch(href);
        if (!res.ok) throw new Error('fetch failed');
        html = await res.text();
        policyCache.set(href, html);
      }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const content = doc.querySelector('.policy-content');
      if (!content) throw new Error('no content');
      modalBody.innerHTML = content.innerHTML;
      modal.scrollTop = 0;
    } catch (err) {
      closeModal();
      window.location.href = href;
    }
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href="privacy.html"], a[href="terms.html"]');
    if (!link) return;
    e.preventDefault();
    openModal();
    loadPolicy(link.getAttribute('href'));
  });
})();