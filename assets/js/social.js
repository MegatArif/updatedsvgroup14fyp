import { db, storage, app } from './firebase-config.js';
import { showToast } from './toast.js';
import { setupNavbar } from './navbar.js';

setupNavbar();


// FIREBASE IMPORTS

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

const auth = getAuth(app); // initialize auth

// =====================
// STATE
// =====================
let currentUser = null;
let selectedImageFile = null;
let selectedLocation = "";
let selectedLocationLink = "";

const DEFAULT_AVATAR = "picture/user2avatar.jpeg";
const userCache = {}; // cache user data

// =====================
// AUTH (FIXED)
// =====================
// user login listener
onAuthStateChanged(auth, async (user) => {

  if (!user) {
    currentUser = null;
    return;
  }
// get user profile
  const snap = await getDoc(doc(db, "Customers", user.uid));
  const data = snap.exists() ? snap.data() : {};
// store current user data
  currentUser = {
    userId: user.uid,
    email: user.email,
    username: data.username || user.email.split("@")[0],
    photoURL: data.photoURL || DEFAULT_AVATAR
  };
// update ui
  updateSidebarAvatar();
  updateMyPostTitle();
  loadPosts();
// listen for realtime profile updates
  onSnapshot(doc(db, "Customers", user.uid), (snap) => {
    const data = snap.data();
    if (!data) return;
// update username and avatar
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
  // update sidebar avartar
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
// cache user profile
// =====================
async function getUserData(userId) {
// return cache data
  if (userCache[userId]) return userCache[userId];
// fetch user document
  const snap = await getDoc(doc(db, "Customers", userId));
  const data = snap.exists() ? snap.data() : null;
// save to cache
  userCache[userId] = data;
  return data;
}

// =====================
// LOCATION
// add cafe location
// =====================
window.addLocation = function () {
  selectedLocation = prompt("Enter cafe name:"); // ask for cafe name
// generate google maps link
  if (selectedLocation) {
    selectedLocationLink =
      "https://www.google.com/maps/search/" +
      encodeURIComponent(selectedLocation);
  }
};

// =====================
// IMAGE (UPDATED: ADD PREVIEW)
// =====================
const uploadEl = document.getElementById("upload-img");

if (uploadEl) {
  uploadEl.addEventListener("change", (e) => {

    const file = e.target.files[0];
    if (!file) return;

    selectedImageFile = file;

    // =========================
    // IMAGE PREVIEW ADDED
    // =========================
    const preview = document.getElementById("preview-img"); // get preview element

    if (preview) {
      preview.src = URL.createObjectURL(file); // display image preview
      preview.style.display = "block";
    }
  });
}

// =====================
// CREATE POST
// create new post
// =====================
window.createPost = async function () {

  if (!currentUser) return;
// get post content
  const content = document.getElementById("post-input").value;
// empty content check
  if (!content.trim()) {
    showToast("Write something first", "error");
    return;
  }

  let imageURL = "picture/postalice.png";

  try {
// upload custom image
    if (selectedImageFile) {
      const imageRef = ref(
        storage,
        `posts/${Date.now()}_${selectedImageFile.name}`
      );

      await uploadBytes(imageRef, selectedImageFile);
      imageURL = await getDownloadURL(imageRef);
    }
// add post to firestore
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
// success message
    showToast("Post created ☕");

    document.getElementById("post-input").value = "";
    selectedImageFile = null;
    selectedLocation = "";
    selectedLocationLink = "";

    // reset preview
    const preview = document.getElementById("preview-img");
    if (preview) preview.style.display = "none";

  } catch (err) {
    console.error(err);
    showToast("Failed to create post", "error");
  }
};

// =====================
// DELETE POST
// =====================
window.deletePost = async function (postId, postUserId, imageURL) {
// only owner can delete
  if (!currentUser || postUserId !== currentUser.userId) return;
  if (!confirm("Delete this post?")) return; // confirm delete
// delete firestore document
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
// Toggle like status
// =====================
window.toggleLike = async function (postId, likedBy = [], currentLikes = 0) {

  if (!currentUser) return;

  const refDoc = doc(db, "posts", postId);

  let list = [...likedBy];

  const isLiked = list.includes(currentUser.userId);

  if (isLiked) {
    list = list.filter(id => id !== currentUser.userId); // remove like
    await updateDoc(refDoc, {
      likedBy: list,
      likes: currentLikes - 1
    });
  } else {
    list.push(currentUser.userId); // add like
    await updateDoc(refDoc, {
      likedBy: list,
      likes: currentLikes + 1
    });
  }
};

// =====================
// LOAD POSTS
// load all posts
// =====================
function loadPosts() {
// query latest posts
  const q = query(
    collection(db, "posts"),
    orderBy("createAt", "desc")
  );
// listen for realtime updates
  onSnapshot(q, async (snapshot) => {

    const feed = document.getElementById("feed");
    const myPosts = document.getElementById("my-posts");

    if (!feed || !myPosts) return;
// clear old content
    feed.innerHTML = "";
    myPosts.innerHTML = "";
// loop through posts
    for (const docSnap of snapshot.docs) {

      const post = docSnap.data();
      const postId = docSnap.id;
// check ownership
      const isMine = currentUser && post.userId === currentUser.userId;
      const isLiked = (post.likedBy || []).includes(currentUser?.userId);

      const userData = await getUserData(post.userId);

      const avatar = userData?.photoURL || DEFAULT_AVATAR;
      const username = userData?.username || "User";
// post card html
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

      feed.innerHTML += card; // add to main feed
// add my posts section
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