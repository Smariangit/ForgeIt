// nav.js - Auto-injects the correct navigation into every page
// Include this as the FIRST script on every page

(function() {
  const LINKS = [
    { href: 'index.html',           label: 'Home' },
    { href: 'ssb.html',             label: 'SSB' },
    { href: 'practice.html',        label: 'Practice' },
    { href: 'progress.html',        label: 'Progress' },
    { href: 'current-affairs.html', label: 'Current Affairs' },
    { href: 'mind-forge.html',      label: 'Mind Forge' },
    { href: 'premium.html',         label: 'Premium' },
  ];

  function buildNav() {
    const container = document.getElementById('navLinks');
    if (!container) return;

    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;

    let html = '';
    LINKS.forEach(link => {
      const isActive = currentFile === link.href || (currentFile === '' && link.href === 'index.html');
      html += '<a href="' + link.href + '"' + (isActive ? ' style="color:var(--gold)"' : '') + '>' + link.label + '</a>';
    });

    if (user) {
      const displayName = user.name ? user.name.split(' ')[0] : user.email.split('@')[0];
      html += '<a href="#" id="loginBtn" title="Click to logout">' + displayName + '</a>';
    } else {
      html += '<a href="#" id="loginBtn">Login</a>';
    }

    container.innerHTML = html;

    const lb = document.getElementById('loginBtn');
    if (lb) {
      lb.dataset.authWired = 'true';
      lb.addEventListener('click', function(e) {
        e.preventDefault();
        if (user) {
          if (confirm('Logged in as ' + user.email + '.\nLogout?')) {
            if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout();
          }
        } else {
          const modal = document.getElementById('loginModal');
          if (modal) modal.classList.add('active');
        }
      });
    }

  }

  document.addEventListener('DOMContentLoaded', buildNav);
})();

