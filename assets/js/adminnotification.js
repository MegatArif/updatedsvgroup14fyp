// assets/js/adminnotification.js
// Admin Notification page — displays system-wide notifications for admins.
// Replicates the theme and functionality of customernotification.js.

import { db, app } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { setupNavbar } from "./navbar.js";
import { guardSession } from "./session.js";

// Guard this page for admin role only
guardSession(["admin"]);

setupNavbar();

const auth = getAuth(app);

const notificationList = document.getElementById("notificationList");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const markAllReadBtn = document.getElementById("markAllReadBtn");
const tabs = document.querySelectorAll(".ntab");

let allNotifications = [];
let currentFilter = "all"; // 'all' or 'unread'

// Helper to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Render notifications
const renderNotifications = () => {
  notificationList.innerHTML = "";
  loadingState.classList.add("hidden");

  const filteredNotifications = allNotifications.filter((notif) => {
    if (currentFilter === "unread") {
      return !notif.read;
    }
    return true; // 'all' filter
  });

  const actualUnreadCount = allNotifications.filter((notif) => !notif.read).length;

  if (filteredNotifications.length === 0) {
    markAllReadBtn.disabled = (actualUnreadCount === 0); // Disable if no unread notifications exist
    markAllReadBtn.textContent = `Mark all as read`; // Reset text if no notifications
    return;
  }

  emptyState.classList.add("hidden");
  markAllReadBtn.disabled = false;

  filteredNotifications.forEach((notif) => {
    const notifCard = document.createElement("div");
    notifCard.className = `notif-card ${notif.read ? "read" : "unread"}`;

    let iconClass = "fas fa-info-circle"; // Default icon
    let iconTypeClass = "admin_message"; // Default type class

    switch (notif.type) {
      case "payment_success":
        iconClass = "fas fa-money-bill-wave";
        iconTypeClass = "payment_success";
        break;
      case "new_cafe_registration":
        iconClass = "fas fa-store";
        iconTypeClass = "admin_message";
        break;
      // Add more cases for other admin notification types
    }

    notifCard.innerHTML = `
            <div class="notif-icon ${iconTypeClass}">
                <i class="${iconClass}"></i>
            </div>
            <div class="notif-content">
                <p class="notif-msg">${notif.message}</p>
                <div class="notif-meta">
                    ${notif.cafeName ? `<span><i class="fas fa-coffee"></i> ${notif.cafeName}</span>` : ''}
                    ${notif.reservationId ? `<span><i class="fas fa-receipt"></i> ${notif.reservationId.substring(0, 6)}...</span>` : ''}
                    <span><i class="fas fa-clock"></i> ${formatTimestamp(notif.createdAt)}</span>
                </div>
            </div>
            ${!notif.read ? '<span class="unread-dot"></span>' : ''}
            <button class="btn-mark-read" data-id="${notif.id}" ${notif.read ? 'style="visibility: hidden;"' : ''}>
                <i class="fas fa-eye"></i> Mark Read
            </button>
        `;
    notificationList.appendChild(notifCard);
  });

  // Add event listeners for "Mark Read" buttons
  document.querySelectorAll(".btn-mark-read").forEach((button) => {
    button.addEventListener("click", (e) => {
      const notifId = e.currentTarget.dataset.id;
      markNotificationAsRead(notifId);
    });
  });
};

// Mark a single notification as read
const markNotificationAsRead = async (id) => {
  try {
    await updateDoc(doc(db, "adminnotifications", id), {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

// Mark all filtered notifications as read
markAllReadBtn.addEventListener("click", async () => {
  const unreadNotifications = allNotifications.filter((notif) => !notif.read);
  if (unreadNotifications.length === 0) return;

  if (confirm(`Mark all ${unreadNotifications.length} unread notifications as read?`)) {
    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach((notif) => {
        const notifRef = doc(db, "adminnotifications", notif.id);
        batch.update(notifRef, { read: true, readAt: serverTimestamp() });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }
});

// Tab filtering
tabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    tabs.forEach((t) => t.classList.remove("active"));
    e.currentTarget.classList.add("active");
    currentFilter = e.currentTarget.dataset.filter;
    renderNotifications();
  });
});

// Listen for admin notifications
onAuthStateChanged(auth, (user) => {
  if (!user) return; // Should be guarded by guardSession, but good to double check

  loadingState.classList.remove("hidden");
  emptyState.classList.add("hidden");

  // Query all admin notifications, ordered by creation time
  const q = query(collection(db, "adminnotifications"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    allNotifications = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    renderNotifications();
  });
});