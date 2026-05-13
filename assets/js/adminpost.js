import { db, storage } from './firebase-config.js';
import { showToast } from './toast.js';
import { setupNavbar } from './navbar.js';

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

// =====================
// LOAD POSTS
// =====================
function loadAdminPosts() {

  const q = query(collection(db, "posts"), orderBy("createAt", "desc"));

  onSnapshot(q, async (snapshot) => {

    const adminFeed = document.getElementById("admin-feed");
    const totalPosts = document.getElementById("total-posts");

    adminFeed.innerHTML = "";
    totalPosts.innerText = snapshot.size;

    for (const docSnap of snapshot.docs) {

      const post = docSnap.data();
      const postId = docSnap.id;

      let username = "Unknown User";

      try {
        if (post.userId) {
          const userSnap = await getDoc(doc(db, "Customers", post.userId));
          const userData = userSnap.data();
          username = userData?.username || "Unknown User";
        }
      } catch (err) {
        console.warn("User fetch failed", err);
      }

      // 🔥 FIX: clickable location
      const locationHTML = post.locationName
        ? `
          <div class="post-location">
            📍 <a href="${post.locationLink}" target="_blank" rel="noopener noreferrer">
              ${post.locationName}
            </a>
          </div>
        `
        : "";

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
  });
}

// =====================
// DELETE POST
// =====================
async function deletePost(postId) {

  if (!confirm("Delete this post?")) return;

  try {
    const postSnap = await getDoc(doc(db, "posts", postId));
    const imageURL = postSnap.exists() ? postSnap.data().imageURL : null;

    await deleteDoc(doc(db, "posts", postId));

    if (imageURL && !imageURL.includes("postalice.png")) {
      try {
        await deleteObject(ref(storage, imageURL));
      } catch (err) {
        console.warn(err);
      }
    }

    showToast("Post deleted 🗑", "success");

  } catch (err) {
    console.error(err);
    showToast("Delete failed", "error");
  }
}

// expose
window.deletePost = deletePost;

loadAdminPosts();