import { db } from "./firebase.js";

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// =====================
// 👤 USER
// =====================
const currentUser = {
  userId: "annie001",
  username: "ANNIE",
  avatar: "picture/user2avatar.jpeg"
};


// =====================
// LOCATION
// =====================
let selectedLocation = "";
let selectedLocationLink = "";

function addLocation() {
  selectedLocation = prompt("Enter cafe name:");

  if (selectedLocation) {
    selectedLocationLink =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(selectedLocation);
  }
}


// =====================
// IMAGE
// =====================
let selectedImageURL = "";

document.getElementById("upload-img").addEventListener("change", (e) => {

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (event) => {
    selectedImageURL = event.target.result;

    // ✅ NEW: show preview
    const preview = document.getElementById("preview-img");
    preview.src = selectedImageURL;
    preview.style.display = "block";
  };

  reader.readAsDataURL(file);
});

// =====================
// CREATE POST
// =====================
async function createPost() {

  const content = document.getElementById("post-input").value;

  // ❌ 防呆：没有内容
  if (content.trim() === "") {
    showToast("ERROR: Please write something before posting", "error");
    return;
  }

  await addDoc(collection(db, "posts"), {

    username: currentUser.username,
    userId: currentUser.userId,
    avatar: currentUser.avatar,

    content: content,
    imageURL: selectedImageURL || "picture/postalice.png",

    locationName: selectedLocation,
    locationLink: selectedLocationLink,

    likes: 0,
    likedBy: [],

    createAt: serverTimestamp()

  });

  // ✅ 成功提示（你之前要的）
  showToast("Create successful ☕", "success");

  // 清空输入
  document.getElementById("post-input").value = "";
  selectedImageURL = "";
  selectedLocation = "";
  selectedLocationLink = "";
}


// =====================
// DELETE POST (ONLY OWN POSTS)
// =====================
async function deletePost(postId, postUserId) {

  if (postUserId !== currentUser.userId) return;

  const ok = confirm("Delete this post?");
  if (!ok) return;

  await deleteDoc(doc(db, "posts", postId));
  showToast("Delete post successful 🗑", "success");
}


// =====================
// ❤️ LIKE SYSTEM (FIXED)
// =====================
async function toggleLike(postId, likedBy = [], currentLikes = 0) {

  const ref = doc(db, "posts", postId);

  let list = [...likedBy];

  const isLiked = list.includes(currentUser.userId);

  if (isLiked) {

    // ❌ unlike
    list = list.filter(id => id !== currentUser.userId);

    await updateDoc(ref, {
      likedBy: list,
      likes: currentLikes - 1
    });
    showToast("Unlike removed successfully", "info");

  } else {

    // ❤️ like
    list.push(currentUser.userId);

    await updateDoc(ref, {
      likedBy: list,
      likes: currentLikes + 1
    });

    showToast("Like successful ❤️", "success");

  }
}


// =====================
// LOAD POSTS (REALTIME)
// =====================
function loadPosts() {

  const q = query(
    collection(db, "posts"),
    orderBy("createAt", "desc")
  );

  onSnapshot(q, (snapshot) => {

    const feed = document.getElementById("feed");
    const myPosts = document.getElementById("my-posts");

    feed.innerHTML = "";
    myPosts.innerHTML = "";

    snapshot.forEach((docSnap) => {

      const post = docSnap.data();
      const postId = docSnap.id;

      const isMine = post.userId === currentUser.userId;
      const isLiked = (post.likedBy || []).includes(currentUser.userId);

      // =====================
      // FEED (ALL USERS)
      // =====================
      const feedHTML = `
        <div class="post-card">

          <div class="post-header">
            <img src="${post.avatar || 'picture/user1avatar.jpeg'}" class="avatar">
            <b>${post.username}</b>
          </div>

          <div class="post-content">${post.content}</div>

          <div class="post-time">
            ${post.createAt ? post.createAt.toDate().toLocaleString() : ""}
          </div>

          <img src="${post.imageURL}" class="post-image">

          ${post.locationName ? `
            <a class="post-location"
               href="${post.locationLink}"
               target="_blank">
              📍 ${post.locationName}
            </a>
          ` : ""}

          <div style="cursor:pointer;"
               onclick='toggleLike("${postId}", ${JSON.stringify(post.likedBy || [])}, ${post.likes || 0})'>

            ${isLiked ? "❤️" : "🤍"} ${post.likes || 0}

          </div>

        </div>
      `;

      feed.innerHTML += feedHTML;


      // =====================
      // MY POSTS (WITH DELETE)
      // =====================
      if (isMine) {

        const myHTML = `
          <div class="post-card my-post">

            <div class="delete-btn"
                 onclick='deletePost(${JSON.stringify(postId)}, ${JSON.stringify(post.userId)})'>
              🗑
            </div>

            <div class="post-header">
              <img src="${post.avatar || 'picture/user1avatar.jpeg'}" class="avatar">
              <b>${post.username}</b>
            </div>

            <div class="post-content">${post.content}</div>

            <div class="post-time">
              ${post.createAt ? post.createAt.toDate().toLocaleString() : ""}
            </div>

            <img src="${post.imageURL}" class="post-image">

            ${post.locationName ? `
              <a class="post-location"
                 href="${post.locationLink}"
                 target="_blank">
                📍 ${post.locationName}
              </a>
            ` : ""}

            <div style="cursor:pointer;"
                 onclick='toggleLike("${postId}", ${JSON.stringify(post.likedBy || [])}, ${post.likes || 0})'>

              ${isLiked ? "❤️" : "🤍"} ${post.likes || 0}

            </div>

          </div>
        `;

        myPosts.innerHTML += myHTML;
      }

    });

  });

}


// =====================
// EXPORT
// =====================
window.createPost = createPost;
window.addLocation = addLocation;
window.deletePost = deletePost;
window.toggleLike = toggleLike;


// START
loadPosts();

// =====================
// 🍞 TOAST SYSTEM (ADDED ONLY - NO CHANGES)
// =====================

const toastStyle = document.createElement('style');
toastStyle.textContent = `
  #toast-container {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: .6rem;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: .75rem;
    min-width: 280px;
    max-width: 360px;
    padding: .9rem 1.1rem;
    border-radius: .85rem;
    background: #1a1a1a;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    font-family: "Syne", sans-serif;
    font-size: .85rem;
    font-weight: 600;
    color: #f5f5f5;
    pointer-events: all;
    border-left: 4px solid transparent;
    opacity: 0;
    transform: translateX(60px);
    transition: opacity .32s ease, transform .32s ease;
  }
  .toast.show {
    opacity: 1;
    transform: translateX(0);
  }
  .toast.hide {
    opacity: 0;
    transform: translateX(60px);
  }
  .toast.success { border-color: #43a047; }
  .toast.error   { border-color: #e53935; }
  .toast.info    { border-color: #1e88e5; }
  .toast-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    margin-top: .05rem;
  }
  .toast.success .toast-icon { color: #43a047; }
  .toast.error   .toast-icon { color: #e53935; }
  .toast.info    .toast-icon { color: #1e88e5; }
  .toast-body { flex: 1; line-height: 1.45; }
  .toast-title {
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    margin-bottom: .2rem;
    opacity: .6;
  }
  .toast-progress {
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    border-radius: 0 0 .85rem .85rem;
    width: 100%;
    transform-origin: left;
  }
  .toast.success .toast-progress { background: #43a047; }
  .toast.error   .toast-progress { background: #e53935; }
  .toast.info    .toast-progress { background: #1e88e5; }
`;
document.head.appendChild(toastStyle);

// container
const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

// function
function showToast(message, type = 'success', duration = 3500) {

  const icons = {
    success: '✔️',
    error: '❌',
    info: 'ℹ️'
  };

  const titles = {
    success: 'Success',
    error: 'Error',
    info: 'Info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';

  toast.innerHTML = `
    <i class="toast-icon">${icons[type]}</i>
    <div class="toast-body">
      <div class="toast-title">${titles[type]}</div>
      <div>${message}</div>
    </div>
    <div class="toast-progress"></div>
  `;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}