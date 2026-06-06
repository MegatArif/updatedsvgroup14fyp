const notifications = [

  {
    type:"booking",
    title:"New Reservation",
    message:"John Tan booked a table for 4 guests",
    time:"2 minutes ago"
  },

  {
    type:"booking",
    title:"New Reservation",
    message:"Sarah booked a table for 2 guests",
    time:"5 minutes ago"
  },

  {
    type:"booking",
    title:"New Reservation",
    message:"Alex booked a table for 6 guests",
    time:"10 minutes ago"
  },

  {
    type:"expired",
    title:"Reservation Expired",
    message:"Reservation A12345 expired",
    time:"1 hour ago"
  },

  {
    type:"expired",
    title:"Reservation Expired",
    message:"Reservation B55321 expired",
    time:"2 hours ago"
  },

  {
    type:"admin",
    title:"Admin Notice",
    message:"Customer John123 has been suspended",
    time:"Yesterday"
  }

];

const params = new URLSearchParams(window.location.search);
const selectedType = params.get("type");

const categoryContainer =
document.getElementById("categoryContainer");

const mainView =
document.getElementById("mainView");

const detailView =
document.getElementById("detailView");

const detailTitle =
document.getElementById("detailTitle");

const detailList =
document.getElementById("detailList");

const backBtn =
document.getElementById("backBtn");

if(selectedType){

  showDetails(selectedType);

}else{

  showCategories();
}

backBtn.addEventListener("click",()=>{

  window.location.href="sonotification.html";
});

function showCategories(){

  const bookingCount =
    notifications.filter(n=>n.type==="booking").length;

  const expiredCount =
    notifications.filter(n=>n.type==="expired").length;

  const adminCount =
    notifications.filter(n=>n.type==="admin").length;

  categoryContainer.innerHTML = `

    <div class="category-grid">

      <div class="category-card"
      onclick="goType('booking')">

        <div class="left">

          <div class="icon-box booking">
            <i class="fas fa-calendar-check"></i>
          </div>

          <div>
            <div class="card-title">
              New Reservations
            </div>

            <div class="card-subtitle">
              New customer bookings
            </div>
          </div>

        </div>

        <div class="count">
          ${bookingCount}
        </div>

      </div>

      <div class="category-card"
      onclick="goType('expired')">

        <div class="left">

          <div class="icon-box expired">
            <i class="fas fa-clock"></i>
          </div>

          <div>
            <div class="card-title">
              Expired Reservations
            </div>

            <div class="card-subtitle">
              Auto expired bookings
            </div>
          </div>

        </div>

        <div class="count">
          ${expiredCount}
        </div>

      </div>

      <div class="category-card"
      onclick="goType('admin')">

        <div class="left">

          <div class="icon-box admin">
            <i class="fas fa-triangle-exclamation"></i>
          </div>

          <div>
            <div class="card-title">
              Admin Notices
            </div>

            <div class="card-subtitle">
              Messages from admin
            </div>
          </div>

        </div>

        <div class="count">
          ${adminCount}
        </div>

      </div>

    </div>
  `;
}

window.goType = function(type){

  window.location.href =
  `sonotification.html?type=${type}`;
}

function showDetails(type){

  mainView.style.display="none";
  detailView.style.display="block";

  const filtered =
  notifications.filter(n=>n.type===type);

  const titleMap = {
    booking:"New Reservations",
    expired:"Expired Reservations",
    admin:"Admin Notices"
  };

  detailTitle.textContent =
  titleMap[type];

  detailList.innerHTML =
  filtered.map(n=>`

    <div class="detail-card">

      <div class="detail-title">
        ${n.title}
      </div>

      <div>
        ${n.message}
      </div>

      <div class="detail-time">
        ${n.time}
      </div>

    </div>

  `).join("");
}