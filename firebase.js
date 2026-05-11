
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// =====================
// 🔥 FIREBASE CONFIG
// =====================
 const firebaseConfig = {
    apiKey: "AIzaSyBW6kZ1X9qSa5aOMjY-gjC--u1QQVqZrBU",
    authDomain: "projectcafehunt.firebaseapp.com",
    projectId: "projectcafehunt",
    storageBucket: "projectcafehunt.firebasestorage.app",
    messagingSenderId: "420902695771",
    appId: "1:420902695771:web:6484b6f576eff6257ee07e"
  };

// =====================
// 🚀 INIT FIREBASE
// =====================
const app = initializeApp(firebaseConfig);


// =====================
// 🗄️ FIRESTORE
// =====================
const db = getFirestore(app);


// =====================
// 📤 EXPORT
// =====================
export { db };