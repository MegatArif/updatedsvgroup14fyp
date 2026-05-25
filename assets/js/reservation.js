import { db } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// ============================
// REAL LOGIN USER
// ============================
const currentUser =
JSON.parse(localStorage.getItem("user"));

console.log("👤 Current User:", currentUser);


// ============================
// CHECK LOGIN
// ============================
if (!currentUser || !currentUser.username) {

  console.error("❌ No logged in user");

}


// ============================
// CONTAINERS
// ============================
const activeContainer =
document.getElementById("activeReservations");

const pastContainer =
document.getElementById("pastReservations");


// ============================
// LOAD RESERVATIONS
// ============================
loadReservations();

function loadReservations() {

  const q = query(

    // 🔥 IMPORTANT
    collection(db, "reservation"),

    where(
      "username",
      "==",
      currentUser.username
    )

  );

  onSnapshot(q, (snapshot) => {

    console.log(
      "🔥 Reservation Count:",
      snapshot.size
    );

    activeContainer.innerHTML = "";
    pastContainer.innerHTML = "";

    // EMPTY STATE
    if (snapshot.empty) {

      activeContainer.innerHTML = `

        <p style="
          color:#c98b3b;
          font-weight:600;
        ">
          No reservations found
        </p>

      `;

      return;
    }

    snapshot.forEach((doc) => {

      const data = doc.data();

      console.log("📄 Reservation:", data);

      renderReservation(data);

    });

  });

}


// ============================
// RENDER RESERVATION
// ============================
function renderReservation(data) {

  // 🔥 SAFER DATE FORMAT
  const reservationDate =
  new Date(`${data.date}T${data.time}`);

  const now = new Date();

  const isActive =
  reservationDate > now;

  const statusText =
  isActive
  ? "ACTIVE"
  : "COMPLETED";

  const statusClass =
  isActive
  ? "status-active"
  : "status-past";

  const container =
  isActive
  ? activeContainer
  : pastContainer;


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

      <button
        class="receipt-btn"
        onclick="downloadReceipt(this)"
      >

        <i class="fa-solid fa-download"></i>

        Download Receipt

      </button>

    </div>

  `;
}


// ============================
// PDF RECEIPT
// ============================
window.downloadReceipt = function (btn) {

  const card =
  btn.closest(".reservation-card");

  const data = {

    cafe:
    card.dataset.cafe,

    location:
    card.dataset.location,

    date:
    card.dataset.date,

    time:
    card.dataset.time,

    guests:
    card.dataset.guests,

    status:
    card.dataset.status

  };

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({

    unit: "mm",

    format: [80, 170]

  });


  // =========================
  // HEADER
  // =========================
  doc.setFillColor(227, 176, 122);

  doc.rect(0, 0, 80, 22, "F");

  doc.setTextColor(60, 40, 30);

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(14);

  doc.text(
    "CAFEHUNT",
    40,
    10,
    {
      align: "center"
    }
  );

  doc.setFontSize(7);

  doc.text(
    "OFFICIAL RESERVATION RECEIPT",
    40,
    16,
    {
      align: "center"
    }
  );


  // =========================
  // STORE INFO
  // =========================
  let y = 30;

  doc.setTextColor(120);

  doc.setFontSize(7);

  // 🔥 DYNAMIC CAFE
  doc.text(
    data.cafe,
    40,
    y,
    {
      align: "center"
    }
  );

  y += 5;

  // 🔥 DYNAMIC LOCATION
  doc.text(
    data.location,
    40,
    y,
    {
      align: "center"
    }
  );

  y += 8;


  // LINE
  doc.setDrawColor(
    220,
    190,
    160
  );

  doc.line(5, y, 75, y);

  y += 10;


  // =========================
  // RECEIPT INFO
  // =========================
  const receiptId =
  "CH" +
  Date.now()
  .toString()
  .slice(-6);

  const now =
  new Date();

  doc.setFontSize(7);

  doc.setTextColor(120);

  doc.text(
    `Receipt ID : ${receiptId}`,
    5,
    y
  );

  y += 5;

  doc.text(
    `Generated : ${now.toLocaleDateString()}`,
    5,
    y
  );

  y += 8;


  // LINE
  doc.line(5, y, 75, y);

  y += 10;


  // =========================
  // BOOKING DETAILS
  // =========================
  const drawRow = (label, value) => {

    doc.setTextColor(120);

    doc.setFont(
      "helvetica",
      "bold"
    );

    doc.text(
      label,
      5,
      y
    );

    doc.setTextColor(
      60,
      40,
      30
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.text(
      String(value),
      30,
      y
    );

    y += 8;
  };

  drawRow(
    "Cafe",
    data.cafe
  );

  drawRow(
    "Location",
    data.location
  );

  drawRow(
    "Date",
    data.date
  );

  drawRow(
    "Time",
    data.time
  );

  drawRow(
    "Guests",
    `${data.guests} pax`
  );


  // =========================
  // STATUS BOX
  // =========================
  y += 3;

  doc.setFillColor(
    255,
    242,
    217
  );

  doc.rect(
    5,
    y - 4,
    70,
    10,
    "F"
  );

  doc.setTextColor(
    150,
    90,
    40
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.text(
    `STATUS : ${data.status}`,
    40,
    y + 2,
    {
      align: "center"
    }
  );

  y += 18;


  // =========================
  // FOOTER
  // =========================
  doc.setTextColor(140);

  doc.setFontSize(7);

  doc.text(
    "THANK YOU FOR CHOOSING CAFEHUNT",
    40,
    y,
    {
      align: "center"
    }
  );

  y += 5;

  doc.setFontSize(6);

  doc.text(
    "Please present this receipt at counter",
    40,
    y,
    {
      align: "center"
    }
  );

  y += 5;

  doc.text(
    "CafeHunt • All Rights Reserved",
    40,
    y,
    {
      align: "center"
    }
  );


  // =========================
  // SAVE PDF
  // =========================
  doc.save(

    `CafeHunt_${receiptId}.pdf`

  );

};