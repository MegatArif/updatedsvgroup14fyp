// assets/js/navbar.js
// MODIFIED: notification bell now routes to customernotification.html for customers
// and shows a live unread-count badge driven by Firestore.

import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { showConfirm } from './toast.js';
// ADDED: Firestore imports needed for the live unread badge
import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  onSnapshot,
   getDoc,
   doc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

export function setupNavbar() {

  const role     = sessionStorage.getItem('userRole');
  const navbarEl = document.querySelector('.navbar .nav-links');

  if (!navbarEl) return;

  const isAdmin     = role === 'admin';
  const isShopOwner = role === 'shopowner';
  const isCustomer  = role === 'customer';

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

    ${/* ── RESERVATIONS: customer only ── */
    isCustomer ? `
      <a href="reservation.html" id="nav-reservations">
        <i class="fas fa-calendar-check"></i> Reservations
      </a>
    ` : ''}

    ${/* ── NOTIFICATIONS: everyone sees this ──
          MODIFIED: href now goes to customernotification.html for customers;
          admin/shopowner keep href="#" (they have no inbox page yet).
          A <span id="notif-badge"> is injected and filled by the live listener below. ── */
    `<a href="${isAdmin ? 'adminnotification.html' : isCustomer ? 'customernotification.html' : isShopOwner ? 'sonotification.html': '#'}" id="nav-notif" style="position:relative">
      <i class="fas fa-bell"></i> Notifications
      <span id="notif-badge" class="notif-badge" style="display:none;"></span>
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
      <a href="${isShopOwner ? 'profilesopage.html' : 'profilepage.html'}" id="nav-profile">
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
    "gallery.html":                "nav-explore",
    "socialpage.html":             "nav-post",
    "adminpost.html":              "nav-post",
    "profilepage.html":            "nav-profile",
    "profilesopage.html":          "nav-profileso",
    "so_dashboard.html":           "nav-dashboard",
    "reservation.html":            "nav-reservations",
    "adminnotification.html":      "nav-notif",
    // ADDED: mark notifications link active when on the notification page
    "customernotification.html":   "nav-notif",
  };

  const activeId = activeMap[currentPage];
  if (activeId) document.getElementById(activeId)?.classList.add("active");

  /* ── LOGOUT ── */
  document.getElementById('nav-logout')?.addEventListener('click', () => {
    showConfirm("Are you sure you want to log out?", async () => {
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
});

  /* ── LIVE UNREAD BADGE (customer only) ──────────────────────────────────────
     ADDED: listens to the notifications collection for this user and shows
     an unread count on the bell icon. Uses onAuthStateChanged so we have a UID
     before querying Firestore.
     Only runs for the customer role to avoid pointless listeners for admin/SO. ── */
  if (isCustomer) {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const badgeEl = document.getElementById("notif-badge");
      if (!badgeEl) return;

      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("read", "==", false)
      );

      // onSnapshot gives live updates — badge refreshes instantly when a new
      // notification is written or when the user marks one as read.
      onSnapshot(q, (snap) => {
        const count = snap.size;
        if (count > 0) {
          badgeEl.textContent = count > 99 ? "99+" : String(count);
          badgeEl.style.display = "flex";
        } else {
          badgeEl.style.display = "none";
        }
      });
    });
  }
   /* ── LIVE UNREAD BADGE (admin only) ────────────────────────────────────── */
  if (isAdmin) {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const badgeEl = document.getElementById("admin-notif-badge");
      if (!badgeEl) return;

      const q = query(
        collection(db, "adminnotifications"), // Query the new adminnotifications collection
        where("read", "==", false)
      );

      onSnapshot(q, (snap) => {
        const count = snap.size;
        if (count > 0) {
          badgeEl.textContent = count > 99 ? "99+" : String(count);
          badgeEl.style.display = "flex";
        } else {
          badgeEl.style.display = "none";
        }
      });
    });
  }

  if (isShopOwner) {

  const auth = getAuth();

  onAuthStateChanged(auth, async (user) => {

    if (!user) return;

    try {

      const ownerSnap = await getDoc(doc(db, "ShopOwner", user.uid));
      if (!ownerSnap.exists()) return;

      const cafeDocId = ownerSnap.data().cafeDocId;

      const cafeSnap = await getDoc(doc(db, "cafes", cafeDocId));
      if (!cafeSnap.exists()) return;

      const cafeName = cafeSnap.data().name;

      const q = query(
        collection(db, "sonotifications"),
        where("cafeName", "==", cafeName),
        where("read", "==", false)
      );

      onSnapshot(q, (snap) => {

        const badgeEl = document.getElementById("notif-badge");
        if (!badgeEl) return;

        const count = snap.size;

        if (count > 0) {
          badgeEl.textContent = count > 99 ? "99+" : String(count);
          badgeEl.style.display = "flex";
        } else {
          badgeEl.style.display = "none";
        }

      });

    } catch (err) {
      console.error("shop owner notif error:", err);
    }

  });
}
}


