// assets/js/navbar.js

import {
  getAuth,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

export function setupNavbar() {

  const role     = sessionStorage.getItem('userRole');
  const navbarEl = document.querySelector('.navbar .nav-links');

  if (!navbarEl) return;

  const isAdmin     = role === 'admin';
  const isShopOwner = role === 'shopowner';

  navbarEl.innerHTML = `

    ${/* ── EXPLORE: hidden for shop owner only ── */
    !isShopOwner ? `
      <a href="gallery.html" id="nav-explore">
        <i class="fas fa-compass"></i> Explore
      </a>
    ` : ''}

    ${/* ── POST: hidden for shop owner only ── */
    !isShopOwner ? `
      <a href="#" id="nav-post">
        <i class="fas fa-plus-circle"></i> Post
      </a>
    ` : ''}

    ${/* ── NOTIFICATIONS: everyone sees this ── */
    `<a href="#" id="nav-notif" style="position:relative">
      <i class="fas fa-bell"></i> Notifications
    </a>`}

    ${/* ── APPROVAL: admin only ── */
    isAdmin ? `
      <a href="adminapprove.html" id="nav-approval">
        <i class="fas fa-clipboard-check"></i> Approval
      </a>
    ` : ''}

    ${/* ── DASHBOARD: shop owner only ── */
    isShopOwner ? `
      <a href="so_dashboard.html" id="nav-dashboard">
        <i class="fas fa-store"></i> Dashboard
      </a>
    ` : ''}

    ${/* ── PROFILE: everyone except admin ── */
    !isAdmin ? `
      <a href="profilepage.html" id="nav-profile">
        <i class="fas fa-user"></i> Profile
      </a>
    ` : ''}

    ${/* ── LOGOUT: admin only ── */
    isAdmin ? `
      <button id="nav-logout" class="nav-logout-btn">
        <i class="fas fa-sign-out-alt"></i> Log Out
      </button>
    ` : ''}
  `;

  /* ── POST ROUTING ── */
  document.getElementById('nav-post')?.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = isAdmin ? 'adminpost.html' : 'socialpage.html';
  });

  /* ── ACTIVE PAGE ── */
  const currentPage = window.location.pathname.split("/").pop();

  const activeMap = {
    "gallery.html":     "nav-explore",
    "socialpage.html":  "nav-post",
    "adminpost.html":   "nav-post",
    "profilepage.html": "nav-profile",
    "so.html":          "nav-dashboard",
  };

  const activeId = activeMap[currentPage];
  if (activeId) document.getElementById(activeId)?.classList.add("active");

  /* ── LOGOUT ── */
  document.getElementById('nav-logout')?.addEventListener('click', async () => {

    if (!confirm("Are you sure you want to log out?")) return;

    try {
      const auth = getAuth();
      await signOut(auth);
      sessionStorage.removeItem('userRole');
      window.location.href = 'index.html';
    } catch (err) {
      console.error("Logout error:", err);
      alert("Failed to log out. Please try again.");
    }
  });
}