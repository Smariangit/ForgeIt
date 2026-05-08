// main.js — SSBForge General UI

document.addEventListener('DOMContentLoaded', function() {
  // ===== NAV: hamburger =====
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
  }

  // ===== NAV: scroll effect =====
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.style.background = window.scrollY > 40
        ? 'rgba(14,21,17,0.98)'
        : 'rgba(14,21,17,0.92)';
    });
  }

  // ===== LOGIN MODAL =====
  const loginBtn = document.getElementById('loginBtn');
  const loginModal = document.getElementById('loginModal');
  const modalClose = document.getElementById('modalClose');

  if (loginBtn && loginModal) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const user = Auth.getUser();
      if (user) {
        if (confirm(`Logged in as ${user.email}. Logout?`)) Auth.logout();
      } else {
        loginModal.classList.add('active');
      }
    });
  }

  if (modalClose && loginModal) {
    modalClose.addEventListener('click', () => loginModal.classList.remove('active'));
    loginModal.addEventListener('click', (e) => {
      if (e.target === loginModal) loginModal.classList.remove('active');
    });
  }

  // Login form
  const doLogin = document.getElementById('doLogin');
  if (doLogin) {
    doLogin.addEventListener('click', () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pwd = document.getElementById('loginPassword').value;
      if (!email || !pwd) { alert('Please enter email and password.'); return; }
      const result = Auth.login(email, pwd);
      if (result.error) { alert(result.error); return; }
      loginModal.classList.remove('active');
      updateLoginBtn();
      alert(`Welcome back, ${result.user.name || result.user.email}!`);
      window.location.reload();
    });
  }

  // Register button
  const goRegister = document.getElementById('goRegister');
  if (goRegister) {
    goRegister.addEventListener('click', () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pwd = document.getElementById('loginPassword').value;
      if (!email || !pwd) { alert('Please enter an email and password to register.'); return; }
      const name = prompt('Your name (optional):') || '';
      const result = Auth.register(name, email, pwd);
      if (result.error) { alert(result.error); return; }
      loginModal.classList.remove('active');
      updateLoginBtn();
      alert(`Account created! Welcome to SSBForge, ${name || email}.`);
      window.location.reload();
    });
  }

  // ===== Update login button text =====
  function updateLoginBtn() {
    const lb = document.getElementById('loginBtn');
    if (!lb) return;
    const user = Auth.getUser();
    if (user) {
      lb.textContent = user.name ? user.name.split(' ')[0] : 'Account';
    } else {
      lb.textContent = 'Login';
    }
  }
  updateLoginBtn();

  // ===== Ticker duplicate for infinite loop =====
  const ticker = document.getElementById('quoteTicker');
  if (ticker) {
    ticker.innerHTML += ticker.innerHTML; // duplicate for seamless loop
  }

  // ===== Animate module cards on scroll =====
  if ('IntersectionObserver' in window) {
    const cards = document.querySelectorAll('.module-card, .feature-item, .newspaper-card');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    cards.forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(card);
    });
  }
});
