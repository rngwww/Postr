const CURRENT_VERSION = "2.0";
const STORAGE_KEY = "postr_notes_db";
let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let swRegistration = null;
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

// Native Hardware Taptic Trigger (Zero Speaker Audio)
function triggerHaptic(intensity = "light") {
  // Method 1: Programmatically dispatching a native click on a hidden input switch triggers Apple's Taptic motor
  try {
    const label = document.getElementById("taptic-label");
    const trigger = document.getElementById("taptic-trigger");
    if (label) {
      label.click();
    } else if (trigger) {
      trigger.click();
    }
  } catch (e) {}

  // Method 2: Standard API fallback
  if ("vibrate" in navigator) {
    try {
      if (intensity === "medium") {
        navigator.vibrate([15, 30, 15]);
      } else if (intensity === "heavy") {
        navigator.vibrate(40);
      } else {
        navigator.vibrate(12);
      }
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
  triggerHaptic();
  if ("Notification" in window) {
    const perm = await Notification.requestPermission();
    updateNotifyButton();
    if (perm === "granted") {
      triggerNotification("Reminders Active", "Lock screen pings and custom intervals enabled.", "perm_granted");
    }
  }
});

function triggerNotification(primaryText, secondaryText, tag) {
  triggerHaptic();

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
        <div class="swipe-action-underlay underlay-edit">
          <div class="edit-action-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"></path>
              <path d="M2 6h4"></path>
              <path d="M2 10h4"></path>
              <path d="M2 14h4"></path>
              <path d="M2 18h4"></path>
              <path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l5.013-5.01z"></path>
            </svg>
          </div>
        </div>
        <div class="swipe-action-underlay underlay-delete">
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

// 1:1 Smooth Physical Card Swipe Sync
function attachCardInteractions(wrapper, item) {
  const card = wrapper.querySelector(".card");
  const trashIcon = wrapper.querySelector(".trash-can-icon");
  const editIcon = wrapper.querySelector(".edit-action-icon");
  const underlayDelete = wrapper.querySelector(".underlay-delete");
  const underlayEdit = wrapper.querySelector(".underlay-edit");
  const btnDone = wrapper.querySelector(".btn-complete");

  btnDone.addEventListener("click", (e) => {
    e.stopPropagation();
    triggerHaptic("medium");
    deleteWithAnimation(item.id, wrapper);
  });

  let startX = 0;
  let startY = 0;
  let currentOffsetX = 0;
  let swipeDirection = null; // 'left' | 'right' | null
  let hasThresholdCrossed = false;
  let isDragging = false;

  function onPointerStart(e) {
    if (e.target.closest(".btn-complete")) return;

    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    currentOffsetX = 0;
    swipeDirection = null;
    hasThresholdCrossed = false;
    isDragging = true;

    card.style.transition = "none";
    trashIcon.style.transition = "none";
    editIcon.style.transition = "none";
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const point = e.touches ? e.touches[0] : e;
    const diffX = point.clientX - startX;
    const diffY = point.clientY - startY;

    if (!swipeDirection) {
      if (Math.abs(diffX) > 6 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          swipeDirection = "left";
          underlayDelete.style.opacity = "1";
          underlayEdit.style.opacity = "0";
        } else {
          swipeDirection = "right";
          underlayDelete.style.opacity = "0";
          underlayEdit.style.opacity = "1";
        }
      } else if (Math.abs(diffY) > 8) {
        isDragging = false;
        return; // Allow vertical scrolling
      }
    }

    if (swipeDirection === "left") {
      if (e.cancelable) e.preventDefault();
      if (diffX <= 0) {
        currentOffsetX = diffX;
        card.style.transform = `translate3d(${diffX}px, 0px, 0px)`;

        const dist = Math.abs(diffX);
        const scale = Math.min(2.2, Math.max(0.75, dist / 80));
        const rotate = Math.min(16, dist * 0.08);
        trashIcon.style.transform = `scale(${scale}) rotate(-${rotate}deg)`;

        const threshold = Math.min(card.offsetWidth * 0.42, 130);
        if (dist >= threshold && !hasThresholdCrossed) {
          hasThresholdCrossed = true;
          triggerHaptic("light");
        } else if (dist < threshold && hasThresholdCrossed) {
          hasThresholdCrossed = false;
        }
      } else {
        currentOffsetX = 0;
        card.style.transform = "translate3d(0px, 0px, 0px)";
        trashIcon.style.transform = "scale(0.8) rotate(0deg)";
      }
    } else if (swipeDirection === "right") {
      if (e.cancelable) e.preventDefault();
      if (diffX >= 0) {
        currentOffsetX = diffX;
        card.style.transform = `translate3d(${diffX}px, 0px, 0px)`;

        const dist = diffX;
        const scale = Math.min(2.2, Math.max(0.75, dist / 80));
        const rotate = Math.min(16, dist * 0.08);
        editIcon.style.transform = `scale(${scale}) rotate(${rotate}deg)`;

        const threshold = Math.min(card.offsetWidth * 0.42, 130);
        if (dist >= threshold && !hasThresholdCrossed) {
          hasThresholdCrossed = true;
          triggerHaptic("light");
        } else if (dist < threshold && hasThresholdCrossed) {
          hasThresholdCrossed = false;
        }
      } else {
        currentOffsetX = 0;
        card.style.transform = "translate3d(0px, 0px, 0px)";
        editIcon.style.transform = "scale(0.8) rotate(0deg)";
      }
    }
  }

  function onPointerEnd() {
    if (!isDragging) return;
    isDragging = false;

    if (swipeDirection === "left") {
      const cardWidth = card.offsetWidth;
      const dist = Math.abs(currentOffsetX);
      const threshold = Math.min(cardWidth * 0.42, 130);

      if (dist >= threshold) {
        triggerHaptic("medium");
        card.style.transition = "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = `translate3d(-${cardWidth + 40}px, 0px, 0px)`;
        trashIcon.style.transition = "transform 0.2s ease";
        trashIcon.style.transform = "scale(1.8)";
        
        setTimeout(() => {
          deleteWithAnimation(item.id, wrapper);
        }, 160);
      } else {
        card.style.transition = "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translate3d(0px, 0px, 0px)";
        trashIcon.style.transition = "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)";
        trashIcon.style.transform = "scale(0.8) rotate(0deg)";
      }
    } else if (swipeDirection === "right") {
      const cardWidth = card.offsetWidth;
      const dist = currentOffsetX;
      const threshold = Math.min(cardWidth * 0.42, 130);

      if (dist >= threshold) {
        triggerHaptic("medium");
        card.style.transition = "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translate3d(0px, 0px, 0px)";
        editIcon.style.transition = "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)";
        editIcon.style.transform = "scale(0.8) rotate(0deg)";

        setTimeout(() => {
          openEditModal(item);
        }, 160);
      } else {
        card.style.transition = "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translate3d(0px, 0px, 0px)";
        editIcon.style.transition = "transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)";
        editIcon.style.transform = "scale(0.8) rotate(0deg)";
      }
    }

    swipeDirection = null;
    hasThresholdCrossed = false;
  }

  card.addEventListener("touchstart", onPointerStart, { passive: false });
  card.addEventListener("touchmove", onPointerMove, { passive: false });
  card.addEventListener("touchend", onPointerEnd, { passive: false });
  card.addEventListener("touchcancel", onPointerEnd, { passive: false });

  // Mouse support for desktop / browser testing
  card.addEventListener("mousedown", onPointerStart);
  window.addEventListener("mousemove", (e) => {
    if (isDragging) onPointerMove(e);
  });
  window.addEventListener("mouseup", () => {
    if (isDragging) onPointerEnd();
  });
}

function deleteWithAnimation(id, wrapper) {
  triggerHaptic();
  wrapper.classList.add("deleting");
  setTimeout(() => {
    reminders = reminders.filter(r => r.id !== id);
    persistAndSync();
  }, 260);
}

function setupLabelSelector() {
  const container = document.getElementById("label-selector");
  container.querySelectorAll(".label-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const label = pill.getAttribute("data-label");
      triggerHaptic();
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
  triggerHaptic();
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
  const el = document.getElementById(modalId);
  el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  el.classList.remove("active");
}

// Background Ping Interval Loop
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
    triggerHaptic();
    if (e.target.value === "custom") {
      customTimeRow.classList.remove("hidden");
    } else {
      customTimeRow.classList.add("hidden");
    }
  });
});

document.getElementById("btn-add").addEventListener("click", openCreateModal);
document.getElementById("btn-close-modal").addEventListener("click", () => {
  triggerHaptic("light");
  closeModal("splash-modal");
});

document.getElementById("btn-tips").addEventListener("click", () => {
  triggerHaptic("light");
  currentSlide = 0;
  updateCarousel();
  openModal("tips-modal");
});

document.getElementById("btn-close-tips").addEventListener("click", () => {
  triggerHaptic("light");
  closeModal("tips-modal");
});

document.getElementById("btn-logo").addEventListener("click", () => {
  triggerHaptic("light");
  openModal("version-modal");
});

document.getElementById("btn-close-version").addEventListener("click", () => {
  triggerHaptic("light");
  closeModal("version-modal");
});

document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();

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
    triggerHaptic("medium");
    const alertHeading = newReminder.label ? `[${newReminder.label}] ${title}` : title;
    triggerNotification(alertHeading, body || "Added to active reminders.", newReminder.id);
  }

  persistAndSync();
  closeModal("splash-modal");
});

// Tips Carousel
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
    triggerHaptic();
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
    triggerHaptic();
  } else if (diffX > threshold && currentSlide > 0) {
    currentSlide--;
    updateCarousel();
    triggerHaptic();
  }
}

setupDynamicAppIcon();
setupLabelSelector();
updateNotifyButton();
syncVersionDisplay();
render();
