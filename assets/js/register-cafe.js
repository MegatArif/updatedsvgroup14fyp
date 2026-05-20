// assets/js/register-cafe.js

import { db, storage } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { showToast } from "./toast.js";


/* ── FACILITY ICON MAP ───────────────────────────────────────── */
const facilityIcons = {
  "WiFi":              "fa-wifi",
  "Power outlet":      "fa-plug",
  "Outdoor seating":   "fa-umbrella-beach",
  "Meeting equipment": "fas fa-chalkboard-user",
};

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

  // facilities
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
    // fallback: count + 1
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

  // Selected facilities
  const facilities = [...document.querySelectorAll(".facility-pill input:checked")]
    .map(cb => cb.value);

  // Set loading state
  submitBtn.disabled = true;
  submitLabel.classList.add("hidden");
  submitSpin.classList.remove("hidden");

  try {
    const nextId = await getNextId();
    let imagePath = "";

    // Upload image if selected
    const file = imageInput.files[0];
    if (file) {
      const ext        = file.name.split(".").pop();
      const storePath  = `cafes/cafes${nextId}.${ext}`;
      const storageRef = ref(storage, storePath);
      await uploadBytes(storageRef, file);
      imagePath = storePath;
    }

    // Build Firestore document — default rating seeded at 4
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

    showToast(`🎉 "${nameEl.value.trim()}" has been registered! It will appear on CafeHunt once approved.`, "success", 5000);

    // Reset form
    [nameEl, openEl, closeEl, descEl, addressEl, cityEl].forEach(el => el.value = "");
    document.querySelectorAll(".facility-pill input").forEach(cb => cb.checked = false);
    imageInput.value = "";
    imgPreview.classList.add("hidden");
    placeholder.classList.remove("hidden");
    document.getElementById("previewImg").src = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80";
    updatePreview();

  } catch (err) {
    console.error("Registration error:", err);
    showToast("Something went wrong. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitLabel.classList.remove("hidden");
    submitSpin.classList.add("hidden");
  }
});

/* ── INIT ────────────────────────────────────────────────────── */
updatePreview();