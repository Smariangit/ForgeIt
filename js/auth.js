// auth.js — SSBForge simple auth (localStorage-based for GitHub Pages)
// For production, replace with a real backend (Supabase free tier recommended)

const Auth = {
  getUser() {
    try { return JSON.parse(localStorage.getItem('ssbUser') || 'null'); }
    catch { return null; }
  },

  setUser(user) {
    localStorage.setItem('ssbUser', JSON.stringify(user));
  },

// FOR REAL WORLD SCENARIOS, USE THE COMMENTED isPremium() function
  /*isPremium() {
    const u = this.getUser();
    if (!u || !u.isPremium) return false;
    if (u.premiumExpiry && new Date(u.premiumExpiry) < new Date()) {
      u.isPremium = false;
      this.setUser(u);
      return false;
    }
    return true;
  },*/
  isPremium() {
  const u = this.getUser();

  if (!u) return false;

  // Test account override
  if (u.email?.toLowerCase() === "spartenx.21@gmail.com") {
    return true;
  }

  // Normal premium logic
  if (!u.isPremium) return false;

  // Expiry check
  if (u.premiumExpiry && new Date(u.premiumExpiry) < new Date()) {
    u.isPremium = false;
    this.setUser(u);
    return false;
  }

  return true;
},

  register(name, email, password) {
    // In a real app, send to backend. Here we store locally.
    const existing = this.getUser();
    if (existing && existing.email === email) return { error: 'Account already exists.' };
    const user = {
      name, email,
      passwordHash: btoa(password), // NOT real security — demo only
      isPremium: false,
      createdAt: new Date().toISOString()
    };
    this.setUser(user);
    return { user };
  },

  login(email, password) {
    const u = this.getUser();
    if (!u || u.email !== email) return { error: 'No account found with this email.' };
    if (u.passwordHash !== btoa(password)) return { error: 'Incorrect password.' };
    return { user: u };
  },

  logout() {
    localStorage.removeItem('ssbUser');
    window.location.href = 'index.html';
  }
};

// Expose globally
window.Auth = Auth;
