// nav.js — Auto-injects the correct navigation into every page
// Include this as the FIRST script on every page

(function() {
  const LINKS = [
    { href: 'index.html',          label: 'Home' },
    { href: 'ssb.html',            label: 'SSB' },
    { href: 'practice.html',       label: 'Practice' },
    { href: 'current-affairs.html',label: 'Current Affairs' },
    { href: 'mind-forge.html',    label: 'Mind Forge' },
    { href: 'premium.html',        label: 'Premium' },
  ];

  function buildNav() {
    const container = document.getElementById('navLinks');
    if (!container) return;

    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const isPremium = typeof Auth !== 'undefined' ? Auth.isPremium() : false;

    let html = '';
    LINKS.forEach(link => {
      const isActive = currentFile === link.href || currentFile === '' && link.href === 'index.html';
      html += '<a href="' + link.href + '"' + (isActive ? ' style="color:var(--gold)"' : '') + '>' + link.label + '</a>';
    });

    // Login / Account button
    if (user) {
      const displayName = (user.name ? user.name.split(' ')[0] : user.email.split('@')[0]) + (isPremium ? ' ⭐' : '');
      html += '<a href="#" id="loginBtn" title="Click to logout">' + displayName + '</a>';
    } else {
      html += '<a href="#" id="loginBtn">Login</a>';
    }

    container.innerHTML = html;

    // Wire login/logout
    const lb = document.getElementById('loginBtn');
    if (lb) {
      lb.addEventListener('click', function(e) {
        e.preventDefault();
        if (user) {
          if (confirm('Logged in as ' + user.email + '.\nLogout?')) {
            localStorage.removeItem('ssbUser');
            window.location.reload();
          }
        } else {
          const modal = document.getElementById('loginModal');
          if (modal) modal.classList.add('active');
        }
      });
    }
  }

  // Run after DOM + Auth are ready
  document.addEventListener('DOMContentLoaded', buildNav);
})();
