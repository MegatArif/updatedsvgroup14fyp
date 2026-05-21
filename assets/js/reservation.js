import { db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// ============================
// MOCK USER
// ============================
const currentUser = {
  username: "alex"
};

console.log("👤 currentUser =", currentUser.username);


// ============================
// CONTAINERS
// ============================
const activeContainer = document.getElementById("activeReservations");
const pastContainer = document.getElementById("pastReservations");


// ============================
// 🔥 DEBUG ALL DATA
// ============================
function debugAllData() {

  const q = query(collection(db, "reservation")); // 🔥 FIX HERE

  onSnapshot(q, (snapshot) => {

    console.log("🔥 TOTAL DOCS IN reservation:", snapshot.size);

    snapshot.forEach(doc => {
      console.log("📄 DOC:", doc.id, doc.data());
    });

  });
}


// ============================
// 🔥 FILTERED QUERY
// ============================
function loadReservations() {

  console.log("🔥 loadReservations running");

  const q = query(
    collection(db, "reservation"), // 🔥 FIX HERE
    where("username", "==", currentUser.username)
  );

  onSnapshot(q, (snapshot) => {

    console.log("🎯 FILTERED RESULT SIZE:", snapshot.size);

    activeContainer.innerHTML = "";
    pastContainer.innerHTML = "";

    if (snapshot.empty) {
      activeContainer.innerHTML = `
        <p style="color:red">
          ❌ No match for username: "${currentUser.username}"
        </p>
      `;
      return;
    }

    snapshot.forEach(doc => {
      renderReservation(doc.data());
    });

  });
}


// ============================
// RENDER CARD
// ============================
function renderReservation(data) {

  // 🔥 safer time parsing (important)
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
          <strong>${data.guests}</strong>
        </div>

      </div>

      <button class="receipt-btn" onclick="downloadReceipt(this)">
        Download Receipt
      </button>

    </div>
  `;
}


// ============================
// INIT
// ============================
debugAllData();
loadReservations();


// ============================
// PDF
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

  // =========================
  // HEADER (REAL RECEIPT STYLE)
  // =========================
doc.setFillColor(227, 176, 122);
doc.rect(0, 0, 80, 22, "F");

  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CAFEHUNT", 40, 10, { align: "center" });

  doc.setFontSize(7);
  doc.text("OFFICIAL RESERVATION RECEIPT", 40, 16, { align: "center" });

  // =========================
  // STORE INFO (like real shop receipt)
  // =========================
  doc.setTextColor(80);
  doc.setFontSize(6);

  let y = 28;

  doc.text("Grind.JB Cafe System", 40, y, { align: "center" });
  y += 4;
  doc.text("Kluang Mall Branch", 40, y, { align: "center" });
  y += 6;

  // dashed line effect
  doc.setDrawColor(150);
  doc.line(5, y, 75, y);
  y += 8;

  // =========================
  // ORDER META
  // =========================
  const receiptId = "CH" + Date.now().toString().slice(-6);
  const now = new Date();

  doc.setFontSize(7);
  doc.setTextColor(60);

  doc.text(`Receipt ID : ${receiptId}`, 5, y); y += 5;
  doc.text(`Date      : ${now.toLocaleDateString()}`, 5, y); y += 5;
  doc.text(`Time      : ${now.toLocaleTimeString()}`, 5, y); y += 6;

  doc.line(5, y, 75, y);
  y += 8;

  // =========================
  // BOOKING DETAILS (REAL ALIGN STYLE)
  // =========================
  doc.setFontSize(9);
  doc.setTextColor(30);

  const drawRow = (label, value) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 5, y);

    doc.setFont("helvetica", "normal");
    doc.text(String(value), 30, y);

    y += 7;
  };

  drawRow("Cafe", data.cafe);
  drawRow("Location", data.location);
  drawRow("Date", data.date);
  drawRow("Time", data.time);
  drawRow("Guests", `${data.guests} pax`);

  y += 2;
  doc.line(5, y, 75, y);
  y += 10;

  // =========================
  // STATUS BOX (highlight like POS)
  // =========================
  doc.setFillColor(240, 240, 240);
  doc.rect(5, y - 4, 70, 10, "F");

  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  doc.text(`STATUS: ${data.status}`, 40, y + 2, { align: "center" });

  y += 15;

  // =========================
  // FOOTER (REAL RECEIPT FEEL)
  // =========================
  doc.setTextColor(120);
  doc.setFontSize(7);

  doc.text("THANK YOU FOR YOUR VISIT", 40, y, { align: "center" });
  y += 5;

  doc.setFontSize(6);
  doc.text("Please present this receipt at counter", 40, y, { align: "center" });
  y += 4;

  doc.text("CafeHunt • All rights reserved", 40, y, { align: "center" });

  // =========================
  // SAVE
  // =========================
  doc.save(`CafeHunt_${receiptId}.pdf`);
};