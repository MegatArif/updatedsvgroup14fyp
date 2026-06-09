import { db, storage } from './firebase-config.js';
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import { collection, getDocs, deleteDoc, doc, query, where, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { setupNavbar } from './navbar.js';
import { showToast } from './toast.js';

setupNavbar();
let cafes = [];

import { guardSession, sessionLogout } from './session.js';
// Call guardFunction 
guardSession(['customer','admin']);

// ---------- LOCAL FALLBACK DATA ----------
const localCafes = [
    {
        id: 1, name: "Bean & Bond", city: "skudai", address: "22, Jalan Hang Tuah, Skudai",
        description: "Smooth espresso, cozy work-friendly environment with fast WiFi and power outlets.",
        openHour: "08:00", closeHour: "22:00", rating: 4.7, facilities: ["WiFi", "Power outlet"],
        image: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=500&auto=format"
    },
    {
        id: 2, name: "Kulai Artisan Coffee", city: "kulai", address: "No 5, Jalan Sendayan 1, Kulai",
        description: "Artisan brews, rustic interior and outdoor seating area.",
        openHour: "09:30", closeHour: "21:00", rating: 4.3, facilities: ["WiFi", "Outdoor seating"],
        image: "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=500&auto=format"
    },
    {
        id: 3, name: "Masai Roast Lab", city: "masai", address: "88, Taman Megah Ria, Masai",
        description: "Specialty roasting, modern minimalist style and meeting friendly.",
        openHour: "10:00", closeHour: "20:30", rating: 4.0, facilities: ["WiFi", "Meeting equipment"],
        image: "https://images.unsplash.com/photo-1580933073521-dc49ac0d4e6a?w=500&auto=format"
    },
    {
        id: 4, name: "Skudai Hideout", city: "skudai", address: "15, Jalan Emas, Taman Skudai Baru",
        description: "Secret garden cafe, perfect for study & chill, full facilities.",
        openHour: "07:30", closeHour: "23:00", rating: 4.8,
        facilities: ["WiFi", "Power outlet", "Outdoor seating", "Meeting equipment"],
        image: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=500&auto=format"
    },
    {
        id: 5, name: "Kopi Kubu Kulai", city: "kulai", address: "12, Jalan Kilang, Kulai Besar",
        description: "Traditional kopi with modern twist, outdoor space & charging points.",
        openHour: "08:00", closeHour: "22:30", rating: 4.2,
        facilities: ["WiFi", "Power outlet", "Outdoor seating"],
        image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&auto=format"
    },
    {
        id: 6, name: "Tide Coffee Masai", city: "masai", address: "34, Pangsapuri Seri Alam, Masai",
        description: "Beach vibe cafe, open until midnight, great for late night coffee.",
        openHour: "12:00", closeHour: "00:00", rating: 4.5, facilities: ["WiFi", "Power outlet"],
        image: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=500&auto=format"
    },
    {
        id: 7, name: "Work & Wonder Skudai", city: "skudai", address: "UTM area, 48, Jalan Kebudayaan",
        description: "Co-working cafe, high speed internet & meeting rooms.",
        openHour: "09:00", closeHour: "20:00", rating: 4.6,
        facilities: ["WiFi", "Power outlet", "Meeting equipment"],
        image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format"
    }
];

// =================================================================
//  IMAGE URL HELPER
// =================================================================
async function getCafeImageUrl(imageInput) {
    if (!imageInput) return '';
    if (typeof imageInput !== 'string') return '';
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) return imageInput;
    try {
        if (imageInput.endsWith('/')) return '';
        return await getDownloadURL(ref(storage, imageInput));
    } catch (e) {
        console.error('Image URL error:', e);
        return '';
    }
}

// =================================================================
//  LOAD FROM FIRESTORE 
// =================================================================
async function initializeData() {
    setLoading(true);   
    try {
        const snapshot = await getDocs(collection(db, "cafes"));
        if (snapshot.empty) throw new Error("Empty collection.");
        const data = [];
        for (const d of snapshot.docs) {
            const cafe = { ...d.data(), id: d.id };
            if (cafe.approveStatus && cafe.approveStatus !== 'approved') continue;
            cafe.image = await getCafeImageUrl(cafe.image);
            data.push(cafe);
        }
        cafes = data;
    } catch (err) {
        console.error("Firebase failed, using local data:", err);
        for (const c of localCafes) c.image = await getCafeImageUrl(c.image);
        cafes = localCafes;
    } finally {
        setLoading(false);  
        updateCafeList();
    }
}

// =================================================================
//  FILTER 
// =================================================================
function filterCafes(location, searchName, timeSlot, facilities, minRating) {
    let f = [...cafes];
    if (location !== 'all') f = f.filter(c => c.city === location);
    if (searchName.trim()) f = f.filter(c => c.name.toLowerCase().includes(searchName.trim().toLowerCase()));
    if (timeSlot) f = f.filter(c => isOpenDuringSlot(c, timeSlot));
    if (facilities.length) f = f.filter(c => facilities.every(x => c.facilities.includes(x)));
    if (minRating > 0) f = f.filter(c => c.rating >= minRating);
    return f;
}

function isOpenDuringSlot(cafe, ts) {
    const [s] = ts.split('~');
    const toMin = t => { const [h, m] = t.split(':'); return +h * 60 + +m; };
    const slot = toMin(s.trim());
    return slot >= toMin(cafe.openHour) && slot <= toMin(cafe.closeHour);
}

function renderStars(rating) {
    let html = '';
    const full = Math.floor(rating);
    for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
    if (rating % 1 >= 0.5) html += '<i class="fas fa-star-half-alt"></i>';
    for (let i = 0; i < 5 - Math.ceil(rating); i++) html += '<i class="far fa-star"></i>';
    return html + ` <span style="font-size:0.7rem;">(${rating})</span>`;
}

function updateCafeList() {
    const location    = document.getElementById('locationFilter').value;
    const nameQuery   = document.getElementById('nameSearch').value;
    const timeSlot    = document.getElementById('timeSlot').value;
    const facilities  = Array.from(document.querySelectorAll('#facilitiesFilterGroup input:checked')).map(cb => cb.value);
    let minRating     = parseFloat(document.getElementById('ratingFilterSelect').value) || 0;
    renderCafeCards(filterCafes(location, nameQuery, timeSlot, facilities, minRating));
}

async function renderCafeCards(filtered) {
    const container = document.getElementById('cafeGridContainer');
    if (!filtered.length) {
        container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;">🤷‍♀️ No cafes match your filters. Try different time or location!</div>`;
        return;
    }
    container.innerHTML = filtered.map(cafe => `
        <div class="cafe-card" data-id="${cafe.id}">
            <div class="card-img" style="background-color:#f0f0f0;"></div>
            <div class="card-info">
                <div class="cafe-name">${cafe.name}</div>
                <div class="cafe-location"><i class="fas fa-location-dot"></i> ${cafe.city.toUpperCase()} · ${cafe.address.substring(0,30)}</div>
                <div class="stars">${renderStars(cafe.rating)}</div>
                <div><span class="open-badge"><i class="far fa-clock"></i> ${cafe.openHour} - ${cafe.closeHour}</span></div>
                <div class="cafe-desc">${cafe.description}</div>
            </div>
        </div>
    `).join('');

    for (const cafe of filtered) {
        let url = cafe.image;
        if (url && !url.startsWith('http')) url = await getCafeImageUrl(cafe.image);
        const card = document.querySelector(`.cafe-card[data-id="${cafe.id}"]`);
        if (card && url) {
            const img = card.querySelector('.card-img');
            img.style.backgroundImage = `url('${url}')`;
            img.style.backgroundSize  = 'cover';
            img.style.backgroundColor = 'transparent';
        }
    }

    document.querySelectorAll('.cafe-card').forEach(card => {
        card.addEventListener('click', () => {
            const cafe = cafes.find(c => String(c.id) === card.getAttribute('data-id'));
            if (cafe) showDetailModal(cafe);
        });
    });
}

// =================================================================
//  DELETE RESTAURANT (admin only)
// =================================================================
async function deleteRestaurant(cafe) {
    const confirmed = confirm(
        `⚠️ Delete "${cafe.name}"?\n\nThis will permanently remove this restaurant from the database. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
        // 1. Delete the cafe doc from Firestore
        await deleteDoc(doc(db, 'cafes', cafe.id));

        // 2. Reset the linked ShopOwner doc so the owner is no longer
        //    approved and can re-register a new cafe.
        //    Match by ownerId (new registrations) or ownerEmail (legacy).
        try {
            let ownerDocId = cafe.ownerId || null;

            // Fallback: find owner by email if ownerId not stored (legacy cafes)
            if (!ownerDocId && cafe.ownerEmail) {
                const ownerSnap = await getDocs(
                    query(collection(db, 'ShopOwner'), where('email', '==', cafe.ownerEmail))
                );
                if (!ownerSnap.empty) ownerDocId = ownerSnap.docs[0].id;
            }

            if (ownerDocId) {
                await updateDoc(doc(db, 'ShopOwner', ownerDocId), {
                    cafeRegistered: false,
                    approved:       false,
                    rejected:       false,
                    cafeDocId:      '',
                    rejectionNote:  '',
                });
            }
        } catch (ownerErr) {
            // Non-fatal — cafe is deleted; owner cleanup failed silently
            console.warn('ShopOwner reset failed (non-fatal):', ownerErr);
        }

        // 3. Remove from local array and re-render
        cafes = cafes.filter(c => c.id !== cafe.id);
        updateCafeList();

        // 4. Close modal
        document.getElementById('detailModal').style.display = 'none';

        showToast(`✅ "${cafe.name}" has been deleted.`, 'success', 3500);

    } catch (err) {
        console.error('Delete restaurant failed:', err);
        showToast('❌ Failed to delete restaurant. Please try again.', 'error', 4000);
    }
}

// =================================================================
//  GOOGLE MAPS URL BUILDERS
// =================================================================

/**
 * Place-search URL — opens the cafe location on Google Maps.
 * @returns {string}
 */
function buildPlaceUrl(address, city) {
    const q = encodeURIComponent(`${address}, ${city}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Directions URL — from a given origin to the cafe.
 * When origin is empty, Google Maps will ask the user for it.
 * @returns {string}
 */
function buildDirectionsUrl(address, city, origin = '') {
    const dest = encodeURIComponent(`${address}, ${city}`);
    const from = origin.trim() ? encodeURIComponent(origin.trim()) : '';
    return `https://www.google.com/maps/dir/?api=1`
         + (from ? `&origin=${from}` : '')
         + `&destination=${dest}&travelmode=driving`;
}

/**
 * Embed URL (no API key required — uses maps.google.com iframe embed).
 */
function buildEmbedUrl(address, city) {
    const q = encodeURIComponent(`${address}, ${city}`);
    return `https://maps.google.com/maps?q=${q}&output=embed&z=16`;
}

/**
 * Route embed URL — shows driving route in the iframe.
 */
function buildRouteEmbedUrl(originText, destAddress) {
    return `https://maps.google.com/maps?saddr=${encodeURIComponent(originText)}&daddr=${encodeURIComponent(destAddress)}&output=embed`;
}

// =================================================================
//  DISTANCE CALCULATOR
//  Uses Nominatim (OSM) for geocoding + OSRM for road routing.
//  Both are free and require no API key.
// =================================================================

/** Straight-line fallback (Haversine) in km */
function haversineKm(a, b) {
    const R = 6371, toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
    return R * 2 * Math.asin(Math.sqrt(h));
}

/** Geocode address text → {lat, lng} via Nominatim */
async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    if (!data.length) throw new Error(`"${address}" not found`);
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

/** Road distance + duration via OSRM (free, no key) */
async function getRouteInfo(origin, dest) {
    try {
        const url  = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes.length) {
            const r = data.routes[0];
            return {
                km:     (r.distance / 1000).toFixed(1),
                mins:   Math.round(r.duration / 60),
                source: 'road'
            };
        }
    } catch (e) { console.warn('OSRM failed, using Haversine:', e); }
    // Straight-line fallback
    const km   = haversineKm(origin, dest).toFixed(1);
    const mins = Math.round(km / 40 * 60);
    return { km, mins, source: 'straight-line' };
}

// =================================================================
//  SPLIT DETAIL MODAL
// =================================================================

// Map the camelCase city filter keys → real place names for geocoding & display.
// Without this, "johorBahru" goes into the geocode query and Nominatim can't find it.
const CITY_NAMES = {
    skudai:     'Skudai',
    kulai:      'Kulai',
    masai:      'Masai',
    tangkak:    'Tangkak',
    pontian:    'Pontian',
    segamat:    'Segamat',
    muar:       'Muar',
    kluang:     'Kluang',
    batuPahat:  'Batu Pahat',
    johorBahru: 'Johor Bahru',
};

// =================================================================
//  CUSTOMER ACTION ZONE
// =================================================================
function buildCustomerActions(cafe) {
    const zone = document.getElementById('modalActionsZone');
    if (!zone) return;

    zone.innerHTML = `
      <div class="modal-actions">
        <button class="btn-reserve" id="btnReservation" style="flex:1;">
          <i class="fas fa-calendar-check"></i> Make a Reservation
        </button>
        <button class="btn-close-left" id="modalCloseBtnCustomer" style="flex:1;">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
    `;

    document.getElementById('btnReservation').addEventListener('click', () => {
        const params = new URLSearchParams({
            id:        cafe.id,
            name:      cafe.name,
            address:   cafe.address,
            city:      cafe.city,
            openHour:  cafe.openHour,
            closeHour: cafe.closeHour
        });
        window.location.href = `bookingform.html?${params.toString()}`;
    });

    document.getElementById('modalCloseBtnCustomer')?.addEventListener('click', () => {
        document.getElementById('detailModal').style.display = 'none';
    });
}

// =================================================================
//  ADMIN ACTION ZONE
// =================================================================
const PRESET_FACILITIES = ['WiFi', 'Power outlet', 'Outdoor seating', 'Meeting equipment'];

const FACILITY_ICONS = {
    'WiFi':              'fa-wifi',
    'Power outlet':      'fa-plug',
    'Outdoor seating':   'fa-umbrella-beach',
    'Meeting equipment': 'fa-chalkboard-user',
};

function buildAdminActions(cafe) {
    const zone = document.getElementById('modalActionsZone');
    if (!zone) return;

    // Build checkbox list — tick whichever the cafe currently has
    const checkboxesHtml = PRESET_FACILITIES.map(f => {
        const checked = (cafe.facilities || []).includes(f) ? 'checked' : '';
        return `
          <label class="admin-fac-label">
            <input type="checkbox" value="${f}" ${checked} class="admin-fac-cb">
            <i class="fas ${FACILITY_ICONS[f]}"></i> ${f}
          </label>`;
    }).join('');

    zone.innerHTML = `
      <!-- ── Edit Facilities Panel ── -->
      <div class="admin-fac-panel">
        <div class="admin-fac-header">
          <i class="fas fa-microchip"></i> Edit Facilities
        </div>
        <div class="admin-fac-grid">${checkboxesHtml}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-save-facilities" id="btnSaveFacilities">
            <i class="fas fa-floppy-disk"></i> Save Facilities
          </button>
        </div>
        <div id="facilityStatus" style="font-size:.75rem;margin-top:6px;min-height:1rem;"></div>
      </div>

      <!-- ── Danger zone ── -->
      <div class="modal-actions" style="margin-top:10px;">
        <button class="btn-delete-restaurant" id="btnDeleteRestaurant" style="flex:1;">
          <i class="fas fa-trash-alt"></i> Delete Restaurant
        </button>
        <button class="btn-close-left" id="modalCloseBtnAdmin" style="flex:1;">
          <i class="fas fa-times"></i> Close
        </button>
      </div>
    `;

    // Save facilities
    document.getElementById('btnSaveFacilities').addEventListener('click', async () => {
        const selected = [...document.querySelectorAll('.admin-fac-cb:checked')].map(cb => cb.value);
        const statusEl = document.getElementById('facilityStatus');
        const saveBtn  = document.getElementById('btnSaveFacilities');

        saveBtn.disabled = true;
        statusEl.textContent = 'Saving…';
        statusEl.style.color = '#c47b4a';

        try {
            // cafe.id is the Firestore doc ID for Firestore-sourced cafes
            // (local fallback cafes have numeric ids — guard against that)
            if (typeof cafe.id === 'number') {
                showToast('Cannot edit local fallback cafes.', 'error');
                statusEl.textContent = '';
                saveBtn.disabled = false;
                return;
            }

            await updateDoc(doc(db, 'cafes', cafe.id), { facilities: selected });
            await addDoc(
  collection(db, "sonotifications"),
  {
    cafeName: cafe.name,
    type: "admin",
    message: "Admin has updated your facilities.",
    createdAt: serverTimestamp(),
    read: false
  }
);

            // Update local cache so modal reflects the new state immediately
            cafe.facilities = selected;

            // Refresh the facility pills in the modal-left panel
            const pillContainer = document.querySelector('.modal-facilities');
            if (pillContainer) {
                pillContainer.innerHTML = selected.length
                    ? selected.map(f =>
                        `<span class="facility-pill"><i class="fas ${FACILITY_ICONS[f] || 'fa-check'}"></i> ${f}</span>`
                      ).join('')
                    : '<span style="color:#9e8070;font-size:.8rem;">None listed</span>';
            }

            // Also refresh the cafe card in the grid
            updateCafeList();

            statusEl.textContent = '✓ Saved successfully';
            statusEl.style.color = '#2d7a3a';
            showToast('Facilities updated!', 'success');
        } catch (err) {
            console.error('Save facilities error:', err);
            statusEl.textContent = '✗ Save failed';
            statusEl.style.color = '#e53935';
            showToast('Failed to save facilities.', 'error');
        } finally {
            saveBtn.disabled = false;
        }
    });

    // Delete restaurant
    document.getElementById('btnDeleteRestaurant').addEventListener('click', () => deleteRestaurant(cafe));

    // Close button (admin modal)
    document.getElementById('modalCloseBtnAdmin')?.addEventListener('click', () => {
        document.getElementById('detailModal').style.display = 'none';
    });
}

async function showDetailModal(cafe) {
    const modal      = document.getElementById('detailModal');
    const contentDiv = document.getElementById('modalDynamicContent');

    const imageUrl  = await getCafeImageUrl(cafe.image);
    // Use the human-readable city name so Nominatim geocoding works correctly
    const cityTitle = CITY_NAMES[cafe.city] || cafe.city;
    const destAddress = `${cafe.address}`;
    const placeUrl    = buildPlaceUrl(cafe.address);
    const dirUrl      = buildDirectionsUrl(cafe.address);
    const embedUrl    = buildEmbedUrl(cafe.address);

    const facilityIcons = {
        'WiFi':              'fa-wifi',
        'Power outlet':      'fa-plug',
        'Outdoor seating':   'fa-umbrella-beach',
        'Meeting equipment': 'fa-chalkboard-user',
    };
    const facilitiesHtml = (cafe.facilities || []).map(f =>
        `<span class="facility-pill"><i class="fas ${facilityIcons[f] || 'fa-check'}"></i> ${f}</span>`
    ).join('');

    contentDiv.innerHTML = `

      <!-- ══════ LEFT — Cafe info ══════ -->
      <div class="modal-left">

        <div class="modal-hero"
             style="background-image:url('${imageUrl}');"
             role="img" aria-label="${cafe.name}"></div>

        <div class="modal-left-body">

          <div class="modal-cafe-name">${cafe.name}</div>

          <div class="modal-rating-row">
            ${renderStars(cafe.rating)}
            <span>${cafe.rating} / 5</span>
          </div>

          <div class="modal-divider"></div>

          <div class="modal-info-row">
            <i class="fas fa-clock"></i>
            <div><strong>Hours:</strong> ${cafe.openHour} – ${cafe.closeHour}</div>
          </div>

          <div class="modal-info-row">
            <i class="fas fa-map-pin"></i>
            <div><strong>Address:</strong> ${cafe.address}</div>
          </div>

          <div class="modal-info-row">
            <i class="fas fa-align-left"></i>
            <div>${cafe.description}</div>
          </div>

          <div class="modal-info-row" style="flex-direction:column;gap:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <i class="fas fa-microchip" style="color:#c47b4a;width:16px;text-align:center;"></i>
              <strong style="color:#2b1a0e;font-size:.88rem;">Facilities</strong>
            </div>
            <div class="modal-facilities">${facilitiesHtml || '<span style="color:#9e8070;font-size:.8rem;">None listed</span>'}</div>
          </div>

          <div class="modal-divider"></div>

          <div id="modalActionsZone"></div>

        </div>
      </div><!-- /modal-left -->

      <!-- ══════ RIGHT — Distance / Maps ══════ -->
      <div class="modal-right">

        <!-- ① MAP EMBED — grows to fill the top of the panel -->
        <div class="map-embed-wrap">
          <div class="map-embed-placeholder" id="mapPlaceholder">
            <i class="fas fa-map"></i>
            <span>Map preview loading…<br>Enter your location below for route directions.</span>
          </div>
          <iframe id="mapIframe"
                  src="${embedUrl}"
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                  allowfullscreen
                  title="Map for ${cafe.name}"
                  style="position:absolute;inset:0;width:100%;height:100%;border:none;"></iframe>
        </div>

        <!-- ② CONTROLS FOOTER — pinned below the map -->
        <div class="map-controls-footer">

          <!-- Header strip -->
          <div class="map-panel-header">
            <div class="map-panel-title">
              <i class="fas fa-map-location-dot"></i> Get Directions
            </div>
            <div class="map-panel-dest">
              <i class="fas fa-flag-checkered" style="margin-right:5px;"></i>${destAddress}
            </div>
          </div>

          <!-- Origin input -->
          <div class="map-origin-row">
            <div class="map-origin-label">
              <i class="fas fa-location-arrow"></i> Your starting point
            </div>
            <div class="map-origin-input-wrap">
              <input id="originInput" type="text" class="map-origin-input"
                     placeholder="e.g. UTM Skudai, Midvalley KL…" />
              <button class="btn-calc-distance" id="calcBtn">
                <i class="fas fa-route"></i> Go
              </button>
            </div>
            <button class="btn-use-location" id="useLocationBtn">
              <i class="fas fa-crosshairs"></i> Use my current location
            </button>
          </div>

          <!-- Status message -->
          <div class="map-status" id="mapStatus"></div>

          <!-- Distance result card -->
          <div class="distance-result" id="distanceResult">
            <div class="dist-row">
              <i class="fas fa-road"></i>
              <div>
                <div class="dist-value" id="distValue">—</div>
                <div class="dist-label">Distance</div>
              </div>
            </div>
            <div class="dist-row">
              <i class="fas fa-car"></i>
              <div>
                <div class="dist-value" id="timeValue">—</div>
                <div class="dist-label">Est. driving time</div>
              </div>
            </div>
            <div id="distSourceRow" style="font-size:0.72rem;color:#6b4f3e;margin-top:2px;padding-left:2px;"></div>
          </div>

          <!-- Action buttons -->
          <div class="map-btn-row">
            <a id="btnDirections" href="${dirUrl}" target="_blank" rel="noopener noreferrer"
               class="btn-gmaps btn-gmaps-directions">
              <i class="fab fa-google"></i> Open Google Maps — Directions
            </a>
            <a id="btnPlace" href="${placeUrl}" target="_blank" rel="noopener noreferrer"
               class="btn-gmaps btn-gmaps-place">
              <i class="fas fa-map-marker-alt"></i> View Location on Map
            </a>
          </div>

        </div><!-- /map-controls-footer -->

      </div><!-- /modal-right -->
    `;

    modal.style.display = 'flex';

    // ── Close handlers ──
    const closeModal = () => { modal.style.display = 'none'; };
    modal.querySelector('.close-modal').onclick = closeModal;
    window.onclick = e => { if (e.target === modal) closeModal(); };

    // ── Render role-specific action zone ──
    const role = sessionStorage.getItem('userRole');
    if (role === 'admin') {
        buildAdminActions(cafe);
    } else {
        buildCustomerActions(cafe);
    }

    // ── Hide embed placeholder when iframe loads ──
    const iframe      = document.getElementById('mapIframe');
    const placeholder = document.getElementById('mapPlaceholder');
    iframe.onload = () => { if (placeholder) placeholder.style.display = 'none'; };

    // ── Cache frequently-used DOM refs ──
    const originInput   = document.getElementById('originInput');
    const calcBtn       = document.getElementById('calcBtn');
    const mapStatus     = document.getElementById('mapStatus');
    const distResult    = document.getElementById('distanceResult');
    const distValue     = document.getElementById('distValue');
    const timeValue     = document.getElementById('timeValue');
    const distSourceRow = document.getElementById('distSourceRow');
    const btnDirections = document.getElementById('btnDirections');

    // ── Shared result renderer ──
    function showRouteResult(km, mins, source, originText) {
        distValue.textContent = `${km} km`;
        timeValue.textContent  = mins >= 60
            ? `${Math.floor(mins/60)}h ${mins % 60}m`
            : `${mins} min`;
        distSourceRow.innerHTML = source === 'road'
            ? '<i class="fas fa-check-circle" style="color:#4caf50;margin-right:4px;"></i> Road distance (OSRM)'
            : '<i class="fas fa-info-circle" style="color:#f4b942;margin-right:4px;"></i> Straight-line estimate';
        distResult.classList.add('visible');
        mapStatus.textContent = '';

        // Update directions URL with actual origin
        btnDirections.href = buildDirectionsUrl(cafe.address, originText);
        // Swap iframe to route view
        iframe.src = buildRouteEmbedUrl(originText, destAddress);
        if (placeholder) placeholder.style.display = 'none';
    }

    // ── Calculate from a text origin ──
    async function calcFromText(originText) {
        if (!originText.trim()) {
            mapStatus.textContent = '⚠️ Please enter a starting location.';
            return;
        }
        mapStatus.textContent = '🔍 Locating addresses…';
        calcBtn.disabled = true;
        distResult.classList.remove('visible');
        try {
            const [originCoords, destCoords] = await Promise.all([
                geocode(originText),
                geocode(destAddress)
            ]);
            mapStatus.textContent = '🛣️ Calculating route…';
            const { km, mins, source } = await getRouteInfo(originCoords, destCoords);
            showRouteResult(km, mins, source, originText);
        } catch (err) {
            console.error(err);
            mapStatus.textContent = '❌ Could not find that location. Try a more specific address.';
            distResult.classList.remove('visible');
        } finally {
            calcBtn.disabled = false;
        }
    }

    calcBtn.addEventListener('click', () => calcFromText(originInput.value));
    originInput.addEventListener('keydown', e => { if (e.key === 'Enter') calcFromText(originInput.value); });

    // ── Use browser geolocation ──
    document.getElementById('useLocationBtn').addEventListener('click', () => {
        if (!navigator.geolocation) {
            mapStatus.textContent = '❌ Geolocation not supported by your browser.';
            return;
        }
        mapStatus.textContent = '📡 Detecting your location…';
        calcBtn.disabled = true;
        distResult.classList.remove('visible');

        navigator.geolocation.getCurrentPosition(
            async ({ coords: { latitude, longitude } }) => {
                // ── The coordinate string we use for routing & URLs ──
                // Always use raw lat,lng — never the verbose display_name,
                // which Nominatim cannot reliably reverse-geocode back.
                const coordString = `${latitude},${longitude}`;

                // Fill the input with a human-readable label (display only, not geocoded again)
                try {
                    const rev  = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        { headers: { 'Accept-Language': 'en' } }
                    );
                    const data = await rev.json();
                    // Show a short label: road + suburb if available, otherwise coords
                    const addr = data.address || {};
                    const shortLabel = [addr.road, addr.suburb || addr.village || addr.town || addr.city]
                        .filter(Boolean).join(', ') || coordString;
                    originInput.value = shortLabel;
                } catch {
                    originInput.value = coordString;
                }

                mapStatus.textContent = '🛣️ Calculating route…';
                try {
                    // Geocode only the destination — origin is already lat/lng
                    const destCoords = await geocode(destAddress);
                    const { km, mins, source } = await getRouteInfo(
                        { lat: latitude, lng: longitude },
                        destCoords
                    );
                    // Pass coordString (not display_name) so embed & directions URLs are precise
                    showRouteResult(km, mins, source, coordString);
                } catch (err) {
                    console.error(err);
                    mapStatus.textContent = '❌ Route calculation failed. Please try again.';
                } finally {
                    calcBtn.disabled = false;
                }
            },
            err => {
                mapStatus.textContent = '❌ Location access denied or timed out.';
                calcBtn.disabled = false;
                console.warn('Geolocation error:', err);
            },
            { timeout: 10000 }
        );
    });
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

// ---------- DEFAULT DATE ----------
const datePicker = document.getElementById('datePicker');
if (datePicker) {
    const today = new Date().toISOString().split('T')[0];
    datePicker.setAttribute('min', today);
}

// ---------- UI HELPER ----------
function setLoading(show) {
  const loader = document.getElementById("loadingState");
  if (loader) loader.style.display = show ? "flex" : "none";
}

// ---------- EVENT LISTENERS ----------
document.getElementById('searchBtn').addEventListener('click', updateCafeList);
document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    document.getElementById('locationFilter').value    = 'all';
    document.getElementById('nameSearch').value        = '';
    document.getElementById('timeSlot').value          = '';
    document.getElementById('ratingFilterSelect').value = '0';
    document.querySelectorAll('#facilitiesFilterGroup input').forEach(cb => cb.checked = false);
    updateCafeList();
});
document.querySelectorAll('#facilitiesFilterGroup input, #ratingFilterSelect')
    .forEach(el => el.addEventListener('change', updateCafeList));
document.getElementById('locationFilter').addEventListener('change', updateCafeList);
document.getElementById('nameSearch').addEventListener('input', updateCafeList);
document.getElementById('timeSlot').addEventListener('change', updateCafeList);
const loadingState  = document.getElementById("loadingState");

initializeData();