import { app, db } from "./firebase-config.js";
import { setupNavbar } from "./navbar.js";

setupNavbar();

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  writeBatch
}
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { guardSession, sessionLogout } from './session.js';
// Call guardFunction 
guardSession(['shopowner']);

const auth = getAuth(app);

let notifications = [];

const params = new URLSearchParams(window.location.search);
const selectedType = params.get("type");

const categoryContainer =
  document.getElementById("categoryContainer");

const mainView =
  document.getElementById("mainView");

const detailView =
  document.getElementById("detailView");

const detailTitle =
  document.getElementById("detailTitle");

const detailList =
  document.getElementById("detailList");

const backBtn =
  document.getElementById("backBtn");

const markAllBtn =
  document.getElementById("markAllBtn");


// =========================
// LOAD OWNER CAFE
// =========================

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    console.log("No shop owner logged in");
    return;
  }

  try {

    const ownerSnap =
      await getDoc(
        doc(db, "ShopOwner", user.uid)
      );

    if (!ownerSnap.exists()) {
      console.log("Shop owner not found");
      return;
    }

    const cafeDocId =
      ownerSnap.data().cafeDocId;

    if (!cafeDocId) {
      console.log("No cafeDocId found");
      return;
    }

    const cafeSnap =
      await getDoc(
        doc(db, "cafes", cafeDocId)
      );

    if (!cafeSnap.exists()) {
      console.log("Cafe not found");
      return;
    }

    const cafeName =
      cafeSnap.data().name;

    console.log(
      "Loading notifications for:",
      cafeName
    );

    loadNotifications(cafeName);

  } catch (error) {

    console.error(
      "Notification load error:",
      error
    );
  }
});


// =========================
// LOAD NOTIFICATIONS
// =========================

function loadNotifications(cafeName) {

  const q = query(
    collection(db, "sonotifications"),
    where("cafeName", "==", cafeName)
  );

  onSnapshot(q, (snapshot) => {

    notifications =
  snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
  .sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime; 
  });

    console.log(
      "Cafe Notifications:",
      notifications
    );

    if (selectedType) {

      showDetails(selectedType);

    } else {

      showCategories();
    }

  });

}


// =========================
// BACK BUTTON
// =========================

backBtn?.addEventListener("click", () => {

  window.location.href =
    "sonotification.html";

});


// =========================
// CATEGORY PAGE
// =========================
window.markAsRead = async function(id) {
  try {

    await updateDoc(doc(db, "sonotifications", id), {
      read: true
    });

    const n = notifications.find(x => x.id === id);
    if (n) n.read = true;

    refreshNotificationView();

  } catch (err) {
    console.error(err);
  }
};

markAllBtn?.addEventListener("click", async () => {
  const unreadNotifications =
    notifications.filter(n => n.read !== true);

  if (!unreadNotifications.length) return;

  try {
    const batch = writeBatch(db);

    unreadNotifications.forEach((n) => {
      batch.update(
        doc(db, "sonotifications", n.id),
        { read: true }
      );
    });

    await batch.commit();

    notifications = notifications.map(n => ({
      ...n,
      read: true
    }));

    refreshNotificationView();

  } catch (err) {
    console.error("Error marking all notifications as read:", err);
  }
});

function refreshNotificationView() {
  updateMarkAllButton();

  if (selectedType) {
    showDetails(selectedType);
  } else {
    showCategories();
  }
}

function updateMarkAllButton() {
  if (!markAllBtn) return;

  const unreadCount =
    notifications.filter(n => n.read !== true).length;

  markAllBtn.disabled = unreadCount === 0;
}

function showCategories() {
  updateMarkAllButton();

  const bookingCount =
    notifications.filter(n =>
      (n.type === "booking" || n.type === "reservation") &&
      n.read !== true
    ).length;

  const expiredCount =
    notifications.filter(n =>
      n.type === "expired" &&
      n.read !== true
    ).length;

  const adminCount =
    notifications.filter(n =>
      n.type === "admin" &&
      n.read !== true
    ).length;

  categoryContainer.innerHTML = `
    <div class="category-grid">

      <div class="category-card"
      onclick="goType('booking')">

        <div class="left">
          <div class="icon-box booking">
            <i class="fas fa-calendar-check"></i>
          </div>

          <div>
            <div class="card-title">New Reservations</div>
            <div class="card-subtitle">New customer bookings</div>
          </div>
        </div>

        <div class="count">${bookingCount}</div>

      </div>

      <div class="category-card"
      onclick="goType('expired')">

        <div class="left">
          <div class="icon-box expired">
            <i class="fas fa-clock"></i>
          </div>

          <div>
            <div class="card-title">Expired Reservations</div>
            <div class="card-subtitle">Auto expired bookings</div>
          </div>
        </div>

        <div class="count">${expiredCount}</div>

      </div>

      <div class="category-card"
      onclick="goType('admin')">

        <div class="left">
          <div class="icon-box admin">
            <i class="fas fa-triangle-exclamation"></i>
          </div>

          <div>
            <div class="card-title">Admin Notices</div>
            <div class="card-subtitle">Messages from admin</div>
          </div>
        </div>

        <div class="count">${adminCount}</div>

      </div>

    </div>
  `;
}

// =========================
// OPEN CATEGORY
// =========================

window.goType = function(type) {

  window.location.href =
    `sonotification.html?type=${type}`;

};


// =========================
// DETAIL PAGE
// =========================

function showDetails(type) {
  updateMarkAllButton();

  mainView.style.display = "none";
  detailView.style.display = "block";

  let filtered = [];

  if (type === "booking") {

    filtered =
      notifications.filter(n =>
        n.type === "booking" ||
        n.type === "reservation"
      );

  } else {

    filtered =
      notifications.filter(n =>
        n.type === type
      );
  }

  const titleMap = {

    booking:
      "New Reservations",

    expired:
      "Expired Reservations",

    admin:
      "Admin Notices"
  };

  detailTitle.textContent =
    titleMap[type] ||
    "Notifications";

  detailList.innerHTML =
  filtered.map(n => {

    let dateText = "";

    if (n.createdAt?.toDate) {
      dateText = n.createdAt.toDate().toLocaleString();
    }

    return `
      <div class="detail-card ${n.read ? "read" : "unread"}">

        <div class="detail-title">${n.type}</div>

        <div>${formatTimesInMessage(n.message)}</div>

        <div class="detail-time">${dateText}</div>

        ${!n.read ? `
          <button class="mark-btn"
            onclick="markAsRead('${n.id}')">
            Mark as read
          </button>
        ` : `
          <span class="done-text">✓ Done</span>
        `}

      </div>
    `;

  }).join("");}

function formatTimeDisplay(timeString) {
  if (!timeString || !timeString.includes(":")) return timeString || "";

  const [hourString, minuteString = "00"] = timeString.split(":");
  let hour = Number.parseInt(hourString, 10);
  if (Number.isNaN(hour)) return timeString;

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minuteString} ${ampm}`;
}

function formatTimesInMessage(message) {
  return String(message ?? "").replace(
    /\bat\s+([01]?\d|2[0-3]):([0-5]\d)(?!\s*[AP]M)\b/gi,
    (_match, hour, minute) => `at ${formatTimeDisplay(`${hour}:${minute}`)}`
  );
}
