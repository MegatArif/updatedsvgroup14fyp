import { db, storage, app } from './firebase-config.js';
import { showToast } from './toast.js';
import { setupNavbar } from './navbar.js';

setupNavbar();

// =====================
// FIREBASE IMPORTS
// =====================
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
  getDownloadURL,
  deleteObject
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
let selectedImageFile = null;
let selectedLocation = "";
let selectedLocationLink = "";

const DEFAULT_AVATAR = "picture/user2avatar.jpeg";
const userCache = {};

// =====================
// AUTH (FIXED)
// =====================
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    currentUser = null;
    return;
  }

  const snap = await getDoc(doc(db, "Customers", user.uid));
  const data = snap.exists() ? snap.data() : {};

  currentUser = {
    userId: user.uid,
    email: user.email,
    username: data.username || user.email.split("@")[0],
    photoURL: data.photoURL || DEFAULT_AVATAR
  };

  // 🔥 FIX 1: update sidebar avatar
  updateSidebarAvatar();

  // 🔥 FIX 2: update "My Posts (alex)"
  updateMyPostTitle();

  loadPosts();

  // realtime sync profile changes
  onSnapshot(doc(db, "Customers", user.uid), (snap) => {
    const data = snap.data();
    if (!data) return;

    currentUser.username = data.username || currentUser.username;
    currentUser.photoURL = data.photoURL || DEFAULT_AVATAR;

    updateSidebarAvatar();
    updateMyPostTitle();
  });
});

// =====================
// UI UPDATES
// =====================
function updateSidebarAvatar() {
  const el = document.getElementById("sidebar-avatar");
  if (el && currentUser) {
    el.src = currentUser.photoURL;
  }
}

function updateMyPostTitle() {
  const el = document.getElementById("my-post-title");

  if (!el || !currentUser) return;

  el.innerText = `My Posts (${currentUser.username})`;
}

// =====================
// CACHE USER DATA
// =====================
async function getUserData(userId) {

  if (userCache[userId]) return userCache[userId];

  const snap = await getDoc(doc(db, "Customers", userId));
  const data = snap.exists() ? snap.data() : null;

  userCache[userId] = data;
  return data;
}

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
    selectedImageFile = e.target.files[0];
  });
}

// =====================
// CREATE POST
// =====================
window.createPost = async function () {

  if (!currentUser) return;

  const content = document.getElementById("post-input").value;

  if (!content.trim()) {
    showToast("Write something first", "error");
    return;
  }

  let imageURL = "picture/postalice.png";

  try {

    if (selectedImageFile) {
      const imageRef = ref(
        storage,
        `posts/${Date.now()}_${selectedImageFile.name}`
      );

      await uploadBytes(imageRef, selectedImageFile);
      imageURL = await getDownloadURL(imageRef);
    }

    await addDoc(collection(db, "posts"), {
      userId: currentUser.userId,
      content,
      imageURL,
      locationName: selectedLocation,
      locationLink: selectedLocationLink,
      likes: 0,
      likedBy: [],
      createAt: serverTimestamp()
    });

    showToast("Post created ☕");

    document.getElementById("post-input").value = "";
    selectedImageFile = null;
    selectedLocation = "";
    selectedLocationLink = "";

  } catch (err) {
    console.error(err);
    showToast("Failed to create post", "error");
  }
};

// =====================
// DELETE POST
// =====================
window.deletePost = async function (postId, postUserId, imageURL) {

  if (!currentUser || postUserId !== currentUser.userId) return;
  if (!confirm("Delete this post?")) return;

  await deleteDoc(doc(db, "posts", postId));

  if (imageURL && !imageURL.includes("postalice.png")) {
    try {
      const imageRef = ref(storage, imageURL);
      await deleteObject(imageRef);
    } catch (err) {
      console.warn(err);
    }
  }

  showToast("Deleted 🗑️");
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

  onSnapshot(q, async (snapshot) => {

    const feed = document.getElementById("feed");
    const myPosts = document.getElementById("my-posts");

    if (!feed || !myPosts) return;

    feed.innerHTML = "";
    myPosts.innerHTML = "";

    for (const docSnap of snapshot.docs) {

      const post = docSnap.data();
      const postId = docSnap.id;

      const isMine = currentUser && post.userId === currentUser.userId;
      const isLiked = (post.likedBy || []).includes(currentUser?.userId);

      const userData = await getUserData(post.userId);

      const avatar = userData?.photoURL || DEFAULT_AVATAR;
      const username = userData?.username || "User";

      const card = `
        <div class="post-card">

          <div class="post-header">
            <img src="${avatar}" class="avatar">
            <b>${username}</b>
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

          ${isMine ? `
            <div class="delete-btn"
              onclick='deletePost("${postId}", "${post.userId}", "${post.imageURL}")'>
              🗑
            </div>
          ` : ""}

        </div>
      `;

      feed.innerHTML += card;

      if (isMine) {
        myPosts.innerHTML += card;
      }
    }
  });
}

// =====================
// EXPORT
// =====================
window.createPost = createPost;
window.addLocation = addLocation;
window.deletePost = deletePost;
window.toggleLike = toggleLike;