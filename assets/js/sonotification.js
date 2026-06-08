import { app, db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc
}
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

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

      }));

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

function showCategories() {

  const bookingCount =
    notifications.filter(n =>
      n.type === "booking" ||
      n.type === "reservation"
    ).length;

  const expiredCount =
    notifications.filter(n =>
      n.type === "expired"
    ).length;

  const adminCount =
    notifications.filter(n =>
      n.type === "admin"
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
            <div class="card-title">
              New Reservations
            </div>

            <div class="card-subtitle">
              New customer bookings
            </div>
          </div>

        </div>

        <div class="count">
          ${bookingCount}
        </div>

      </div>

      <div class="category-card"
      onclick="goType('expired')">

        <div class="left">

          <div class="icon-box expired">
            <i class="fas fa-clock"></i>
          </div>

          <div>
            <div class="card-title">
              Expired Reservations
            </div>

            <div class="card-subtitle">
              Auto expired bookings
            </div>
          </div>

        </div>

        <div class="count">
          ${expiredCount}
        </div>

      </div>

      <div class="category-card"
      onclick="goType('admin')">

        <div class="left">

          <div class="icon-box admin">
            <i class="fas fa-triangle-exclamation"></i>
          </div>

          <div>
            <div class="card-title">
              Admin Notices
            </div>

            <div class="card-subtitle">
              Messages from admin
            </div>
          </div>

        </div>

        <div class="count">
          ${adminCount}
        </div>

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

        dateText =
          n.createdAt
          .toDate()
          .toLocaleString();
      }

      return `

        <div class="detail-card">

          <div class="detail-title">
            ${n.type}
          </div>

          <div>
            ${n.message || ""}
          </div>

          <div class="detail-time">
            ${dateText}
          </div>

        </div>

      `;

    }).join("");

  if (filtered.length === 0) {

    detailList.innerHTML = `

      <div class="detail-card">

        No notifications found.

      </div>

    `;
  }
}