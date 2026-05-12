import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js"; 
import { getStorage } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";


const firebaseConfig = {
  apiKey: "AIzaSyBW6kZ1X9qSa5aOMjY-gjC--u1QQVqZrBU",
  authDomain: "projectcafehunt.firebaseapp.com",
  databaseURL: "https://projectcafehunt-default-rtdb.firebaseio.com",
  projectId: "projectcafehunt",
  storageBucket: "projectcafehunt.firebasestorage.app",
  messagingSenderId: "420902695771",
  appId: "1:420902695771:web:6484b6f576eff6257ee07e"
};

//initialize FireBase and FireStore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const storage = getStorage(app);

export { db, app, storage };