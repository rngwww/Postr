const CURRENT_VERSION = "2.1";
const STORAGE_KEY = "postr_notes_db";
const TRASH_STORAGE_KEY = "postr_trash_db";
const TRASH_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let trashedNotes = JSON.parse(localStorage.getItem(TRASH_STORAGE_KEY) || "[]");
let swRegistration = null;
let activeSelectedLabel = null;
let activeFilterCategory = "all";
let searchQuery = "";

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

function updateAppBadge() {
  if ("setAppBadge" in navigator) {
    try {
      if (reminders.length > 0) {
        navigator.setAppBadge(reminders.length);
      } else {
        navigator.clearAppBadge();
      }
    } catch (e) {}
  }
}

function cleanupExpiredTrash() {
  const now = Date.now();
  const countBefore = trashedNotes.length;
  trashedNotes = trashedNotes.filter(item => (now - item.deletedAt) < TRASH_RETENTION_MS);
  if (trashedNotes.length !== countBefore) {
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trashedNotes));
  }
}

function persistTrash() {
  localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(trashedNotes));
  updateTrashBadge();
  renderTrashList();
}

function updateTrashBadge() {
  const badge = document.getElementById("trash-badge");
  if (!badge) return;
  cleanupExpiredTrash();
  if (trashedNotes.length > 0) {
    badge.innerText = trashedNotes.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function moveToTrash(id, wrapper) {
  triggerHaptic("medium");
  wrapper.classList.add("deleting");

  setTimeout(() => {
    const noteIndex = reminders.findIndex(r => r.id === id);
    if (noteIndex !== -1) {
      const [deletedNote] = reminders.splice(noteIndex, 1);
      deletedNote.deletedAt = Date.now();
      trashedNotes.unshift(deletedNote);
      persistTrash();
      persistAndSync();
    }
  }, 260);
}

function restoreFromTrash(id) {
  triggerHaptic("medium");
  const index = trashedNotes.findIndex(t => t.id === id);
  if (index !== -1) {
    const [restoredNote] = trashedNotes.splice(index, 1);
    delete restoredNote.deletedAt;
    reminders.unshift(restoredNote);
    persistTrash();
    persistAndSync();
  }
}

function permanentlyDeleteFromTrash(id) {
  triggerHaptic("medium");
  trashedNotes = trashedNotes.filter(t => t.id !== id);
  persistTrash();
}

function emptyEntireTrash() {
  triggerHaptic("heavy");
  trashedNotes = [];
  persistTrash();
}

function formatRemainingTime(deletedAt) {
  const elapsed = Date.now() - deletedAt;
  const remaining = Math.max(0, TRASH_RETENTION_MS - elapsed);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

function renderTrashList() {
  const container = document.getElementById("trash-list");
  const emptyState = document.getElementById("trash-empty-state");
  const emptyBtn = document.getElementById("btn-empty-trash");
  if (!container) return;

  cleanupExpiredTrash();
  container.innerHTML = "";

  if (trashedNotes.length === 0) {
    emptyState.style.display = "block";
    emptyBtn.classList.add("hidden");
  } else {
    emptyState.style.display = "none";
    emptyBtn.classList.remove("hidden");

    trashedNotes.forEach(item => {
      const card = document.createElement("div");
      card.className = "trash-item-card";
      card.innerHTML = `
        <div class="trash-item-header">
          <h4>${escapeHtml(item.title)}</h4>
          <span class="trash-expiry-badge">${formatRemainingTime(item.deletedAt)}</span>
        </div>
        ${item.body ? `<div class="trash-item-body">${escapeHtml(item.body)}</div>` : ""}
        <div class="trash-item-actions">
          <button type="button" class="btn-trash-restore" data-id="${item.id}">RESTORE</button>
          <button type="button" class="btn-trash-delete" data-id="${item.id}">DELETE NOW</button>
        </div>
      `;

      card.querySelector(".btn-trash-restore").addEventListener("click", () => {
        restoreFromTrash(item.id);
      });

      card.querySelector(".btn-trash-delete").addEventListener("click", () => {
        permanentlyDeleteFromTrash(item.id);
      });

      container.appendChild(card);
    });
  }
}

function renderNoteBody(bodyText, noteId) {
  if (!bodyText) return "";
  const lines = bodyText.split("\n");
  const hasChecklist = lines.some(line => /^\s*(-?\s*\[[ xX]\])/.test(line));

  if (!hasChecklist) {
    return `<p>${escapeHtml(bodyText)}</p>`;
  }

  let html = `<div class="checklist-container">`;
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(-?\s*)\[([ xX])\]\s*(.*)$/);
    if (match) {
      const isChecked = match[2].toLowerCase() === "x";
      const text = match[3];
      html += `
        <div class="checklist-item ${isChecked ? "checked" : ""}" data-note-id="${noteId}" data-line-index="${index}">
          <div class="custom-checkbox">${isChecked ? "✓" : ""}</div>
          <span>${escapeHtml(text)}</span>
        </div>
      `;
    } else if (line.trim().length > 0) {
      html += `<p style="margin-top: 4px;">${escapeHtml(line)}</p>`;
    }
  });
  html += `</div>`;
  return html;
}

function toggleChecklistItem(noteId, lineIndex) {
  const note = reminders.find(r => r.id === noteId);
  if (!note || !note.body) return;

  const lines = note.body.split("\n");
  if (lines[lineIndex] !== undefined) {
    const match = lines[lineIndex].match(/^(\s*-?\s*\[)([ xX])(\]\s*.*)$/);
    if (match) {
      const currentVal = match[2].toLowerCase();
      const newVal = currentVal === "x" ? " " : "x";
      lines[lineIndex] = `${match[1]}${newVal}${match[3]}`;
      note.body = lines.join("\n");
      triggerHaptic("light");
      persistAndSync();
    }
  }
}

function formatDueTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const hours = d.getHours().toString().padStart(2, "0");
    const mins = d.getMinutes().toString().padStart(2, "0");
    const month = d.toLocaleString("default", { month: "short" });
    const day = d.getDate();
    return `${month} ${day} ${hours}:${mins}`;
  } catch (e) {
    return "";
  }
}

function getFilteredReminders() {
  return reminders.filter(item => {
    if (activeFilterCategory !== "all" && item.label !== activeFilterCategory) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchBody = (item.body || "").toLowerCase().includes(q);
      const matchLabel = (item.label || "").toLowerCase().includes(q);
      if (!matchTitle && !matchBody && !matchLabel) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

function persistAndSync() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  render();
  triggerIslandPulse();
  updateAppBadge();
  updateTrashBadge();
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

  const btnPin = wrapper.querySelector(".btn-pin-toggle");
  if (btnPin) {
    btnPin.addEventListener("click", (e) => {
      e.stopPropagation();
      item.pinned = !item.pinned;
      triggerHaptic("light");
      persistAndSync();
    });
  }

  wrapper.querySelectorAll(".checklist-item").forEach(chk => {
    chk.addEventListener("click", (e) => {
      e.stopPropagation();
      const lineIndex = parseInt(chk.dataset.lineIndex, 10);
      toggleChecklistItem(item.id, lineIndex);
    });
  });

  btnDone.addEventListener("click", (e) => {
    e.stopPropagation();
    moveToTrash(item.id, wrapper);
  });

  let startX = 0;
  let startY = 0;
  let currentOffsetX = 0;
  let swipeDirection = null; // 'left' | 'right' | null
  let hasThresholdCrossed = false;
  let isDragging = false;

  function onPointerStart(e) {
    if (e.target.closest(".btn-complete") || e.target.closest(".btn-pin-toggle") || e.target.closest(".checklist-item")) return;

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
          moveToTrash(item.id, wrapper);
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
  document.getElementById("input-pin-note").checked = false;
  document.getElementById("input-due-time").value = "";
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
  document.getElementById("input-pin-note").checked = !!item.pinned;
  document.getElementById("input-due-time").value = item.dueTime || "";

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

// Background Ping & Due Date Interval Loop
setInterval(() => {
  const now = Date.now();
  let changed = false;

  reminders.forEach(item => {
    // Check specific due time
    if (item.dueTime && !item.dueTimeTriggered) {
      const targetTs = new Date(item.dueTime).getTime();
      if (!isNaN(targetTs) && now >= targetTs) {
        item.dueTimeTriggered = true;
        changed = true;
        const alertHeading = item.label ? `[${item.label}] ${item.title}` : item.title;
        triggerNotification(`⏰ DUE: ${alertHeading}`, item.body || "Scheduled reminder alert.", item.id + "_due");
      }
    }

    // Check repeat ping interval
    if (item.pingMinutes > 0) {
      const intervalMs = item.pingMinutes * 60 * 1000;
      if (now - item.lastPing >= intervalMs) {
        item.lastPing = now;
        changed = true;
        const alertHeading = item.label ? `[${item.label}] ${item.title}` : item.title;
        triggerNotification(alertHeading, item.body || "Pinned note remains active.", item.id);
      }
    }
  });

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }

  cleanupExpiredTrash();
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

// Trash Modal Controls
document.getElementById("btn-trash").addEventListener("click", () => {
  triggerHaptic("light");
  renderTrashList();
  openModal("trash-modal");
});

document.getElementById("btn-close-trash").addEventListener("click", () => {
  triggerHaptic("light");
  closeModal("trash-modal");
});

document.getElementById("btn-empty-trash").addEventListener("click", () => {
  if (confirm("Permanently empty all notes in the trash?")) {
    emptyEntireTrash();
  }
});

// Clear Due Time Button
const btnClearDue = document.getElementById("btn-clear-due-time");
if (btnClearDue) {
  btnClearDue.addEventListener("click", () => {
    document.getElementById("input-due-time").value = "";
    triggerHaptic("light");
  });
}

// Search & Filter Controls
const searchInput = document.getElementById("search-input");
const btnClearSearch = document.getElementById("btn-clear-search");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    if (searchQuery) {
      btnClearSearch.classList.remove("hidden");
    } else {
      btnClearSearch.classList.add("hidden");
    }
    render();
  });
}

if (btnClearSearch) {
  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    btnClearSearch.classList.add("hidden");
    triggerHaptic("light");
    render();
  });
}

const categoryFilters = document.getElementById("category-filters");
if (categoryFilters) {
  categoryFilters.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const filter = chip.getAttribute("data-filter");
      triggerHaptic("light");
      activeFilterCategory = filter;
      categoryFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      render();
    });
  });
}

// Backup Export & Import Functions
function exportBackupData() {
  triggerHaptic("medium");
  const data = {
    app: "Postr",
    version: CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    reminders,
    trashedNotes
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `postr-backup-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackupData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (Array.isArray(parsed.reminders)) {
        reminders = parsed.reminders;
        if (Array.isArray(parsed.trashedNotes)) {
          trashedNotes = parsed.trashedNotes;
        }
        persistTrash();
        persistAndSync();
        triggerHaptic("heavy");
        alert(`Successfully imported ${reminders.length} notes!`);
        closeModal("version-modal");
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Failed to parse backup JSON file.");
    }
  };
  reader.readAsText(file);
}

document.getElementById("btn-export-backup").addEventListener("click", exportBackupData);
document.getElementById("file-import-backup").addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) {
    importBackupData(e.target.files[0]);
  }
});

document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const editId = document.getElementById("edit-reminder-id").value;
  const title = document.getElementById("input-title").value.trim();
  const body = document.getElementById("input-body").value.trim();
  const isPinned = document.getElementById("input-pin-note").checked;
  const dueTimeVal = document.getElementById("input-due-time").value || null;
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
      reminders[index].pinned = isPinned;
      reminders[index].dueTime = dueTimeVal;
      reminders[index].dueTimeTriggered = false;
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
      pinned: isPinned,
      dueTime: dueTimeVal,
      dueTimeTriggered: false,
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
updateTrashBadge();
updateAppBadge();
render();
