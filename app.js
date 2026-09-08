const CURRENT_VERSION = "1.0";
const STORAGE_KEY = "postr_notes_db";
let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let swRegistration = null;
let audioCtx = null;

const PASTEL_MAP = {
  School: "#b2d8d8",
  Work: "#d4b8e5",
  Shopping: "#f8c8dc",
  Personal: "#fde49e",
  Tasks: "#b5ead7"
};

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

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
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
}

document.getElementById("btn-notify-perm").addEventListener("click", async () => {
  initAudio();
  if ("Notification" in window) {
    const perm = await Notification.requestPermission();
    updateNotifyButton();
    if (perm === "granted") {
      triggerNotification("Postr Enabled", "Lock screen pings and custom intervals active.");
    }
  }
});

function triggerNotification(title, body, tag) {
  triggerHapticPing();

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "TRIGGER_NOTIFICATION",
      title: title,
      body: body,
      tag: tag
    });
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: body, tag: tag });
  }
}

function triggerHapticPing() {
  initAudio();
  try {
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }
  } catch (e) {}

  if ("vibrate" in navigator) {
    navigator.vibrate([100, 50, 100]);
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

  cardList.innerHTML = "";

  if (reminders.length === 0) {
    emptyState.style.display = "flex";
    islandPill.classList.remove("active");
    islandText.innerText = "POSTR IDLE";
  } else {
    emptyState.style.display = "none";
    islandPill.classList.add("active");
    islandText.innerText = `${reminders.length} PINNED`;

    reminders.forEach(item => {
      const card = document.createElement("div");
      card.className = "card";
      card.setAttribute("data-id", item.id);

      let pingLabel = "";
      if (item.pingMinutes > 0) {
        if (item.pingMinutes >= 60 && item.pingMinutes % 60 === 0) {
          pingLabel = `PING: EVERY ${item.pingMinutes / 60}H`;
        } else {
          pingLabel = `PING: EVERY ${item.pingMinutes}M`;
        }
      }

      const labelColor = PASTEL_MAP[item.label] || "#e0e0e0";

      card.innerHTML = `
        <div class="card-content">
          <h3>${escapeHtml(item.title)}</h3>
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          <div class="card-tags-row">
            ${item.label ? `<span class="pastel-tag" style="background-color: ${labelColor};">${escapeHtml(item.label)}</span>` : ""}
            ${pingLabel ? `<span class="card-meta">${pingLabel}</span>` : ""}
          </div>
        </div>
        <button class="btn-complete" title="Mark Done" onclick="completeReminder('${item.id}')" aria-label="Mark Done">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      `;
      cardList.appendChild(card);
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
  initAudio();
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

function openModal(modalId) {
  initAudio();
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

setInterval(() => {
  const now = Date.now();
  reminders.forEach(item => {
    if (item.pingMinutes > 0) {
      const intervalMs = item.pingMinutes * 60 * 1000;
      if (now - item.lastPing >= intervalMs) {
        item.lastPing = now;
        triggerNotification(`POSTR: ${item.title}`, item.body || "Sticky note is still active on lock screen.", item.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      }
    }
  });
}, 3000);

const customTimeRow = document.getElementById("custom-time-row");
document.querySelectorAll('input[name="pingPreset"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      customTimeRow.classList.remove("hidden");
    } else {
      customTimeRow.classList.add("hidden");
    }
  });
});

document.getElementById("btn-add").addEventListener("click", () => {
  document.getElementById("modal-title").innerText = "NEW REMINDER";
  openModal("splash-modal");
  document.getElementById("input-title").focus();
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

// Logo Click -> Open Version Screen
document.getElementById("btn-logo").addEventListener("click", () => {
  openModal("version-modal");
  triggerHapticPing();
});

document.getElementById("btn-close-version").addEventListener("click", () => {
  closeModal("version-modal");
});

// Form Submit
document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();
  initAudio();

  const title = document.getElementById("input-title").value.trim();
  const body = document.getElementById("input-body").value.trim();
  const selectedPreset = document.querySelector('input[name="pingPreset"]:checked').value;
  const selectedLabel = document.querySelector('input[name="noteLabel"]:checked').value;

  let finalMinutes = 0;
  if (selectedPreset === "custom") {
    const val = parseInt(document.getElementById("custom-val").value, 10) || 1;
    const unit = document.getElementById("custom-unit").value;
    finalMinutes = (unit === "h") ? (val * 60) : val;
  } else {
    finalMinutes = parseInt(selectedPreset, 10);
  }

  if (!title) return;

  const newReminder = {
    id: "postr_" + Date.now(),
    title,
    body,
    label: selectedLabel,
    pingMinutes: finalMinutes,
    createdAt: Date.now(),
    lastPing: Date.now()
  };

  reminders.unshift(newReminder);
  persistAndSync();
  triggerNotification(`Pinned: ${title}`, body || "Active reminder posted.", newReminder.id);

  document.getElementById("input-title").value = "";
  document.getElementById("input-body").value = "";
  document.getElementById("p0").checked = true;
  customTimeRow.classList.add("hidden");
  closeModal("splash-modal");
});

// Carousel Logic
let currentSlide = 0;
const totalSlides = 4;
const track = document.querySelector(".carousel-slides");
const dots = document.querySelectorAll(".carousel-dots .dot");
let startX = 0;
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
  const threshold = 40;
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

document.addEventListener("click", initAudio, { once: true });
updateNotifyButton();
render();
