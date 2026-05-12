import { db, storage, app } from './firebase-config.js';
import { showToast } from './toast.js';

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const auth = getAuth(app);

// =====================
// STATE
// =====================
let currentUser = null;
let isPosting = false;
let selectedImageFile = null;
let selectedLocation = "";
let selectedLocationLink = "";

const DEFAULT_AVATAR = "picture/user2avatar.jpeg";

// =====================
// TITLE
// =====================
function updateMyPostTitle() {
  const el = document.getElementById("my-post-title");
  if (!el) return;

  el.innerText = currentUser
    ? `My Posts (${currentUser.username})`
    : "My Posts ()";
}

// =====================
// AUTH CONNECT
// =====================
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    currentUser = null;
    updateMyPostTitle();
    return;
  }

  try {
    const snap = await getDoc(doc(db, "Customers", user.uid));
    const data = snap.exists() ? snap.data() : {};

    currentUser = {
      userId: user.uid,
      username: data.username || user.email.split("@")[0],
      avatar: data.avatar || DEFAULT_AVATAR
    };

  } catch (err) {
    console.error(err);

    currentUser = {
      userId: user.uid,
      username: user.email.split("@")[0],
      avatar: DEFAULT_AVATAR
    };
  }

  updateMyPostTitle();

  // 🔥 SIDEBAR AVATAR UPDATE (KEY FIX)
  const sidebarAvatar = document.getElementById("sidebar-avatar");
  if (sidebarAvatar) {
    sidebarAvatar.src = currentUser.avatar;
  }

  loadPosts();
});

// =====================
// LOCATION
// =====================
window.addLocation = function () {
  selectedLocation = prompt("Enter cafe name:");

  if (selectedLocation) {
    selectedLocationLink =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(selectedLocation);
  }
};

// =====================
// IMAGE
// =====================
const uploadEl = document.getElementById("upload-img");

if (uploadEl) {
  uploadEl.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedImageFile = file;

    const preview = document.getElementById("preview-img");
    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }
  });
}

// =====================
// CREATE POST
// =====================
window.createPost = async function () {

  if (isPosting || !currentUser) return;
  isPosting = true;

  const content = document.getElementById("post-input").value;

  if (!content.trim()) {
    showToast("Please write something first", "error");
    isPosting = false;
    return;
  }

  try {

    let imageURL = "picture/postalice.png";

    if (selectedImageFile) {
      const imageRef = ref(
        storage,
        `posts/${Date.now()}_${selectedImageFile.name}`
      );

      await uploadBytes(imageRef, selectedImageFile);
      imageURL = await getDownloadURL(imageRef);
    }

    await addDoc(collection(db, "posts"), {
      username: currentUser.username,
      userId: currentUser.userId,
      avatar: currentUser.avatar,

      content,
      imageURL,

      locationName: selectedLocation,
      locationLink: selectedLocationLink,

      likes: 0,
      likedBy: [],

      createAt: serverTimestamp()
    });

    showToast("Post created ☕", "success");

    document.getElementById("post-input").value = "";
    selectedImageFile = null;
    selectedLocation = "";
    selectedLocationLink = "";

    const preview = document.getElementById("preview-img");
    if (preview) preview.style.display = "none";

  } finally {
    isPosting = false;
  }
};

// =====================
// DELETE
// =====================
window.deletePost = async function (postId, postUserId) {
  if (!currentUser || postUserId !== currentUser.userId) return;

  if (!confirm("Delete this post?")) return;

  await deleteDoc(doc(db, "posts", postId));
};

// =====================
// LIKE
// =====================
window.toggleLike = async function (postId, likedBy = [], currentLikes = 0) {

  if (!currentUser) return;

  const refDoc = doc(db, "posts", postId);

  let list = [...likedBy];

  const isLiked = list.includes(currentUser.userId);

  if (isLiked) {
    list = list.filter(id => id !== currentUser.userId);

    await updateDoc(refDoc, {
      likedBy: list,
      likes: currentLikes - 1
    });

  } else {
    list.push(currentUser.userId);

    await updateDoc(refDoc, {
      likedBy: list,
      likes: currentLikes + 1
    });
  }
};

// =====================
// LOAD POSTS
// =====================
function loadPosts() {

  const q = query(
    collection(db, "posts"),
    orderBy("createAt", "desc")
  );

  onSnapshot(q, (snapshot) => {

    const feed = document.getElementById("feed");
    const myPosts = document.getElementById("my-posts");

    if (!feed || !myPosts) return;

    feed.innerHTML = "";
    myPosts.innerHTML = "";

    snapshot.forEach((docSnap) => {

      const post = docSnap.data();
      const postId = docSnap.id;

      const isMine = currentUser && post.userId === currentUser.userId;
      const isLiked = (post.likedBy || []).includes(currentUser?.userId);

      const avatar = post.avatar || DEFAULT_AVATAR;

      // =========================
      // 🔵 FEED CARD (NO DELETE)
      // =========================
      const feedHTML = `
        <div class="post-card">

          <div class="post-header">
            <img src="${avatar}" class="avatar">
            <b>${post.username}</b>
          </div>

          <div class="post-content">${post.content}</div>

          <div class="post-time">
            ${post.createAt ? post.createAt.toDate().toLocaleString() : ""}
          </div>

          <img src="${post.imageURL}" class="post-image">

          ${post.locationName ? `
            <a href="${post.locationLink}" target="_blank">
              📍 ${post.locationName}
            </a>
          ` : ""}

          <div style="cursor:pointer"
               onclick='toggleLike("${postId}", ${JSON.stringify(post.likedBy || [])}, ${post.likes || 0})'>

            ${isLiked ? "❤️" : "🤍"} ${post.likes || 0}

          </div>

        </div>
      `;

      feed.innerHTML += feedHTML;

      // =========================
      // 🟢 MY POSTS (WITH DELETE)
      // =========================
      if (isMine) {

        const myPostHTML = `
          <div class="post-card">

            <!-- 🔥 DELETE ONLY HERE -->
            <div class="delete-btn"
                 onclick='deletePost("${postId}", "${post.userId}")'
                 style="cursor:pointer; float:right;">
              🗑
            </div>

            <div class="post-header">
              <img src="${avatar}" class="avatar">
              <b>${post.username}</b>
            </div>

            <div class="post-content">${post.content}</div>

            <div class="post-time">
              ${post.createAt ? post.createAt.toDate().toLocaleString() : ""}
            </div>

            <img src="${post.imageURL}" class="post-image">

            ${post.locationName ? `
              <a href="${post.locationLink}" target="_blank">
                📍 ${post.locationName}
              </a>
            ` : ""}

            <div style="cursor:pointer"
                 onclick='toggleLike("${postId}", ${JSON.stringify(post.likedBy || [])}, ${post.likes || 0})'>

              ${isLiked ? "❤️" : "🤍"} ${post.likes || 0}

            </div>

          </div>
        `;

        myPosts.innerHTML += myPostHTML;
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