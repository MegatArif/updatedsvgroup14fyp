import { db, app } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { setupNavbar } from './navbar.js';
setupNavbar();

const auth = getAuth(app);

// ============================
// CONTAINERS
// ============================
const activeContainer = document.getElementById("activeReservations");
const pastContainer = document.getElementById("pastReservations");

// ============================
// STATE
// ============================
let currentUser = null;

// ============================
// AUTH LISTENER (IMPORTANT)
// ============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.error("❌ No user logged in");
    return;
  }

  // get profile from Firestore
  const snap = await getDoc(doc(db, "Customers", user.uid));
  const data = snap.exists() ? snap.data() : {};

  currentUser = {
    userId: user.uid,
    username: data.username || user.email
  };

  console.log("👤 Logged in:", currentUser);

  loadReservations();
});

// ============================
// LOAD RESERVATIONS
// ============================
function loadReservations() {
  if (!currentUser) return;

  const q = query(
    collection(db, "reservation"),
    where("userId", "==", currentUser.userId)
  );

  onSnapshot(q, (snapshot) => {
    activeContainer.innerHTML = "";
    pastContainer.innerHTML = "";

    if (snapshot.empty) {
      activeContainer.innerHTML = `
        <p style="color:#c98b3b;font-weight:600;">
          No reservations found
        </p>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      renderReservation(docSnap.data());
    });
  });
}

// ============================
// RENDER RESERVATION
// ============================
function renderReservation(data) {

  const reservationDate = new Date(`${data.date}T${data.time}`);
  const now = new Date();

  const isActive = reservationDate > now;

  const statusText = isActive ? "ACTIVE" : "COMPLETED";
  const statusClass = isActive ? "status-active" : "status-past";

  const container = isActive ? activeContainer : pastContainer;

  container.innerHTML += `
    <div class="reservation-card"
      data-cafe="${data.cafe}"
      data-location="${data.location}"
      data-date="${data.date}"
      data-time="${data.time}"
      data-guests="${data.guests}"
      data-status="${statusText}"
    >

      <div class="card-top">

        <div>
          <h3>${data.cafe}</h3>

          <p class="location">
            <i class="fa-solid fa-location-dot"></i>
            ${data.location}
          </p>
        </div>

        <span class="status ${statusClass}">
          ${statusText}
        </span>

      </div>

      <div class="booking-info">
        <div class="info-box">
          <span>Date</span>
          <strong>${data.date}</strong>
        </div>

        <div class="info-box">
          <span>Time</span>
          <strong>${data.time}</strong>
        </div>

        <div class="info-box">
          <span>Guests</span>
          <strong>${data.guests} Pax</strong>
        </div>
      </div>

      <button class="receipt-btn" onclick="downloadReceipt(this)">
        <i class="fa-solid fa-download"></i>
        Download Receipt
      </button>

    </div>
  `;
}

// ============================
// PDF RECEIPT (UNCHANGED)
// ============================
window.downloadReceipt = function (btn) {

  const card = btn.closest(".reservation-card");

  const data = {
    cafe: card.dataset.cafe,
    location: card.dataset.location,
    date: card.dataset.date,
    time: card.dataset.time,
    guests: card.dataset.guests,
    status: card.dataset.status
  };

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    unit: "mm",
    format: [80, 170]
  });

  // HEADER
  doc.setFillColor(227, 176, 122);
  doc.rect(0, 0, 80, 22, "F");

  doc.setTextColor(60, 40, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CAFEHUNT", 40, 10, { align: "center" });

  doc.setFontSize(7);
  doc.text("OFFICIAL RESERVATION RECEIPT", 40, 16, { align: "center" });

  let y = 30;

  doc.setTextColor(120);
  doc.setFontSize(7);

  doc.text(data.cafe, 40, y, { align: "center" });
  y += 5;

  doc.text(data.location, 40, y, { align: "center" });
  y += 8;

  doc.setDrawColor(220, 190, 160);
  doc.line(5, y, 75, y);
  y += 10;

  // DETAILS
  const row = (k, v) => {
    doc.setTextColor(120);
    doc.setFont("helvetica", "bold");
    doc.text(k, 5, y);

    doc.setTextColor(60, 40, 30);
    doc.setFont("helvetica", "normal");
    doc.text(String(v), 30, y);

    y += 8;
  };

  row("Cafe", data.cafe);
  row("Location", data.location);
  row("Date", data.date);
  row("Time", data.time);
  row("Guests", data.guests);

  y += 5;

  doc.setFillColor(255, 242, 217);
  doc.rect(5, y - 4, 70, 10, "F");

  doc.setTextColor(150, 90, 40);
  doc.setFont("helvetica", "bold");
  doc.text(`STATUS : ${data.status}`, 40, y + 2, { align: "center" });

  doc.save(`CafeHunt_${Date.now()}.pdf`);
};