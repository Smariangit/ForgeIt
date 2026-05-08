// premium-gate.js - hides premium-only pages until Auth verifies access
const PremiumGate = {
  requireAccess(options) {
    const pageName = options.pageName || 'Premium Content';
    const content = document.getElementById(options.contentId);
    const isPremium = typeof Auth !== 'undefined' && Auth.isPremium();

    if (isPremium) {
      if (content) content.classList.remove('hidden');
      return true;
    }

    if (content) content.classList.add('hidden');
    this.showLockedState(pageName);
    return false;
  },

  showLockedState(pageName) {
    if (document.getElementById('premiumGate')) return;

    const gate = document.createElement('main');
    gate.id = 'premiumGate';
    gate.className = 'premium-gate-page';
    gate.innerHTML = `
      <section class="premium-gate-card">
        <span class="section-label">PREMIUM ONLY</span>
        <h1>${pageName}</h1>
        <p>This page opens after your premium access is verified. Subscribe or login with a premium account to view the full content.</p>
        <div class="premium-gate-actions">
          <a class="btn-primary" href="premium.html">Get Premium</a>
          <button class="btn-outline" id="premiumGateLogin">Login</button>
        </div>
      </section>
    `;

    const navbar = document.getElementById('navbar');
    if (navbar && navbar.nextSibling) {
      navbar.parentNode.insertBefore(gate, navbar.nextSibling);
    } else {
      document.body.prepend(gate);
    }

    const loginBtn = document.getElementById('premiumGateLogin');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.add('active');
      });
    }
  }
};

window.PremiumGate = PremiumGate;