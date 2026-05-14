/**
 * Dropsoft Corporate Parallax — Rellax + Intersection Observer + mobile nav.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Mobile nav */
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Rellax — lightweight parallax on decorative layers */
  if (!reduceMotion && typeof Rellax !== 'undefined') {
    try {
      new Rellax('.rellax', { center: true, round: true, vertical: true, horizontal: false });
    } catch (e) {
      /* no-op */
    }
  }

  /* Fade-in-up on scroll */
  var revealEls = document.querySelectorAll('.ds-reveal');
  if (revealEls.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) {
        el.classList.add('ds-in-view');
      });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('ds-in-view');
              io.unobserve(entry.target);
            }
          });
        },
        { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      revealEls.forEach(function (el) {
        io.observe(el);
      });
    }
  }

  /* Pricing: Monthly vs Annual */
  var pricingToggle = document.querySelector('[data-pricing-toggle]');
  var pricingSection = document.querySelector('[data-pricing-section]');
  var pricingCells = document.querySelectorAll('[data-pricing-cell]');
  var labelMonthly = document.querySelector('.ds-pricing-toolbar__label--monthly');
  var labelAnnual = document.querySelector('.ds-pricing-toolbar__label--annual');

  function setPricingLabels(isAnnual) {
    if (labelMonthly) labelMonthly.classList.toggle('ds-is-active', !isAnnual);
    if (labelAnnual) labelAnnual.classList.toggle('ds-is-active', isAnnual);
  }

  function applyPricing(isAnnual) {
    if (!pricingCells.length) return;
    pricingCells.forEach(function (cell) {
      cell.classList.add('is-price-changing');
    });
    window.setTimeout(function () {
      var attr = isAnnual ? 'data-annual' : 'data-monthly';
      pricingCells.forEach(function (cell) {
        var next = cell.getAttribute(attr);
        if (next) cell.textContent = next;
        cell.classList.remove('is-price-changing');
      });
    }, 170);
    if (pricingSection) pricingSection.classList.toggle('ds-pricing--annual', isAnnual);
    setPricingLabels(isAnnual);
  }

  if (pricingToggle && pricingSection) {
    pricingToggle.addEventListener('change', function () {
      applyPricing(pricingToggle.checked);
    });
    applyPricing(pricingToggle.checked);
  }

  /* Systems slideshow carousel */
  var slideshowRoot = document.querySelector('[data-ds-slideshow]');
  if (slideshowRoot && !reduceMotion) {
    var slides = slideshowRoot.querySelectorAll('.ds-slideshow__slide');
    var dotsWrap = slideshowRoot.querySelector('[data-ds-slideshow-dots]');
    var btnPrev = slideshowRoot.querySelector('[data-ds-slideshow-prev]');
    var btnNext = slideshowRoot.querySelector('[data-ds-slideshow-next]');
    var live = slideshowRoot.querySelector('[data-ds-slideshow-live]');
    var intervalMs = Math.max(3000, parseInt(slideshowRoot.getAttribute('data-interval') || '6000', 10) || 6000);
    var index = 0;
    var timer = null;

    function setActive(i) {
      if (!slides.length) return;
      index = (i + slides.length) % slides.length;
        slides.forEach(function (slide, j) {
        var on = j === index;
        slide.classList.toggle('is-active', on);
        slide.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in slide) {
          slide.inert = !on;
        }
      });
      if (dotsWrap) {
        dotsWrap.querySelectorAll('button').forEach(function (btn, j) {
          btn.setAttribute('aria-current', j === index ? 'true' : 'false');
          btn.classList.toggle('is-active', j === index);
        });
      }
      if (live) {
        var cap = slides[index] && slides[index].getAttribute('data-caption');
        live.textContent = cap || '';
      }
    }

    function next() {
      setActive(index + 1);
    }

    function prev() {
      setActive(index - 1);
    }

    function startTimer() {
      stopTimer();
      if (slides.length > 1) {
        timer = window.setInterval(next, intervalMs);
      }
    }

    function stopTimer() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    if (slides.length > 1) {
      setActive(0);
      startTimer();
      slideshowRoot.addEventListener('mouseenter', stopTimer);
      slideshowRoot.addEventListener('mouseleave', startTimer);
      slideshowRoot.addEventListener('focusin', stopTimer);
      slideshowRoot.addEventListener('focusout', function () {
        if (!slideshowRoot.contains(document.activeElement)) startTimer();
      });
      if (btnPrev) btnPrev.addEventListener('click', function () { prev(); startTimer(); });
      if (btnNext) btnNext.addEventListener('click', function () { next(); startTimer(); });
      if (dotsWrap) {
        dotsWrap.addEventListener('click', function (e) {
          var btn = e.target.closest('button[data-slide-to]');
          if (!btn) return;
          var to = parseInt(btn.getAttribute('data-slide-to'), 10);
          if (!isNaN(to)) {
            setActive(to);
            startTimer();
          }
        });
      }
      slideshowRoot.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
          startTimer();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prev();
          startTimer();
        }
      });
    } else if (slides.length === 1) {
      setActive(0);
    }
  } else if (slideshowRoot && reduceMotion && slideshowRoot.querySelectorAll('.ds-slideshow__slide').length) {
    slideshowRoot.querySelectorAll('.ds-slideshow__slide').forEach(function (slide, j) {
      slide.classList.toggle('is-active', j === 0);
      slide.setAttribute('aria-hidden', j === 0 ? 'false' : 'true');
      if ('inert' in slide) {
        slide.inert = j !== 0;
      }
    });
  }
})();
