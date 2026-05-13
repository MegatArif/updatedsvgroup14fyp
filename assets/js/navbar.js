// assets/js/navbar.js

import { 
  getAuth, 
  signOut 
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

export function setupNavbar() {

  const role = sessionStorage.getItem('userRole');

  const navbarEl = document.querySelector('.navbar .nav-links');

  if (!navbarEl) return;

  const isAdmin = role === 'admin';

  navbarEl.innerHTML = `
    <a href="gallery.html" id="nav-explore">
      <i class="fas fa-compass"></i> Explore
    </a>

    <a href="#" id="nav-post">
      <i class="fas fa-plus-circle"></i> Post
    </a>

    <a href="#" id="nav-notif" style="position:relative">
      <i class="fas fa-bell"></i> Notifications
    </a>

    ${isAdmin ? `
      <a href="#" id="nav-approval">
        <i class="fas fa-clipboard-check"></i> Approval
      </a>
    ` : ''}

    ${!isAdmin ? `
      <a href="profilepage.html" id="nav-profile">
        <i class="fas fa-user"></i> Profile
      </a>
    ` : ''}

    ${isAdmin ? `
      <button id="nav-logout" class="nav-logout-btn">
        <i class="fas fa-sign-out-alt"></i> Log Out
      </button>
    ` : ''}
  `;

  /* POST ROUTING */

  document.getElementById('nav-post')?.addEventListener('click', (e) => {

    e.preventDefault();

    window.location.href = isAdmin
      ? 'adminpost.html'
      : 'socialpage.html';
  });

  /* ACTIVE PAGE */

  const currentPage = window.location.pathname.split("/").pop();

  if(currentPage === "gallery.html"){
    document.getElementById("nav-explore")
      ?.classList.add("active");
  }

  if(currentPage === "socialpage.html"){
    document.getElementById("nav-post")
      ?.classList.add("active");
  }

  if(currentPage === "profilepage.html"){
    document.getElementById("nav-profile")
      ?.classList.add("active");
  }

  /* LOGOUT */

  document.getElementById('nav-logout')
    ?.addEventListener('click', async () => {

    const confirmLogout = confirm(
      "Are you sure you want to log out?"
    );

    if (!confirmLogout) return;

    try {

      const auth = getAuth();

      await signOut(auth);

      sessionStorage.removeItem('userRole');

      window.location.href = 'index.html';

    } catch (error) {

      console.error("Logout error:", error);

      alert("Failed to log out. Please try again.");
    }
  });
}
