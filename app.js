const STORAGE_KEY = "postr_notes_db";
let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let swRegistration = null;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then((reg) => { swRegistration = reg; })
    .catch((err) => console.log("SW error:", err));
}

function updateNotifyButton() {
  const btn = document.getElementById("btn-notify-perm");
  if (!("Notification" in window)) {
    btn.style.display = "none";
    return;
  }
  if (Notification.permission === "granted") {
    btn.innerText = "🔔✓";
    btn.style.background = "#1f0505";
    btn.style.color = "#ff3b30";
  } else {
    btn.innerText = "🔔";
  }
}

document.getElementById("btn-notify-perm").addEventListener("click", async () => {
  if ("Notification" in window) {
    const perm = await Notification.requestPermission();
    updateNotifyButton();
    if (perm === "granted") {
      triggerNotification("Postr Enabled", "Lock screen pings are active.");
    }
  }
});

function triggerNotification(title, body) {
  triggerHapticPing();
  if ("Notification" in window && Notification.permission === "granted") {
    if (swRegistration) {
      swRegistration.showNotification(title, {
        body: body,
        icon: "manifest.json",
        requireInteraction: true
      });
    } else {
      new Notification(title, { body: body });
    }
  }
}

function triggerHapticPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}

  if ("vibrate" in navigator) {
    navigator.vibrate([80, 40, 80]);
  }
}

function persistAndSync() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  render();
}

function render() {
  const cardList = document.getElementById("card-list");
  const emptyState = document.getElementById("empty-state");
  const islandPill = document.getElementById("dynamic-island");
  const islandText = document.getElementById("island-text");
  const liveBar = document.getElementById("live-activity-bar");
  const liveCount = document.getElementById("live-count");
  const liveItems = document.getElementById("live-items");

  cardList.innerHTML = "";
  liveItems.innerHTML = "";

  if (reminders.length === 0) {
    emptyState.style.display = "flex";
    islandPill.classList.remove("active");
    islandText.innerText = "POSTR IDLE";
    liveBar.classList.add("hidden");
  } else {
    emptyState.style.display = "none";
    islandPill.classList.add("active");
    islandText.innerText = `${reminders.length} PINNED`;
    liveBar.classList.remove("hidden");
    liveCount.innerText = `${reminders.length} ITEMS`;

    reminders.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-id", item.id);
      card.innerHTML = `
        <div class="card-content">
          <h3>${escapeHtml(item.title)}</h3>
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          ${item.ping > 0 ? `<div class="card-meta">PING: EVERY ${item.ping}M</div>` : ""}
        </div>
        <button class="btn-complete" title="Mark Done" onclick="completeReminder('${item.id}')">✓</button>
      `;
      cardList.appendChild(card);

      const liveRow = document.createElement("div");
      liveRow.className = "live-row";
      liveRow.innerHTML = `
        <span>${escapeHtml(item.title)}</span>
        <button onclick="completeReminder('${item.id}')">DONE</button>
      `;
      liveItems.appendChild(liveRow);
    });
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function completeReminder(id) {
  const cardElement = document.querySelector(`[data-id="${id}"]`);
  if (cardElement) {
    cardElement.classList.add("dismissing");
    setTimeout(() => {
      reminders = reminders.filter(r => r.id !== id);
      triggerHapticPing();
      persistAndSync();
    }, 280);
  } else {
    reminders = reminders.filter(r => r.id !== id);
    triggerHapticPing();
    persistAndSync();
  }
}

// Fade Out Helper for Modals
function openModal(modalId) {
  const el = document.getElementById(modalId);
  el.classList.remove("hidden", "closing");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  el.classList.add("closing");
  setTimeout(() => {
    el.classList.add("hidden");
    el.classList.remove("closing");
  }, 260);
}

// Recurring Ping Loop
setInterval(() => {
  const now = Date.now();
  reminders.forEach(item => {
    if (item.ping > 0) {
      const intervalMs = item.ping * 60 * 1000;
      if (now - item.lastPing >= intervalMs) {
        item.lastPing = now;
        triggerNotification(`POSTR: ${item.title}`, item.body || "Reminder still active.");
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      }
    }
  });
}, 5000);

// Buttons & Modals
document.getElementById("btn-add").addEventListener("click", () => {
  document.getElementById("modal-title").innerText = "NEW REMINDER";
  openModal("splash-modal");
  document.getElementById("input-title").focus();
});

document.getElementById("btn-backtap").addEventListener("click", () => {
  document.getElementById("modal-title").innerText = "QUICK PIN (BACK TAP)";
  openModal("splash-modal");
  document.getElementById("input-title").focus();
  triggerHapticPing();
});

document.getElementById("btn-close-modal").addEventListener("click", () => {
  closeModal("splash-modal");
});

document.getElementById("btn-tips").addEventListener("click", () => {
  currentSlide = 0;
  updateCarousel();
  openModal("tips-modal");
});

document.getElementById("btn-close-tips").addEventListener("click", () => {
  closeModal("tips-modal");
});

// Form Submission
document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("input-title").value.trim();
  const body = document.getElementById("input-body").value.trim();
  const pingVal = parseInt(document.querySelector('input[name="ping"]:checked').value, 10);

  if (!title) return;

  const newReminder = {
    id: "postr_" + Date.now(),
    title,
    body,
    ping: pingVal,
    createdAt: Date.now(),
    lastPing: Date.now()
  };

  reminders.unshift(newReminder);
  persistAndSync();
  triggerNotification(`Pinned: ${title}`, body || "Added to active list.");

  document.getElementById("input-title").value = "";
  document.getElementById("input-body").value = "";
  document.getElementById("p0").checked = true;
  closeModal("splash-modal");
});

// --- Swipeable Tips Carousel Logic (Touch & Mouse Drag) ---
let currentSlide = 0;
const totalSlides = 4;
const track = document.querySelector(".carousel-slides");
const dots = document.querySelectorAll(".carousel-dots .dot");
let startX = 0;
let currentX = 0;
let isDragging = false;

function updateCarousel() {
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentSlide);
  });
}

dots.forEach(dot => {
  dot.addEventListener("click", (e) => {
    currentSlide = parseInt(e.target.dataset.index, 10);
    updateCarousel();
  });
});

const viewport = document.getElementById("carousel-track");

// Touch Events
viewport.addEventListener("touchstart", (e) => {
  startX = e.touches[0].clientX;
  isDragging = true;
});

viewport.addEventListener("touchend", (e) => {
  if (!isDragging) return;
  const diffX = e.changedTouches[0].clientX - startX;
  handleSwipe(diffX);
  isDragging = false;
});

// Mouse Events for Desktop Testing
viewport.addEventListener("mousedown", (e) => {
  startX = e.clientX;
  isDragging = true;
});

viewport.addEventListener("mouseup", (e) => {
  if (!isDragging) return;
  const diffX = e.clientX - startX;
  handleSwipe(diffX);
  isDragging = false;
});

function handleSwipe(diffX) {
  const threshold = 40; // minimum pixels to count as swipe
  if (diffX < -threshold && currentSlide < totalSlides - 1) {
    currentSlide++;
    updateCarousel();
    triggerHapticPing();
  } else if (diffX > threshold && currentSlide > 0) {
    currentSlide--;
    updateCarousel();
    triggerHapticPing();
  }
}

updateNotifyButton();
render();