import { db, storage, app } from './firebase-config.js'; // ✅ app must be exported from firebase-config.js
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider }
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { setupNavbar } from './navbar.js';

const auth = getAuth(app);

const DEFAULT_AVATAR = "picture/user2avatar.jpeg" // ✅ default for all accounts

// UI Utilities
const showLoading = (show) => document.getElementById('loading-overlay').classList.toggle('hidden', !show);
const showToast = (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
};

// =====================
// INIT
// =====================
document.addEventListener('DOMContentLoaded', () => {
    setupNavbar();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadUserProfile(user);
        } else {
            window.location.href = 'login.html';
        }
    });
});

// =====================
// LOAD PROFILE
// =====================
async function loadUserProfile(user) {
    showLoading(true);
    try {
        const docRef = doc(db, "Customers", user.uid);
        const docSnap = await getDoc(docRef);

        document.getElementById('display-email').value = user.email;

        if (docSnap.exists()) {
            const data = docSnap.data();

            document.getElementById('display-name').textContent =
                data.username || user.email.split('@')[0];

            document.getElementById('username').value   = data.username  || '';

            // ✅ Use saved photo or fall back to default
            document.getElementById('main-profile-pic').src = data.photoURL || DEFAULT_AVATAR;

        } else {
            // ✅ Brand new account — no doc yet, show defaults
            document.getElementById('display-name').textContent = user.email.split('@')[0];
            document.getElementById('main-profile-pic').src = DEFAULT_AVATAR;
        }

    } catch (error) {
        console.error(error);
        showToast("Error loading profile.", "error");
    } finally {
        showLoading(false);
    }
}

// =====================
// TAB SWITCHING
// =====================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
    });
});

// =====================
// BIO COUNTER
// =====================
document.getElementById('bio').addEventListener('input', (e) => {
    document.getElementById('bio-count').textContent = e.target.value.length;
});

// =====================
// UPLOAD PROFILE PICTURE
// =====================
const uploadInput = document.getElementById('upload-photo');
document.getElementById('trigger-upload').addEventListener('click', () => uploadInput.click());

uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) return showToast("Invalid file type. JPG, PNG, WEBP only.", "error");
    if (file.size > 5 * 1024 * 1024) return showToast("File exceeds 5MB limit.", "error");

    const storageRef = ref(storage, `profile-images/${user.uid}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    const progressEl = document.getElementById('upload-progress');
    const progressFill = progressEl.querySelector('.progress-fill');

    progressEl.classList.remove('hidden');

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressFill.style.width = progress + '%';
        },
        (error) => {
            console.error(error);
            progressEl.classList.add('hidden');
            showToast("Upload failed.", "error");
        },
        async () => {
            progressEl.classList.add('hidden');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // ✅ Save to Firestore
            await setDoc(doc(db, "Customers", user.uid), { photoURL: downloadURL }, { merge: true });

            // ✅ Update UI
            document.getElementById('main-profile-pic').src = downloadURL;
            showToast("Profile picture updated! 📷");
        }
    );
});

// =====================
// SAVE PERSONAL INFO
// =====================
document.getElementById('personal-info').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);

    const user = auth.currentUser;
    if (!user) return showToast("Not logged in.", "error");

    const username  = document.getElementById('username').value.trim();
    
    try {
        await setDoc(doc(db, "Customers", user.uid), {
            username,
        }, { merge: true });

        document.getElementById('display-name').textContent =
            username;

        showToast("Profile updated successfully! 💾");
    } catch (error) {
        console.error(error);
        showToast("Failed to update profile.", "error");
    } finally {
        showLoading(false);
    }
});

// =====================
// CHANGE PASSWORD (real)
// =====================

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
        // ✅ Re-authenticate first before changing password
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

// =====================
// CHANGE EMAIL (real)
// =====================

document.getElementById('change-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);

    const user = auth.currentUser;
    if (!user) return;

    const newEmail  = document.getElementById('new-email').value.trim();
    const password  = document.getElementById('email-password-confirm').value;

    try {
        // ✅ Re-authenticate first before changing email
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
        await updateEmail(user, newEmail);

        document.getElementById('display-email').value = newEmail;
        showToast("Email updated successfully! ✉️");
        e.target.reset();
    } catch (error) {
        console.error(error);
        showToast("Wrong password or session expired.", "error");
    } finally {
        showLoading(false);
    }
});