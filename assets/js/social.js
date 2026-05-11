import { db } from './firebase-config.js';
import { showToast } from './toast.js'

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



const currentUser = {
  userId: "annie001",
  username: "ANNIE",
  avatar: "picture/user2avatar.jpeg"
};



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



let selectedImageURL = "";

document.getElementById("upload-img").addEventListener("change", (e) => {

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = (event) => {
    selectedImageURL = event.target.result;

   
    const preview = document.getElementById("preview-img");
    preview.src = selectedImageURL;
    preview.style.display = "block";
  };

  reader.readAsDataURL(file);
});


async function createPost() {

  const content = document.getElementById("post-input").value;


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

  
  showToast("Create successful ☕", "success");


  document.getElementById("post-input").value = "";
  selectedImageURL = "";
  selectedLocation = "";
  selectedLocationLink = "";
}



async function deletePost(postId, postUserId) {

  if (postUserId !== currentUser.userId) return;

  const ok = confirm("Delete this post?");
  if (!ok) return;

  await deleteDoc(doc(db, "posts", postId));
  showToast("Delete post successful 🗑", "success");
}


async function toggleLike(postId, likedBy = [], currentLikes = 0) {

  const ref = doc(db, "posts", postId);

  let list = [...likedBy];

  const isLiked = list.includes(currentUser.userId);

  if (isLiked) {

   
    list = list.filter(id => id !== currentUser.userId);

    await updateDoc(ref, {
      likedBy: list,
      likes: currentLikes - 1
    });
    showToast("Unlike removed successfully", "info");

  } else {

    
    list.push(currentUser.userId);

    await updateDoc(ref, {
      likedBy: list,
      likes: currentLikes + 1
    });

    showToast("Like successful ❤️", "success");

  }
}



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



window.createPost = createPost;
window.addLocation = addLocation;
window.deletePost = deletePost;
window.toggleLike = toggleLike;


// START
loadPosts();