// assets/js/register-cafe.js

import { db, storage, app } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import {
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { showToast } from "./toast.js";


/* ── FACILITY ICON MAP ───────────────────────────────────────── */
const facilityIcons = {
  "WiFi":              "fa-wifi",
  "Power outlet":      "fa-plug",
  "Outdoor seating":   "fa-umbrella-beach",
  "Meeting equipment": "fas fa-chalkboard-user",
};

/* ── AUTH ────────────────────────────────────────────────────── */
const auth = getAuth(app);

/* ── DOM REFS ────────────────────────────────────────────────── */
const nameEl       = document.getElementById("cafeName");
const openEl       = document.getElementById("openHour");
const closeEl      = document.getElementById("closeHour");
const descEl       = document.getElementById("description");
const addressEl    = document.getElementById("address");
const cityEl       = document.getElementById("city");
const imageInput   = document.getElementById("cafeImage");
const uploadZone   = document.getElementById("uploadZone");
const placeholder  = document.getElementById("uploadPlaceholder");
const imgPreview   = document.getElementById("imagePreview");
const submitBtn    = document.getElementById("submitBtn");
const submitLabel  = document.getElementById("submitLabel");
const submitSpin   = document.getElementById("submitSpinner");

/* ── LIVE PREVIEW ────────────────────────────────────────────── */
function fmt(t) { if (!t) return "––:––"; return t; }

function updatePreview() {
  document.getElementById("previewName").textContent    = nameEl.value.trim()    || "Your Cafe Name";
  document.getElementById("previewAddress").textContent = addressEl.value.trim() || "Your address";
  document.getElementById("previewDesc").textContent    = descEl.value.trim()    || "Your description will appear here.";

  const open  = fmt(openEl.value);
  const close = fmt(closeEl.value);
  document.getElementById("previewHours").textContent = `${open}  –  ${close}`;

  const checked = [...document.querySelectorAll(".facility-pill input:checked")]
    .map(cb => cb.value);
  document.getElementById("previewFacilities").innerHTML = checked.length
    ? checked.map(f => `
        <span class="preview-fac-tag">
          <i class="fas ${facilityIcons[f] || 'fa-check'}"></i> ${f}
        </span>`).join("")
    : "";
}

[nameEl, openEl, closeEl, descEl, addressEl, cityEl].forEach(el => {
  el.addEventListener("input", updatePreview);
});
document.querySelectorAll(".facility-pill input").forEach(cb => {
  cb.addEventListener("change", updatePreview);
});

/* ── IMAGE UPLOAD ZONE ───────────────────────────────────────── */
uploadZone.addEventListener("click", () => imageInput.click());

uploadZone.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.style.borderColor = "var(--brand)";
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.style.borderColor = "";
});
uploadZone.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.style.borderColor = "";
  const file = e.dataTransfer.files[0];
  if (file) previewFile(file);
});

imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) previewFile(imageInput.files[0]);
});

function previewFile(file) {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = e => {
    imgPreview.src = e.target.result;
    imgPreview.classList.remove("hidden");
    placeholder.classList.add("hidden");
    document.getElementById("previewImg").src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ── GET NEXT ID ─────────────────────────────────────────────── */
async function getNextId() {
  try {
    const q = query(collection(db, "cafes"), orderBy("id", "desc"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return 1;
    const last = snap.docs[0].data().id;
    return (typeof last === "number" ? last : parseInt(last) || 0) + 1;
  } catch {
    const snap = await getDocs(collection(db, "cafes"));
    return snap.size + 1;
  }
}

/* ── VALIDATE ────────────────────────────────────────────────── */
function validate() {
  if (!nameEl.value.trim())    { showToast("Cafe name is required.", "error"); return false; }
  if (!openEl.value)           { showToast("Open hour is required.", "error"); return false; }
  if (!closeEl.value)          { showToast("Close hour is required.", "error"); return false; }
  if (!descEl.value.trim())    { showToast("Description is required.", "error"); return false; }
  if (!addressEl.value.trim()) { showToast("Address is required.", "error"); return false; }
  if (!cityEl.value.trim())    { showToast("City is required.", "error"); return false; }
  return true;
}

/* ── SUBMIT ──────────────────────────────────────────────────── */
submitBtn.addEventListener("click", async () => {
  if (!validate()) return;

  const facilities = [...document.querySelectorAll(".facility-pill input:checked")]
    .map(cb => cb.value);

  submitBtn.disabled = true;
  submitLabel.classList.add("hidden");
  submitSpin.classList.remove("hidden");

  try {
    const nextId = await getNextId();
    let imagePath = "";

    const file = imageInput.files[0];
    if (file) {
      const ext        = file.name.split(".").pop();
      const storePath  = `cafes/cafes${nextId}.${ext}`;
      const storageRef = ref(storage, storePath);
      await uploadBytes(storageRef, file);
      imagePath = storePath;
    }

    // Build Firestore cafe document — default rating seeded at 4
    const cafeDoc = {
      id:          nextId,
      name:        nameEl.value.trim(),
      openHour:    openEl.value,
      closeHour:   closeEl.value,
      description: descEl.value.trim(),
      address:     addressEl.value.trim(),
      city:        cityEl.value.trim(),
      facilities:  facilities,
      image:       imagePath,
      rating:      4,
      ratingCount: 1,
      ratingSum:   4,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
    };

    await addDoc(collection(db, "cafes"), cafeDoc);

    // Flag the shop owner's Firestore doc as having submitted a cafe
    const currentUser = auth.currentUser;
    if (currentUser) {
      await updateDoc(doc(db, "ShopOwner", currentUser.uid), {
        cafeRegistered: true,
        // approved remains false — admin must flip it
      });
    }

    // Lock button and show toast before signing out
    submitLabel.classList.remove("hidden");
    submitSpin.classList.add("hidden");
    submitLabel.textContent = "✅ Submitted — Signing you out…";

    showToast(
      `🎉 "${nameEl.value.trim()}" submitted! Signing you out — log back in after approval to access your dashboard.`,
      "success",
      3500
    );

    // Sign out after the toast has had time to read
    setTimeout(async () => {
      await signOut(auth);
      sessionStorage.clear();
      window.location.href = "index.html";  // ← your login page
    }, 3500);

  } catch (err) {
    console.error("Registration error:", err);
    showToast("Something went wrong. Please try again.", "error");
    submitBtn.disabled = false;
    submitLabel.classList.remove("hidden");
    submitSpin.classList.add("hidden");
  }
});

/* ── INIT ────────────────────────────────────────────────────── */
updatePreview();