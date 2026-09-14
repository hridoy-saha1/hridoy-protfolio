(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  /* ------------------------------------------------------------------
     0a. PRELOADER — brief "compiling" count-up, then reveals the page.
     Only ever shown when JS runs (CSS gates it behind .js), so a
     visitor never gets trapped behind it.
  ------------------------------------------------------------------ */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    const countEl = document.getElementById('preloaderCount');
    const timeEl = document.getElementById('preloaderTime');
    const startedAt = performance.now();

    const finishPreloader = () => {
      const elapsed = Math.round(performance.now() - startedAt);
      if (timeEl) timeEl.textContent = String(elapsed);
      preloader.classList.add('is-done');
      preloader.addEventListener('transitionend', () => preloader.remove(), { once: true });
    };

    if (prefersReducedMotion) {
      if (countEl) countEl.textContent = '100';
      finishPreloader();
    } else {
      let progress = 0;
      const tick = () => {
        progress += Math.max(1, (100 - progress) / 9);
        if (progress >= 100) {
          progress = 100;
          if (countEl) countEl.textContent = '100';
          setTimeout(finishPreloader, 220);
          return;
        }
        if (countEl) countEl.textContent = String(Math.round(progress));
        setTimeout(tick, 45);
      };
      tick();
    }
  }

  /* ------------------------------------------------------------------
     0b. SCROLL PROGRESS — thin bar tracking read position
  ------------------------------------------------------------------ */
  const scrollProgress = document.getElementById('scrollProgress');
  if (scrollProgress) {
    const updateScrollProgress = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      scrollProgress.style.transform = `scaleX(${pct})`;
    };
    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    window.addEventListener('resize', updateScrollProgress);
    updateScrollProgress();
  }

  /* ------------------------------------------------------------------
     0c. AMBIENT MESH CANVAS — a quiet grid of connected nodes drifting
     behind the page. Engineering-diagram in spirit, not a starfield:
     nodes are evenly gridded, links only draw between near neighbours.
     Skipped entirely under reduced motion (canvas is display:none there).
  ------------------------------------------------------------------ */
  const meshCanvas = document.getElementById('meshCanvas');
  if (meshCanvas && !prefersReducedMotion && window.innerWidth >= 640) {
    const ctx = meshCanvas.getContext('2d');
    let width, height, nodes;
    const SPACING = 120;
    const LINK_DIST = 170;

    const buildNodes = () => {
      nodes = [];
      const cols = Math.ceil(width / SPACING) + 2;
      const rows = Math.ceil(height / SPACING) + 2;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          nodes.push({
            x: c * SPACING,
            y: r * SPACING,
            ox: c * SPACING,
            oy: r * SPACING,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    };

    const resize = () => {
      width = meshCanvas.width = window.innerWidth;
      height = meshCanvas.height = window.innerHeight;
      buildNodes();
    };
    window.addEventListener('resize', resize);
    resize();

    let t = 0;
    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, width, height);

      nodes.forEach((n) => {
        n.x = n.ox + Math.sin(t + n.phase) * 8;
        n.y = n.oy + Math.cos(t + n.phase) * 8;
      });

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.06;
            ctx.strokeStyle = `rgba(240, 166, 75, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        ctx.fillStyle = 'rgba(167, 156, 135, 0.28)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  /* ------------------------------------------------------------------
     1. NAVIGATION — scroll state, mobile menu, active-link indicator
  ------------------------------------------------------------------ */
  const siteNav = document.getElementById('siteNav');
  const navToggle = document.getElementById('navToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const navIndicator = document.getElementById('navIndicator');
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const onScrollNav = () => {
    siteNav.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  navToggle.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  document.querySelectorAll('.mobile-link').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    });
  });

  const desktopNavLinks = navLinks.filter((l) => l.classList.contains('nav-link'));

  const moveIndicatorTo = (link) => {
    if (!link || window.innerWidth <= 860) return;
    const linkRect = link.getBoundingClientRect();
    const parentRect = link.parentElement.getBoundingClientRect();
    navIndicator.style.width = `${linkRect.width}px`;
    navIndicator.style.transform = `translateX(${linkRect.left - parentRect.left}px)`;
    navIndicator.classList.add('is-active');
  };

  const setActiveLink = () => {
    let current = sections[0];
    const scrollPos = window.scrollY + window.innerHeight * 0.35;
    sections.forEach((sec) => {
      if (sec && sec.offsetTop <= scrollPos) current = sec;
    });
    desktopNavLinks.forEach((link) => {
      const match = link.getAttribute('href') === `#${current?.id}`;
      link.classList.toggle('is-active', match);
      if (match) moveIndicatorTo(link);
    });
  };

  window.addEventListener('scroll', setActiveLink, { passive: true });
  window.addEventListener('resize', setActiveLink);
  setActiveLink();

  /* ------------------------------------------------------------------
     2. SCROLL REVEAL — IntersectionObserver, staggered
  ------------------------------------------------------------------ */
  const revealTargets = document.querySelectorAll('.reveal-up');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            const delay = prefersReducedMotion ? 0 : (i % 4) * 90;
            setTimeout(() => entry.target.classList.add('is-visible'), delay);
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------------
     3. HERO LOAD SEQUENCE — one orchestrated entrance
  ------------------------------------------------------------------ */
  window.addEventListener('load', () => {
    const badge = document.querySelector('[data-reveal="badge"]');
    const lines = document.querySelectorAll('[data-reveal-line]');
    const desc = document.querySelector('[data-reveal="desc"]');
    const actions = document.querySelector('[data-reveal="actions"]');
    const socials = document.querySelector('[data-reveal="socials"]');
    const card = document.querySelector('[data-reveal="card"]');

    if (prefersReducedMotion) {
      [badge, desc, actions, socials, card].forEach((el) => el && el.classList.add('is-visible'));
      lines.forEach((l) => { l.style.opacity = '1'; l.style.transform = 'none'; });
      return;
    }

    const steps = [
      { el: badge, delay: 80 },
      { el: desc, delay: 620 },
      { el: actions, delay: 760 },
      { el: socials, delay: 880 },
      { el: card, delay: 420 },
    ];
    steps.forEach(({ el, delay }) => {
      if (!el) return;
      setTimeout(() => el.classList.add('is-visible'), delay);
    });

    lines.forEach((line, i) => {
      setTimeout(() => {
        line.style.transition = 'transform 0.9s cubic-bezier(0.16,1,0.3,1), opacity 0.9s ease';
        line.style.transform = 'translateY(0)';
        line.style.opacity = '1';
      }, 160 + i * 130);
    });
  });

  /* ------------------------------------------------------------------
     4. CURSOR SPOTLIGHT — desktop only, CSS custom properties
  ------------------------------------------------------------------ */
  const spotlightTargets = document.querySelectorAll('.skill-card, .project-featured, .project-card');
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (isDesktop && !prefersReducedMotion) {
    spotlightTargets.forEach((target) => {
      target.addEventListener('mousemove', (e) => {
        const rect = target.getBoundingClientRect();
        target.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        target.style.setProperty('--my', `${e.clientY - rect.top}px`);
      });
    });
  }

  /* ------------------------------------------------------------------
     5. 3D PROJECT TILT — vanilla JS, requestAnimationFrame
  ------------------------------------------------------------------ */
  if (isDesktop && !prefersReducedMotion) {
    const tiltEls = document.querySelectorAll('[data-tilt]');
    const MAX_TILT = 6;

    tiltEls.forEach((el) => {
      let rafId = null;
      let targetRotX = 0;
      let targetRotY = 0;
      let currentRotX = 0;
      let currentRotY = 0;

      const animate = () => {
        currentRotX += (targetRotX - currentRotX) * 0.12;
        currentRotY += (targetRotY - currentRotY) * 0.12;
        el.style.transform = `perspective(1000px) rotateX(${currentRotX}deg) rotateY(${currentRotY}deg) translateZ(0)`;
        if (Math.abs(targetRotX - currentRotX) > 0.01 || Math.abs(targetRotY - currentRotY) > 0.01) {
          rafId = requestAnimationFrame(animate);
        } else {
          rafId = null;
        }
      };

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        targetRotY = px * MAX_TILT * 2;
        targetRotX = -py * MAX_TILT * 2;
        if (!rafId) rafId = requestAnimationFrame(animate);
      });

      el.addEventListener('mouseleave', () => {
        targetRotX = 0;
        targetRotY = 0;
        if (!rafId) rafId = requestAnimationFrame(animate);
      });
    });
  }

  /* ------------------------------------------------------------------
     6. MARQUEE — pause on hover (CSS handles the rest)
  ------------------------------------------------------------------ */
  document.querySelectorAll('[data-marquee]').forEach((marquee) => {
    marquee.addEventListener('mouseenter', () => marquee.classList.add('is-paused'));
    marquee.addEventListener('mouseleave', () => marquee.classList.remove('is-paused'));
  });

  /* ------------------------------------------------------------------
     7. NUMBER COUNTER — animates when metrics enter viewport
     NOTE: real figures are placeholders (0) until provided; the
     counter animates whatever data-target value is set on each stat.
  ------------------------------------------------------------------ */
  const metricEls = document.querySelectorAll('.metric-value');
  if ('IntersectionObserver' in window && metricEls.length) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = Number(el.getAttribute('data-target')) || 0;
          if (prefersReducedMotion || target === 0) {
            el.textContent = String(target);
            countObserver.unobserve(el);
            return;
          }
          const duration = 1200;
          const startTime = performance.now();
          const step = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = String(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          countObserver.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    metricEls.forEach((el) => countObserver.observe(el));
  }

  /* ------------------------------------------------------------------
     8. CODE LINE REVEAL — types out the "How I think" snippet
  ------------------------------------------------------------------ */
  const codeBody = document.getElementById('codeBody');
  if (codeBody) {
    const codeEl = codeBody.querySelector('code');
    const codeLines = [
      { html: '<span class="tok-kw">const</span> developer = {' },
      { html: '&nbsp;&nbsp;role: <span class="tok-str">"Full-Stack Developer"</span>,' },
      { html: '&nbsp;&nbsp;focus: [' },
      { html: '&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-str">"Scalable APIs"</span>,' },
      { html: '&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-str">"Clean Architecture"</span>,' },
      { html: '&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-str">"Database Design"</span>,' },
      { html: '&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-str">"User Experience"</span>' },
      { html: '&nbsp;&nbsp;],' },
      { html: '&nbsp;&nbsp;mindset: <span class="tok-str">"Build. Learn. Improve."</span>' },
      { html: '};' },
    ];

    const typeCode = () => {
      if (prefersReducedMotion) {
        codeEl.innerHTML = codeLines.map((l) => l.html).join('<br>');
        return;
      }
      let i = 0;
      const renderNext = () => {
        if (i >= codeLines.length) {
          const cursor = document.createElement('span');
          cursor.className = 'code-cursor';
          codeEl.appendChild(cursor);
          return;
        }
        const div = document.createElement('div');
        div.innerHTML = codeLines[i].html;
        div.style.opacity = '0';
        div.style.transform = 'translateY(4px)';
        div.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        codeEl.appendChild(div);
        requestAnimationFrame(() => {
          div.style.opacity = '1';
          div.style.transform = 'translateY(0)';
        });
        i += 1;
        setTimeout(renderNext, 160);
      };
      renderNext();
    };

    if ('IntersectionObserver' in window) {
      const codeObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              typeCode();
              codeObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      codeObserver.observe(codeBody);
    } else {
      typeCode();
    }
  }

  /* ------------------------------------------------------------------
     9. MAGNETIC BUTTONS — subtle pull toward cursor
  ------------------------------------------------------------------ */
  if (isDesktop && !prefersReducedMotion) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      const MAX_PULL = 5;
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        btn.style.transform = `translate(${px * MAX_PULL * 2}px, ${py * MAX_PULL * 2}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0, 0)';
      });
    });
  }

  /* ------------------------------------------------------------------
     10. CONTACT FORM — vanilla JS validation
  ------------------------------------------------------------------ */
  const form = document.getElementById('contactForm');
  if (form) {
    const nameField = document.getElementById('name');
    const emailField = document.getElementById('email');
    const messageField = document.getElementById('message');
    const formStatus = document.getElementById('formStatus');

    const validators = {
      name: (v) => v.trim().length >= 2,
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      message: (v) => v.trim().length >= 10,
    };
    const errorMessages = {
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      message: 'Message should be at least 10 characters.',
    };

    const validateField = (input) => {
      const field = input.closest('.field');
      const errorEl = field.querySelector('.field-error');
      const valid = validators[input.name](input.value);
      field.classList.toggle('has-error', !valid);
      field.classList.toggle('is-valid', valid);
      errorEl.textContent = valid ? '' : errorMessages[input.name];
      return valid;
    };

    [nameField, emailField, messageField].forEach((input) => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        if (input.closest('.field').classList.contains('has-error')) validateField(input);
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const validName = validateField(nameField);
      const validEmail = validateField(emailField);
      const validMessage = validateField(messageField);

      if (!validName || !validEmail || !validMessage) {
        formStatus.textContent = 'Please fix the highlighted fields.';
        formStatus.style.color = '#F87171';
        return;
      }

      const submitLabel = document.getElementById('submitLabel');
      submitLabel.textContent = 'Sending…';
      formStatus.textContent = '';

      setTimeout(() => {
        submitLabel.textContent = 'Send message';
        formStatus.style.color = '';
        formStatus.textContent = `Thanks, ${nameField.value.trim().split(' ')[0]} — your message is on its way.`;
        form.reset();
        [nameField, emailField, messageField].forEach((input) => {
          input.closest('.field').classList.remove('is-valid', 'has-error');
        });
      }, 900);
    });
  }
})();
