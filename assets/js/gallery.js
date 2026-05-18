import { db, storage } from './firebase-config.js';
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { setupNavbar } from './navbar.js';
import { guardSession, sessionLogout } from './session.js';

setupNavbar();
let cafes = [];

// Call guard function
guardSession(['customer', 'admin']);

// ---------- LOCAL FALLBACK DATA ----------
const localCafes = [
    {
        id: 1, name: "Bean & Bond", city: "skudai", address: "22, Jalan Hang Tuah, Skudai", description: "Smooth espresso, cozy work-friendly environment with fast WiFi and power outlets.",
        openHour: "08:00", closeHour: "22:00", rating: 4.7, facilities: ["WiFi", "Power outlet"], image: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500&auto=format"
    },
    {
        id: 2, name: "Kulai Artisan Coffee", city: "kulai", address: "No 5, Jalan Sendayan 1, Kulai", description: "Artisan brews, rustic interior and outdoor seating area.",
        openHour: "09:30", closeHour: "21:00", rating: 4.3, facilities: ["WiFi", "Outdoor seating"], image: "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=500&auto=format"
    },
    {
        id: 3, name: "Masai Roast Lab", city: "masai", address: "88, Taman Megah Ria, Masai", description: "Specialty roasting, modern minimalist style and meeting friendly.",
        openHour: "10:00", closeHour: "20:30", rating: 4.0, facilities:["WiFi", "Meeting equipment"], image: "https://images.unsplash.com/photo-1580933073521-dc49ac0d4e6a?w=500&auto=format"
    },
    {
        id: 4, name: "Skudai Hideout", city: "skudai", address: "15, Jalan Emas, Taman Skudai Baru", description: "Secret garden cafe, perfect for study & chill, full facilities.",
        openHour: "07:30", closeHour: "23:00", rating: 4.8, facilities: ["WiFi", "Power outlet", "Outdoor seating", "Meeting equipment"], image: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500&auto=format"
    },
    {
        id: 5, name: "Kopi Kubu Kulai", city: "kulai", address: "12, Jalan Kilang, Kulai Besar", description: "Traditional kopi with modern twist, outdoor space & charging points.",
        openHour: "08:00", closeHour: "22:30", rating: 4.2, facilities: ["WiFi", "Power outlet", "Outdoor seating"], image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&auto=format"
    },
    {
        id: 6, name: "Tide Coffee Masai", city: "masai", address: "34, Pangsapuri Seri Alam, Masai", description: "Beach vibe cafe, open until midnight, great for late night coffee.",
        openHour: "12:00", closeHour: "00:00", rating: 4.5, facilities:["WiFi", "Power outlet"], image: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=500&auto=format"
    },
    {
        id: 7, name: "Work & Wonder Skudai", city: "skudai", address: "UTM area, 48, Jalan Kebudayaan", description: "Co-working cafe, high speed internet & meeting rooms.",
        openHour: "09:00", closeHour: "20:00", rating: 4.6, facilities: ["WiFi", "Power outlet", "Meeting equipment"], image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format"
    }
];

// ---------- HELPER: GET IMAGE URL (from HTTPS, gs://, or path) ----------
async function getCafeImageUrl(imageInput) {
    if (!imageInput) return '';
    if (typeof imageInput !== 'string') {
        console.warn('getCafeImageUrl received non-string:', imageInput);
        return '';
    }
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        return imageInput;
    }
    let storagePath = imageInput;
    try {
        // Prevent folder paths
        if (storagePath.endsWith('/')) {
            console.error('Invalid path: folder, not a file');
            return '';
        }
        const imageRef = ref(storage, storagePath);
        const url = await getDownloadURL(imageRef);
        return url;
    } catch (error) {
        if (error.code === 'storage/object-not-found') {
            console.error(`File not found: ${storagePath}`);
        } else {
            console.error('Error getting download URL:', error);
        }
        return '';
    }
}

// ---------- LOAD DATA FROM FIRESTORE ----------
async function initializeData() {
    try {
        console.log("Fetching data from Firestore...");
        const querySnapshot = await getDocs(collection(db, "cafes"));
        if (querySnapshot.empty) throw new Error("Collection in Firestore is empty.");
        const firebaseData = [];
        for (const doc of querySnapshot.docs) {
            const cafe = { id: doc.id, ...doc.data() };
            // Resolve image URL once and store it
            cafe.image = await getCafeImageUrl(cafe.image);
            firebaseData.push(cafe);
        }
        cafes = firebaseData;
        console.log("✅ Successfully loaded and resolved image URLs.");
    } catch (error) {
        console.error("❌ Failed to load from Firebase. Error:", error);
        // Use local fallback, also resolve their images
        for (const cafe of localCafes) {
            cafe.image = await getCafeImageUrl(cafe.image);
        }
        cafes = localCafes;
    } finally {
        updateCafeList();
    }
}

// ---------- FILTER LOGIC ----------
function filterCafes(location, searchName, timeSlot, selectedFacilities, minRatingValue) {
    let filtered = [...cafes];
    if (location !== 'all') filtered = filtered.filter(c => c.city === location);
    if (searchName.trim() !== "") {
        const term = searchName.trim().toLowerCase();
        filtered = filtered.filter(c => c.name.toLowerCase().includes(term));
    }
    if (timeSlot) filtered = filtered.filter(c => isOpenDuringSlot(c, timeSlot));
    if (selectedFacilities.length > 0) {
        filtered = filtered.filter(cafe => selectedFacilities.every(facility => cafe.facilities.includes(facility)));
    }
    if (minRatingValue > 0) filtered = filtered.filter(cafe => cafe.rating >= minRatingValue);
    return filtered;
}

// ---------- TIME CHECK ----------
function isOpenDuringSlot(cafe, timeSlotStr) {
    if (!timeSlotStr) return true;
    const [startStr] = timeSlotStr.split('~');
    const slotStart = startStr.trim();
    const toMinutes = (t) => {
        let [h, m] = t.split(':');
        return parseInt(h) * 60 + parseInt(m);
    };
    const slotStartMin = toMinutes(slotStart);
    const openMin = toMinutes(cafe.openHour);
    const closeMin = toMinutes(cafe.closeHour);
    return slotStartMin >= openMin && slotStartMin <= closeMin;
}

// ---------- STARS RENDER ----------
function renderStars(rating) {
    let fullStars = Math.floor(rating);
    let half = rating % 1 >= 0.5;
    let starsHtml = '';
    for (let i = 0; i < fullStars; i++) starsHtml += '<i class="fas fa-star"></i>';
    if (half) starsHtml += '<i class="fas fa-star-half-alt"></i>';
    let empty = 5 - Math.ceil(rating);
    for (let i = 0; i < empty; i++) starsHtml += '<i class="far fa-star"></i>';
    return starsHtml + ` <span style="font-size:0.7rem;">(${rating})</span>`;
}

// ---------- UPDATE CAFE LIST (TRIGGERED BY FILTERS) ----------
function updateCafeList() {
    const location = document.getElementById('locationFilter').value;
    const nameQuery = document.getElementById('nameSearch').value;
    const timeSlot = document.getElementById('timeSlot').value;
    const selectedFacilities = Array.from(document.querySelectorAll('#facilitiesFilterGroup input:checked')).map(cb => cb.value);
    let minRating = parseFloat(document.getElementById('ratingFilterSelect').value);
    if (isNaN(minRating)) minRating = 0;
    const filtered = filterCafes(location, nameQuery, timeSlot, selectedFacilities, minRating);
    renderCafeCards(filtered);
}

// ---------- RENDER CARDS ----------
async function renderCafeCards(filteredCafes) {
    const container = document.getElementById('cafeGridContainer');
    if (!filteredCafes.length) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding: 3rem;">🤷‍♀️ No cafes match your filters. Try different time or location!</div>`;
        return;
    }

    // Build cards with placeholder background
    container.innerHTML = filteredCafes.map(cafe => `
        <div class="cafe-card" data-id="${cafe.id}">
            <div class="card-img" style="background-image: url(''); background-color: #f0f0f0;"></div>
            <div class="card-info">
                <div class="cafe-name">${cafe.name}</div>
                <div class="cafe-location"><i class="fas fa-location-dot"></i> ${cafe.city.toUpperCase()} · ${cafe.address.substring(0, 30)}</div>
                <div class="stars">${renderStars(cafe.rating)}</div>
                <div><span class="open-badge"><i class="far fa-clock"></i> ${cafe.openHour} - ${cafe.closeHour}</span></div>
                <div class="cafe-desc">${cafe.description}</div>
            </div>
        </div>
    `).join('');

    // Set actual images (already resolved in initializeData, but just in case)
    for (const cafe of filteredCafes) {
        let imageUrl = cafe.image;
        if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = await getCafeImageUrl(cafe.image);
        }
        const card = document.querySelector(`.cafe-card[data-id="${cafe.id}"]`);
        if (card && imageUrl) {
            const imgDiv = card.querySelector('.card-img');
            imgDiv.style.backgroundImage = `url('${imageUrl}')`;
            imgDiv.style.backgroundColor = 'transparent';
        }
    }

    // Attach click event for modal
    document.querySelectorAll('.cafe-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const id = parseInt(card.getAttribute('data-id'));
            const cafe = cafes.find(c => c.id === id);
            if (cafe) showDetailModal(cafe);
        });
    });
}

// ---------- SHOW DETAIL MODAL ----------
async function showDetailModal(cafe) {
    const modal = document.getElementById('detailModal');
    const contentDiv = document.getElementById('modalDynamicContent');
    
    // IMPORTANT: pass cafe.image (string), not the whole cafe
    const imageUrl = await getCafeImageUrl(cafe.image);
    contentDiv.innerHTML = `
        <div class="detail-img" style="background-image: url('${imageUrl}'); background-size: cover; background-position: center; height: 200px; border-radius: 12px 12px 0 0;"></div>
        <div class="detail-title">${cafe.name}</div>
        <div class="rating-large">${renderStars(cafe.rating)}</div>
        <div><i class="fas fa-clock"></i> <strong>Opening Hours:</strong> ${cafe.openHour} - ${cafe.closeHour}</div>
        <div><i class="fas fa-map-pin"></i> <strong>Location:</strong> ${cafe.address}, ${cafe.city}</div>
        <hr>
        <div><i class="fas fa-align-left"></i> <strong>Description:</strong></div>
        <p style="margin-top:8px;">${cafe.description}</p>
        <div style="margin-top:12px;"><i class="fas fa-microchip"></i> <strong>Facilities:</strong> ${cafe.facilities.join(', ')}</div>
        <div style="margin-top:8px;"><i class="fas fa-star-of-life"></i> <strong>Review Star Rating:</strong> ${cafe.rating} / 5</div>
        <hr>
        <button id="closeModalBtn" style="background:#c47b4a; border:none; padding:8px 16px; border-radius:30px; color:white; cursor:pointer; margin-top:10px;"><i class="fas fa-times"></i> Close</button>
        <button id="closeModalBtn" style="background:#F7BF09; border:node; padding:8px 16px; border-radius:30px; color:white; cursor:pointer; margin-top:10px;"><i class="fas fa-calendar-check"></i> Make a reservation</button>`;

    modal.style.display = 'flex';
    const closeSpan = modal.querySelector('.close-modal');
    const closeBtn = contentDiv.querySelector('#closeModalBtn');
    const closeModal = () => modal.style.display = 'none';
    closeSpan.onclick = closeModal;
    if (closeBtn) closeBtn.onclick = closeModal;
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
}

// ---------- CAROUSEL ----------
let currentSlide = 0;
const slides = document.querySelectorAll('.carousel-slide');
function nextSlide() {
    if (!slides.length) return;
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
}

if (slides.length) setInterval(nextSlide, 4500);

// ---------- SET DEFAULT DATE ----------
const today = new Date().toISOString().split('T')[0];
document.getElementById('datePicker').value = today;

// ---------- EVENT LISTENERS ----------
document.getElementById('searchBtn').addEventListener('click', updateCafeList);
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('locationFilter').value = 'all';
    document.getElementById('nameSearch').value = '';
    document.getElementById('timeSlot').value = '';
    document.getElementById('ratingFilterSelect').value = '0';
    document.querySelectorAll('#facilitiesFilterGroup input').forEach(cb => cb.checked = false);
    updateCafeList();
});

document.querySelectorAll('#facilitiesFilterGroup input, #ratingFilterSelect').forEach(el => {
    el.addEventListener('change', () => updateCafeList());
});

document.getElementById('locationFilter').addEventListener('change', () => updateCafeList());
document.getElementById('nameSearch').addEventListener('input', () => updateCafeList());
document.getElementById('timeSlot').addEventListener('change', () => updateCafeList());

// Start
initializeData();