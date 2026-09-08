const CURRENT_VERSION = "1.5";
const STORAGE_KEY = "postr_notes_db";
let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let swRegistration = null;
let audioCtx = null;
let activeSelectedLabel = null;

const PASTEL_MAP = {
  School: "#b2d8d8",
  Work: "#d4b8e5",
  Shopping: "#f8c8dc",
  Personal: "#fde49e",
  Tasks: "#b5ead7"
};

function setupDynamicAppIcon() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 512, 115);
    ctx.fill();

    ctx.strokeStyle = "#1c1c1c";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 496, 107);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 340px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", 236, 276);

    ctx.fillStyle = "#ff3b30";
    ctx.beginPath();
    ctx.arc(370, 148, 28, 0, Math.PI * 2);
    ctx.fill();

    const pngUrl = canvas.toDataURL("image/png");
    const appleIconLink = document.getElementById("dynamic-apple-icon");
    const favIconLink = document.getElementById("dynamic-favicon");
    if (appleIconLink) appleIconLink.href = pngUrl;
    if (favIconLink) favIconLink.href = pngUrl;
  } catch (e) {}
}

function syncVersionDisplay() {
  const badge = document.getElementById("app-version-badge");
  if (badge) {
    badge.innerText = `VERSION ${CURRENT_VERSION}`;
  }
}

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
  triggerHapticPing(0.12, 800, [60]);
  if ("Notification" in window) {
    const perm = await Notification.requestPermission();
    updateNotifyButton();
    if (perm === "granted") {
      triggerNotification("Reminders Active", "Lock screen pings and custom intervals enabled.", "perm_granted");
    }
  }
});

function triggerNotification(primaryText, secondaryText, tag) {
  triggerHapticPing(0.2, 880, [100, 50, 100]);

  const payload = {
    title: primaryText,
    body: secondaryText || "",
    tag: tag || "postr_ping_" + Date.now(),
    icon: "icon.svg",
    badge: "icon.svg"
  };

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "TRIGGER_NOTIFICATION",
      ...payload
    });
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: payload.icon,
      badge: payload.badge
    });
  }
}

// Configurable Haptic Audio Synthesizer & Hardware Vibration
function triggerHapticPing(duration = 0.15, freq = 880, vibrationPattern = [70]) {
  initAudio();
  try {
    if (audioCtx) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    }
  } catch (e) {}

  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(vibrationPattern);
    } catch (e) {}
  }
}

function triggerIslandPulse() {
  const islandPill = document.getElementById("dynamic-island");
  islandPill.classList.remove("pulse");
  void islandPill.offsetWidth;
  islandPill.classList.add("pulse");
}

function persistAndSync() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  render();
  triggerIslandPulse();
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
      const wrapper = document.createElement("div");
      wrapper.className = "card-wrapper";
      wrapper.setAttribute("data-id", item.id);

      let pingLabel = "";
      if (item.pingMinutes > 0) {
        if (item.pingMinutes >= 60 && item.pingMinutes % 60 === 0) {
          pingLabel = `PING: EVERY ${item.pingMinutes / 60}H`;
        } else {
          pingLabel = `PING: EVERY ${item.pingMinutes}M`;
        }
      }

      const labelColor = PASTEL_MAP[item.label] || "#e0e0e0";

      wrapper.innerHTML = `
        <div class="swipe-action-underlay">
          <div class="trash-can-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
        </div>
        <div class="card">
          <div class="card-content">
            <h3>${escapeHtml(item.title)}</h3>
            ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
            <div class="card-tags-row">
              ${item.label ? `<span class="pastel-tag" style="background-color: ${labelColor};">${escapeHtml(item.label)}</span>` : ""}
              ${pingLabel ? `<span class="card-meta">${pingLabel}</span>` : ""}
            </div>
          </div>
          <button class="btn-complete" title="Mark Done" aria-label="Mark Done">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
        </div>
      `;

      cardList.appendChild(wrapper);
      attachCardInteractions(wrapper, item);
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

function attachCardInteractions(wrapper, item) {
  const card = wrapper.querySelector(".card");
  const trashIcon = wrapper.querySelector(".trash-can-icon");
  const btnDone = wrapper.querySelector(".btn-complete");

  btnDone.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteWithAnimation(item.id, wrapper);
  });

  let holdTimer = null;
  let isHolding = false;
  let startX = 0;
  let startY = 0;
  let currentTranslateX = 0;
  let isValidSwipe = false;
  let startTime = 0;

  function onPointerDown(e) {
    if (e.target.closest(".btn-complete")) return;

    const pageX = e.touches ? e.touches[0].clientX : e.clientX;
    const pageY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = card.getBoundingClientRect();

    startX = pageX;
    startY = pageY;
    startTime = Date.now();
    currentTranslateX = 0;

    const relativeX = pageX - rect.left;
    isValidSwipe = relativeX >= rect.width * 0.55;

    isHolding = false;
    card.classList.remove("holding");

    holdTimer = setTimeout(() => {
      isHolding = true;
      card.classList.add("holding");
      triggerHapticPing(0.12, 600, [50]);
      openEditModal(item);
    }, 500);

    card.style.transition = "none";
  }

  function onPointerMove(e) {
    const pageX = e.touches ? e.touches[0].clientX : e.clientX;
    const pageY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = pageX - startX;
    const deltaY = pageY - startY;

    if (Math.hypot(deltaX, deltaY) > 8) {
      clearTimeout(holdTimer);
    }

    if (isHolding || !isValidSwipe) return;

    if (deltaX < 0) {
      currentTranslateX = deltaX;
      card.style.transform = `translateX(${deltaX}px)`;

      const elapsed = Math.max(1, Date.now() - startTime);
      const speed = Math.abs(deltaX) / elapsed;
      const distanceRatio = Math.min(1.8, Math.abs(deltaX) / 130);
      const velocityBonus = Math.min(0.5, speed * 0.4);
      const totalScale = Math.max(0.7, distanceRatio + velocityBonus);
      const rotationDeg = Math.min(18, Math.abs(deltaX) * 0.1);

      trashIcon.style.transform = `scale(${totalScale}) rotate(-${rotationDeg}deg)`;
    }
  }

  function onPointerUp(e) {
    clearTimeout(holdTimer);
    card.classList.remove("holding");

    if (isHolding) return;

    const cardWidth = card.offsetWidth;
    const swipeDistance = Math.abs(currentTranslateX);
    const elapsed = Math.max(1, Date.now() - startTime);
    const speed = swipeDistance / elapsed;

    if (isValidSwipe && (swipeDistance > cardWidth * 0.52 || (swipeDistance > 90 && speed > 0.65))) {
      card.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
      card.style.transform = `translateX(-${cardWidth + 40}px)`;
      trashIcon.style.transform = `scale(2)`;
      setTimeout(() => {
        deleteWithAnimation(item.id, wrapper);
      }, 160);
    } else {
      card.style.transition = "transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)";
      card.style.transform = "translateX(0px)";
      trashIcon.style.transform = "scale(1)";
    }
  }

  card.addEventListener("touchstart", onPointerDown, { passive: true });
  card.addEventListener("touchmove", onPointerMove, { passive: true });
  card.addEventListener("touchend", onPointerUp);
  card.addEventListener("touchcancel", onPointerUp);

  card.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
}

// Dedicated Delete Haptic Pulse
function deleteWithAnimation(id, wrapper) {
  triggerHapticPing(0.18, 420, [40, 30, 80]); // Low-pitch tactile thud + double vibration
  wrapper.classList.add("deleting");
  setTimeout(() => {
    reminders = reminders.filter(r => r.id !== id);
    persistAndSync();
  }, 300);
}

function setupLabelSelector() {
  const container = document.getElementById("label-selector");
  container.querySelectorAll(".label-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const label = pill.getAttribute("data-label");
      triggerHapticPing(0.08, 700, [30]);
      if (activeSelectedLabel === label) {
        activeSelectedLabel = null;
        pill.classList.remove("selected");
      } else {
        container.querySelectorAll(".label-pill").forEach(p => p.classList.remove("selected"));
        activeSelectedLabel = label;
        pill.classList.add("selected");
      }
    });
  });
}

function resetLabelSelection(presetLabel = null) {
  activeSelectedLabel = presetLabel;
  document.querySelectorAll("#label-selector .label-pill").forEach(pill => {
    if (presetLabel && pill.getAttribute("data-label") === presetLabel) {
      pill.classList.add("selected");
    } else {
      pill.classList.remove("selected");
    }
  });
}

// Plus Button Haptic Pulse on Open
function openCreateModal() {
  triggerHapticPing(0.1, 950, [40]); // Crisp high-pitch click
  document.getElementById("modal-title").innerText = "NEW REMINDER";
  document.getElementById("btn-submit").innerText = "PIN TO LOCK SCREEN";
  document.getElementById("edit-reminder-id").value = "";
  document.getElementById("input-title").value = "";
  document.getElementById("input-body").value = "";
  document.getElementById("p0").checked = true;
  document.getElementById("custom-time-row").classList.add("hidden");
  resetLabelSelection(null);

  openModal("splash-modal");
  document.getElementById("input-title").focus();
}

function openEditModal(item) {
  document.getElementById("modal-title").innerText = "EDIT REMINDER";
  document.getElementById("btn-submit").innerText = "SAVE CHANGES";
  document.getElementById("edit-reminder-id").value = item.id;
  document.getElementById("input-title").value = item.title;
  document.getElementById("input-body").value = item.body || "";

  resetLabelSelection(item.label || null);

  const customTimeRow = document.getElementById("custom-time-row");
  if ([0, 1, 5, 10].includes(item.pingMinutes)) {
    const radio = document.getElementById(`p${item.pingMinutes}`);
    if (radio) radio.checked = true;
    customTimeRow.classList.add("hidden");
  } else {
    document.getElementById("pCustom").checked = true;
    customTimeRow.classList.remove("hidden");
    if (item.pingMinutes >= 60 && item.pingMinutes % 60 === 0) {
      document.getElementById("custom-val").value = item.pingMinutes / 60;
      document.getElementById("custom-unit").value = "h";
    } else {
      document.getElementById("custom-val").value = item.pingMinutes;
      document.getElementById("custom-unit").value = "m";
    }
  }

  openModal("splash-modal");
}

function openModal(modalId) {
  initAudio();
  const el = document.getElementById(modalId);
  el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  el.classList.remove("active");
}

// Scheduled Ping Verification
setInterval(() => {
  const now = Date.now();
  reminders.forEach(item => {
    if (item.pingMinutes > 0) {
      const intervalMs = item.pingMinutes * 60 * 1000;
      if (now - item.lastPing >= intervalMs) {
        item.lastPing = now;
        const alertHeading = item.label ? `[${item.label}] ${item.title}` : item.title;
        triggerNotification(alertHeading, item.body || "Pinned note remains active.", item.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
      }
    }
  });
}, 3000);

const customTimeRow = document.getElementById("custom-time-row");
document.querySelectorAll('input[name="pingPreset"]').forEach(radio => {
  radio.addEventListener("change", (e) => {
    triggerHapticPing(0.06, 680, [20]);
    if (e.target.value === "custom") {
      customTimeRow.classList.remove("hidden");
    } else {
      customTimeRow.classList.add("hidden");
    }
  });
});

document.getElementById("btn-add").addEventListener("click", openCreateModal);
document.getElementById("btn-close-modal").addEventListener("click", () => closeModal("splash-modal"));

document.getElementById("btn-tips").addEventListener("click", () => {
  triggerHapticPing(0.08, 720, [30]);
  currentSlide = 0;
  updateCarousel();
  openModal("tips-modal");
});

document.getElementById("btn-close-tips").addEventListener("click", () => closeModal("tips-modal"));

// About Section Haptic Pulse on Open
document.getElementById("btn-logo").addEventListener("click", () => {
  triggerHapticPing(0.12, 540, [50]); // Resonant bass pulse
  openModal("version-modal");
});

document.getElementById("btn-close-version").addEventListener("click", () => closeModal("version-modal"));

// Form Submit
document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();
  initAudio();

  const editId = document.getElementById("edit-reminder-id").value;
  const title = document.getElementById("input-title").value.trim();
  const body = document.getElementById("input-body").value.trim();
  const selectedPreset = document.querySelector('input[name="pingPreset"]:checked').value;

  let finalMinutes = 0;
  if (selectedPreset === "custom") {
    const val = parseInt(document.getElementById("custom-val").value, 10) || 1;
    const unit = document.getElementById("custom-unit").value;
    finalMinutes = (unit === "h") ? (val * 60) : val;
  } else {
    finalMinutes = parseInt(selectedPreset, 10);
  }

  if (!title) return;

  if (editId) {
    const index = reminders.findIndex(r => r.id === editId);
    if (index !== -1) {
      reminders[index].title = title;
      reminders[index].body = body;
      reminders[index].label = activeSelectedLabel;
      reminders[index].pingMinutes = finalMinutes;
      reminders[index].lastPing = Date.now();
    }
    triggerHapticPing(0.16, 920, [50, 40]);
  } else {
    const newReminder = {
      id: "postr_" + Date.now(),
      title,
      body,
      label: activeSelectedLabel,
      pingMinutes: finalMinutes,
      createdAt: Date.now(),
      lastPing: Date.now()
    };
    reminders.unshift(newReminder);
    const alertHeading = newReminder.label ? `[${newReminder.label}] ${title}` : title;
    triggerNotification(alertHeading, body || "Added to active reminders.", newReminder.id);
  }

  persistAndSync();
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
    triggerHapticPing(0.06, 680, [25]);
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
    triggerHapticPing(0.07, 720, [30]);
  } else if (diffX > threshold && currentSlide > 0) {
    currentSlide--;
    updateCarousel();
    triggerHapticPing(0.07, 720, [30]);
  }
}

document.addEventListener("click", initAudio, { once: true });
setupDynamicAppIcon();
setupLabelSelector();
updateNotifyButton();
syncVersionDisplay();
render();
