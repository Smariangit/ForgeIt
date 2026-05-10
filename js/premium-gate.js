// premium-gate.js - shows a free preview, then blurs premium-only sections until Auth verifies access
const PremiumGate = {
  requireAccess(options) {
    const pageName = options.pageName || 'Premium Content';
    const content = document.getElementById(options.contentId);
    const isPremium = typeof Auth !== 'undefined' && Auth.isPremium();

    if (!content) return isPremium;
    content.classList.remove('hidden');

    if (isPremium) {
      content.classList.remove('premium-preview-locked');
      content.querySelectorAll('.premium-preview-overlay').forEach(overlay => overlay.remove());
      return true;
    }

    content.classList.add('premium-preview-locked');
    this.lockPreviewZones(content, pageName);
    return false;
  },

  lockPreviewZones(content, pageName) {
    const zones = content.querySelectorAll('.premium-preview-zone');
    zones.forEach(zone => {
      if (zone.querySelector('.premium-preview-overlay')) return;

      const overlay = document.createElement('div');
      overlay.className = 'premium-preview-overlay';
      overlay.innerHTML = `
        <div class="premium-preview-card">
          <span class="section-label">PREMIUM ONLY</span>
          <h2>${pageName}</h2>
          <p>Preview the beginning for free. Verify premium access to unlock the full page.</p>
          <div class="premium-gate-actions">
            <a class="btn-primary" href="premium.html">Get Premium</a>
            <button class="btn-outline" type="button" data-premium-login>Login</button>
          </div>
        </div>
      `;
      zone.appendChild(overlay);
    });

    content.querySelectorAll('[data-premium-login]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById('loginModal');
        if (modal) modal.classList.add('active');
      });
    });
  }
};

window.PremiumGate = PremiumGate;