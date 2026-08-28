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

  const timeline = document.querySelector('.problem-timeline');
  const pinWrap = document.querySelector('.problem-pin-wrap');
  if (timeline && pinWrap) {
    const svg = timeline.querySelector('.timeline-arrow-svg');
    const path = timeline.querySelector('.timeline-arrow-path');
    const head = timeline.querySelector('.timeline-arrow-head');
    const items = Array.from(timeline.querySelectorAll('.problem-item'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let totalLength = 0;
    let itemLengths = [];
    let ticking = false;

    const DOT = 1;
    const GAP = 9;
    const dashArrayTo = (len) => {
      const unit = DOT + GAP;
      const repeats = Math.max(Math.ceil(len / unit), 0);
      const arr = [];
      for (let i = 0; i < repeats; i++) arr.push(DOT, GAP);
      arr.push(0, Math.max(totalLength * 2, 1000));
      return arr.join(' ');
    };

    const buildPath = () => {
      const rect = timeline.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);

      const points = items.map(item => {
        const circle = item.querySelector('.icon-circle');
        const r = circle.getBoundingClientRect();
        return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
      });

      let d = `M ${points[0].x} ${points[0].y}`;
      itemLengths = [0];
      path.setAttribute('d', d);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i], p1 = points[i + 1];
        const midX = (p0.x + p1.x) / 2;
        d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
        path.setAttribute('d', d);
        itemLengths.push(path.getTotalLength());
      }
      totalLength = itemLengths[itemLengths.length - 1] || 0;
      path.style.strokeDasharray = dashArrayTo(0);
      items[0].classList.add('visible');
    };

    const pinQuery = window.matchMedia('(min-width: 901px)');

    const update = () => {
      ticking = false;
      if (!totalLength) return;
      const vh = window.innerHeight;
      let progress;

      if (pinQuery.matches) {
        const wrapRect = pinWrap.getBoundingClientRect();
        const stickyTop = 88;
        const childHeight = vh - stickyTop;
        const holdFraction = 0.72;
        const range = Math.max((wrapRect.height - childHeight) * holdFraction, 1);
        const scrolled = stickyTop - wrapRect.top;
        progress = Math.min(1, Math.max(0, scrolled / range));
      } else {
        const rect = timeline.getBoundingClientRect();
        const startTrigger = vh * 0.82;
        const endTrigger = vh * 0.3;
        const range = Math.max(rect.height + startTrigger - endTrigger, 1);
        const scrolled = startTrigger - rect.top;
        progress = Math.min(1, Math.max(0, scrolled / range));
      }

      const currentLength = progress * totalLength;
      path.style.strokeDasharray = dashArrayTo(currentLength);

      items.forEach((item, i) => {
        if (currentLength >= itemLengths[i] - 10) item.classList.add('visible');
      });

      const pt = path.getPointAtLength(currentLength);
      const pt2 = path.getPointAtLength(Math.min(currentLength + 1, totalLength));
      const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
      head.setAttribute('transform', `translate(${pt.x},${pt.y}) rotate(${angle})`);
      head.style.opacity = progress > 0.01 && progress < 0.995 ? '1' : '0';
    };

    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    if (reducedMotion) {
      buildPath();
      items.forEach(item => item.classList.add('visible'));
      path.style.strokeDasharray = dashArrayTo(totalLength);
    } else {
      buildPath();
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { buildPath(); update(); }, 150);
      });
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