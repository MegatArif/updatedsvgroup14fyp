import { db, app } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs,
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
  accepted: document.getElementById("acceptList"),
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

  const data = snap.exists() ? snap.data() : {};

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
function getStatus(r) {
  const now = new Date();
  const bookingTime = new Date(`${r.date}T${r.time}`);
  const dbStatus = (r.status || "").toLowerCase();

  if (dbStatus === "cancelled" || dbStatus === "cancel") return "cancel";
  if (dbStatus === "rejected") return "reject";
  if (dbStatus === "expired") return "expired";

  // ✅ FIX: unified status = accepted
  if (dbStatus === "accepted") {
    if (bookingTime < now) return "completed";
    return "accepted";
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
    status === "accepted";

  const canRate =
    status === "completed" &&
    !r.rating;

  container.innerHTML += `
    <div class="reservation-card status-${status}">

      <div class="card-top">
        <div>
          <h3>${r.cafe}</h3>
          <div class="location">${r.location}</div>
        </div>

        <span class="status status-${status}">
          ${getStatusLabel(status)}
        </span>
      </div>

      <div class="booking-info">
        <div class="info-box"><span>Date</span><strong>${r.date}</strong></div>
        <div class="info-box"><span>Time</span><strong>${r.time}</strong></div>
        <div class="info-box"><span>Guests</span><strong>${r.guests}</strong></div>
      </div>

      ${
        r.rating
          ? `<div class="rating-display">⭐ Your Rating: ${r.rating}/5</div>`
          : ""
      }

      <div class="button-group">

        <button class="receipt-btn" onclick="downloadPDF('${r.id}')">
          <i class="fa-solid fa-download"></i> Download Receipt
        </button>

        ${
          canRate
            ? `<button class="rate-btn" onclick="openRating('${r.id}')">
                <i class="fa-solid fa-star"></i> Rate
              </button>`
            : ""
        }

        ${
          canCancel
            ? `<button class="cancel-btn" onclick="cancelReservation('${r.id}')">
                <i class="fa-solid fa-ban"></i> Cancel
              </button>`
            : ""
        }

      </div>
    </div>
  `;
}

// ================= CANCEL =================
window.cancelReservation = async function(id) {
  const confirmCancel = confirm("Are you sure you want to cancel this reservation?");
  if (!confirmCancel) return;

  try {
    await updateDoc(doc(db, "reservation", id), {
      status: "cancel"
    });

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

  doc.setFillColor(227, 176, 122);
  doc.rect(0, 0, 80, 25, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CAFEHUNT", 40, 11, { align: "center" });

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("OFFICIAL RESERVATION RECEIPT", 40, 18, { align: "center" });

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

  doc.setFillColor(240, 240, 240);
  doc.rect(5, y, 70, 12, "F");

  doc.setFont("helvetica", "bold");
  doc.text(`STATUS: ${status.toUpperCase()}`, 40, y + 8, {
    align: "center"
  });

  doc.save(`CafeHunt_${r.id}.pdf`);
};


// ================= RATING =================
window.openRating = async function(id) {

  const rating = prompt("Rate this cafe from 1 to 5 stars");
  if (!rating) return;

  const ratingValue = Number(rating);

  if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    alert("Please enter 1-5");
    return;
  }

  try {

    const ref = doc(db, "reservation", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const data = snap.data();

    // ================= 1. UPDATE RESERVATION =================
    await updateDoc(ref, {
      rating: ratingValue
    });

    // ================= 2. FIND CAFE =================
    const cafeQuery = query(
      collection(db, "cafes"),
      where("name", "==", data.cafe)
    );

    const cafeSnap = await getDocs(cafeQuery);

    if (cafeSnap.empty) {
      alert("Rating saved but cafe not found");
      return;
    }

    const cafeDoc = cafeSnap.docs[0];

    const cafeRef = doc(db, "cafes", cafeDoc.id);

    const cafeData = cafeDoc.data();

    // ================= 3. CURRENT VALUES =================
    const newSum =
      (cafeData.ratingSum || 0) + ratingValue;

    const newCount =
      (cafeData.ratingCount || 0) + 1;

    // ================= 4. RATING BREAKDOWN =================
    const breakdown =
      cafeData.ratingBreakdown || {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0
      };

    breakdown[ratingValue] =
      (breakdown[ratingValue] || 0) + 1;

    // ================= 5. ROUND AVERAGE =================
    const averageRating = Number(
      (newSum / newCount).toFixed(1)
    );

    // ================= 6. UPDATE FIREBASE =================
    await updateDoc(cafeRef, {
      ratingSum: newSum,
      ratingCount: newCount,
      rating: averageRating,
      ratingBreakdown: breakdown
    });

    alert("Thank you for your rating!");

  } catch (err) {

    console.error(err);
    alert("Failed to submit rating");
  }
};


function getStatusLabel(status) {
  const map = {
    pending: "PENDING",
    accepted: "ACCEPTED",
    reject: "REJECTED",
    completed: "COMPLETED",
    expired: "EXPIRED",
    cancel: "CANCELLED"
  };
  return map[status] || status.toUpperCase();
}