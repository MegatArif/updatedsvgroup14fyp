import { db } from "./firebase.js";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


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
// DELETE POST
// =====================
async function deletePost(postId) {

  const ok = confirm("Delete this post?");

  if (!ok) return;

  await deleteDoc(doc(db, "posts", postId));
}


// expose
window.deletePost = deletePost;

loadAdminPosts();