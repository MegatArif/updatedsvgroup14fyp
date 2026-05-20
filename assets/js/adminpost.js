import { db, storage } from './firebase-config.js';
import { showToast } from './toast.js';
import { setupNavbar } from './navbar.js';

// Initialize navbar
setupNavbar();

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  ref,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

import { guardSession, sessionLogout } from './session.js';

// Call guardFunction
guardSession(['admin']);

// ---------- LOAD POSTS ----------
function loadAdminPosts() {

  // Get posts ordered by latest
  const q = query(collection(db, "posts"), orderBy("createAt", "desc"));

  // Listen for realtime updates
  onSnapshot(q, async (snapshot) => {

  const adminFeed = document.getElementById("admin-feed");
  const totalPosts = document.getElementById("total-posts");

  // Clear old posts
  adminFeed.innerHTML = "";

  // Update total posts count
  totalPosts.innerText = snapshot.size;

  // Loop through all posts
  for (const docSnap of snapshot.docs) {

    const post = docSnap.data();
    const postId = docSnap.id;

    let username = "Unknown User";

    try {
      // Fetch user data
      if (post.userId) {
        const userSnap = await getDoc(doc(db, "Customers", post.userId));
        const userData = userSnap.data();
        username = userData?.username || "Unknown User"; // get username from firebase
      }
    } catch (err) {
      console.warn("User fetch failed", err);
    }

  // Clickable location
  const locationHTML = post.locationName
    ? `
      <div class="post-location">
        📍 <a href="${post.locationLink}" target="_blank" rel="noopener noreferrer">
          ${post.locationName}
        </a>
      </div>
    `
    : "";

  // Post Card HTML
  const card = `
    <div class="post-card">

      <div class="post-header">
        <b>${username}</b>

        <button class="delete-btn"
          onclick="deletePost('${postId}')">
          🗑 Delete
        </button>
      </div>

      <div class="post-content">
        ${post.content}
      </div>

      <img src="${post.imageURL}" class="post-image">

      ${locationHTML}

      <div class="post-time">
        ${post.createAt ? post.createAt.toDate().toLocaleString() : ""}
      </div>

    </div>
  `;

  adminFeed.innerHTML += card;
  }
  //TODO check below
  });
}

// ---------- DELETE POST ----------
async function deletePost(postId) {

  if (!confirm("Delete this post?")) return;

  try {
    const postSnap = await getDoc(doc(db, "posts", postId)); // get post document
    const imageURL = postSnap.exists() ? postSnap.data().imageURL : null; // get imageURL

    await deleteDoc(doc(db, "posts", postId)); // delete firestore posts

    if (imageURL && !imageURL.includes("postalice.png")) {
      try {
        await deleteObject(ref(storage, imageURL));
      } catch (err) {
        console.warn(err);
      }
    }

    showToast("Post deleted 🗑", "success"); // success message

  } catch (err) {
    console.error(err);
    showToast("Delete failed", "error");
  }
}

// expose
window.deletePost = deletePost;

loadAdminPosts();