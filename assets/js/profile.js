import { db, storage } from './firebase-config.js';
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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

// Mock User for Independent Testing
// This replaces the Firebase Auth user so the database still has an ID to save to.
const currentUser = {
    uid: "KlnwYg2ezNPCoM7v1zZ7vNKp06O2",
    email: "guest@example.com"
};

// Initialize page without waiting for authentication
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
});

// Load Profile Data from Firestore
async function loadUserProfile() {
    showLoading(true);
    try {
        const docRef = doc(db, "Customers", currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        document.getElementById('display-email').value = currentUser.email;

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            document.getElementById('nav-username').textContent = data.username || 'Guest User';
            document.getElementById('display-name').textContent = data.firstName ? `${data.firstName} ${data.lastName}` : (data.username || 'Guest User');
            document.getElementById('username').value = data.username || '';
            document.getElementById('firstName').value = data.firstName || '';
            document.getElementById('lastName').value = data.lastName || '';
            document.getElementById('bio').value = data.bio || '';
            document.getElementById('bio-count').textContent = (data.bio || '').length;
            
            if (data.photoURL) {
                document.getElementById('main-profile-pic').src = data.photoURL;
                document.getElementById('nav-profile-pic').src = data.photoURL;
            }
        } else {
            document.getElementById('nav-username').textContent = 'Guest User';
            document.getElementById('display-name').textContent = 'Guest User';
        }
    } catch (error) {
        console.error(error);
        showToast("Error loading profile data. Check Firebase Rules.", "error");
    } finally {
        showLoading(false);
    }
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
    });
});

// Bio Counter
document.getElementById('bio').addEventListener('input', (e) => {
    document.getElementById('bio-count').textContent = e.target.value.length;
});

// Upload Profile Picture (Max 5MB, JPG/PNG/WEBP)
const uploadInput = document.getElementById('upload-photo');
document.getElementById('trigger-upload').addEventListener('click', () => uploadInput.click());

uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) return showToast("Invalid file type. JPG, PNG, WEBP only.", "error");
    if (file.size > 5 * 1024 * 1024) return showToast("File exceeds 5MB limit.", "error");

    const storageRef = ref(storage, `profile-images/${currentUser.uid}`);
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
            showToast("Upload failed. Check Firebase Storage rules.", "error");
        }, 
        async () => {
            progressEl.classList.add('hidden');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await setDoc(doc(db, "Customers", currentUser.uid), { photoURL: downloadURL }, { merge: true });
            document.getElementById('main-profile-pic').src = downloadURL;
            document.getElementById('nav-profile-pic').src = downloadURL;
            showToast("Profile picture updated!");
        }
    );
});

// Save Personal Information
document.getElementById('personal-info').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);
    const username = document.getElementById('username').value.trim();
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const bio = document.getElementById('bio').value.trim();

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            username, firstName, lastName, bio
        }, { merge: true });
        
        document.getElementById('nav-username').textContent = username;
        document.getElementById('display-name').textContent = firstName ? `${firstName} ${lastName}` : username;
        showToast("Profile updated successfully!");
    } catch (error) {
        console.error(error);
        showToast("Failed to update profile.", "error");
    } finally {
        showLoading(false);
    }
});

// Mock Password Update (Since there is no real auth session)
document.getElementById('change-password').addEventListener('submit', (e) => {
    e.preventDefault();
    showLoading(true);
    setTimeout(() => {
        showLoading(false);
        showToast("UI Test: Password update simulated successfully.");
        e.target.reset();
    }, 1000);
});

// Mock Email Update (Since there is no real auth session)
document.getElementById('change-email').addEventListener('submit', (e) => {
    e.preventDefault();
    showLoading(true);
    setTimeout(() => {
        showLoading(false);
        showToast("UI Test: Email update simulated successfully.");
        e.target.reset();
    }, 1000);
});

// Mock Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    if(confirm("Simulate logout?")) {
        showToast("Logged out successfully. (Mock)");
    }
});