import { db, storage, app } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch }
    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject }
    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, updatePassword, verifyBeforeUpdateEmail,
         reauthenticateWithCredential, EmailAuthProvider, signOut }
    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { setupNavbar } from './navbar.js';
import { showConfirm } from './toast.js';

const auth = getAuth(app);

// ─── UI helpers ────────────────────────────────────────────────────────────────
const showLoading = (show) =>
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);

const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
};

// ─── Fixed 4 facilities — no custom input ─────────────────────────────────────
const PRESET_FACILITIES = [
    'WiFi',
    'Power outlet',
    'Meeting equipment',
    'Outdoor seating',
];

let selectedFacilities = [];
let currentCafeId = null;

// ─── Build the 4 checkboxes once ──────────────────────────────────────────────
function buildFacilityCheckboxes(saved = []) {
    selectedFacilities = saved.filter(f => PRESET_FACILITIES.includes(f)); // only keep valid ones
    const container = document.getElementById('facilities-checkboxes');
    container.innerHTML = '';
    PRESET_FACILITIES.forEach(f => renderFacilityCheckbox(f, container, selectedFacilities.includes(f)));
}

function renderFacilityCheckbox(label, container, checked = false) {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.875rem;';
    wrapper.innerHTML = `<input type="checkbox" value="${label}" ${checked ? 'checked' : ''} style="cursor:pointer;"> ${label}`;
    wrapper.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
            if (!selectedFacilities.includes(label)) selectedFacilities.push(label);
        } else {
            selectedFacilities = selectedFacilities.filter(f => f !== label);
        }
    });
    container.appendChild(wrapper);
}

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupNavbar();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadShopOwnerProfile(user);
        } else {
            window.location.href = 'index.html';
        }
    });

    const logoutBtn = document.getElementById('log-up-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        showConfirm("Are you sure you want to log out?", async () => {
            showLoading(true);
            try {
                await signOut(auth);
                showToast("Logged out successfully! 👋");
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            } catch (err) {
                console.error(err);
                showToast("Failed to log out.", "error");
                showLoading(false);
            }
        });
    });
}
});

// ─── LOAD PROFILE ──────────────────────────────────────────────────────────────
async function loadShopOwnerProfile(user) {
    showLoading(true);
    try {
        const ownerSnap = await getDoc(doc(db, "ShopOwner", user.uid));
        if (!ownerSnap.exists()) {
            window.location.href = 'index.html';
            return;
        }

        const q    = query(collection(db, "cafes"), where("ownerId", "==", user.uid));
        const snap = await getDocs(q);

        if (snap.empty) {
            showToast("No cafe registered to this account.", "error");
            showLoading(false);
            return;
        }

        const cafeDoc = snap.docs[0];
        currentCafeId = cafeDoc.id;
        const cafe    = cafeDoc.data();

        // Sidebar shop image
        if (cafe.image) {
            let imgSrc = cafe.image;
            if (!imgSrc.startsWith('http')) {
                try { imgSrc = await getDownloadURL(ref(storage, imgSrc)); } catch (_) {}
            }
            const pic = document.getElementById('main-profile-pic');
            pic.src = imgSrc;
            pic.dataset.currentPath = cafe.image;
        }

        document.getElementById('display-name').textContent = cafe.name || user.email.split('@')[0];
        document.getElementById('shop-name').value          = cafe.name        || '';
        document.getElementById('shop-address').value       = cafe.address     || '';
        document.getElementById('shop-city').value          = cafe.city        || '';
        document.getElementById('shop-description').value   = cafe.description || '';
        document.getElementById('shop-open-hour').value     = cafe.openHour    || '';
        document.getElementById('shop-close-hour').value    = cafe.closeHour   || '';

        // Build the 4 checkboxes, ticking whichever the cafe already has saved
        buildFacilityCheckboxes(cafe.facilities || []);

        // Approval status notice
        if (cafe.approveStatus && cafe.approveStatus !== 'approved') {
            document.getElementById('shop-status-notice').classList.remove('hidden');
            document.getElementById('shop-status-text').textContent =
                cafe.approveStatus === 'rejected'
                ? `⚠️ Your shop was rejected. ${cafe.rejectionNote ? 'Reason: ' + cafe.rejectionNote : ''}`
                : `⏳ Your shop is pending approval.`;
        }

    } catch (err) {
        console.error(err);
        showToast("Error loading shop profile.", "error");
    } finally {
        showLoading(false);
    }
}

// ─── TAB SWITCHING ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
    });
});

// ─── SIDEBAR SHOP IMAGE UPLOAD ─────────────────────────────────────────────────
const shopPhotoInput = document.getElementById('upload-shop-photo');
document.getElementById('trigger-upload').addEventListener('click', () => shopPhotoInput.click());

shopPhotoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");
    if (!currentCafeId) return showToast("No cafe found.", "error");

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) return showToast("Invalid file type. JPG, PNG, WEBP only.", "error");
    if (file.size > 5 * 1024 * 1024)    return showToast("File exceeds 5MB limit.", "error");

    const storagePath  = `cafes/${currentCafeId}.jpg`;
    const storageRef   = ref(storage, storagePath);
    const uploadTask   = uploadBytesResumable(storageRef, file);
    const progressEl   = document.getElementById('upload-progress');
    const progressFill = progressEl.querySelector('.progress-fill');

    progressEl.classList.remove('hidden');

    uploadTask.on('state_changed',
        (snapshot) => {
            progressFill.style.width = (snapshot.bytesTransferred / snapshot.totalBytes * 100) + '%';
        },
        (error) => {
            console.error(error);
            progressEl.classList.add('hidden');
            showToast("Upload failed.", "error");
        },
        async () => {
            progressEl.classList.add('hidden');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await setDoc(doc(db, "cafes", currentCafeId), { image: storagePath }, { merge: true });
            const pic = document.getElementById('main-profile-pic');
            pic.src = downloadURL;
            pic.dataset.currentPath = storagePath;
            showToast("Shop image updated! 📷");
        }
    );
});

// ─── SAVE SHOP SETTINGS ───────────────────────────────────────────────────────
document.getElementById('shop-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentCafeId) { showToast("No cafe document found.", "error"); return; }

    showLoading(true);
    try {
        await setDoc(doc(db, "cafes", currentCafeId), {
            address:     document.getElementById('shop-address').value.trim(),
            city:        document.getElementById('shop-city').value.trim(),
            openHour:    document.getElementById('shop-open-hour').value,
            closeHour:   document.getElementById('shop-close-hour').value,
            description: document.getElementById('shop-description').value.trim(),
            facilities:  selectedFacilities
        }, { merge: true });

        showToast("Shop settings saved! 💾");
    } catch (err) {
        console.error(err);
        showToast("Failed to save shop settings.", "error");
    } finally {
        showLoading(false);
    }
});

// ─── DELETE SHOP & UNREGISTER ─────────────────────────────────────────────────
document.getElementById('delete-shop-btn').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || !currentCafeId) return;

    if (!confirm(
        "⚠️ Are you sure you want to DELETE your shop and unregister?\n\n" +
        "• Your cafe listing will be permanently removed\n" +
        "• Your ShopOwner registration will be revoked\n\n" +
        "This CANNOT be undone."
    )) return;

    if (!confirm("Final confirmation: Delete shop and unregister?")) return;

    showLoading(true);
    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "cafes", currentCafeId));
        batch.set(doc(db, "ShopOwner", user.uid), {
            cafeRegistered: false,
            approved: false,
            rejected: false,
            resolvedAt: null
        }, { merge: true });
        await batch.commit();

        try {
            const pic = document.getElementById('main-profile-pic');
            const imgPath = pic.dataset.currentPath || `cafes/${currentCafeId}.jpg`;
            await deleteObject(ref(storage, imgPath));
        } catch (_) {}

        showToast("Shop deleted and account unregistered. Redirecting...");
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);

    } catch (err) {
        console.error(err);
        showToast("Failed to delete shop. Please try again.", "error");
        showLoading(false);
    }
});

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────────
document.getElementById('change-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    const user = auth.currentUser;
    if (!user) return;

    const currentPw = document.getElementById('current-password').value;
    const newPw     = document.getElementById('new-password').value;
    const confirmPw = document.getElementById('confirm-password').value;

    if (newPw !== confirmPw) {
        showToast("Passwords do not match.", "error");
        showLoading(false);
        return;
    }
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPw);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPw);
        showToast("Password updated successfully! 🔒");
        e.target.reset();
    } catch (err) {
        console.error(err);
        showToast("Wrong current password or session expired.", "error");
    } finally {
        showLoading(false);
    }
});

// ─── CHANGE EMAIL ──────────────────────────────────────────────────────────────
document.getElementById('change-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    const user = auth.currentUser;
    if (!user) return;

    const newEmail = document.getElementById('new-email').value.trim();
    const password = document.getElementById('email-password-confirm').value;

    if (newEmail === user.email) {
        showToast("New email must be different.", "error");
        showLoading(false);
        return;
    }

    const emailSnap = await getDocs(query(collection(db, "ShopOwner"), where("email", "==", newEmail)));
    if (!emailSnap.empty) {
        showToast("That email is already registered.", "error");
        showLoading(false);
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        await verifyBeforeUpdateEmail(user, newEmail);
        showToast(`Verification email sent to ${newEmail}! Check your inbox. ✉️`);
        setTimeout(async () => {
            await signOut(auth);
            window.location.href = 'index.html';
        }, 3000);
        e.target.reset();
    } catch (err) {
        console.error(err);
        let msg = "Failed to update email.";
        switch (err.code) {
            case 'auth/wrong-password':
            case 'auth/invalid-credential':    msg = 'Wrong password.'; break;
            case 'auth/email-already-in-use':  msg = 'Email already in use.'; break;
            case 'auth/invalid-email':         msg = 'Invalid email address.'; break;
            case 'auth/requires-recent-login': msg = 'Session expired. Log in again.'; break;
        }
        showToast(msg, "error");
    } finally {
        showLoading(false);
    }
});