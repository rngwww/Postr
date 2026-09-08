const CURRENT_VERSION = "1.6";
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

// Generates high-res PNG for iOS Homescreen
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

// iOS Safari / WebKit Sound-Based Physical Haptic Engine
function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// Low-frequency sub-bass transducer pulse simulating native Taptic Engine taps
function triggerHaptic(type = "light") {
  initAudio();
  if (!audioCtx) return;

  try {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (type === "light") {
      // Crisp subtle tap (plus button / selection)
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === "medium") {
      // Solid click (modal / about / hold edit)
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.07);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === "delete") {
      // Double tactile thud (swipe delete / discard)
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.09);
      gain.gain.setValueAtTime(0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch (err) {}

  if ("vibrate" in navigator) {
    try {
      if (type === "delete") navigator.vibrate([30, 40, 60]);
      else if (type === "medium") navigator.vibrate(40);
      else navigator.vibrate(20);
    } catch (e) {}
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
  triggerHaptic("medium");
  if ("Notification" in window) {
    const perm = await Notification.requestPermission();
    updateNotifyButton();
    if (perm === "granted") {
      triggerNotification("Reminders Active", "Lock screen pings and custom intervals enabled.", "perm_granted");
    }
  }
});

function triggerNotification(primaryText, secondaryText, tag) {
  triggerHaptic("medium");

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

// Smooth Touch Sync & Swipe-To-Delete Implementation
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
  let isSwiping = false;
  let isValidSwipeOrigin = false;
  let startTime = 0;

  function onPointerDown(e) {
    initAudio();
    if (e.target.closest(".btn-complete")) return;

    const pageX = e.touches ? e.touches[0].clientX : e.clientX;
    const pageY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = card.getBoundingClientRect();

    startX = pageX;
    startY = pageY;
    startTime = Date.now();
    currentTranslateX = 0;
    isSwiping = false;

    // Must initiate from the right half of the note
    const relativeX = pageX - rect.left;
    isValidSwipeOrigin = relativeX >= rect.width * 0.45;

    isHolding = false;
    card.classList.remove("holding");

    // Remove CSS transitions during direct finger tracking to prevent stutter
    card.style.transition = "none";
    trashIcon.style.transition = "none";

    holdTimer = setTimeout(() => {
      if (!isSwiping) {
        isHolding = true;
        card.classList.add("holding");
        triggerHaptic("medium");
        openEditModal(item);
      }
    }, 500);
  }

  function onPointerMove(e) {
    const pageX = e.touches ? e.touches[0].clientX : e.clientX;
    const pageY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = pageX - startX;
    const deltaY = pageY - startY;

    // Movement cancels press-and-hold
    if (Math.hypot(deltaX, deltaY) > 8) {
      clearTimeout(holdTimer);
    }

    if (isHolding || !isValidSwipeOrigin) return;

    // Detect intentional left drag
    if (deltaX < -5 && Math.abs(deltaX) > Math.abs(deltaY)) {
      isSwiping = true;
      if (e.cancelable) e.preventDefault(); // Prevent vertical scrolling while swiping
      
      currentTranslateX = deltaX;

      // Sync physical note position directly to finger
      requestAnimationFrame(() => {
        card.style.transform = `translateX(${deltaX}px)`;

        const distance = Math.abs(deltaX);
        const elapsed = Math.max(1, Date.now() - startTime);
        const speed = distance / elapsed;
        const scale = Math.min(2.0, Math.max(0.7, (distance / 120) + (speed * 0.2)));
        const rotate = Math.min(18, distance * 0.08);

        trashIcon.style.transform = `scale(${scale}) rotate(-${rotate}deg)`;
      });
    }
  }

  function onPointerUp() {
    clearTimeout(holdTimer);
    card.classList.remove("holding");

    if (isHolding) return;

    if (isSwiping) {
      const cardWidth = card.offsetWidth;
      const distance = Math.abs(currentTranslateX);
      const elapsed = Math.max(1, Date.now() - startTime);
      const speed = distance / elapsed;

      // Deletion threshold: 45% card width or swift drag past 80px
      if (distance > cardWidth * 0.45 || (distance > 80 && speed > 0.55)) {
        card.style.transition = "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = `translateX(-${cardWidth + 20}px)`;
        trashIcon.style.transition = "transform 0.2s ease-out";
        trashIcon.style.transform = "scale(1.8)";
        
        setTimeout(() => {
          deleteWithAnimation(item.id, wrapper);
        }, 160);
      } else {
        // Snap back cleanly with finger release
        card.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translateX(0px)";
        trashIcon.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)";
        trashIcon.style.transform = "scale(1) rotate(0deg)";
      }
    } else {
      card.style.transition = "transform 0.2s ease";
      card.style.transform = "translateX(0px)";
    }

    isSwiping = false;
  }

  // Touch Events
  card.addEventListener("touchstart", onPointerDown, { passive: false });
  card.addEventListener("touchmove", onPointerMove, { passive: false });
  card.addEventListener("touchend", onPointerUp);
  card.addEventListener("touchcancel", onPointerUp);

  // Desktop Mouse Events for simulation
  card.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
}

function deleteWithAnimation(id, wrapper) {
  triggerHaptic("delete");
  wrapper.classList.add("deleting");
  setTimeout(() => {
    reminders = reminders.filter(r => r.id !== id);
    persistAndSync();
  }, 280);
}

function setupLabelSelector() {
  const container = document.getElementById("label-selector");
  container.querySelectorAll(".label-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const label = pill.getAttribute("data-label");
      triggerHaptic("light");
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

function openCreateModal() {
  triggerHaptic("light");
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

// Scheduled Ping Loop
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
    triggerHaptic("light");
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
  triggerHaptic("light");
  currentSlide = 0;
  updateCarousel();
  openModal("tips-modal");
});

document.getElementById("btn-close-tips").addEventListener("click", () => closeModal("tips-modal"));

// About Section Logo Touch
document.getElementById("btn-logo").addEventListener("click", () => {
  triggerHaptic("medium");
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
    triggerHaptic("medium");
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

// Carousel
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
    triggerHaptic("light");
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
    triggerHaptic("light");
  } else if (diffX > threshold && currentSlide > 0) {
    currentSlide--;
    updateCarousel();
    triggerHaptic("light");
  }
}

// Global First Touch Audio Unlocking
window.addEventListener("touchstart", initAudio, { once: true, passive: true });
window.addEventListener("click", initAudio, { once: true });

setupDynamicAppIcon();
setupLabelSelector();
updateNotifyButton();
syncVersionDisplay();
render();
