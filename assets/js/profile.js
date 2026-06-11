import { db, storage, app } from './firebase-config.js';
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, updatePassword, updateEmail, verifyBeforeUpdateEmail, reauthenticateWithCredential, EmailAuthProvider, signOut } 
from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { setupNavbar } from './navbar.js';
import { showConfirm } from './toast.js';

const auth = getAuth(app);

const DEFAULT_AVATAR = "picture/user2avatar.jpeg"; // ✅ default for all accounts

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
            window.location.href ='index.html';
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
        await setDoc(docRef, { email: user.email }, { merge: true });
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
// TOGGLE PASSWORD VISIBILITY
// =====================
window.togglePw = function (inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
        btn.classList.add('active');
    } else {
        input.type = 'password';
        btn.textContent = '🔓';
        btn.classList.remove('active');
    }
};

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
            username
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

    
    const pwRules = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,}$/;
    if (!pwRules.test(newPw)) {
        showToast("Password must be at least 6 characters with uppercase, lowercase, number, and special character.", "error");
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
// CHANGE EMAIL 
// =====================

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
    const emailSnap = await getDocs(emailQuery);

    if (!emailSnap.empty) {
        showToast("That email is already registered.", "error");
        showLoading(false);
        return;
    }
    try {
        // Re-authenticate first
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);

        // ✅ Use verifyBeforeUpdateEmail instead of updateEmail
        await verifyBeforeUpdateEmail(user, newEmail);

        showToast("Verification email sent to " + newEmail + "! Please check your inbox to confirm the change. ✉️", "success", 5000);
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
            case 'auth/invalid-credential':  msg = 'Wrong password. Please try again.'; break;
            case 'auth/email-already-in-use': msg = 'That email is already in use.'; break;
            case 'auth/invalid-email':        msg = 'Invalid email address.'; break;
            case 'auth/requires-recent-login': msg = 'Session expired. Please log out and log in again.'; break;
        }
        showToast(msg, "error");
    } finally {
        showLoading(false);
    }
});

// =====================
// LOGOUT FUNCTIONALITY
// =====================
document.addEventListener('DOMContentLoaded', () => {
    // Change logout button type from 'submit' to 'button' to prevent form submission
    const logoutBtn = document.getElementById('log-up-btn');
    if (logoutBtn) {
        logoutBtn.type = 'button'; // Prevents form from triggering save profile
        
        // Add click event listener for logout
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();

            showConfirm("Are you sure you want to log out?", 
                async () => {
                    showLoading(true);
            
            try {
                const auth = getAuth();
                await signOut(auth);
                showToast("Logged out successfully! 👋");
                
                // Redirect to login page after short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                
            } catch (error) {
                console.error("Logout error:", error);
                showToast("Failed to log out. Please try again.", "error");
                showLoading(false);
            }
                }
            )
        });
    }
});

// =====================
// DELETE ACCOUNT
// =====================
document.getElementById('delete-account-btn').addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) return;

    showConfirm(
        "⚠️ Delete your account?\n\nYour profile and all data will be permanently removed. This cannot be undone.",
        async () => {
            showLoading(true);
            try {
                // Delete Firestore customer doc
                await deleteDoc(doc(db, "Customers", user.uid));

                // Delete profile image from Storage (if it's not the default)
                const pic = document.getElementById('main-profile-pic');
                if (pic.src && !pic.src.includes('user2avatar')) {
                    try {
                        await deleteObject(ref(storage, `profile-images/${user.uid}`));
                    } catch (_) {} // Ignore if no image exists
                }

                // Delete Firebase Auth account
                await user.delete();

                showToast("Account deleted successfully. Goodbye! 👋");
                setTimeout(() => { window.location.href = 'index.html'; }, 2000);

            } catch (err) {
                console.error(err);
                if (err.code === 'auth/requires-recent-login') {
                    showToast("Session expired. Please log in again before deleting.", "error");
                    setTimeout(async () => {
                        await signOut(auth);
                        window.location.href = 'index.html';
                    }, 2000);
                } else {
                    showToast("Failed to delete account. Please try again.", "error");
                }
                showLoading(false);
            }
        }
    );
});