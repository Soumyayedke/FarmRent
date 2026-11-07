/* =========================================================
   FARMRENT — SCRIPT.JS
   All interactivity for the prototype lives here.
   Sections:
   1. Equipment data  (EDIT HERE to change listed equipment)
   2. Navigation between "pages"
   3. Rendering equipment cards
   4. Equipment details page
   5. Listing page filters & sorting
   6. Booking flow
   7. Navbar / modal / toast helpers
========================================================= */

/* ---------------------------------------------------------
   1. EQUIPMENT DATA
   Add, remove or edit equipment objects here.
   `image` uses a real photo URL — swap it for your own if needed.
--------------------------------------------------------- */

/* =========================================================
   SUPABASE AUTHENTICATION
========================================================= */

const SUPABASE_URL = "https://hstqachutvwpqvdkmgkg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JLx22E1slhwpVltr0IRekg_1pc0HElr";


const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let currentProfile = null;
let equipmentData = [];

// Demo payment & farmer dashboard state
let latestCreatedBooking = null;
let currentCheckoutBooking = null;
let farmerBookingsData = [];
let farmerDashboardToken = 0;
const FARMRENT_PAYMENTS_KEY = "farmrent_demo_payments_v1";

function getLocalDemoPayments() {
  try {
    return JSON.parse(localStorage.getItem(FARMRENT_PAYMENTS_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function saveLocalDemoPayment(bookingId, paymentRecord) {
  try {
    const store = getLocalDemoPayments();
    store[bookingId] = paymentRecord;
    localStorage.setItem(FARMRENT_PAYMENTS_KEY, JSON.stringify(store));
  } catch (e) {
    console.error("Local payment storage error:", e);
  }
}

function getPaymentStatus(booking) {
  if (!booking) return "unpaid";
  if (booking.payment_status && booking.payment_status !== "unpaid") {
    return booking.payment_status;
  }
  const local = getLocalDemoPayments()[booking.id];
  if (local && local.status) return local.status;
  return "unpaid";
}

function createPaymentBadge(status) {
  const st = status || "unpaid";
  const span = el("span", "payment-badge " + (st === "paid" ? "paid" : st === "failed" ? "failed" : "unpaid"));
  span.innerHTML = st === "paid" ? '<i class="fa-solid fa-check"></i> Paid (Demo)'
                 : st === "failed" ? '<i class="fa-solid fa-xmark"></i> Failed'
                 : '<i class="fa-solid fa-clock"></i> Unpaid';
  return span;
}


/* ---------------------------------------------------------
   SMALL HELPERS
   escapeHTML() must be used whenever user-controlled text
   (equipment names, descriptions, ...) goes into an innerHTML string.
   el() builds DOM nodes with textContent, which is always safe.
--------------------------------------------------------- */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

// type: "error" | "success" | undefined
function setInlineMessage(id, text, type) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = text || "";
  node.className = "inline-message" + (type ? " " + type : "");
}

function formatRupees(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

// "2026-10-01" -> "01 Oct 2026" (parsed by hand so the date never shifts with the time zone)
function formatDisplayDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Used when an equipment record has no image (the image URL field is optional when adding equipment)
const PLACEHOLDER_IMAGE = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="500" viewBox="0 0 700 500">' +
  '<rect width="700" height="500" fill="#EEF2E7"/>' +
  '<text x="350" y="260" font-family="Arial, sans-serif" font-size="30" fill="#5B6259" text-anchor="middle">No image provided</text>' +
  '</svg>'
);

// For images built as DOM nodes
function attachImage(img, url) {
  img.addEventListener("error", function onImageError() {
    img.removeEventListener("error", onImageError);
    img.src = PLACEHOLDER_IMAGE;
  });
  img.src = url || PLACEHOLDER_IMAGE;
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data || !data.user) return null;
  return data.user;
}


/* ---------------------------------------------------------
   LOAD EQUIPMENT FROM SUPABASE
--------------------------------------------------------- */
async function loadEquipmentData() {

    const { data, error } = await supabaseClient
        .from("equipment")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.error("Equipment fetch error:", error);
        showToast("Could not load equipment.");
        return;
    }

    equipmentData = data.map(item => ({
        id: item.id,
        owner_id: item.owner_id,
        name: item.name,
        category: item.category,
        price: Number(item.price_per_day),
        rating: Number(item.rating),
        reviews: item.reviews,
        distance: Number(item.distance_km),
        available: item.available,
        image: item.image,
        specs: item.specs || {},
        description: item.description || "",
        provider: {
            name: "Equipment Owner",
            rating: Number(item.rating),
            location: item.location || "Local equipment provider"
        }
    }));

    console.log("Equipment loaded from Supabase:", equipmentData);

    renderPopularEquipment();
    applyFilters(); // re-renders the listing and keeps any filters the farmer already chose
}


/* ---------------------------------------------------------
   NAVBAR LOGGED-IN STATE
   Swaps the "Login" button for the user's name and makes it
   clickable, routing to the correct dashboard for their role.
   Passing profile = null resets the navbar to the logged-out state.
--------------------------------------------------------- */
function updateNavbarUser(profile) {
    const navLoginBtn = document.getElementById("navLoginBtn");
    const mobileLoginBtn = document.getElementById("mobileLoginBtn");

    if (profile) {
        const targetPage = profile.role === "owner" ? "ownerDashboard"
                     : profile.role === "admin" ? "admin" : "dashboard";

        if (navLoginBtn) {
            navLoginBtn.textContent = profile.full_name || "Account";
            navLoginBtn.onclick = function () {
                showPage(targetPage);
            };
        }

        if (mobileLoginBtn) {
            mobileLoginBtn.textContent = profile.full_name || "Account";
            mobileLoginBtn.onclick = function () {
                showPage(targetPage);
                toggleMobileMenu();
            };
        }
    } else {
        if (navLoginBtn) {
            navLoginBtn.textContent = "Login";
            navLoginBtn.onclick = openLoginModal;
        }

        if (mobileLoginBtn) {
            mobileLoginBtn.textContent = "Login";
            mobileLoginBtn.onclick = function () {
                openLoginModal();
                toggleMobileMenu();
            };
        }
    }
}

/* ---------------------------------------------------------
   PROFILE PAGE
   Fills the Profile page fields from a Supabase profiles row.
   Empty/null fields fall back to "Not provided" instead of
   being left on "Loading...".
--------------------------------------------------------- */
function updateProfilePage(profile) {
    if (!profile) return;

    const profileName = document.getElementById("profileName");
    const profileFullName = document.getElementById("profileFullName");
    const profileEmail = document.getElementById("profileEmail");
    const profilePhone = document.getElementById("profilePhone");
    const profileAddress = document.getElementById("profileAddress");
    const profileRole = document.getElementById("profileRole");
    const profileRoleDetail = document.getElementById("profileRoleDetail");
    const profileAvatar = document.getElementById("profileAvatar");

    if (profileName) profileName.textContent = profile.full_name || "User";
    if (profileFullName) profileFullName.textContent = profile.full_name || "Not provided";
    if (profileEmail) profileEmail.textContent = profile.email || "Not provided";
    if (profilePhone) profilePhone.textContent = profile.phone || "Not provided";
    if (profileAddress) profileAddress.textContent = profile.address || "Not provided";
    if (profileRole) profileRole.textContent = profile.role || "User";
    if (profileRoleDetail) profileRoleDetail.textContent = profile.role || "Not provided";
    if (profileAvatar) {
        profileAvatar.textContent = (profile.full_name || "U").charAt(0).toUpperCase();
    }
}

/* ---------------------------------------------------------
   PROFILE PAGE NAVIGATION
   Shows the Profile page immediately with a loading state,
   then fetches the CURRENTLY LOGGED-IN user's row from
   public.profiles using their auth UUID and fills it in.
--------------------------------------------------------- */
async function showProfilePage() {
  showPage("profile");
  updateProfileSidebar(currentProfile ? currentProfile.role : "");

  const loadingProfile = {
    full_name: "Loading...",
    email: "Loading...",
    phone: "Loading...",
    address: "Loading...",
    role: currentProfile ? currentProfile.role : ""
  };
  updateProfilePage(loadingProfile);

  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) {
    console.error("Could not get authenticated user:", userError);
    showToast("Please log in to view your profile.");
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("full_name, email, phone, address, role")
    .eq("id", userData.user.id)
    .single();

  if (profileError) {
    console.error("Profile fetch error:", profileError);
    showToast("Could not load your profile.");
    return;
  }

  currentProfile = profile;
  updateProfilePage(profile);
  updateProfileSidebar(profile.role);
  updateNavbarUser(profile);
}

/* ---------------------------------------------------------
   LOGOUT
   Signs out of Supabase and resets the app back to a
   logged-out state.
--------------------------------------------------------- */
async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentProfile = null;
  resetAdminViews();
  resetOwnerViews(); // never leave one owner's data in the page for the next login
  resetFarmerViews();
  updateNavbarUser(null);
  showToast("You have been logged out.");
  showPage("home");
}

// Keeps track of which equipment the user is currently viewing/booking
let currentEquipmentId = null;
/* ---------------------------------------------------------
   2. NAVIGATION BETWEEN "PAGES"
   The whole prototype lives on one HTML file. Each <section class="page">
   is shown/hidden with this function instead of loading a new file.
--------------------------------------------------------- */
function showPage(pageId) {
  // UX guard only. Real admin protection is RLS / is_admin() in the database.
  if (pageId === "admin" && !(currentProfile && currentProfile.role === "admin")) {
    showToast("Admin access required.");
    return;
  }
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById("page-" + pageId);
  if (target) target.classList.add("active");
  document.body.classList.toggle("cinematic-home-active", pageId === "home");

  // Footer only makes sense on the marketing pages
  const footer = document.getElementById("siteFooter");
  footer.style.display = (pageId === "home" || pageId === "listing") ? "block" : "none";

  window.scrollTo({ top: 0, behavior: "smooth" });
  if (pageId === "home") {
    const homeFrame = document.getElementById("cinematicHomeFrame");
    if (homeFrame && homeFrame.contentWindow) {
      homeFrame.contentWindow.postMessage({ type: "farmrent:navigate", action: "home" }, window.location.origin);
    }
  }

  // Pages load their own data whenever they are opened
  if (pageId === "ownerDashboard") {
    refreshOwnerDashboard();
  } else if (pageId === "bookingRequests") {
    setInlineMessage("bookingRequestsMessage", "");
    loadBookingRequests();
  } else if (pageId === "dashboard") {
    loadFarmerDashboard();
  } else if (pageId === "admin") {
    loadAdminDashboard();
  }
}

function scrollToHowItWorks() {
  showPage("home");
  setTimeout(() => {
    document.getElementById("how-it-works").scrollIntoView({ behavior: "smooth" });
  }, 100);
}

function showAbout() {
  showToast("FarmRent — a student project connecting farmers with nearby equipment owners.");
}

/* ---------------------------------------------------------
   3. RENDERING EQUIPMENT CARDS
--------------------------------------------------------- */
function createEquipmentCardHTML(item) {
  const availabilityHTML = item.available
    ? `<span class="availability-badge available">Available</span>`
    : `<span class="availability-badge unavailable">Unavailable</span>`;

  // Owners type these values, so they are escaped before going into HTML.
  return `
    <div class="equipment-card">
      <img src="${escapeHTML(item.image || PLACEHOLDER_IMAGE)}" alt="${escapeHTML(item.name)}" onerror="this.onerror=null;this.src=PLACEHOLDER_IMAGE;" />
      <div class="equipment-card-body">
        <span class="equipment-category">${escapeHTML(item.category)}</span>
        <h3>${escapeHTML(item.name)}</h3>
        <div class="equipment-price">₹${item.price} <span>/ day</span></div>
        <div class="equipment-meta">
          <span><i class="fa-solid fa-star"></i>${item.rating}</span>
          <span><i class="fa-solid fa-location-dot"></i>${item.distance} km away</span>
        </div>
        ${availabilityHTML}
        <button class="btn btn-primary" onclick="viewDetails(${item.id})">View Details</button>
      </div>
    </div>
  `;
}

function renderPopularEquipment() {
  const grid = document.getElementById("popularEquipmentGrid");

  // The 4 best-rated listings, available ones first. (Previously this was hard-wired to
  // ids 1-4, which would leave the home page empty as soon as those rows were deleted.)
  const popular = equipmentData
    .slice()
    .sort((a, b) =>
      (Number(b.available) - Number(a.available)) ||
      (b.rating - a.rating) ||
      (Number(b.id) - Number(a.id)))
    .slice(0, 4);

  if (popular.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No equipment has been listed yet.</p></div>`;
    return;
  }
  grid.innerHTML = popular.map(createEquipmentCardHTML).join("");
}

/* ---------------------------------------------------------
   4. EQUIPMENT DETAILS PAGE
--------------------------------------------------------- */
function viewDetails(id) {
  currentEquipmentId = id;
  const item = equipmentData.find(e => e.id === id);
  if (!item) return;

  const specsHTML = Object.entries(item.specs)
    .map(([key, val]) => `<div class="spec-item"><span>${escapeHTML(key)}</span><span>${escapeHTML(val)}</span></div>`)
    .join("");

  const statusHTML = item.available
    ? `<p class="details-status available"><i class="fa-solid fa-circle-check"></i>Available</p>`
    : `<p class="details-status"><i class="fa-solid fa-circle-xmark"></i>Currently unavailable</p>`;

  // An owner can mark equipment unavailable, so farmers must not be able to book it.
  const bookButtonHTML = item.available
    ? `<button class="btn btn-primary" onclick="startBooking(${item.id})">Book Now</button>`
    : `<button class="btn btn-primary" disabled>Currently Unavailable</button>`;

  document.getElementById("detailsContent").innerHTML = `
    <div class="details-image">
      <img src="${escapeHTML(item.image || PLACEHOLDER_IMAGE)}" alt="${escapeHTML(item.name)}" onerror="this.onerror=null;this.src=PLACEHOLDER_IMAGE;" />
    </div>
    <div class="details-info">
      <span class="equipment-category">${escapeHTML(item.category)}</span>
      <h1>${escapeHTML(item.name)}</h1>
      <p class="details-rating"><i class="fa-solid fa-star"></i> ${item.rating} (${escapeHTML(item.reviews)} reviews)</p>
      <p class="details-price">₹${item.price} <span>/ day</span></p>
      <p class="details-distance"><i class="fa-solid fa-location-dot"></i>${item.distance} km from your location</p>
      ${statusHTML}
      ${bookButtonHTML}

      <div class="details-block">
        <h3>Specifications</h3>
        <div class="spec-list">${specsHTML}</div>
      </div>

      <div class="details-block">
        <h3>Description</h3>
        <p>${escapeHTML(item.description)}</p>
      </div>

      <div class="provider-card">
        <h4>${escapeHTML(item.provider.name)}</h4>
        <p class="provider-rating"><i class="fa-solid fa-star"></i> ${item.provider.rating} provider rating</p>
        <p class="provider-location"><i class="fa-solid fa-location-dot"></i>${escapeHTML(item.provider.location)}</p>
        <button class="btn btn-outline" onclick="showToast('Provider contact details sent to your registered number.')">Contact Provider</button>
      </div>
    </div>
  `;

  showPage("details");
}

/* ---------------------------------------------------------
   5. LISTING PAGE — FILTERS & SORTING
--------------------------------------------------------- */
function renderListingEquipment(list) {
  const grid = document.getElementById("listingEquipmentGrid");
  const countLabel = document.getElementById("resultsCount");

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><p>No equipment matches your filters. Try adjusting them.</p></div>`;
  } else {
    grid.innerHTML = list.map(createEquipmentCardHTML).join("");
  }
  countLabel.textContent = `Showing ${list.length} of ${equipmentData.length} equipment`;
}

function updatePriceLabel() {
  document.getElementById("priceRangeValue").textContent = document.getElementById("priceRange").value;
}

function applyFilters() {
  const searchTerm = document.getElementById("listingSearchInput").value.trim().toLowerCase();
  const checkedCats = Array.from(document.querySelectorAll(".cat-filter:checked")).map(cb => cb.value);
  const maxPrice = Number(document.getElementById("priceRange").value);
  const onlyAvailable = document.getElementById("availabilityFilter").checked;
  const sortBy = document.getElementById("sortSelect").value;

  let result = equipmentData.filter(item => {
    const matchesSearch = (item.name || "").toLowerCase().includes(searchTerm) || (item.category || "").toLowerCase().includes(searchTerm);
    const matchesCategory = checkedCats.length === 0 || checkedCats.includes(item.category);
    const matchesPrice = item.price <= maxPrice;
    const matchesAvailability = !onlyAvailable || item.available;
    return matchesSearch && matchesCategory && matchesPrice && matchesAvailability;
  });

  if (sortBy === "price-low") result.sort((a, b) => a.price - b.price);
  else if (sortBy === "price-high") result.sort((a, b) => b.price - a.price);
  else if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
  else if (sortBy === "distance") result.sort((a, b) => a.distance - b.distance);

  renderListingEquipment(result);
}

function resetFilters() {
  document.querySelectorAll(".cat-filter").forEach(cb => cb.checked = false);
  document.getElementById("priceRange").value = 5000;
  updatePriceLabel();
  document.getElementById("availabilityFilter").checked = false;
  document.getElementById("listingSearchInput").value = "";
  document.getElementById("sortSelect").value = "recommended";
  applyFilters();
}

/* ---------------------------------------------------------
   6. BOOKING FLOW
--------------------------------------------------------- */
const SERVICE_FEE = 100;

function startBooking(id) {
  currentEquipmentId = id;
  const item = equipmentData.find(e => e.id === id);
  if (!item) return;

  if (!item.available) {
    showToast("This equipment is currently unavailable.");
    return;
  }

  // Reset the booking view back to the form (in case a previous booking was completed)
  document.getElementById("bookingFormView").style.display = "block";
  document.getElementById("bookingSuccessView").style.display = "none";

  document.getElementById("bookingEquipmentSummary").innerHTML = `
    <img src="${escapeHTML(item.image || PLACEHOLDER_IMAGE)}" alt="${escapeHTML(item.name)}" onerror="this.onerror=null;this.src=PLACEHOLDER_IMAGE;" />
    <div>
      <h4>${escapeHTML(item.name)}</h4>
      <p>₹${item.price} / day</p>
    </div>
  `;

  // Default dates: today and tomorrow, so the summary is never empty
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  document.getElementById("startDate").value = formatDateForInput(today);
  document.getElementById("endDate").value = formatDateForInput(tomorrow);

  updateBookingSummary();
  showPage("booking");
}

function formatDateForInput(date) {
  // Local calendar date. (toISOString() uses UTC, which gives yesterday's date in India before 5:30 AM.)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateBookingSummary() {
  const item = equipmentData.find(e => e.id === currentEquipmentId);
  if (!item) return;

  const startVal = document.getElementById("startDate").value;
  const endVal = document.getElementById("endDate").value;
  const durationText = document.getElementById("durationText");
  const breakdown = document.getElementById("priceBreakdown");

  if (!startVal || !endVal) {
    durationText.textContent = "—";
    breakdown.innerHTML = "";
    return;
  }

  const start = new Date(startVal);
  const end = new Date(endVal);
  let days = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (days < 1) days = 1; // minimum 1 day rental

  durationText.textContent = `${days} Day${days > 1 ? "s" : ""}`;

  const subtotal = item.price * days;
  const total = subtotal + SERVICE_FEE;

  breakdown.innerHTML = `
    <div class="row"><span>₹${item.price} × ${days} day${days > 1 ? "s" : ""}</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
    <div class="row"><span>Service fee</span><span>₹${SERVICE_FEE}</span></div>
    <div class="total-row"><span>Total</span><span>₹${total.toLocaleString("en-IN")}</span></div>
  `;
}

async function confirmBooking() {
    const startVal = document.getElementById("startDate").value;
    const endVal = document.getElementById("endDate").value;

    if (!startVal || !endVal) {
        showToast("Please select both start and end dates.");
        return;
    }

    if (new Date(endVal) < new Date(startVal)) {
        showToast("End date cannot be before start date.");
        return;
    }

    const item = equipmentData.find(e => e.id === currentEquipmentId);

    if (!item) {
        showToast("Equipment not found.");
        return;
    }

    // Get logged-in farmer
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        showToast("Please login again.");
        return;
    }

    // Get farmer profile
    const { data: farmerProfile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("id, role")
            .eq("id", user.id)
            .single();

    if (profileError || !farmerProfile) {
        console.error("Profile error:", profileError);
        showToast("Could not find your profile.");
        return;
    }

    // The owner of the booking is the owner of the equipment (equipment.owner_id).
    const ownerId = item.owner_id;

    if (!ownerId) {
        showToast("This equipment does not have an assigned owner.");
        return;
    }

    // The owner may have switched the listing to unavailable since this page was loaded.
    const { data: latest } = await supabaseClient
        .from("equipment")
        .select("available")
        .eq("id", item.id)
        .single();

    if (latest && latest.available === false) {
        showToast("Sorry, this equipment was just marked unavailable.");
        await loadEquipmentData();
        return;
    }

    // Calculate number of rental days
    const start = new Date(startVal);
    const end = new Date(endVal);

    let days = Math.round(
        (end - start) / (1000 * 60 * 60 * 24)
    );

    if (days < 1) days = 1;

    const subtotal = item.price * days;
    const total = subtotal + SERVICE_FEE;

    // Create booking request
    const { data: booking, error: bookingError } =
        await supabaseClient
            .from("booking_requests")
            .insert({
                farmer_id: farmerProfile.id,
                owner_id: ownerId,
                equipment_name: item.name,
                equipment_image: item.image,
                start_date: startVal,
                end_date: endVal,
                total_amount: total,
                status: "pending"
            })
            .select()
            .single();

    if (bookingError) {
        console.error("Booking insert error:", bookingError);
        showToast("Booking could not be submitted.");
        return;
    }

    console.log("Booking created:", booking);

    // Save for immediate demo payment prompt
    latestCreatedBooking = {
      ...booking,
      durationDays: days,
      dailyRate: item.price,
      subtotal: subtotal,
      serviceFee: SERVICE_FEE
    };

    // Booking reference shown to the farmer, derived from the real database id
    const reference = String(booking.id).replace(/-/g, "").slice(0, 8).toUpperCase().padStart(5, "0");

    document.getElementById("bookingIdText").textContent =
        `FR-${new Date().getFullYear()}-${reference}`;

    // Hide booking form
    document.getElementById("bookingFormView").style.display = "none";

    // Show success screen
    document.getElementById("bookingSuccessView").style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    showToast("Booking request submitted successfully!");
}


/* =========================================================
   OWNER AREA — BOOKING REQUESTS, DASHBOARD STATISTICS, EQUIPMENT
   Every query below is filtered by the logged-in owner's own UUID.
   That filter is a convenience; the real protection is Row Level
   Security in the database (see supabase_owner_policies.sql).
========================================================= */

// Each loader bumps its token when it starts. A response that arrives after a newer
// load (or after logout) has started is ignored, so stale data never overwrites fresh data.
let bookingRequestsToken = 0;
let ownerStatsToken = 0;
let ownerEquipmentToken = 0;

// Status values stored in booking_requests.status -> what the owner sees
const BOOKING_STATUS = {
    pending:   { label: "Pending",   cssClass: "status-pending" },
    approved:  { label: "Accepted",  cssClass: "status-approved" },
    rejected:  { label: "Declined",  cssClass: "status-rejected" },
    completed: { label: "Completed", cssClass: "status-completed" }
};

// newStatus -> the status the row must currently have for that change to be allowed
const ALLOWED_BOOKING_STATUS_CHANGES = {
    approved: "pending",
    rejected: "pending",
    completed: "approved"
};

function createStatusBadge(status) {
    const info = BOOKING_STATUS[status] ||
        { label: String(status || "Unknown"), cssClass: "status-completed" };
    return el("span", "status-badge " + info.cssClass, info.label);
}

function setButtonGroupDisabled(button, disabled) {
    if (!button || !button.parentElement) return;
    button.parentElement.querySelectorAll("button").forEach(b => { b.disabled = disabled; });
}

function describeDatabaseError(error) {
    if (!error) return "Unknown error.";
    if (error.code === "23503") {
        return "This listing is linked to existing booking records, so the database will not delete it. Mark it unavailable instead.";
    }
    return error.message || "Unknown error.";
}

/* ---------------------------------------------------------
   BOOKING REQUESTS PAGE
   options.silent = true refreshes the list without the
   "Loading..." flash (used right after an Accept/Decline click).
--------------------------------------------------------- */
async function loadBookingRequests(options) {
    const silent = Boolean(options && options.silent);
    const container = document.getElementById("bookingRequestsList");
    if (!container) return;

    const token = ++bookingRequestsToken;

    if (!silent) {
        container.replaceChildren(el("p", "muted-text", "Loading booking requests..."));
    }

    const user = await getCurrentUser();
    if (token !== bookingRequestsToken) return;

    if (!user) {
        container.replaceChildren(el("p", "muted-text", "Please log in to see your booking requests."));
        return;
    }

    // Only this owner's requests
    const { data: requests, error } = await supabaseClient
        .from("booking_requests")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

    if (token !== bookingRequestsToken) return;

    if (error) {
        console.error("Booking request error:", error);
        container.replaceChildren(el("p", "inline-message error",
            "Unable to load booking requests. Please check your connection and try again."));
        return;
    }

    if (!requests || requests.length === 0) {
        container.replaceChildren(el("p", "muted-text", "No booking requests available yet."));
        return;
    }

    container.replaceChildren(...requests.map(createBookingRequestCard));
}

function createBookingRequestCard(request) {
    const card = el("div", "booking-request-card");

    const info = el("div", "booking-request-info");
    info.appendChild(el("h3", "", request.equipment_name || "Equipment"));
    info.appendChild(el("p", "", "Requested by farmer"));
    info.appendChild(el("p", "",
        `${formatDisplayDate(request.start_date)} → ${formatDisplayDate(request.end_date)}`));

    const amount = el("p", "", "Total Amount: ");
    amount.appendChild(el("strong", "", formatRupees(request.total_amount)));
    info.appendChild(amount);

    const badgeGroup = el("div", "status-badge-group");
    badgeGroup.style.display = "flex";
    badgeGroup.style.gap = "8px";
    badgeGroup.style.marginTop = "6px";
    badgeGroup.style.flexWrap = "wrap";
    badgeGroup.appendChild(createStatusBadge(request.status));
    badgeGroup.appendChild(createPaymentBadge(getPaymentStatus(request)));
    info.appendChild(badgeGroup);
    card.appendChild(info);

    const actions = el("div", "booking-request-actions");

    if (request.status === "pending") {
        actions.appendChild(createBookingActionButton("Accept", "btn btn-primary", request, "approved"));
        actions.appendChild(createBookingActionButton("Decline", "btn btn-outline", request, "rejected"));
    } else if (request.status === "approved") {
        actions.appendChild(createBookingActionButton("Mark Completed", "btn btn-outline", request, "completed"));
    }

    if (getPaymentStatus(request) === "paid") {
        const rcptBtn = el("button", "btn btn-outline table-action-btn", "Demo Receipt");
        rcptBtn.type = "button";
        rcptBtn.addEventListener("click", () => openDemoReceipt(request.id));
        actions.appendChild(rcptBtn);
    }

    if (actions.children.length > 0) card.appendChild(actions);
    return card;
}

function createBookingActionButton(label, className, request, newStatus) {
    const button = el("button", className, label);
    button.type = "button";
    // The real row id is captured here; nothing is hard-coded or read back from the HTML.
    button.addEventListener("click", () => updateBookingRequestStatus(request.id, newStatus, button));
    return button;
}

/* ---------------------------------------------------------
   ACCEPT / DECLINE / COMPLETE A BOOKING REQUEST
   pending  -> approved | rejected
   approved -> completed
   The UPDATE is limited to this owner's row AND to the expected
   current status, so a request can never be changed twice by accident.
--------------------------------------------------------- */
async function updateBookingRequestStatus(bookingId, newStatus, button) {
    const requiredCurrentStatus = ALLOWED_BOOKING_STATUS_CHANGES[newStatus];
    if (!requiredCurrentStatus) {
        showToast("That status change is not supported.");
        return;
    }

    setButtonGroupDisabled(button, true);
    setInlineMessage("bookingRequestsMessage", "");

    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Please log in again.");

        const { data, error } = await supabaseClient
            .from("booking_requests")
            .update({ status: newStatus })
            .eq("id", bookingId)
            .eq("owner_id", user.id)
            .eq("status", requiredCurrentStatus)
            .select("id, status");

        if (error) throw error;

        // With Row Level Security, a blocked UPDATE is NOT an error: it simply changes 0 rows.
        if (!data || data.length === 0) {
            throw new Error(
                "Nothing was changed. The request may already have been updated, or the database " +
                "policy does not allow owners to update booking requests (see supabase_owner_policies.sql).");
        }

        const doneMessage = {
            approved: "Booking request accepted.",
            rejected: "Booking request declined.",
            completed: "Booking marked as completed."
        }[newStatus];
        showToast(doneMessage);
        setInlineMessage("bookingRequestsMessage", doneMessage, "success");

    } catch (error) {
        console.error("Booking status update error:", error);
        setInlineMessage("bookingRequestsMessage",
            "Could not update the request: " + describeDatabaseError(error), "error");
    } finally {
        // Always re-read from the database so the screen shows the truth, and refresh the statistics.
        await Promise.all([
            loadBookingRequests({ silent: true }),
            loadOwnerBookingStats()
        ]);
    }
}

/* ---------------------------------------------------------
   OWNER DASHBOARD STATISTICS

   EARNINGS RULE (applies to the "Total Earnings" card):
   - Only bookings with status = 'completed' count as earned money.
     pending, approved (not yet completed) and rejected bookings are NOT counted.
   - booking_requests.total_amount is what the farmer pays: rental price PLUS the flat
     SERVICE_FEE added in the booking form. The service fee is not the owner's money,
     so each completed booking contributes (total_amount - SERVICE_FEE), never below 0.
   - Approved-but-not-completed bookings are shown separately in the card's note.
--------------------------------------------------------- */
function ownerShareOfBooking(booking) {
    return Math.max(Number(booking.total_amount || 0) - SERVICE_FEE, 0);
}

function sumOwnerShare(bookings, status) {
    return bookings
        .filter(booking => booking.status === status)
        .reduce((sum, booking) => sum + ownerShareOfBooking(booking), 0);
}

function setOwnerStatsLoading() {
    ["statPendingCount", "statCompletedCount", "statEarnings"].forEach(id => setText(id, "…"));
    setText("statEarningsNote", "");
    setInlineMessage("ownerStatsMessage", "");
    const latest = document.getElementById("ownerLatestRequest");
    if (latest) latest.replaceChildren(el("p", "muted-text", "Loading..."));
}

function setOwnerStatsError(message) {
    ["statPendingCount", "statCompletedCount", "statEarnings"].forEach(id => setText(id, "—"));
    setText("statEarningsNote", "");
    setInlineMessage("ownerStatsMessage", message, "error");
    const latest = document.getElementById("ownerLatestRequest");
    if (latest) latest.replaceChildren(el("p", "muted-text", "Latest request unavailable."));
}

function renderLatestRequest(booking) {
    const box = document.getElementById("ownerLatestRequest");
    if (!box) return;

    if (!booking) {
        box.replaceChildren(el("p", "muted-text",
            "No booking requests yet. Requests from farmers will appear here."));
        return;
    }

    const card = el("div", "upcoming-booking-card");

    const img = el("img");
    img.alt = booking.equipment_name || "Equipment";
    attachImage(img, booking.equipment_image);

    const info = el("div", "upcoming-booking-info");
    info.appendChild(el("h3", "", booking.equipment_name || "Equipment"));
    info.appendChild(el("p", "",
        `${formatDisplayDate(booking.start_date)} – ${formatDisplayDate(booking.end_date)} • ${formatRupees(booking.total_amount)}`));
    info.appendChild(createStatusBadge(booking.status));

    const button = el("button", "btn btn-outline", "View Requests");
    button.type = "button";
    button.addEventListener("click", () => showPage("bookingRequests"));

    card.append(img, info, button);
    box.replaceChildren(card);
}

async function loadOwnerBookingStats() {
    const token = ++ownerStatsToken;
    setOwnerStatsLoading();

    const user = await getCurrentUser();
    if (token !== ownerStatsToken) return;

    if (!user) {
        setOwnerStatsError("Please log in as an owner to see your statistics.");
        return;
    }

    const { data, error } = await supabaseClient
        .from("booking_requests")
        .select("id, status, total_amount, equipment_name, equipment_image, start_date, end_date, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

    if (token !== ownerStatsToken) return;

    if (error) {
        console.error("Owner statistics error:", error);
        setOwnerStatsError("Could not load booking statistics. Please check your connection and database permissions.");
        return;
    }

    const bookings = data || [];
    const earned = sumOwnerShare(bookings, "completed");
    const awaiting = sumOwnerShare(bookings, "approved");

    setText("statPendingCount", bookings.filter(b => b.status === "pending").length);
    setText("statCompletedCount", bookings.filter(b => b.status === "completed").length);
    setText("statEarnings", formatRupees(earned));
    setText("statEarningsNote",
        `Completed rentals only, after the ${formatRupees(SERVICE_FEE)} service fee` +
        (awaiting > 0 ? ` · ${formatRupees(awaiting)} approved, not completed yet` : ""));

    renderLatestRequest(bookings[0]);
}

function refreshOwnerDashboard() {
    return Promise.all([loadOwnerEquipment(), loadOwnerBookingStats()]);
}

// Opens the owner dashboard, optionally scrolling to one of its sections
function showOwnerDashboard(sectionId) {
    showPage("ownerDashboard");
    if (sectionId) {
        setTimeout(() => {
            const section = document.getElementById(sectionId);
            if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 60);
    }
}

// Empties every owner-only area (called on logout)
function resetOwnerViews() {
    bookingRequestsToken++;
    ownerStatsToken++;
    ownerEquipmentToken++;

    ["statEquipmentCount", "statPendingCount", "statCompletedCount", "statEarnings"].forEach(id => setText(id, "—"));
    setText("statEarningsNote", "");
    ["ownerStatsMessage", "ownerEquipmentMessage", "bookingRequestsMessage"].forEach(id => setInlineMessage(id, ""));

    ["ownerLatestRequest", "ownerEquipmentRows", "bookingRequestsList"].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.replaceChildren();
    });
}

/* ---------------------------------------------------------
   OWNER EQUIPMENT TABLE
   Shows ONLY the logged-in owner's equipment, with
   Mark Available/Unavailable and Delete actions.
--------------------------------------------------------- */
function createMessageRow(text) {
    const row = document.createElement("tr");
    const cell = el("td", "", text);
    cell.colSpan = 5;
    row.appendChild(cell);
    return row;
}

function createOwnerEquipmentRow(item) {
    const row = document.createElement("tr");
    row.dataset.equipmentId = item.id;

    row.appendChild(el("td", "", item.name));
    row.appendChild(el("td", "", item.category));
    row.appendChild(el("td", "", formatRupees(item.price_per_day)));

    const statusCell = document.createElement("td");
    statusCell.appendChild(el("span",
        "status-badge " + (item.available ? "status-confirmed" : "status-completed"),
        item.available ? "Available" : "Unavailable"));
    row.appendChild(statusCell);

    const actionsCell = document.createElement("td");
    const actions = el("div", "equipment-actions");

    const toggleButton = el("button", "btn btn-outline btn-small",
        item.available ? "Mark Unavailable" : "Mark Available");
    toggleButton.type = "button";
    toggleButton.addEventListener("click", () => toggleEquipmentAvailability(item, toggleButton));

    const deleteButton = el("button", "btn btn-danger btn-small", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteOwnerEquipment(item, deleteButton));

    actions.append(toggleButton, deleteButton);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);

    return row;
}

async function loadOwnerEquipment(options) {
    const silent = Boolean(options && options.silent);
    const tbody = document.getElementById("ownerEquipmentRows");
    if (!tbody) return;

    const token = ++ownerEquipmentToken;

    if (!silent) {
        setText("statEquipmentCount", "…");
        tbody.replaceChildren(createMessageRow("Loading your equipment..."));
    }

    const user = await getCurrentUser();
    if (token !== ownerEquipmentToken) return;

    if (!user) {
        setText("statEquipmentCount", "—");
        tbody.replaceChildren(createMessageRow("Please log in to view your equipment."));
        return;
    }

    const { data, error } = await supabaseClient
        .from("equipment")
        .select("id, name, category, price_per_day, available")
        .eq("owner_id", user.id)
        .order("id", { ascending: false });

    if (token !== ownerEquipmentToken) return;

    if (error) {
        console.error("Owner equipment fetch error:", error);
        setText("statEquipmentCount", "—");
        tbody.replaceChildren(createMessageRow(
            "Could not load your equipment. Please check your connection and database permissions."));
        return;
    }

    // Statistic: number of equipment records owned by this owner
    setText("statEquipmentCount", data.length);

    if (data.length === 0) {
        tbody.replaceChildren(createMessageRow("No equipment listed yet. Add your first item above."));
        return;
    }

    tbody.replaceChildren(...data.map(createOwnerEquipmentRow));
}

async function toggleEquipmentAvailability(item, button) {
    const makeAvailable = !item.available;
    setButtonGroupDisabled(button, true);
    setInlineMessage("ownerEquipmentMessage", "");

    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Please log in again.");

        const { data, error } = await supabaseClient
            .from("equipment")
            .update({ available: makeAvailable })
            .eq("id", item.id)
            .eq("owner_id", user.id)
            .select("id, available");

        if (error) throw error;

        // A blocked UPDATE (Row Level Security) changes 0 rows without raising an error.
        if (!data || data.length === 0) {
            throw new Error(
                "Nothing was changed. Either this listing is not yours, or the database policy " +
                "does not allow owners to update equipment (see supabase_owner_policies.sql).");
        }

        const text = `"${item.name}" is now ${makeAvailable ? "available" : "unavailable"}.`;
        showToast(text);
        setInlineMessage("ownerEquipmentMessage", text, "success");

        await loadEquipmentData(); // farmers' browsing pages
    } catch (error) {
        console.error("Availability update error:", error);
        setInlineMessage("ownerEquipmentMessage",
            "Could not change availability: " + describeDatabaseError(error), "error");
    } finally {
        await loadOwnerEquipment({ silent: true });
    }
}

async function deleteOwnerEquipment(item, button) {
    setButtonGroupDisabled(button, true);
    setInlineMessage("ownerEquipmentMessage", "");

    let attempted = false;

    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Please log in again.");

        // This function never touches booking_requests rows. They store the equipment name and
        // image themselves, so history stays readable. We only count live requests to warn the
        // owner (matched by name, because booking_requests has no equipment id column).
        let liveRequests = 0;
        const { data: related } = await supabaseClient
            .from("booking_requests")
            .select("status")
            .eq("owner_id", user.id)
            .eq("equipment_name", item.name);
        if (related) {
            liveRequests = related.filter(r => r.status === "pending" || r.status === "approved").length;
        }

        let question =
            `Delete "${item.name}"?\n\n` +
            "This permanently removes the listing from FarmRent. Existing booking history is kept.";
        if (liveRequests > 0) {
            question += `\n\nWarning: ${liveRequests} pending/approved booking request(s) mention this equipment. ` +
                'Consider "Mark Unavailable" instead.';
        }

        if (!window.confirm(question)) return; // cancelled: nothing is deleted

        attempted = true;

        const { data, error } = await supabaseClient
            .from("equipment")
            .delete()
            .eq("id", item.id)
            .eq("owner_id", user.id)
            .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "Nothing was deleted. Either this listing is not yours, or the database policy " +
                "does not allow owners to delete equipment (see supabase_owner_policies.sql).");
        }

        showToast("Equipment deleted.");
        setInlineMessage("ownerEquipmentMessage", `"${item.name}" was deleted.`, "success");

        await loadEquipmentData(); // farmers' browsing pages
    } catch (error) {
        console.error("Delete equipment error:", error);
        setInlineMessage("ownerEquipmentMessage",
            "Could not delete: " + describeDatabaseError(error), "error");
    } finally {
        if (attempted) {
            await loadOwnerEquipment({ silent: true }); // also refreshes the "Equipment Listed" statistic
        } else {
            setButtonGroupDisabled(button, false);
        }
    }
}


/* ---------------------------------------------------------
   7. NAVBAR / MODAL / TOAST HELPERS
--------------------------------------------------------- */
function toggleMobileMenu() {
  document.getElementById("mobileMenu").classList.toggle("open");
}

function openLoginModal() {
  document.getElementById("loginModalOverlay").classList.add("open");
}

function closeLoginModal(event) {
  document.getElementById("loginModalOverlay").classList.remove("open");
}

// Auth form switching
function showSignupForm() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("otpForm").style.display = "none";
  document.getElementById("signupForm").style.display = "block";
  document.getElementById("verificationMessage").style.display = "none";
}

function showLoginForm() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("otpForm").style.display = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("verificationMessage").style.display = "none";
}

function showOTPForm() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("otpForm").style.display = "block";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("verificationMessage").style.display = "none";
}

function showVerificationMessage(email) {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("otpForm").style.display = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("verificationMessage").style.display = "block";

  document.querySelector("#verificationMessage .modal-subtext").textContent =
    `We've sent a verification link to ${email}. Please check your inbox and click the link to activate your account.`;
}

//Login, signup
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const message = document.getElementById("loginMessage");

  message.textContent = "";
  message.className = "auth-message";

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    message.classList.add("error");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = error.message;
    message.classList.add("error");
    return;
  }

  if (!data.user.email_confirmed_at) {
    message.textContent =
      "Please verify your email before logging in.";
    message.classList.add("error");
    return;
  }

  const { data: profile, error: profileError } = await fetchProfileForUser(data.user);

if (profileError) {
    console.error("Profile fetch error:", profileError);

    message.textContent = "Could not load your profile.";
    message.classList.add("error");
    return;
}


currentProfile = profile;

updateNavbarUser(profile);

setWelcomeText(profile);

closeLoginModal();

showToast(`Welcome back, ${profile.full_name}!`);

if (profile.role === "farmer") {
    showPage("dashboard");
} else if (profile.role === "owner") {
    showPage("ownerDashboard");
} else if (profile.role === "admin") {
    showPage("admin");
} else {
    message.textContent = "Invalid user role.";
    message.classList.add("error");
}
}

// Send email OTP
async function handleSendOTP() {
  const email = document.getElementById("loginEmail").value.trim();
  const message = document.getElementById("loginMessage");

  message.textContent = "";
  message.className = "auth-message";

  if (!email) {
    message.textContent = "Please enter your email address.";
    message.classList.add("error");
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: false
    }
  });

  if (error) {
    message.textContent = error.message;
    message.classList.add("error");
    return;
  }

  document.getElementById("otpMessage").textContent =
    `OTP sent to ${email}`;

  showOTPForm();
}


// Verify email OTP
async function handleVerifyOTP() {
  const email = document.getElementById("loginEmail").value.trim();
  const token = document.getElementById("otpCode").value.trim();
  const message = document.getElementById("otpMessage");

  message.textContent = "";
  message.className = "auth-message";

  if (!email || !token) {
    message.textContent = "Please enter the OTP.";
    message.classList.add("error");
    return;
  }

  if (token.length !== 6) {
    message.textContent = "Please enter the 6-digit OTP.";
    message.classList.add("error");
    return;
  }

  const { data, error } = await supabaseClient.auth.verifyOtp({
    email: email,
    token: token,
    type: "email"
  });

  if (error) {
    message.textContent = error.message;
    message.classList.add("error");
    return;
  }

  const { data: profile, error: profileError } = await fetchProfileForUser(data.user);

  if (profileError) {
    console.error("Profile fetch error:", profileError);
    message.textContent = "Could not load your profile.";
    message.classList.add("error");
    return;
  }


  currentProfile = profile;
  updateNavbarUser(profile);

  setWelcomeText(profile);

  closeLoginModal();
  showToast("OTP verified! Login successful.");

  if (profile.role === "owner") {
    showPage("ownerDashboard");
  } else if (profile.role === "admin") {
    showPage("admin");
  } else {
    showPage("dashboard");
  }
}

async function handleSignup() {
const name = document.getElementById("signupName").value.trim();
const email = document.getElementById("signupEmail").value.trim();
const password = document.getElementById("signupPassword").value;
const phone = document.getElementById("signupPhone").value.trim();
const address = document.getElementById("signupAddress").value.trim();
const role = document.getElementById("signupRole").value;

  const message = document.getElementById("signupMessage");

  message.textContent = "";
  message.className = "auth-message";

  if (!name || !email || !password || !phone || !address) {
    message.textContent = "Please fill in all fields.";
    message.classList.add("error");
    return;
  }

  if (password.length < 6) {
    message.textContent =
      "Password must be at least 6 characters.";
    message.classList.add("error");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,

    options: {
      emailRedirectTo: window.location.origin,

      data: {
    full_name: name,
    phone: phone,
    address: address,
    role: role
     }
    }
  });

  if (error) {
    message.textContent = error.message;
    message.classList.add("error");
    return;
  }

  showVerificationMessage(email);
}

function handleHomeSearch() {
  showToast("Searching equipment near you...");
  setTimeout(() => showPage("listing"), 400);
}

let toastTimeout;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}



function showAddEquipmentForm() {
  const panel = document.getElementById("addEquipmentPanel");
  panel.style.display = "block";
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideAddEquipmentForm() {
  document.getElementById("addEquipmentPanel").style.display = "none";
  document.getElementById("addEquipmentForm").reset();
  document.getElementById("addEquipmentMessage").textContent = "";
}

async function handleAddEquipment(event) {
  event.preventDefault();

  const message = document.getElementById("addEquipmentMessage");
  const submitButton = event.submitter;

  message.textContent = "Saving equipment...";
  if (submitButton) submitButton.disabled = true;

  try {
    // Get the currently logged-in user.
    const { data: authData, error: authError } =
      await supabaseClient.auth.getUser();

    const user = authData?.user;

    if (authError || !user) {
      throw new Error("Please log in before adding equipment.");
    }

    // Confirm that this user is registered as an owner.
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    if (profile.role !== "owner") {
      throw new Error("Only equipment owners can add listings.");
    }

    // Convert lines like "Fuel: Diesel" into a JSON object.
    const specsText =
      document.getElementById("equipmentSpecs").value.trim();

    const specs = {};

    if (specsText) {
      specsText.split("\n").forEach(line => {
        const separator = line.indexOf(":");

        if (separator > 0) {
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim();

          if (key && value) specs[key] = value;
        }
      });

      
if (Object.keys(specs).length === 0) {
  specs.Details = specsText;
}

    }

    const equipment = {
      owner_id: user.id,
      name: document.getElementById("equipmentName").value.trim(),
      category: document.getElementById("equipmentCategory").value,
      price_per_day: Number(
        document.getElementById("equipmentPrice").value
      ),
      location: document.getElementById("equipmentLocation").value.trim(),
      image: document.getElementById("equipmentImage").value.trim() || null,
      description:
        document.getElementById("equipmentDescription").value.trim() || null,
      specs,
      available: document.getElementById("equipmentAvailable").checked,
      rating: 0,
      reviews: 0,
      distance_km: 0
    };

    if (!equipment.name || !equipment.location ||
        !Number.isFinite(equipment.price_per_day) ||
        equipment.price_per_day <= 0) {
      throw new Error("Please enter a valid name, location and price.");
    }

    // Save the new listing in Supabase.
    const { error: insertError } = await supabaseClient
      .from("equipment")
      .insert(equipment);

    if (insertError) throw insertError;

    message.textContent = "Equipment added successfully!";
    document.getElementById("addEquipmentForm").reset();

    // Refresh both the public listings and owner's equipment table.
    await loadEquipmentData();
    await loadOwnerEquipment({ silent: true }); // table + "Equipment Listed" statistic

    showToast("Equipment added successfully!");
    hideAddEquipmentForm();

  } catch (error) {
    console.error("Add equipment error:", error);
    message.textContent = "Could not save: " + error.message;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

/* ---------------------------------------------------------
   LOGIN STATE HELPERS
--------------------------------------------------------- */
function setWelcomeText(profile) {
  const name = profile && profile.full_name ? profile.full_name : "";
  const text = profile && profile.role === "admin"
    ? "Welcome back :-} Mohit, Soumya and Rahul!"
    : name ? `Welcome back, ${name}!` : "Welcome back!";
  ["dashboardWelcome", "ownerDashboardWelcome", "adminWelcome"].forEach(id => setText(id, text));
}

// The Profile page is shared, so its sidebar must match the user's role.
function updateProfileSidebar(role) {
  const isOwner = role === "owner";
  const farmerNav = document.getElementById("profileNavFarmer");
  const ownerNav = document.getElementById("profileNavOwner");
  if (farmerNav) farmerNav.hidden = isOwner;
  if (ownerNav) ownerNav.hidden = !isOwner;
}

// "List Your Equipment" button in the navbar
function handleListEquipment() {
  if (!currentProfile) {
    showToast("Please log in with an owner account to list equipment.");
    openLoginModal();
    return;
  }
  if (currentProfile.role !== "owner") {
    showToast("Only owner accounts can list equipment.");
    return;
  }
  showPage("ownerDashboard");
  showAddEquipmentForm();
}

// A Supabase session survives a page refresh; this makes the navbar reflect it again.
async function restoreSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  const session = data && data.session;
  if (error || !session) return;

  const { data: profile, error: profileError } = await fetchProfileForUser(session.user);

  if (profileError || !profile) return;

  currentProfile = profile;
  updateNavbarUser(profile);
  setWelcomeText(profile);
}


/* =========================================================
   ADMIN AREA
   Admin status comes from public.admins (see migration 001). The browser only reads it to pick
   a screen; every query below is still authorised by RLS / admin_overview() in the database.
========================================================= */
let adminToken = 0;
let adminCommission = null;   // null = could not be loaded
let adminOverview = null;
const ADMIN_STAT_IDS = ["admFarmers", "admOwners", "admEquipment", "admBookings", "admValue", "admCommission", "admOwnerShare", "admPaidValue"];

async function fetchProfileForUser(user) {
  // 1. Check admins table
  const { data: adminRow } = await supabaseClient
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();

  // 2. Query profile
  const { data: p, error: pError } = await supabaseClient
    .from("profiles").select("full_name, email, phone, address, role").eq("id", user.id).maybeSingle();

  // If in admins table or assigned role 'admin' in profiles
  if (adminRow || (p && p.role === "admin")) {
    return { data: {
      full_name: (p && p.full_name) || user.email,
      email: (p && p.email) || user.email,
      phone: p ? p.phone : null,
      address: p ? p.address : null,
      role: "admin"
    }, error: null };
  }

  if (p) {
    return { data: p, error: null };
  }

  return { data: null, error: pError || new Error("Profile not found") };
}

function showAdminSection(name) {
  document.querySelectorAll(".admin-section").forEach(s => { s.hidden = s.id !== "adminSection-" + name; });
  document.querySelectorAll("#adminNav a[data-section]").forEach(a =>
    a.classList.toggle("active", a.dataset.section === name));
}

function fillBars(id, rows, emptyText) {
  const box = document.getElementById(id);
  if (!box) return;
  if (rows.length === 0) { box.replaceChildren(el("p", "muted-text", emptyText)); return; }
  const max = Math.max(...rows.map(r => r.value));
  box.replaceChildren(...rows.map(r => {
    const row = el("div", "bar-row");
    row.appendChild(el("span", "bar-label", r.label));
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill");
    fill.style.width = (max > 0 && r.value > 0 ? Math.max(r.value / max * 100, 2) : 0) + "%";
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el("span", "bar-value", r.text));
    return row;
  }));
}

function adminMessageRow(text, cols) {
  const row = document.createElement("tr");
  const cell = el("td", "", text);
  cell.colSpan = cols;
  row.appendChild(cell);
  return row;
}

function renderAdminOverview() {
  const d = adminOverview;
  setText("admFarmers", d.farmers ?? "0");
  setText("admOwners", d.owners ?? "0");
  setText("admEquipment", d.equipment ?? "0");
  setText("admBookings", d.bookings ?? "0");

  const value = Number(d.completed_value || 0);
  setText("admValue", formatRupees(value));

  const paid = Number(d.paid_value || 0);
  setText("admPaidValue", formatRupees(paid));

  if (adminCommission === null || adminCommission === undefined) {
    adminCommission = 10; // Default illustrative 10% commission
  }

  const commission = Math.round(value * adminCommission / 100);
  const ownerEarnings = Math.max(value - commission, 0);

  setText("admCommission", formatRupees(commission));
  setText("admOwnerShare", formatRupees(ownerEarnings));
  setText("admCommissionNote", `At ${adminCommission}% platform facilitation fee estimate (assumption based on ${formatRupees(value)} completed rental volume; no real funds processed).`);
  
  const commInput = document.getElementById("commissionInput");
  if (commInput) commInput.value = adminCommission;

  fillBars("admStatusBars", Object.entries(d.by_status || {}).map(([status, n]) => ({
    label: (BOOKING_STATUS[status] || { label: status }).label,
    value: Number(n),
    text: String(n)
  })), "No booking requests recorded yet.");

  fillBars("admMonthlyBars", (d.monthly || []).map(m => ({
    label: m.month,
    value: Number(m.bookings),
    text: `${m.bookings} bookings · ${formatRupees(m.completed_value)} completed`
  })), "No monthly booking activity recorded yet.");

  fillBars("admCategoryBars", (d.by_category || []).map(c => ({
    label: c.category || "Unassigned",
    value: Number(c.bookings),
    text: String(c.bookings)
  })), "No category booking activity recorded yet.");
}

async function loadAdminDashboard() {
  const token = ++adminToken;
  showAdminSection("overview");
  setInlineMessage("adminMessage", "");
  ADMIN_STAT_IDS.forEach(id => setText(id, "…"));

  let overviewData = null;
  const [overview, settings] = await Promise.all([
    supabaseClient.rpc("admin_overview"),
    supabaseClient.from("platform_settings").select("commission_percent").maybeSingle()
  ]);
  if (token !== adminToken) return;

  adminCommission = settings && settings.data ? Number(settings.data.commission_percent) : 10;

  if (!overview.error && overview.data) {
    overviewData = overview.data;
  } else {
    console.warn("admin_overview RPC unavailable or failed. Using direct query fallback:", overview.error);
    // Resilient fallback: compute metrics directly from tables
    try {
      const [profilesRes, equipRes, bookingsRes] = await Promise.all([
        supabaseClient.from("profiles").select("id, role"),
        supabaseClient.from("equipment").select("id, name, category"),
        supabaseClient.from("booking_requests").select("id, equipment_name, total_amount, status, created_at, payment_status")
      ]);

      if (profilesRes.data && equipRes.data && bookingsRes.data) {
        const profiles = profilesRes.data;
        const equipment = equipRes.data;
        const bookings = bookingsRes.data;

        const byStatus = {};
        let completedVal = 0;
        let paidVal = 0;
        const monthlyMap = {};
        const catMap = {};

        const nameToCat = {};
        equipment.forEach(e => { if (e.name) nameToCat[e.name] = e.category || "Unassigned"; });

        bookings.forEach(b => {
          const st = b.status || "unknown";
          byStatus[st] = (byStatus[st] || 0) + 1;
          const amt = Number(b.total_amount || 0);
          if (st === "completed") completedVal += amt;
          if (getPaymentStatus(b) === "paid") paidVal += amt;

          const m = b.created_at ? b.created_at.slice(0, 7) : "Unknown";
          if (!monthlyMap[m]) monthlyMap[m] = { month: m, bookings: 0, completed_value: 0 };
          monthlyMap[m].bookings++;
          if (st === "completed") monthlyMap[m].completed_value += amt;

          const cat = nameToCat[b.equipment_name] || "Other / Unassigned";
          catMap[cat] = (catMap[cat] || 0) + 1;
        });

        overviewData = {
          farmers: profiles.filter(p => p.role === "farmer").length,
          owners: profiles.filter(p => p.role === "owner").length,
          equipment: equipment.length,
          bookings: bookings.length,
          by_status: byStatus,
          monthly: Object.values(monthlyMap).sort((a,b) => a.month.localeCompare(b.month)),
          by_category: Object.entries(catMap).map(([category, count]) => ({ category, bookings: count })),
          completed_value: completedVal,
          paid_value: paidVal
        };
      }
    } catch (fallbackErr) {
      console.error("Direct table aggregation fallback error:", fallbackErr);
    }
  }

  if (!overviewData) {
    ADMIN_STAT_IDS.forEach(id => setText(id, "—"));
    setInlineMessage("adminMessage",
      "Could not load admin data. Please verify your admin privileges and apply migration 001 in the Supabase SQL Editor.", "error");
    ["admStatusBars", "admMonthlyBars", "admCategoryBars"].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.replaceChildren(el("p", "muted-text", "Data unavailable."));
    });
    return;
  }

  adminOverview = overviewData;
  renderAdminOverview();
  loadAdminUsersAndEquipment(token);
}

async function loadAdminUsersAndEquipment(token) {
  const userBody = document.getElementById("admUserRows");
  const equipBody = document.getElementById("admEquipmentRows");

  const [users, equipment] = await Promise.all([
    supabaseClient.from("profiles").select("id, full_name, email, phone, role").order("full_name").limit(200),
    supabaseClient.from("equipment").select("id, name, category, price_per_day, available, owner_id").order("id", { ascending: false }).limit(200)
  ]);
  if (token !== adminToken) return;

  if (users.error) {
    console.error("Admin users error:", users.error);
    userBody.replaceChildren(adminMessageRow("Could not load users.", 4));
  } else if (!users.data.length) {
    userBody.replaceChildren(adminMessageRow("No users registered yet.", 4));
  } else {
    userBody.replaceChildren(...users.data.map(u => {
      const tr = document.createElement("tr");
      [u.full_name, u.email, u.phone, u.role].forEach(t => tr.appendChild(el("td", "", t || "—")));
      return tr;
    }));
  }

  if (equipment.error) {
    console.error("Admin equipment error:", equipment.error);
    equipBody.replaceChildren(adminMessageRow("Could not load equipment.", 5));
  } else if (!equipment.data.length) {
    equipBody.replaceChildren(adminMessageRow("No equipment listed yet.", 5));
  } else {
    const owners = {};
    (users.data || []).forEach(u => { owners[u.id] = u.full_name; });
    equipBody.replaceChildren(...equipment.data.map(item => {
      const tr = document.createElement("tr");
      tr.appendChild(el("td", "", item.name));
      tr.appendChild(el("td", "", item.category));
      tr.appendChild(el("td", "", owners[item.owner_id] || "Unknown Owner"));
      tr.appendChild(el("td", "", formatRupees(item.price_per_day)));
      const status = document.createElement("td");
      status.appendChild(el("span", "status-badge " + (item.available ? "status-confirmed" : "status-completed"),
        item.available ? "Available" : "Unavailable"));
      tr.appendChild(status);
      return tr;
    }));
  }
}

async function saveCommission() {
  const button = document.getElementById("commissionSaveBtn");
  const value = Number(document.getElementById("commissionInput").value);
  if (!Number.isFinite(value) || value < 0 || value > 30) {
    setInlineMessage("commissionMessage", "Enter a valid percentage between 0 and 30.", "error");
    return;
  }
  button.disabled = true;
  setInlineMessage("commissionMessage", "");
  try {
    const { data, error } = await supabaseClient
      .from("platform_settings").update({ commission_percent: value }).eq("id", true).select("commission_percent");
    if (error) {
      adminCommission = value;
      if (adminOverview) renderAdminOverview();
      setInlineMessage("commissionMessage", `Commission set to ${value}% for current session (Run migration 001 for DB persistence).`, "success");
    } else {
      adminCommission = Number(data[0].commission_percent);
      if (adminOverview) renderAdminOverview();
      setInlineMessage("commissionMessage", `Commission updated to ${adminCommission}%. Estimates recalculated.`, "success");
    }
  } catch (error) {
    console.error("Commission save error:", error);
    adminCommission = value;
    if (adminOverview) renderAdminOverview();
    setInlineMessage("commissionMessage", `Commission set to ${value}% for this session.`, "success");
  } finally {
    button.disabled = false;
  }
}

function resetAdminViews() {
  adminToken++;
  adminOverview = null;
  adminCommission = null;
  ["admUserRows", "admEquipmentRows", "admStatusBars", "admMonthlyBars", "admCategoryBars"].forEach(id => {
    const node = document.getElementById(id);
    if (node) node.replaceChildren();
  });
  setInlineMessage("adminMessage", "");
}

/* =========================================================
   DEMO PAYMENT & RECEIPT IMPLEMENTATION
========================================================= */

function openDemoPaymentModal(booking) {
  if (!booking) {
    showToast("No booking selected for checkout.");
    return;
  }
  currentCheckoutBooking = booking;

  const start = new Date(booking.start_date);
  const end = new Date(booking.end_date);
  let days = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (days < 1) days = 1;

  const total = Number(booking.total_amount || 0);
  const subtotal = Math.max(total - SERVICE_FEE, 0);
  const dailyRate = Math.round(subtotal / days);

  const summary = document.getElementById("paymentCheckoutSummary");
  if (summary) {
    summary.innerHTML = `
      <div class="checkout-equip-row">
        <img src="${escapeHTML(booking.equipment_image || 'https://images.unsplash.com/photo-1655130944276-496518f92f98?auto=format&fit=crop&w=200&q=80')}" alt="${escapeHTML(booking.equipment_name)}" class="checkout-thumb" />
        <div class="checkout-meta">
          <h3>${escapeHTML(booking.equipment_name)}</h3>
          <p>${formatDisplayDate(booking.start_date)} → ${formatDisplayDate(booking.end_date)} (${days} day${days > 1 ? 's' : ''})</p>
        </div>
      </div>
      <table class="checkout-calc-table">
        <tr>
          <td>Equipment Rental (${formatRupees(dailyRate)} × ${days} day${days > 1 ? 's' : ''})</td>
          <td style="text-align:right;">${formatRupees(subtotal)}</td>
        </tr>
        <tr>
          <td>Platform Service Fee (Flat)</td>
          <td style="text-align:right;">${formatRupees(SERVICE_FEE)}</td>
        </tr>
        <tr class="calc-total">
          <td>Total Amount Due</td>
          <td style="text-align:right;">${formatRupees(total)}</td>
        </tr>
      </table>
    `;
  }

  const proc = document.getElementById("paymentProcessingState");
  if (proc) proc.style.display = "none";
  const fail = document.getElementById("paymentFailureAlert");
  if (fail) fail.style.display = "none";

  const btnSuccess = document.getElementById("btnSimulateSuccess");
  if (btnSuccess) {
    btnSuccess.disabled = false;
    btnSuccess.innerHTML = `<i class="fa-solid fa-circle-check"></i> Simulate Payment Success (${formatRupees(total)})`;
  }
  const btnFail = document.getElementById("btnSimulateFail");
  if (btnFail) btnFail.disabled = false;

  handlePaymentMethodChange("demo_upi");

  const overlay = document.getElementById("demoPaymentModalOverlay");
  if (overlay) overlay.classList.add("open");
}

function openDemoPaymentForLatestBooking() {
  if (latestCreatedBooking) {
    openDemoPaymentModal(latestCreatedBooking);
  } else if (farmerBookingsData.length > 0) {
    openDemoPaymentModal(farmerBookingsData[0]);
  } else {
    showToast("No recent booking available for checkout.");
  }
}

function openDemoPaymentById(bookingId) {
  const b = farmerBookingsData.find(item => String(item.id) === String(bookingId));
  if (b) {
    openDemoPaymentModal(b);
  } else {
    supabaseClient.from("booking_requests").select("*").eq("id", bookingId).single()
      .then(({ data }) => {
        if (data) openDemoPaymentModal(data);
        else showToast("Booking not found.");
      })
      .catch(() => showToast("Could not load booking details."));
  }
}

function handlePaymentMethodChange(method) {
  document.querySelectorAll(".payment-option").forEach(opt => {
    const radio = opt.querySelector('input[type="radio"]');
    opt.classList.toggle("active", radio && radio.value === method);
  });

  const pUPI = document.getElementById("previewUPI");
  const pCard = document.getElementById("previewCard");
  const pCOD = document.getElementById("previewCOD");
  if (pUPI) pUPI.style.display = method === "demo_upi" ? "block" : "none";
  if (pCard) pCard.style.display = method === "demo_card" ? "block" : "none";
  if (pCOD) pCOD.style.display = method === "demo_cod" ? "block" : "none";
}


async function sendFarmRentEmail(bookingId, event) {
  const { data, error } = await supabaseClient.functions.invoke(
    "send-farmrent-email",
    {
      body: {
        booking_id: bookingId,
        event: event
      }
    }
  );

  if (error) throw error;

  if (!data?.success) {
    throw new Error(data?.error || "Email could not be sent.");
  }

  return data;
}


// PASTE THE NEW HELPER HERE
async function notifyApprovedBookings(bookings) {
  for (const booking of bookings || []) {
    if (booking.status !== "approved") continue;

    const storageKey = "farmrent_booking_email_sent_" + booking.id;

    if (localStorage.getItem(storageKey) === "yes") continue;

    try {
    const result = await sendFarmRentEmail(booking.id, "booking_confirmed");

    if (!result.in_progress) {
        localStorage.setItem(storageKey, "yes");
    }

    console.log("Booking confirmation email sent:", booking.id);
} catch (error) {
    console.error("Booking confirmation email error:", error);
}
  }
}


async function executeDemoPayment(simulateSuccess) {
  if (!currentCheckoutBooking) return;

  const booking = currentCheckoutBooking;
  const btnSuccess = document.getElementById("btnSimulateSuccess");
  const btnFail = document.getElementById("btnSimulateFail");
  const proc = document.getElementById("paymentProcessingState");
  const failAlert = document.getElementById("paymentFailureAlert");

  if (btnSuccess) btnSuccess.disabled = true;
  if (btnFail) btnFail.disabled = true;
  if (failAlert) failAlert.style.display = "none";

  if (proc) {
    proc.style.display = "flex";
    setText("paymentProcessingText", "Simulating payment gateway authorization...");
  }

  const methodRadio = document.querySelector('input[name="demoPayMethod"]:checked');
  const method = methodRadio ? methodRadio.value : "demo_upi";

  try {
    await new Promise(resolve => setTimeout(resolve, 700));

    const { data, error } = await supabaseClient.rpc("record_demo_payment", {
      p_booking_id: booking.id,
      p_payment_method: method,
      p_simulate_success: simulateSuccess
    });

    if (error) throw error;

    if (simulateSuccess) {
      if (!data?.success || data.payment_status !== "paid") {
        throw new Error("Supabase did not confirm the payment.");
      }

      const record = {
        bookingId: booking.id,
        equipmentName: booking.equipment_name,
        startDate: booking.start_date,
        endDate: booking.end_date,
        totalAmount: data.total_amount ?? booking.total_amount,
        paymentMethod: data.payment_method ?? method,
        status: "paid",
        txnId: data.transaction_ref,
        rcptId: data.receipt_id,
        paidAt: data.paid_at
      };

      saveLocalDemoPayment(booking.id, record);
      closeDemoPaymentModal();

      showToast("Demo payment recorded successfully. No real money was charged.");

      if (document.getElementById("page-dashboard")?.classList.contains("active")) {
        await loadFarmerDashboard();
      }

      if (document.getElementById("page-bookingRequests")?.classList.contains("active")) {
        await loadBookingRequests({ silent: true });
      }

      openDemoReceipt(booking.id);

      try {
        await sendFarmRentEmail(booking.id, "payment_success");
        console.log("Payment confirmation email sent.");
      } catch (emailError) {
        console.error("Payment email error:", emailError);
        showToast("Payment recorded, but confirmation email could not be sent.");
      }

    } else {
      if (data?.payment_status !== "failed") {
        throw new Error("The server did not confirm the simulated failure.");
      }

      saveLocalDemoPayment(booking.id, {
        bookingId: booking.id,
        status: "failed",
        failedAt: new Date().toISOString()
      });

      if (failAlert) {
        failAlert.style.display = "flex";
        setText(
          "paymentFailureReason",
          "Simulated gateway decline. No real money was charged."
        );
      }

      if (document.getElementById("page-dashboard")?.classList.contains("active")) {
        await loadFarmerDashboard();
      }
    }

  } catch (error) {
    console.error("Demo payment error:", error);

    showToast(
      "Payment could not be confirmed. Please try again."
    );

    if (btnSuccess) btnSuccess.disabled = false;
    if (btnFail) btnFail.disabled = false;

  } finally {
    if (proc) proc.style.display = "none";
  }
}


function closeDemoPaymentModal(event) {
  const overlay = document.getElementById("demoPaymentModalOverlay");
  if (overlay) overlay.classList.remove("open");
  currentCheckoutBooking = null;
}

function openDemoReceipt(bookingId) {
  const rec = getLocalDemoPayments()[bookingId] || {};
  let booking = farmerBookingsData.find(b => String(b.id) === String(bookingId))
                || (currentCheckoutBooking && String(currentCheckoutBooking.id) === String(bookingId) ? currentCheckoutBooking : null);

  const startVal = (booking && booking.start_date) || rec.startDate || new Date().toISOString().slice(0, 10);
  const endVal = (booking && booking.end_date) || rec.endDate || startVal;
  const start = new Date(startVal);
  const end = new Date(endVal);
  let days = Math.round((end - start) / (1000 * 60 * 60 * 24));
  if (days < 1) days = 1;

  const total = Number((booking && booking.total_amount) || rec.totalAmount || 0);
  const subtotal = Math.max(total - SERVICE_FEE, 0);
  const dailyRate = Math.round(subtotal / days);
  const equipName = (booking && booking.equipment_name) || rec.equipmentName || "Farm Equipment";

  setText("rcptNumber", rec.rcptId || ("FR-REC-" + new Date().getFullYear() + "-08412"));
  setText("rcptDate", rec.paidAt ? new Date(rec.paidAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN"));
  setText("rcptBookingRef", "FR-" + new Date().getFullYear() + "-" + String(bookingId).replace(/-/g, "").slice(0, 8).toUpperCase().padStart(5, "0"));
  setText("rcptTxnId", rec.txnId || ("TXN-DEMO-SIM-" + String(bookingId).slice(0, 6).toUpperCase()));
  setText("rcptFarmerName", currentProfile?.full_name || "Valued Farmer");
  setText("rcptFarmerPhone", currentProfile?.phone ? ("+91 " + currentProfile.phone) : "+91 98765 43210");

  const methodMap = {
    demo_upi: "Demo UPI (Simulated)",
    demo_card: "Demo Card / NetBanking (Sandbox)",
    demo_cod: "Demo Pay on Delivery"
  };
  setText("rcptPaymentMode", methodMap[rec.paymentMethod] || "Demo Simulation");

  const itemsTable = document.getElementById("rcptItemsTable");
  if (itemsTable) {
    itemsTable.innerHTML = `
      <tr>
        <td><strong>${escapeHTML(equipName)}</strong><br><small class="muted-text">Agricultural Equipment Rental</small></td>
        <td>${days} Day${days > 1 ? "s" : ""}</td>
        <td>${formatRupees(dailyRate)} / day</td>
        <td style="text-align:right;">${formatRupees(subtotal)}</td>
      </tr>
      <tr>
        <td><strong>FarmRent Platform Service Fee</strong><br><small class="muted-text">Standard booking facilitation & equipment insurance cover</small></td>
        <td>Fixed</td>
        <td>${formatRupees(SERVICE_FEE)}</td>
        <td style="text-align:right;">${formatRupees(SERVICE_FEE)}</td>
      </tr>
    `;
  }

  setText("rcptSubtotal", formatRupees(subtotal));
  setText("rcptServiceFee", formatRupees(SERVICE_FEE));
  setText("rcptTotalPaid", formatRupees(total));

  const overlay = document.getElementById("demoReceiptModalOverlay");
  if (overlay) overlay.classList.add("open");
}

function closeDemoReceiptModal(event) {
  const overlay = document.getElementById("demoReceiptModalOverlay");
  if (overlay) overlay.classList.remove("open");
}

function printReceipt() {
  window.print();
}

/* =========================================================
   FARMER DASHBOARD IMPLEMENTATION (Dynamic Supabase)
========================================================= */


async function loadFarmerDashboard() {
  const token = ++farmerDashboardToken;
  setInlineMessage("farmerDashboardMessage", "");

  const user = await getCurrentUser();
  if (token !== farmerDashboardToken) return;

  if (!user) {
    setInlineMessage(
      "farmerDashboardMessage",
      "Please log in as a farmer to view your dashboard.",
      "error"
    );
    return;
  }

  const { data: bookings, error } = await supabaseClient
    .from("booking_requests")
    .select("*")
    .eq("farmer_id", user.id)
    .order("created_at", { ascending: false });

  if (token !== farmerDashboardToken) return;

  if (error) {
    console.error("Farmer bookings error:", error);
    setInlineMessage(
      "farmerDashboardMessage",
      "Could not load bookings from database.",
      "error"
    );
    return;
  }

  farmerBookingsData = bookings || [];

  // Send confirmation emails for newly approved bookings
  await notifyApprovedBookings(farmerBookingsData);

  renderFarmerDashboardStats();
  renderFarmerUpcomingBooking();
  renderFarmerRentalsTable("all");
}


function renderFarmerDashboardStats() {
  const bookings = farmerBookingsData;
  const pending = bookings.filter(b => b.status === "pending").length;
  const approved = bookings.filter(b => b.status === "approved").length;
  const completed = bookings.filter(b => b.status === "completed").length;

  let totalPaid = 0;
  bookings.forEach(b => {
    if (getPaymentStatus(b) === "paid") {
      totalPaid += Number(b.total_amount || 0);
    }
  });

  setText("farmerActiveRentals", pending);
  setText("farmerUpcomingRentals", approved);
  setText("farmerCompletedRentals", completed);
  setText("farmerTotalSpent", formatRupees(totalPaid));
}

function renderFarmerUpcomingBooking() {
  const container = document.getElementById("farmerUpcomingContainer");
  if (!container) return;

  const upcoming = farmerBookingsData.find(b => b.status === "approved") || farmerBookingsData.find(b => b.status === "pending");

  if (!upcoming) {
    container.innerHTML = `
      <div class="upcoming-booking-card" style="align-items:center;">
        <div class="upcoming-booking-info">
          <h3>No Active or Upcoming Bookings</h3>
          <p class="muted-text">You haven't requested any farm machinery yet. Explore nearby listings to get started.</p>
        </div>
        <button class="btn btn-primary" onclick="showPage('listing')">Browse Equipment</button>
      </div>
    `;
    return;
  }

  const pStatus = getPaymentStatus(upcoming);
  const actionBtnHtml = pStatus === "paid"
    ? `<button class="btn btn-outline" onclick="openDemoReceipt('${upcoming.id}')"><i class="fa-solid fa-receipt"></i> View Demo Receipt</button>`
    : `<button class="btn btn-primary" onclick="openDemoPaymentById('${upcoming.id}')"><i class="fa-solid fa-credit-card"></i> Pay Now (Demo)</button>`;

  container.innerHTML = `
    <div class="upcoming-booking-card">
      <img src="${escapeHTML(upcoming.equipment_image || 'https://images.unsplash.com/photo-1655130944276-496518f92f98?auto=format&fit=crop&w=200&q=80')}" alt="${escapeHTML(upcoming.equipment_name)}" />
      <div class="upcoming-booking-info">
        <h3>${escapeHTML(upcoming.equipment_name)}</h3>
        <p>${formatDisplayDate(upcoming.start_date)} – ${formatDisplayDate(upcoming.end_date)} &nbsp;•&nbsp; <strong>${formatRupees(upcoming.total_amount)}</strong></p>
        <div style="display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;">
          ${createStatusBadge(upcoming.status).outerHTML}
          ${createPaymentBadge(pStatus).outerHTML}
        </div>
      </div>
      ${actionBtnHtml}
    </div>
  `;
}

function renderFarmerRentalsTable(filter) {
  const tbody = document.getElementById("farmerRentalsTable");
  if (!tbody) return;

  let list = farmerBookingsData;
  if (filter && filter !== "all") {
    if (filter === "unpaid") {
      list = list.filter(b => getPaymentStatus(b) !== "paid");
    } else if (filter === "paid") {
      list = list.filter(b => getPaymentStatus(b) === "paid");
    } else {
      list = list.filter(b => b.status === filter);
    }
  }

  if (list.length === 0) {
    tbody.replaceChildren(adminMessageRow(
      farmerBookingsData.length === 0
        ? "No bookings placed yet. Visit Browse Equipment to reserve farm machinery."
        : "No bookings match this filter.", 7));
    return;
  }

  tbody.replaceChildren(...list.map(b => {
    const tr = document.createElement("tr");

    tr.appendChild(el("td", "", b.equipment_name || "Equipment"));
    tr.appendChild(el("td", "", `${formatDisplayDate(b.start_date)} → ${formatDisplayDate(b.end_date)}`));

    const s = new Date(b.start_date);
    const e = new Date(b.end_date);
    const days = Math.max(Math.round((e - s) / (1000 * 60 * 60 * 24)), 1);
    tr.appendChild(el("td", "", `${days} Day${days > 1 ? "s" : ""}`));

    tr.appendChild(el("td", "", formatRupees(b.total_amount)));

    const statusTd = document.createElement("td");
    statusTd.appendChild(createStatusBadge(b.status));
    tr.appendChild(statusTd);

    const pStatus = getPaymentStatus(b);
    const payTd = document.createElement("td");
    payTd.appendChild(createPaymentBadge(pStatus));
    tr.appendChild(payTd);

    const actionTd = document.createElement("td");
    if (pStatus === "paid") {
      const btn = el("button", "btn btn-outline table-action-btn", "Demo Receipt");
      btn.type = "button";
      btn.addEventListener("click", () => openDemoReceipt(b.id));
      actionTd.appendChild(btn);
    } else {
      const btn = el("button", "btn btn-primary table-action-btn", "Pay Now (Demo)");
      btn.type = "button";
      btn.addEventListener("click", () => openDemoPaymentById(b.id));
      actionTd.appendChild(btn);
    }
    tr.appendChild(actionTd);

    return tr;
  }));
}

function showFarmerSection(section) {
  const over = document.getElementById("farmerSub-overview");
  const book = document.getElementById("farmerSub-bookings");
  if (section === "overview") {
    if (over) over.style.display = "block";
    if (book) book.style.display = "none";
  } else if (section === "bookings") {
    if (over) over.style.display = "none";
    if (book) book.style.display = "block";
    filterFarmerRentals("all");
  } else if (section === "payments") {
    if (over) over.style.display = "none";
    if (book) book.style.display = "block";
    filterFarmerRentals("paid");
  }

  document.querySelectorAll("#farmerNav a[data-farmer-section]").forEach(a => {
    a.classList.toggle("active", a.dataset.farmerSection === section);
  });
}

function filterFarmerRentals(statusFilter, btnElement) {
  if (btnElement) {
    document.querySelectorAll("#farmerFilterPills .pill").forEach(p => p.classList.remove("active"));
    btnElement.classList.add("active");
  }
  renderFarmerRentalsTable(statusFilter);
}

function resetFarmerViews() {
  farmerDashboardToken++;
  farmerBookingsData = [];
  ["farmerActiveRentals", "farmerUpcomingRentals", "farmerCompletedRentals", "farmerTotalSpent"].forEach(id => setText(id, "—"));
  const up = document.getElementById("farmerUpcomingContainer");
  if (up) up.replaceChildren();
  const tbl = document.getElementById("farmerRentalsTable");
  if (tbl) tbl.replaceChildren();
}

/* ---------------------------------------------------------
   INITIALISE PAGE ON LOAD
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    loadEquipmentData();
    updatePriceLabel();
    restoreSession();
});