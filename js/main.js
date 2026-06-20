// main.js — SSBForge General UI

document.addEventListener('DOMContentLoaded', function() {
  ensureLoginModal();
  ensurePasswordToggle('loginPassword', 'loginPasswordToggle', 'Password');

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
  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

  if (loginBtn && loginModal && !loginBtn.dataset.authWired) {
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
    doLogin.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pwd = document.getElementById('loginPassword').value;
      if (!email || !pwd) { alert('Please enter email and password.'); return; }
      setAuthButtonState(doLogin, true, 'Signing in...');
      const result = await Auth.login(email, pwd);
      setAuthButtonState(doLogin, false, 'Login');
      if (result.error) {
        alert(result.error);
        return;
      }
      const user = Auth.getUser();
      loginModal.classList.remove('active');
      updateLoginBtn();
      alert(`Welcome back, ${user?.name || user?.email || email}!`);
      window.location.reload();
    });
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      if (!email) {
        alert('Enter your email first.');
        return;
      }

      setAuthButtonState(forgotPasswordBtn, true, 'Sending reset link...');
      await resetPasswordFlow(email);
      setAuthButtonState(forgotPasswordBtn, false, 'Forgot Password');
    });
  }

  // Register button
  const goRegister = document.getElementById('goRegister');
  if (goRegister) {
    goRegister.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim();
      const pwd = document.getElementById('loginPassword').value;
      if (!email || !pwd) { alert('Please enter an email and password to register.'); return; }
      const name = prompt('Your name (optional):') || '';
      setAuthButtonState(goRegister, true, 'Creating account...');
      const result = await Auth.register(name, email, pwd);
      setAuthButtonState(goRegister, false, 'Create Free Account');
      if (result.error) { alert(result.error); return; }
      if (result.confirm) {
        alert(result.message || 'Account created. Please confirm your email, then log in.');
        return;
      }
      loginModal.classList.remove('active');
      updateLoginBtn();
      alert(`Account created! Welcome to SSBForge, ${name || email}.`);
      window.location.reload();
    });
  }

  function setAuthButtonState(button, isBusy, label) {
    if (!button) return;
    button.disabled = isBusy;
    button.textContent = label;
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

function ensureLoginModal() {
  let loginModal = document.getElementById('loginModal');

  if (!loginModal) {
    loginModal = document.createElement('div');
    loginModal.className = 'modal-overlay';
    loginModal.id = 'loginModal';
    loginModal.innerHTML = `
      <div class="modal">
        <button class="modal-close" id="modalClose">x</button>
        <h2>Login to SSBForge</h2>
        <input type="email" id="loginEmail" placeholder="Email address" class="modal-input" />
        <input type="password" id="loginPassword" placeholder="Password" class="modal-input" />
        <button class="btn-primary full-width" id="doLogin">Login</button>
        <div class="modal-divider">or</div>
        <button class="btn-outline full-width" id="goRegister">Create Free Account</button>
      </div>
    `;
    document.body.appendChild(loginModal);
  }

  const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  const doLogin = document.getElementById('doLogin');
  if (!forgotPasswordBtn && doLogin) {
    const button = document.createElement('button');
    button.className = 'btn-outline full-width';
    button.id = 'forgotPasswordBtn';
    button.type = 'button';
    button.style.marginTop = '10px';
    button.textContent = 'Forgot Password';
    doLogin.insertAdjacentElement('afterend', button);
  }

  ensurePasswordToggle('loginPassword', 'loginPasswordToggle', 'Password');
}

function ensurePasswordToggle(inputId, buttonId, label) {
  const input = document.getElementById(inputId);
  if (!input || document.getElementById(buttonId)) return;

  const button = document.createElement('button');
  button.className = 'btn-outline full-width';
  button.id = buttonId;
  button.type = 'button';
  button.style.marginTop = '8px';
  button.textContent = 'Show ' + label;

  button.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    button.textContent = (isHidden ? 'Hide ' : 'Show ') + label;
  });

  input.insertAdjacentElement('afterend', button);
}
