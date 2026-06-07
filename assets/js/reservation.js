// assets/js/reservation.js
// MODIFIED: added "expired" notification trigger.
// When a reservation's computed status is "expired" and a notification
// has not yet been sent (notifSentExpired field is absent), we write
// one notification document and set notifSentExpired: true on the
// reservation to prevent duplicates on future renders.

import { db, app } from "./firebase-config.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  addDoc,          // ADDED: for writing notifications
  serverTimestamp, // ADDED: for notification timestamps
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

import { setupNavbar } from "./navbar.js";

setupNavbar();

const auth = getAuth(app);

// ================= LISTS =================
const containers = {
  pending:   document.getElementById("pendingList"),
  accepted:  document.getElementById("acceptList"),
  reject:    document.getElementById("rejectList"),
  completed: document.getElementById("completedList"),
  expired:   document.getElementById("expiredList"),
  cancel:    document.getElementById("cancelList"),
};

let currentUser     = null;
let allReservations = [];

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snap = await getDoc(doc(db, "Customers", user.uid));
  const data = snap.exists() ? snap.data() : {};

  currentUser = {
    userId: user.uid,
    username: data.username || user.email,
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
    Object.values(containers).forEach((c) => {
      if (c) c.innerHTML = "";
    });

    allReservations = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    allReservations.forEach(render);
  });
}

// ================= STATUS LOGIC =================
function getStatus(r) {
  const now         = new Date();
  const bookingTime = new Date(`${r.date}T${r.time}`);
  const dbStatus    = (r.status || "").toLowerCase();

  if (dbStatus === "cancelled" || dbStatus === "cancel") return "cancel";
  if (dbStatus === "rejected")  return "reject";
  if (dbStatus === "expired")   return "expired";

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
  const status    = getStatus(r);
  const container = containers[status];

  if (!container) return;

  // ADDED: fire-and-forget expired notification (idempotent)
  if (status === "expired") {
    sendExpiredNotificationOnce(r);
  }

  const canCancel = status === "pending" || status === "accepted";
  const canRate   = status === "completed" && !r.rating;

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

      ${r.rating
        ? `<div class="rating-display">⭐ Your Rating: ${r.rating}/5</div>`
        : ""}

      <div class="button-group">

        <button class="detail-btn" onclick="downloadPDF('${r.id}')">
          <i class="fa-solid fa-download"></i> View Detail
        </button>

        ${canRate
          ? `<button class="rate-btn" onclick="openRating('${r.id}')">
              <i class="fa-solid fa-star"></i> Rate
            </button>`
          : ""}

        ${canCancel
          ? `<button class="cancel-btn" onclick="cancelReservation('${r.id}')">
              <i class="fa-solid fa-ban"></i> Cancel
            </button>`
          : ""}

      </div>
    </div>
  `;
}

// ================= EXPIRED NOTIFICATION (ADDED) =================
// Sends a one-time "expired" notification for a reservation that timed
// out before the shop owner approved it.
// Guard: the `notifSentExpired` boolean on the reservation doc prevents
// duplicate notifications across page loads / snapshot refreshes.
async function sendExpiredNotificationOnce(r) {
  // Skip if already sent or if we have no userId to notify
  if (r.notifSentExpired || !r.userId) return;

  try {
    // Mark first so a concurrent snapshot can't re-trigger before Firestore
    // confirms the write.
    await updateDoc(doc(db, "reservation", r.id), {
      notifSentExpired: true,
    });

    await addDoc(collection(db, "notifications"), {
      userId:        r.userId,
      type:          "expired",
      message:       `Your reservation at ${r.cafe || "the cafe"} on ${r.date} at ${r.time} has expired — it was not approved in time. You can make a new booking anytime.`,
      cafeName:      r.cafe || "",
      reservationId: r.id,
      read:          false,
      createdAt:     serverTimestamp(),
    });

  } catch (err) {
    // Non-fatal — user just won't get the notification this cycle
    console.warn("sendExpiredNotificationOnce failed:", err);
  }
}

// ================= CANCEL =================
window.cancelReservation = async function(id) {
  const confirmCancel = confirm("Are you sure you want to cancel this reservation?");
  if (!confirmCancel) return;

  try {
    await updateDoc(doc(db, "reservation", id), {
      status: "cancel",
    });
    alert("Reservation cancelled");
  } catch (err) {
    console.error(err);
    alert("Failed to cancel reservation");
  }
};

// ================= PDF =================
window.downloadPDF = function(id) {
  const r = allReservations.find((x) => x.id === id);
  if (!r) return;

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ unit: "mm", format: [80, 180] });

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
  row("Cafe",     r.cafe);
  row("Location", r.location);
  row("Date",     r.date);
  row("Time",     r.time);
  row("Guests",   r.guests);

  y += 5;
  doc.setFillColor(240, 240, 240);
  doc.rect(5, y, 70, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.text(`STATUS: ${status.toUpperCase()}`, 40, y + 8, { align: "center" });

  doc.save(`CafeHunt_${r.id}.pdf`);
};

// ================= RATING =================
function injectRatingModal() {
  if (document.getElementById("ratingOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "ratingOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(58,47,40,0.45);
    backdrop-filter:blur(4px);z-index:9999;
    display:none;align-items:center;justify-content:center;
  `;

  overlay.innerHTML = `
    <div style="
      background:#fffaf3;border-radius:20px;padding:36px 32px;
      width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.18);
      text-align:center;position:relative;
    ">
      <button id="ratingCloseBtn" style="
        position:absolute;top:14px;right:16px;
        background:none;border:none;font-size:18px;
        color:#8c7a6b;cursor:pointer;
      "><i class="fas fa-xmark"></i></button>

      <div style="font-size:32px;margin-bottom:8px;">⭐</div>
      <h2 style="font-size:1.3rem;font-weight:800;color:#3a2f28;margin-bottom:4px;">Rate Your Visit</h2>
      <p id="ratingCafeName" style="font-size:13px;color:#8c7a6b;margin-bottom:24px;"></p>

      <div id="starRow" style="display:flex;justify-content:center;gap:10px;margin-bottom:20px;">
        ${[1,2,3,4,5].map(n => `
          <span data-star="${n}" style="
            font-size:36px;cursor:pointer;color:#e0d0c0;
            transition:transform 0.15s,color 0.15s;
            user-select:none;
          ">★</span>
        `).join("")}
      </div>

      <p id="ratingHint" style="font-size:12px;color:#b8906d;min-height:18px;margin-bottom:20px;"></p>

      <button id="ratingSubmitBtn" disabled style="
        width:100%;padding:13px;border:none;border-radius:12px;
        background:linear-gradient(135deg,#f6d7a7,#e3b07a);
        color:#3a2f28;font-size:14px;font-weight:700;
        cursor:pointer;opacity:0.5;transition:0.2s;
        box-shadow:0 4px 14px rgba(227,176,122,0.4);
      ">Submit Rating</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Star hover + click
  let selectedRating = 0;
  const stars = overlay.querySelectorAll("[data-star]");
  const hints = ["","Poor 😕","Fair 😐","Good 😊","Great 😄","Excellent! 🤩"];

  stars.forEach(star => {
    star.addEventListener("mouseenter", () => {
      const val = +star.dataset.star;
      stars.forEach(s => {
        s.style.color = +s.dataset.star <= val ? "#e3b07a" : "#e0d0c0";
        s.style.transform = +s.dataset.star <= val ? "scale(1.15)" : "scale(1)";
      });
      document.getElementById("ratingHint").textContent = hints[val];
    });

    star.addEventListener("mouseleave", () => {
      stars.forEach(s => {
        s.style.color = +s.dataset.star <= selectedRating ? "#e3b07a" : "#e0d0c0";
        s.style.transform = "scale(1)";
      });
      document.getElementById("ratingHint").textContent = hints[selectedRating];
    });

    star.addEventListener("click", () => {
      selectedRating = +star.dataset.star;
      const btn = document.getElementById("ratingSubmitBtn");
      btn.disabled = false;
      btn.style.opacity = "1";
      document.getElementById("ratingHint").textContent = hints[selectedRating];
    });
  });

  // Close
  overlay.querySelector("#ratingCloseBtn").addEventListener("click", closeRatingModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeRatingModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeRatingModal(); });

  // Store getter for submit
  overlay._getSelectedRating = () => selectedRating;
  overlay._resetStars = () => {
    selectedRating = 0;
    stars.forEach(s => { s.style.color = "#e0d0c0"; s.style.transform = "scale(1)"; });
    document.getElementById("ratingHint").textContent = "";
    const btn = document.getElementById("ratingSubmitBtn");
    btn.disabled = true;
    btn.style.opacity = "0.5";
  };
}

function closeRatingModal() {
  const overlay = document.getElementById("ratingOverlay");
  if (overlay) {
    overlay.style.display = "none";
    overlay._resetStars?.();
  }
}

window.openRating = async function(id) {
  const r = allReservations.find(x => x.id === id);
  if (!r) return;

  injectRatingModal();
  const overlay = document.getElementById("ratingOverlay");
  document.getElementById("ratingCafeName").textContent = r.cafe || "";
  overlay._resetStars();
  overlay.style.display = "flex";

  // Wire submit
  const submitBtn = document.getElementById("ratingSubmitBtn");
  const newBtn = submitBtn.cloneNode(true); // remove old listeners
  submitBtn.parentNode.replaceChild(newBtn, submitBtn);

  newBtn.addEventListener("click", async () => {
    const ratingValue = overlay._getSelectedRating();
    if (!ratingValue) return;

    newBtn.disabled = true;
    newBtn.textContent = "Submitting…";

    try {
      const resRef  = doc(db, "reservation", id);
      const resSnap = await getDoc(resRef);
      if (!resSnap.exists()) return;

      const data = resSnap.data();
      await updateDoc(resRef, { rating: ratingValue });

      const cafeQuery = query(collection(db, "cafes"), where("name", "==", data.cafe));
      const cafeSnap  = await getDocs(cafeQuery);

      if (!cafeSnap.empty) {
        const cafeDoc  = cafeSnap.docs[0];
        const cafeData = cafeDoc.data();
        const newSum   = (cafeData.ratingSum   || 0) + ratingValue;
        const newCount = (cafeData.ratingCount || 0) + 1;
        const breakdown = cafeData.ratingBreakdown || {1:0,2:0,3:0,4:0,5:0};
        breakdown[ratingValue] = (breakdown[ratingValue] || 0) + 1;

        await updateDoc(doc(db, "cafes", cafeDoc.id), {
          ratingSum: newSum, ratingCount: newCount,
          rating: Number((newSum / newCount).toFixed(1)),
          ratingBreakdown: breakdown,
        });
      }

      closeRatingModal();

    } catch (err) {
      console.error(err);
      newBtn.disabled = false;
      newBtn.textContent = "Submit Rating";
    }
  });
};

// ================= STATUS LABEL =================
function getStatusLabel(status) {
  const map = {
    pending:   "PENDING",
    accepted:  "ACCEPTED",
    reject:    "REJECTED",
    completed: "COMPLETED",
    expired:   "EXPIRED",
    cancel:    "CANCELLED",
  };
  return map[status] || status.toUpperCase();
}