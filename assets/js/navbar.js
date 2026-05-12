// assets/js/navbar.js
export function setupNavbar() {
  const role = sessionStorage.getItem('userRole');

  // Dynamically build navbar so every page gets the same logic
  const navbarEl = document.querySelector('.navbar .nav-links');
  if (!navbarEl) return;

  const isAdmin = role === 'admin';

  navbarEl.innerHTML = `
    <a href="gallery.html" id="nav-explore"><i class="fas fa-compass"></i> Explore</a>
    <a href="#" id="nav-post"><i class="fas fa-plus-circle"></i> Post</a>
    <a href="#" id="nav-notif" style="position:relative">
      <i class="fas fa-bell"></i> Notifications
    </a>
    ${isAdmin ? `<a href="adminpost.html" id="nav-approval"><i class="fas fa-clipboard-check"></i> Approval</a>` : ''}
    <a href="profilepage.html" id="nav-profile"><i class="fas fa-user"></i> Profile</a>
  `;

  // Post link routing based on role
  document.getElementById('nav-post').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = isAdmin ? 'adminpost.html' : 'socialpage.html';
  });
}