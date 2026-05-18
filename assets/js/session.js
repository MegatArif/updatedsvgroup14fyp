// =============================================================
//  session.js  — CafeHunt centralised session management
//
//  Usage (add ONE import + ONE call at the top of every JS file
//  that needs a protected page):
//
//    import { guardSession, sessionLogout } from './session.js';
//    guardSession(['customer']);          // allowed roles
//    guardSession(['admin']);
//    guardSession(['customer', 'admin']); // either role is fine
//
//  For pages that should be public (gallery, index) just omit
//  guardSession() — or call guardSession(null) to skip the check.
// =============================================================

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { app } from './firebase-config.js';

const auth = getAuth(app);

// ── Helpers ──────────────────────────────────────────────────

/** Read the current role from sessionStorage. */
export function getRole() {
  return sessionStorage.getItem('userRole') || null;
}

/** True if a Firebase user is currently signed-in. */
export function isLoggedIn() {
  return !!auth.currentUser;
}

// ── Main guard ───────────────────────────────────────────────

/**
 * guardSession(allowedRoles)
 *
 * Call at page-load time.  Waits for Firebase auth to resolve,
 * then checks sessionStorage role.  If the user is not logged in
 * OR their role is not in allowedRoles, they are redirected to
 * index.html immediately — the page never renders.
 *
 * @param {string[]|null} allowedRoles  e.g. ['customer'] or ['admin']
 *        Pass null / omit to skip the role check (public pages).
 */
export function guardSession(allowedRoles = null) {

  // Block rendering immediately while we resolve auth state.
  // We apply a tiny visibility trick so there is no flash of
  // protected content before the redirect fires.
  document.documentElement.style.visibility = 'hidden';

  onAuthStateChanged(auth, (user) => {

    // No Firebase user at all → send to login
    if (!user) {
      window.location.replace('index.html');
      return;
    }

    // Firebase user exists but sessionStorage role is missing
    // (e.g. user refreshed after clearing storage manually)
    // — We can't trust the page; boot them back to login.
    const role = getRole();

    if (!role) {
      window.location.replace('index.html');
      return;
    }

    // Role check (when allowedRoles is specified)
    if (allowedRoles && !allowedRoles.includes(role)) {
      // Wrong role for this page — send to the right place
      if (role === 'admin') {
        window.location.replace('adminpost.html');
      } else {
        window.location.replace('socialpage.html');
      }
      return;
    }

    // All good — reveal the page
    document.documentElement.style.visibility = '';
  });
}

// ── Logout ───────────────────────────────────────────────────

/**
 * sessionLogout()
 *
 * Signs out from Firebase, wipes sessionStorage, then redirects
 * to index.html.  Safe to call from any page.
 */
export async function sessionLogout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signOut error:', err);
  } finally {
    sessionStorage.clear();
    // Use replace so the back-button cannot return to the page
    window.location.replace('index.html');
  }
}

// ── Back-button / bfcache defence ────────────────────────────
//
// Browsers restore pages from the back-forward cache (bfcache)
// without re-running JS.  We listen for the pageshow event and
// re-validate the session every time the page becomes visible.
//
window.addEventListener('pageshow', (e) => {

  // pageshow fires on normal load too; persisted = true means bfcache
  if (!e.persisted) return;

  const role = getRole();

  // If we are on a page that requires login and there is no role
  // (user logged out in another tab or via back-button after logout)
  // — redirect immediately.
  onAuthStateChanged(auth, (user) => {
    if (!user || !role) {
      window.location.replace('index.html');
    }
  });
});