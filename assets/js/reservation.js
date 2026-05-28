import { db, app } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { setupNavbar } from "./navbar.js";

setupNavbar();

const auth = getAuth(app);

// ================= LISTS =================
const containers = {
  pending: document.getElementById("pendingList"),
  accept: document.getElementById("acceptList"),
  reject: document.getElementById("rejectList"),
  completed: document.getElementById("completedList"),
  expired: document.getElementById("expiredList"),
  cancel: document.getElementById("cancelList"),
};

let currentUser = null;
let allReservations = [];

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {

  if (!user) return;

  const snap = await getDoc(doc(db, "Customers", user.uid));

  const data = snap.exists()
    ? snap.data()
    : {};

  currentUser = {
    userId: user.uid,
    username: data.username || user.email
  };

  loadReservations();
});

// ================= LOAD =================
function loadReservations() {

  const q = query(
    collection(db, "reservation"),
    where("userId", "==", currentUser.userId)
  );

  onSnapshot(q, (snapshot) => {

    Object.values(containers).forEach(c => {
      if (c) c.innerHTML = "";
    });

    allReservations = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    allReservations.forEach(render);
  });
}

// ================= STATUS LOGIC =================
// customer reservation js — getStatus()
function getStatus(r) {
  const now = new Date();
  const bookingTime = new Date(`${r.date}T${r.time}`);
  const dbStatus = (r.status || "").toLowerCase();

  if (dbStatus === "cancelled" || dbStatus === "cancel") return "cancel";  // handle both
  if (dbStatus === "rejected")  return "reject";
  if (dbStatus === "expired")   return "expired";

  if (dbStatus === "accepted") {         
    if (bookingTime < now) return "completed";
    return "accept";
  }

  if (dbStatus === "completed") return "completed";

  if (dbStatus === "" || dbStatus === "pending") {
    if (bookingTime < now) return "expired";
    return "pending";
  }

  return "pending";
}

// ================= RENDER =================
function render(r) {

  const status = getStatus(r);

  const container = containers[status];

  if (!container) return;

  const canCancel =
    status === "pending" ||
    status === "accept";

  const canRate =
  status === "completed" &&
  !r.rating;
  container.innerHTML += `

    <div class="reservation-card">

      <div class="card-top">

        <div>
          <h3>${r.cafe}</h3>
          <div class="location">
            ${r.location}
          </div>
        </div>

        <span class="status status-${status}">
          ${status.toUpperCase()}
        </span>

      </div>

      <div class="booking-info">

        <div class="info-box">
          <span>Date</span>
          <strong>${r.date}</strong>
        </div>

        <div class="info-box">
          <span>Time</span>
          <strong>${r.time}</strong>
        </div>

        <div class="info-box">
          <span>Guests</span>
          <strong>${r.guests}</strong>
        </div>

      </div>

      ${
  r.rating
  ?
  `
    <div class="rating-display">
      ⭐ Your Rating: ${r.rating}/5
    </div>
  `
  :
  ""
}
    <div class="button-group">

  <button
    class="receipt-btn"
    onclick="downloadPDF('${r.id}')"
  >
    <i class="fa-solid fa-download"></i>
    Download Receipt
  </button>

  ${
    canRate
    ?
    `
      <button
        class="rate-btn"
        onclick="openRating('${r.id}')"
      >
        <i class="fa-solid fa-star"></i>
        Rate
      </button>
    `
    :
    ""
  }

  ${
    canCancel
    ?
    `
      <button
        class="cancel-btn"
        onclick="cancelReservation('${r.id}')"
      >
        <i class="fa-solid fa-ban"></i>
        Cancel
      </button>
    `
    :
    ""
  }

</div>

    </div>
  `;
}

// ================= CANCEL =================
window.cancelReservation = async function(id) {

  const confirmCancel = confirm(
    "Are you sure you want to cancel this reservation?"
  );

  if (!confirmCancel) return;

  try {

    await updateDoc(doc(db, "reservation", id), { status: "cancel" });  // was "cancelled"

    alert("Reservation cancelled");

  } catch (err) {

    console.error(err);
    alert("Failed to cancel reservation");
  }
};

// ================= PDF =================
window.downloadPDF = function(id) {

  const r = allReservations.find(x => x.id === id);

  if (!r) return;

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    unit: "mm",
    format: [80, 180]
  });

  const status = getStatus(r);

  doc.setCharSpace(0);
  doc.setLineHeightFactor(1.2);

  // HEADER
  doc.setFillColor(227, 176, 122);
  doc.rect(0, 0, 80, 25, "F");

  doc.setTextColor(60, 40, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);

  doc.text(
    "CAFEHUNT",
    40,
    11,
    { align: "center" }
  );

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  doc.text(
    "OFFICIAL RESERVATION RECEIPT",
    40,
    18,
    { align: "center" }
  );

  let y = 35;

  const row = (label, value) => {

    doc.setTextColor(120);

    doc.setFont("helvetica", "bold");
    doc.text(label, 5, y);

    doc.setFont("helvetica", "normal");
    doc.text(String(value ?? "-"), 30, y);

    y += 7;
  };

  row("Customer", r.username);
  row("Cafe", r.cafe);
  row("Location", r.location);
  row("Date", r.date);
  row("Time", r.time);
  row("Guests", r.guests);

  y += 5;

  doc.setDrawColor(220, 190, 160);
  doc.line(5, y, 75, y);

  y += 10;

  let color = [247, 241, 232];

  if (status === "pending") {
    color = [255, 242, 217];
  }

  if (status === "accept") {
    color = [230, 247, 230];
  }

  if (status === "reject") {
    color = [255, 229, 229];
  }

  if (status === "completed") {
    color = [230, 240, 255];
  }

  if (status === "cancel") {
    color = [245, 225, 225];
  }

  doc.setFillColor(...color);

  doc.rect(5, y, 70, 12, "F");

  doc.setTextColor(60, 40, 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  doc.text(
    `STATUS: ${status.toUpperCase()}`,
    40,
    y + 8,
    { align: "center" }
  );

  y += 18;

  doc.setFontSize(7);

  doc.setTextColor(150);

  doc.setFont("helvetica", "normal");

  doc.text(
    "Thank you for choosing CafeHunt",
    40,
    y,
    { align: "center" }
  );

  doc.save(`CafeHunt_${r.id}.pdf`);
};

// ================= RATING =================
window.openRating = async function(id) {

  const rating = prompt(
    "Rate this cafe from 1 to 5 stars"
  );

  if (!rating) return;

  const ratingValue = Number(rating);

  if (
    isNaN(ratingValue) ||
    ratingValue < 1 ||
    ratingValue > 5
  ) {
    alert("Please enter a number between 1 and 5");
    return;
  }

  try {

    await updateDoc(
      doc(db, "reservation", id),
      {
        rating: ratingValue
      }
    );

    alert("Thank you for your rating!");

  } catch (err) {

    console.error(err);
    alert("Failed to submit rating");
  }
};