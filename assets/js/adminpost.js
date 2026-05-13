import { db, storage } from './firebase-config.js';
import { showToast } from './toast.js';
import { setupNavbar } from './navbar.js';

// Call it once the page loads
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

  const q = query(
    collection(db, "posts"),
    orderBy("createAt", "desc")
  );

  onSnapshot(q, (snapshot) => {

    const adminFeed = document.getElementById("admin-feed");
    const totalPosts = document.getElementById("total-posts");

    adminFeed.innerHTML = "";

    totalPosts.innerText = snapshot.size;

    snapshot.forEach((docSnap) => {

      const post = docSnap.data();
      const postId = docSnap.id;

      const card = `
        <div class="post-card">

          <div class="post-header">
            <b>${post.username}</b>

            <button class="delete-btn"
              onclick="deletePost('${postId}')">
              🗑 Delete
            </button>
          </div>

          <div class="post-content">
            ${post.content}
          </div>

          <img src="${post.imageURL}" class="post-image">

          <div class="post-location">
            📍 ${post.locationName || ""}
          </div>

          <div class="post-time">
            ${post.createAt ? post.createAt.toDate().toLocaleString() : ""}
          </div>

        </div>
      `;

      adminFeed.innerHTML += card;

    });

  });

}


// =====================
// DELETE POST (WITH TOAST)
// =====================
async function deletePost(postId) {
  const ok = confirm("Delete this post?");
  if (!ok) return;

  try {
    // Fetch the post first to get the imageURL
    const postSnap = await getDoc(doc(db, "posts", postId));
    const imageURL = postSnap.exists() ? postSnap.data().imageURL : null;

    // Delete Firestore document
    await deleteDoc(doc(db, "posts", postId));

    // Delete image from Storage if it's not the default
    if (imageURL && !imageURL.includes("postalice.png")) {
      try {
        await deleteObject(ref(storage, imageURL));
      } catch (err) {
        console.warn("Image not found in storage:", err);
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