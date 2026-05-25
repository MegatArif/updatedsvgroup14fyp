import { db, storage, app } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, writeBatch } 
    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } 
    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, updatePassword, verifyBeforeUpdateEmail,
         reauthenticateWithCredential, EmailAuthProvider, signOut, deleteUser }
    from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { setupNavbar } from './navbar.js';

const auth = getAuth(app);

const DEFAULT_AVATAR = "picture/user2avatar.jpeg";

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

// ─── Preset facilities list ────────────────────────────────────────────────────
const PRESET_FACILITIES = [
    'WiFi', 'Power outlet', 'Air conditioning', 'Parking',
    'Outdoor seating', 'Pet friendly', 'Non-smoking', 'Toilet',
    'Prayer room', 'Wheelchair accessible'
];

// Tracks the current list of custom + preset facilities that are selected
let selectedFacilities = [];

// ─── Build facility checkboxes ─────────────────────────────────────────────────
function buildFacilityCheckboxes(saved = []) {
    selectedFacilities = [...saved];

    const container = document.getElementById('facilities-checkboxes');
    container.innerHTML = '';

    // Combine preset + any saved custom ones not in preset
    const allFacilities = [
        ...PRESET_FACILITIES,
        ...saved.filter(f => !PRESET_FACILITIES.includes(f))
    ];

    allFacilities.forEach(f => renderFacilityCheckbox(f, container, saved.includes(f)));
}

function renderFacilityCheckbox(label, container, checked = false) {
    const id = 'fac-' + label.replace(/\s+/g, '-').toLowerCase();
    const wrapper = document.createElement('label');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.875rem;';
    wrapper.innerHTML = `
        <input type="checkbox" id="${id}" value="${label}" ${checked ? 'checked' : ''} style="cursor:pointer;">
        ${label}
    `;
    wrapper.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
            if (!selectedFacilities.includes(label)) selectedFacilities.push(label);
        } else {
            selectedFacilities = selectedFacilities.filter(f => f !== label);
        }
    });
    container.appendChild(wrapper);
    if (checked && !selectedFacilities.includes(label)) selectedFacilities.push(label);
}

// ─── Add custom facility button ────────────────────────────────────────────────
document.getElementById('add-facility-btn').addEventListener('click', () => {
    const input = document.getElementById('custom-facility-input');
    const val = input.value.trim();
    if (!val) return;
    if (selectedFacilities.includes(val)) {
        showToast('Facility already exists.', 'error');
        return;
    }
    const container = document.getElementById('facilities-checkboxes');
    renderFacilityCheckbox(val, container, true);
    input.value = '';
});

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupNavbar();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadUserProfile(user);
        } else {
            window.location.href = 'index.html';
        }
    });
});

// ─── LOAD PROFILE ──────────────────────────────────────────────────────────────
async function loadUserProfile(user) {
    showLoading(true);
    try {
        const docRef  = doc(db, "Customers", user.uid);
        const docSnap = await getDoc(docRef);

        document.getElementById('display-email').value = user.email;
        await setDoc(docRef, { email: user.email }, { merge: true });

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('display-name').textContent = data.username || user.email.split('@')[0];
            document.getElementById('username').value = data.username || '';
            document.getElementById('main-profile-pic').src = data.photoURL || DEFAULT_AVATAR;
        } else {
            document.getElementById('display-name').textContent = user.email.split('@')[0];
            document.getElementById('main-profile-pic').src = DEFAULT_AVATAR;
        }

        // ── Check if this user is a ShopOwner ──────────────────────────────────
        const ownerRef  = doc(db, "ShopOwner", user.uid);
        const ownerSnap = await getDoc(ownerRef);

        if (ownerSnap.exists()) {
            const ownerData = ownerSnap.data();
            // Show Shop Settings tab
            document.getElementById('shop-tab-btn').classList.remove('hidden');

            // If they have a registered cafe, load it
            if (ownerData.cafeRegistered) {
                await loadShopSettings(user.uid);
            }
        }

    } catch (error) {
        console.error(error);
        showToast("Error loading profile.", "error");
    } finally {
        showLoading(false);
    }
}

// ─── LOAD SHOP SETTINGS ────────────────────────────────────────────────────────
async function loadShopSettings(uid) {
    try {
        // Find cafe where ownerId == uid
        const q = query(collection(db, "cafes"), where("ownerId", "==", uid));
        const snap = await getDocs(q);
        if (snap.empty) return;

        const cafeDoc  = snap.docs[0];
        const cafe     = cafeDoc.data();
        const cafeId   = cafeDoc.id;

        // Stash cafeId for saves / deletes
        document.getElementById('shop-settings').dataset.cafeId = cafeId;

        // Populate fields
        document.getElementById('shop-name').value        = cafe.name        || '';
        document.getElementById('shop-address').value     = cafe.address     || '';
        document.getElementById('shop-city').value        = cafe.city        || '';
        document.getElementById('shop-description').value = cafe.description || '';
        document.getElementById('shop-open-hour').value   = cafe.openHour    || '';
        document.getElementById('shop-close-hour').value  = cafe.closeHour   || '';

        // Facilities
        buildFacilityCheckboxes(cafe.facilities || []);

        // Shop image preview
        if (cafe.image) {
            // cafe.image may be a Storage path ("cafes/cafes12.jpg") or a full URL
            let imgSrc = cafe.image;
            if (!imgSrc.startsWith('http')) {
                try {
                    imgSrc = await getDownloadURL(ref(storage, imgSrc));
                } catch (_) { /* keep path string */ }
            }
            const preview = document.getElementById('shop-image-preview');
            preview.src   = imgSrc;
            preview.style.display = 'block';
            preview.dataset.currentPath = cafe.image; // keep original path for delete
        }

        // Approval status notice
        const notice    = document.getElementById('shop-status-notice');
        const noticeText = document.getElementById('shop-status-text');
        if (cafe.approveStatus && cafe.approveStatus !== 'approved') {
            notice.classList.remove('hidden');
            noticeText.textContent =
                cafe.approveStatus === 'rejected'
                ? `⚠️ Your shop was rejected. ${cafe.rejectionNote ? 'Reason: ' + cafe.rejectionNote : ''}`
                : `⏳ Your shop is pending approval.`;
        }

    } catch (err) {
        console.error(err);
        showToast("Could not load shop settings.", "error");
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

// ─── UPLOAD PROFILE PICTURE ────────────────────────────────────────────────────
const uploadInput = document.getElementById('upload-photo');
document.getElementById('trigger-upload').addEventListener('click', () => uploadInput.click());

uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) return showToast("Invalid file type. JPG, PNG, WEBP only.", "error");
    if (file.size > 5 * 1024 * 1024)    return showToast("File exceeds 5MB limit.", "error");

    const storageRef  = ref(storage, `profile-images/${user.uid}`);
    const uploadTask  = uploadBytesResumable(storageRef, file);
    const progressEl  = document.getElementById('upload-progress');
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
            await setDoc(doc(db, "Customers", user.uid), { photoURL: downloadURL }, { merge: true });
            document.getElementById('main-profile-pic').src = downloadURL;
            showToast("Profile picture updated! 📷");
        }
    );
});

// ─── SAVE PERSONAL INFO ────────────────────────────────────────────────────────
document.getElementById('personal-info').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);

    const user = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");

    const username = document.getElementById('username').value.trim();

    try {
        await setDoc(doc(db, "Customers", user.uid), { username }, { merge: true });
        document.getElementById('display-name').textContent = username;
        showToast("Profile updated successfully! 💾");
    } catch (error) {
        console.error(error);
        showToast("Failed to update profile.", "error");
    } finally {
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
    } catch (error) {
        console.error(error);
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
        showToast("New email must be different from your current email.", "error");
        showLoading(false);
        return;
    }

    const emailQuery = query(collection(db, "Customers"), where("email", "==", newEmail));
    const emailSnap  = await getDocs(emailQuery);

    if (!emailSnap.empty) {
        showToast("That email is already registered.", "error");
        showLoading(false);
        return;
    }

    try {
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        await verifyBeforeUpdateEmail(user, newEmail);
        showToast("Verification email sent to " + newEmail + "! Please check your inbox to confirm the change. ✉️", "success");
        setTimeout(async () => {
            await signOut(auth);
            window.location.href = 'index.html';
        }, 3000);
        e.target.reset();
    } catch (error) {
        console.error(error);
        let msg = "Failed to update email.";
        switch (error.code) {
            case 'auth/wrong-password':
            case 'auth/invalid-credential':   msg = 'Wrong password. Please try again.'; break;
            case 'auth/email-already-in-use': msg = 'That email is already in use.'; break;
            case 'auth/invalid-email':        msg = 'Invalid email address.'; break;
            case 'auth/requires-recent-login':msg = 'Session expired. Please log out and log in again.'; break;
        }
        showToast(msg, "error");
    } finally {
        showLoading(false);
    }
});

// ─── LOGOUT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('log-up-btn');
    if (logoutBtn) {
        logoutBtn.type = 'button';
        logoutBtn.addEventListener('click', async () => {
            if (!confirm("Are you sure you want to log out?")) return;
            showLoading(true);
            try {
                await signOut(getAuth());
                showToast("Logged out successfully! 👋");
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            } catch (error) {
                console.error("Logout error:", error);
                showToast("Failed to log out. Please try again.", "error");
                showLoading(false);
            }
        });
    }
});

// ─── SHOP IMAGE UPLOAD ────────────────────────────────────────────────────────
const shopImageInput = document.getElementById('shop-image-upload');
document.getElementById('trigger-shop-image').addEventListener('click', () => shopImageInput.click());

shopImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) return showToast("Invalid file type.", "error");
    if (file.size > 5 * 1024 * 1024)    return showToast("File exceeds 5MB.", "error");

    const cafeId     = document.getElementById('shop-settings').dataset.cafeId;
    if (!cafeId) return showToast("No cafe found to link image to.", "error");

    const storagePath = `cafes/${cafeId}.jpg`;
    const storageRef  = ref(storage, storagePath);
    const uploadTask  = uploadBytesResumable(storageRef, file);
    const progressEl  = document.getElementById('shop-image-progress');
    const progressFill = progressEl.querySelector('.progress-fill');

    progressEl.classList.remove('hidden');

    uploadTask.on('state_changed',
        (snapshot) => {
            progressFill.style.width = (snapshot.bytesTransferred / snapshot.totalBytes * 100) + '%';
        },
        (error) => {
            console.error(error);
            progressEl.classList.add('hidden');
            showToast("Shop image upload failed.", "error");
        },
        async () => {
            progressEl.classList.add('hidden');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Save both full URL and path to Firestore
            await setDoc(doc(db, "cafes", cafeId), { image: storagePath }, { merge: true });

            const preview = document.getElementById('shop-image-preview');
            preview.src = downloadURL;
            preview.style.display = 'block';
            preview.dataset.currentPath = storagePath;

            showToast("Shop image updated! 📷");
        }
    );
});

// ─── SAVE SHOP SETTINGS ───────────────────────────────────────────────────────
document.getElementById('shop-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);

    const user   = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");

    const cafeId = document.getElementById('shop-settings').dataset.cafeId;
    if (!cafeId) {
        showToast("No cafe document found.", "error");
        showLoading(false);
        return;
    }

    const address     = document.getElementById('shop-address').value.trim();
    const city        = document.getElementById('shop-city').value.trim();
    const openHour    = document.getElementById('shop-open-hour').value;
    const closeHour   = document.getElementById('shop-close-hour').value;
    const description = document.getElementById('shop-description').value.trim();
    // selectedFacilities is kept in sync by checkbox listeners

    try {
        await setDoc(doc(db, "cafes", cafeId), {
            address,
            city,
            openHour,
            closeHour,
            description,
            facilities: selectedFacilities
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
    if (!user) return;

    const cafeId = document.getElementById('shop-settings').dataset.cafeId;

    const confirmed = confirm(
        "⚠️ Are you sure you want to DELETE your shop and unregister as a Shop Owner?\n\n" +
        "This will:\n" +
        "  • Permanently delete your cafe listing\n" +
        "  • Remove your ShopOwner registration\n\n" +
        "This action CANNOT be undone."
    );
    if (!confirmed) return;

    // Second confirmation
    const double = confirm("Final confirmation: Delete shop and unregister?");
    if (!double) return;

    showLoading(true);

    try {
        const batch = writeBatch(db);

        // 1. Delete the cafe document
        if (cafeId) {
            batch.delete(doc(db, "cafes", cafeId));

            // Also try to delete the cafe image from Storage
            try {
                const imgPreview = document.getElementById('shop-image-preview');
                const imgPath = imgPreview.dataset.currentPath || `cafes/${cafeId}.jpg`;
                await deleteObject(ref(storage, imgPath));
            } catch (_) { /* image may not exist, ignore */ }
        }

        // 2. Update ShopOwner doc — mark cafeRegistered false & approved false
        batch.set(doc(db, "ShopOwner", user.uid), {
            cafeRegistered: false,
            approved: false,
            rejected: false,
            resolvedAt: null
        }, { merge: true });

        await batch.commit();

        showToast("Shop deleted and account unregistered. Redirecting...", "success");

        // Hide the shop tab and redirect back to profile
        document.getElementById('shop-tab-btn').classList.add('hidden');
        document.querySelector('[data-target="personal-info"]').click();

        setTimeout(() => {
            window.location.reload();
        }, 2000);

    } catch (err) {
        console.error(err);
        showToast("Failed to delete shop. Please try again.", "error");
    } finally {
        showLoading(false);
    }
});