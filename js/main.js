// =============================================
// JOFLIKS PHOTOGRAPHY — main.js
// =============================================

// --- Scroll: sticky header shadow ---
const header = document.getElementById('site-header');
if (header) {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// --- Mobile hamburger menu ---
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
    // Animate bars
    const bars = hamburger.querySelectorAll('span');
    if (open) {
      bars[0].style.transform = 'translateY(6.5px) rotate(45deg)';
      bars[1].style.opacity  = '0';
      bars[2].style.transform = 'translateY(-6.5px) rotate(-45deg)';
    } else {
      bars[0].style.transform = '';
      bars[1].style.opacity  = '';
      bars[2].style.transform = '';
    }
  });
}

// --- Portfolio filter ---
const filterBtns = document.querySelectorAll('.filter-btn');
const pgItems    = document.querySelectorAll('.pg-item');
if (filterBtns.length && pgItems.length) {
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      pgItems.forEach(item => {
        const match = filter === 'all' || item.dataset.cat === filter;
        item.style.display = match ? '' : 'none';
      });
    });
  });
}

// --- Fade-in on scroll ---
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -40px 0px'
};
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// NOTE: .photo-card intentionally excluded — gallery photo cards are managed
// entirely by gallery.html's own JS. Adding fade-up to them caused hidden
// album photos to become visible via the IntersectionObserver.
document.querySelectorAll('.stat, .service-card, .fg-item, .pg-item, .price-card, .faq-item, .dl-card').forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// Inject fade-up CSS once
const style = document.createElement('style');
style.textContent = `
  .fade-up {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.55s ease, transform 0.55s ease;
  }
  .fade-up.in-view {
    opacity: 1;
    transform: translateY(0);
  }
`;
document.head.appendChild(style);
