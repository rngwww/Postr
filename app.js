const CURRENT_VERSION = "2.1";
const STORAGE_KEY = "postr_notes_db";
const TRASH_STORAGE_KEY = "postr_trash_db";
const TRASH_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let trashedNotes = JSON.parse(localStorage.getItem(TRASH_STORAGE_KEY) || "[]");
let swRegistration = null;
let activeSelectedLabel = null;
let activeFilterCategory = null;
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

// Haptic feedback disabled
function triggerHaptic() {}
function triggerDeleteHaptic() {}
function applyHapticOverlays() {}

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
  triggerDeleteHaptic();
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
  }, 300);
}

function restoreFromTrash(id) {
  const index = trashedNotes.findIndex(t => t.id === id);
  if (index !== -1) {
    const [restoredNote] = trashedNotes.splice(index, 1);
    delete restoredNote.deletedAt;
    restoredNote._justRestored = true;
    reminders.unshift(restoredNote);
    persistTrash();
    persistAndSync();
    showToast("NOTE RESTORED");
  }
}

function permanentlyDeleteFromTrash(id) {
  trashedNotes = trashedNotes.filter(t => t.id !== id);
  persistTrash();
}

function animateTrashCardRemoval(card, type, callback) {
  if (card.classList.contains("restoring") || card.classList.contains("deleting")) return;
  card.classList.add(type);

  // Smoothly react on sibling cards below
  const container = document.getElementById("trash-list");
  if (container) {
    const siblings = Array.from(container.querySelectorAll(".trash-item-card:not(.restoring):not(.deleting)"));
    const idx = siblings.indexOf(card);
    if (idx !== -1) {
      siblings.slice(idx + 1).forEach(sib => {
        sib.classList.add("sibling-slide");
        setTimeout(() => sib.classList.remove("sibling-slide"), 260);
      });
    }
  }

  setTimeout(() => {
    callback();
  }, 290);
}

function emptyEntireTrash() {
  triggerDeleteHaptic();
  const container = document.getElementById("trash-list");
  const cards = container ? Array.from(container.querySelectorAll(".trash-item-card")) : [];
  if (cards.length > 0) {
    cards.forEach((c, idx) => {
      setTimeout(() => {
        c.classList.add("deleting");
      }, idx * 40);
    });
    setTimeout(() => {
      trashedNotes = [];
      persistTrash();
      showToast("TRASH EMPTIED");
    }, cards.length * 40 + 260);
  } else {
    trashedNotes = [];
    persistTrash();
    showToast("TRASH EMPTIED");
  }
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
    if (emptyState) {
      emptyState.style.display = "block";
      emptyState.classList.add("fade-in");
    }
    if (emptyBtn) emptyBtn.classList.add("hidden");
  } else {
    if (emptyState) {
      emptyState.style.display = "none";
      emptyState.classList.remove("fade-in");
    }
    if (emptyBtn) emptyBtn.classList.remove("hidden");

    trashedNotes.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "trash-item-card";
      card.style.animationDelay = `${index * 45}ms`;
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

      card.querySelector(".btn-trash-restore").addEventListener("click", (e) => {
        e.stopPropagation();
        triggerHaptic("medium");
        animateTrashCardRemoval(card, "restoring", () => {
          restoreFromTrash(item.id);
        });
      });

      card.querySelector(".btn-trash-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        triggerDeleteHaptic();
        animateTrashCardRemoval(card, "deleting", () => {
          permanentlyDeleteFromTrash(item.id);
        });
      });

      container.appendChild(card);
    });
    applyHapticOverlays(container);
  }
}

function renderNoteBody(bodyText) {
  if (!bodyText) return "";
  return `<p>${escapeHtml(bodyText)}</p>`;
}

function renderCardBody(item) {
  if (item.type === "checklist" || (item.checklistItems && item.checklistItems.length > 0)) {
    const items = item.checklistItems || [];
    const total = items.length;
    const completed = items.filter(i => i.done).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const itemsHtml = items.map((ci, idx) => `
      <div class="card-checklist-item ${ci.done ? "completed" : ""}" data-item-index="${idx}">
        <button type="button" class="checklist-item-check" aria-label="Toggle ${escapeHtml(ci.text)}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <span class="checklist-item-text">${escapeHtml(ci.text)}</span>
      </div>
    `).join("");

    return `
      <div class="card-checklist">
        <div class="checklist-progress-bar">
          <div class="progress-fill" style="width: ${percent}%;"></div>
        </div>
        <div class="checklist-progress-text">${completed} OF ${total} COMPLETED (${percent}%)</div>
        <div class="card-checklist-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }
  return renderNoteBody(item.body);
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
    if (activeFilterCategory && item.label !== activeFilterCategory) {
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
    return reminders.indexOf(a) - reminders.indexOf(b);
  });
}

function render() {
  const cardList = document.getElementById("card-list");
  const emptyState = document.getElementById("empty-state");
  if (!cardList) return;

  const filtered = getFilteredReminders();
  cardList.innerHTML = "";

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
  } else {
    if (emptyState) emptyState.style.display = "none";

    filtered.forEach(item => {
      const isJustRestored = Boolean(item._justRestored);
      if (isJustRestored) {
        delete item._justRestored;
      }
      const wrapper = document.createElement("div");
      wrapper.className = `card-wrapper ${item.pinned ? "is-pinned" : ""} ${isJustRestored ? "just-restored" : ""}`;
      wrapper.setAttribute("data-id", item.id);

      let pingLabel = "";
      if (item.pingMinutes > 0) {
        if (item.pingMinutes >= 60 && item.pingMinutes % 60 === 0) {
          pingLabel = `ALARM: EVERY ${item.pingMinutes / 60}H`;
        } else {
          pingLabel = `ALARM: EVERY ${item.pingMinutes}M`;
        }
      }

      const dueLabel = item.dueTime ? formatDueTime(item.dueTime) : "";
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
            <div class="card-title-row">
              <h3>${escapeHtml(item.title)}</h3>
              <button class="btn-pin-toggle ${item.pinned ? "active" : ""}" title="${item.pinned ? "Unpin note" : "Pin note to top"}" aria-label="Pin">
                ${item.pinned ? "📌" : "📍"}
              </button>
            </div>
            ${renderCardBody(item)}
            <div class="card-tags-row">
              ${item.pinned ? `<span class="pin-badge">📌 PINNED</span>` : ""}
              ${item.label ? `<span class="pastel-tag" style="background-color: ${labelColor};">${escapeHtml(item.label)}</span>` : ""}
              ${dueLabel ? `<span class="card-due-tag">⏰ DUE: ${dueLabel}</span>` : ""}
              ${pingLabel ? `<span class="card-meta">${pingLabel}</span>` : ""}
            </div>
          </div>
          <div class="card-actions-col">
            <button class="btn-complete" title="Move to Trash" aria-label="Move to Trash">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
            <button class="btn-card-menu" title="Options" aria-label="Options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="5" cy="12" r="2.2"></circle>
                <circle cx="12" cy="12" r="2.2"></circle>
                <circle cx="19" cy="12" r="2.2"></circle>
              </svg>
            </button>
          </div>
        </div>
      `;

      cardList.appendChild(wrapper);
      attachCardInteractions(wrapper, item);
    });
    applyHapticOverlays(cardList);
  }
}

function persistAndSync() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  render();
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

function reorderRemindersArrayFromDOM(draggedItem) {
  const cardList = document.getElementById("card-list");
  if (!cardList) return;

  const currentDomWrappers = Array.from(cardList.querySelectorAll(".card-wrapper"));
  const currentDomIds = currentDomWrappers.map(w => w.dataset.id).filter(Boolean);
  if (currentDomIds.length <= 1) return;

  const idToItem = new Map(reminders.map(r => [r.id, r]));
  const visibleItems = currentDomIds.map(id => idToItem.get(id)).filter(Boolean);

  if (draggedItem) {
    const draggedIdx = visibleItems.findIndex(it => it.id === draggedItem.id);
    if (draggedIdx !== -1) {
      if (draggedItem.pinned) {
        const hasUnpinnedAbove = visibleItems.slice(0, draggedIdx).some(it => !it.pinned);
        if (hasUnpinnedAbove) {
          draggedItem.pinned = false;
        }
      } else {
        const hasPinnedBelow = visibleItems.slice(draggedIdx + 1).some(it => it.pinned);
        if (hasPinnedBelow) {
          draggedItem.pinned = true;
        }
      }
    }
  }

  let visibleIdx = 0;
  reminders = reminders.map(r => {
    if (currentDomIds.includes(r.id)) {
      return visibleItems[visibleIdx++];
    }
    return r;
  });

  persistAndSync();
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

  const btnCardMenu = wrapper.querySelector(".btn-card-menu");
  if (btnCardMenu) {
    btnCardMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      openCardIosMenu(item, wrapper);
    });
  }

  wrapper.querySelectorAll(".card-checklist-item").forEach(itemEl => {
    itemEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(itemEl.dataset.itemIndex, 10);
      if (item.checklistItems && item.checklistItems[idx]) {
        item.checklistItems[idx].done = !item.checklistItems[idx].done;
        triggerHaptic("selection");
        persistAndSync();
      }
    });
  });

  btnDone.addEventListener("click", (e) => {
    e.stopPropagation();
    moveToTrash(item.id, wrapper);
  });

  let startX = 0;
  let startY = 0;
  let currentOffsetX = 0;
  let currentOffsetY = 0;
  let swipeDirection = null; // 'left' | 'right' | null
  let hasThresholdCrossed = false;
  let isDragging = false;
  let isReordering = false;
  let longPressTimer = null;
  let placeholder = null;
  let initialRect = null;
  let lastHoveredSibling = null;

  function onPointerStart(e) {
    if (e.target.closest(".btn-complete") || e.target.closest(".btn-pin-toggle") || e.target.closest(".btn-card-menu") || e.target.closest(".card-checklist-item")) return;

    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    currentOffsetX = 0;
    currentOffsetY = 0;
    swipeDirection = null;
    hasThresholdCrossed = false;
    isDragging = true;
    isReordering = false;

    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (isDragging && !swipeDirection && Math.abs(currentOffsetX) < 10 && Math.abs(currentOffsetY) < 10) {
        startReorder();
      }
    }, 340);

    card.style.transition = "none";
    trashIcon.style.transition = "none";
    editIcon.style.transition = "none";
  }

  function startReorder() {
    isReordering = true;
    triggerHaptic("heavy");

    const cardList = document.getElementById("card-list");
    if (!cardList) return;

    initialRect = wrapper.getBoundingClientRect();

    // Create ghost placeholder at current position
    placeholder = document.createElement("div");
    placeholder.className = "card-placeholder";
    placeholder.style.height = `${initialRect.height}px`;
    placeholder.style.marginBottom = "12px";
    placeholder.setAttribute("data-placeholder-for", item.id);
    wrapper.parentNode.insertBefore(placeholder, wrapper);

    // Elevate and fix position of dragged card
    wrapper.style.position = "fixed";
    wrapper.style.left = `${initialRect.left}px`;
    wrapper.style.top = `${initialRect.top}px`;
    wrapper.style.width = `${initialRect.width}px`;
    wrapper.style.height = `${initialRect.height}px`;
    wrapper.style.margin = "0";
    wrapper.classList.add("is-dragging");
    cardList.classList.add("is-reordering");
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const point = e.touches ? e.touches[0] : e;
    const diffX = point.clientX - startX;
    const diffY = point.clientY - startY;
    currentOffsetX = diffX;
    currentOffsetY = diffY;

    if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
      if (longPressTimer && !isReordering) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (isReordering) {
      if (e.cancelable) e.preventDefault();
      const currentY = point.clientY;
      const targetTop = initialRect.top + diffY;
      wrapper.style.top = `${targetTop}px`;

      // Auto-scroll container when near viewport boundary
      const container = document.getElementById("reminder-container");
      if (container) {
        const cRect = container.getBoundingClientRect();
        if (currentY < cRect.top + 70) {
          container.scrollTop -= 8;
        } else if (currentY > cRect.bottom - 70) {
          container.scrollTop += 8;
        }
      }

      // Check position relative to sibling cards in the feed
      const cardList = document.getElementById("card-list");
      if (cardList && placeholder) {
        const siblings = Array.from(cardList.querySelectorAll(".card-wrapper:not(.is-dragging)"));
        const draggedCenterY = targetTop + (initialRect.height / 2);

        for (const sib of siblings) {
          const sRect = sib.getBoundingClientRect();
          const sibCenterY = sRect.top + (sRect.height / 2);

          if (draggedCenterY < sibCenterY && (placeholder.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_PRECEDING)) {
            cardList.insertBefore(placeholder, sib);
            if (lastHoveredSibling !== sib) {
              lastHoveredSibling = sib;
              triggerHaptic("selection");
            }
            break;
          } else if (draggedCenterY > sibCenterY && (placeholder.compareDocumentPosition(sib) & Node.DOCUMENT_POSITION_FOLLOWING)) {
            cardList.insertBefore(placeholder, sib.nextSibling);
            if (lastHoveredSibling !== sib) {
              lastHoveredSibling = sib;
              triggerHaptic("selection");
            }
            break;
          }
        }
      }
      return;
    }

    // Normal horizontal swipe gesture detection
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
        return;
      }
    }

    if (swipeDirection === "left") {
      if (e.cancelable) e.preventDefault();
      if (diffX <= 0) {
        card.style.transform = `translate3d(${diffX}px, 0px, 0px)`;
        const dist = Math.abs(diffX);
        const scale = Math.min(2.2, Math.max(0.75, dist / 80));
        const rotate = Math.min(16, dist * 0.08);
        trashIcon.style.transform = `scale(${scale}) rotate(-${rotate}deg)`;

        const threshold = Math.min(card.offsetWidth * 0.42, 130);
        if (dist >= threshold && !hasThresholdCrossed) {
          hasThresholdCrossed = true;
          triggerHaptic("medium");
        } else if (dist < threshold && hasThresholdCrossed) {
          hasThresholdCrossed = false;
        }
      } else {
        card.style.transform = "translate3d(0px, 0px, 0px)";
        trashIcon.style.transform = "scale(0.8) rotate(0deg)";
      }
    } else if (swipeDirection === "right") {
      if (e.cancelable) e.preventDefault();
      if (diffX >= 0) {
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
        card.style.transform = "translate3d(0px, 0px, 0px)";
        editIcon.style.transform = "scale(0.8) rotate(0deg)";
      }
    }
  }

  function onPointerEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (!isDragging) return;
    isDragging = false;

    if (isReordering) {
      isReordering = false;
      const cardList = document.getElementById("card-list");
      if (cardList) cardList.classList.remove("is-reordering");

      if (placeholder && placeholder.parentNode) {
        const targetRect = placeholder.getBoundingClientRect();
        wrapper.style.transition = "top 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease";
        wrapper.style.top = `${targetRect.top}px`;
        wrapper.style.transform = "scale(1) rotate(0deg)";
        wrapper.style.boxShadow = "none";

        setTimeout(() => {
          triggerHaptic("light");
          if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.insertBefore(wrapper, placeholder);
            placeholder.remove();
            placeholder = null;
          }
          cleanupReorderStyles();
          reorderRemindersArrayFromDOM(item);
        }, 180);
      } else {
        cleanupReorderStyles();
      }
      return;
    }

    if (swipeDirection === "left") {
      const cardWidth = card.offsetWidth;
      const dist = Math.abs(currentOffsetX);
      const threshold = Math.min(cardWidth * 0.42, 130);

      if (dist >= threshold) {
        triggerDeleteHaptic();
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

  function cleanupReorderStyles() {
    wrapper.classList.remove("is-dragging");
    wrapper.style.position = "";
    wrapper.style.left = "";
    wrapper.style.top = "";
    wrapper.style.width = "";
    wrapper.style.height = "";
    wrapper.style.margin = "";
    wrapper.style.transition = "";
    wrapper.style.transform = "";
    wrapper.style.boxShadow = "";
    if (placeholder && placeholder.parentNode) {
      placeholder.remove();
      placeholder = null;
    }
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

  setEditorMode("note");
  populateBuilderChecklist([]);

  const toggleDue = document.getElementById("toggle-due-time");
  const dueControls = document.getElementById("due-time-controls");
  const inputDue = document.getElementById("input-due-time");
  const btnClearDue = document.getElementById("btn-clear-due-time");
  if (toggleDue && dueControls && inputDue) {
    toggleDue.checked = false;
    dueControls.classList.add("disabled");
    inputDue.disabled = true;
    inputDue.value = "";
    if (btnClearDue) btnClearDue.disabled = true;
  }

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

  if (item.type === "checklist" || (item.checklistItems && item.checklistItems.length > 0)) {
    setEditorMode("checklist");
    populateBuilderChecklist(item.checklistItems || []);
  } else {
    setEditorMode("note");
    populateBuilderChecklist([]);
  }

  const toggleDue = document.getElementById("toggle-due-time");
  const dueControls = document.getElementById("due-time-controls");
  const inputDue = document.getElementById("input-due-time");
  const btnClearDue = document.getElementById("btn-clear-due-time");
  if (toggleDue && dueControls && inputDue) {
    if (item.dueTime) {
      toggleDue.checked = true;
      dueControls.classList.remove("disabled");
      inputDue.disabled = false;
      inputDue.value = item.dueTime;
      if (btnClearDue) btnClearDue.disabled = false;
    } else {
      toggleDue.checked = false;
      dueControls.classList.add("disabled");
      inputDue.disabled = true;
      inputDue.value = "";
      if (btnClearDue) btnClearDue.disabled = true;
    }
  }

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
  if (!el) return;
  applyHapticOverlays(el);
  el.classList.remove("modal-closing");
  el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el || !el.classList.contains("active")) return;
  triggerHaptic("light");
  el.classList.add("modal-closing");
  el.classList.remove("active");
  setTimeout(() => {
    el.classList.remove("modal-closing");
  }, 240);
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
const btnTrash = document.getElementById("btn-trash");
if (btnTrash) {
  btnTrash.addEventListener("click", () => {
    triggerHaptic("light");
    renderTrashList();
    openModal("trash-modal");
  });
}

const btnCloseTrash = document.getElementById("btn-close-trash");
if (btnCloseTrash) {
  btnCloseTrash.addEventListener("click", () => {
    triggerHaptic("light");
    closeModal("trash-modal");
  });
}

const btnEmptyTrash = document.getElementById("btn-empty-trash");
if (btnEmptyTrash) {
  btnEmptyTrash.addEventListener("click", () => {
    if (trashedNotes.length === 0) return;
    if (confirm("Permanently empty all notes in the trash?")) {
      emptyEntireTrash();
    }
  });
}

// Due Time Toggle & Clear Controls
const toggleDueTime = document.getElementById("toggle-due-time");
const dueTimeControls = document.getElementById("due-time-controls");
const inputDueTime = document.getElementById("input-due-time");
const btnClearDue = document.getElementById("btn-clear-due-time");

if (toggleDueTime && dueTimeControls && inputDueTime) {
  toggleDueTime.addEventListener("change", () => {
    triggerHaptic("selection");
    if (toggleDueTime.checked) {
      dueTimeControls.classList.remove("disabled");
      inputDueTime.disabled = false;
      if (btnClearDue) btnClearDue.disabled = false;
      if (!inputDueTime.value) {
        const d = new Date(Date.now() + 3600000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        const pad = n => String(n).padStart(2, "0");
        inputDueTime.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } else {
      dueTimeControls.classList.add("disabled");
      inputDueTime.disabled = true;
      if (btnClearDue) btnClearDue.disabled = true;
    }
  });
}

if (btnClearDue && inputDueTime) {
  btnClearDue.addEventListener("click", () => {
    inputDueTime.value = "";
    triggerHaptic("light");
  });
}

// iOS Native Context Menu System
function showIosMenu({ title = "Options", items = [] }) {
  const backdrop = document.getElementById("ios-context-menu-backdrop");
  const menuTitle = document.getElementById("ios-menu-title");
  const menuItemsContainer = document.getElementById("ios-menu-items");

  if (!backdrop || !menuItemsContainer) return;

  triggerHaptic("medium");

  if (title) {
    menuTitle.textContent = title;
    menuTitle.style.display = "block";
  } else {
    menuTitle.style.display = "none";
  }

  menuItemsContainer.innerHTML = "";
  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `ios-menu-item ${item.destructive ? "destructive" : ""}`;
    btn.innerHTML = `
      <span>${escapeHtml(item.label)}</span>
      <span class="ios-menu-icon">${item.icon || ""}</span>
    `;
    btn.addEventListener("click", () => {
      triggerHaptic("selection");
      closeIosMenu();
      if (item.action) item.action();
    });
    menuItemsContainer.appendChild(btn);
  });
  applyHapticOverlays(menuItemsContainer);

  backdrop.classList.remove("menu-closing");
  backdrop.classList.add("active");
}

function closeIosMenu() {
  const backdrop = document.getElementById("ios-context-menu-backdrop");
  if (!backdrop || !backdrop.classList.contains("active")) return;
  triggerHaptic("light");
  backdrop.classList.add("menu-closing");
  backdrop.classList.remove("active");
  setTimeout(() => {
    backdrop.classList.remove("menu-closing");
  }, 240);
}

const btnCancelIosMenu = document.getElementById("btn-cancel-ios-menu");
if (btnCancelIosMenu) {
  btnCancelIosMenu.addEventListener("click", closeIosMenu);
}
const iosBackdrop = document.getElementById("ios-context-menu-backdrop");
if (iosBackdrop) {
  iosBackdrop.addEventListener("click", (e) => {
    if (e.target === iosBackdrop) closeIosMenu();
  });
}

function openCardIosMenu(item, wrapper) {
  const pinSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24V17z"></path></svg>`;
  const editSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
  const copySvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  const trashSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

  showIosMenu({
    title: item.title || "Note Options",
    items: [
      {
        label: item.pinned ? "Unpin Note" : "Pin Note to Top",
        icon: pinSvg,
        action: () => {
          item.pinned = !item.pinned;
          triggerHaptic("light");
          persistAndSync();
        }
      },
      {
        label: "Edit Note",
        icon: editSvg,
        action: () => {
          openEditModal(item);
        }
      },
      {
        label: "Duplicate Note",
        icon: copySvg,
        action: () => {
          const duplicate = JSON.parse(JSON.stringify(item));
          duplicate.id = "postr_" + Date.now();
          duplicate.title = duplicate.title + " (Copy)";
          duplicate.createdAt = Date.now();
          duplicate.lastPing = Date.now();
          reminders.unshift(duplicate);
          triggerHaptic("medium");
          persistAndSync();
        }
      },
      {
        label: "Move to Trash",
        icon: trashSvg,
        destructive: true,
        action: () => {
          moveToTrash(item.id, wrapper);
        }
      }
    ]
  });
}

// Mode Switcher & Checklist Builder
const tabModeNote = document.getElementById("tab-mode-note");
const tabModeChecklist = document.getElementById("tab-mode-checklist");
const inputNoteType = document.getElementById("input-note-type");
const inputBody = document.getElementById("input-body");
const checklistBuilder = document.getElementById("checklist-builder");
const checklistRowsContainer = document.getElementById("checklist-rows-container");
const btnAddChecklistRow = document.getElementById("btn-add-checklist-row");
const btnChecklistMenu = document.getElementById("btn-checklist-menu");

function setEditorMode(mode) {
  if (inputNoteType) inputNoteType.value = mode;
  if (mode === "checklist") {
    tabModeChecklist?.classList.add("active");
    tabModeNote?.classList.remove("active");
    if (inputBody) inputBody.style.display = "none";
    if (checklistBuilder) checklistBuilder.classList.remove("hidden");
    if (checklistRowsContainer && checklistRowsContainer.children.length === 0) {
      createBuilderRow("", false, true);
    }
  } else {
    tabModeNote?.classList.add("active");
    tabModeChecklist?.classList.remove("active");
    if (inputBody) inputBody.style.display = "block";
    if (checklistBuilder) checklistBuilder.classList.add("hidden");
  }
}

if (tabModeNote) {
  tabModeNote.addEventListener("click", () => {
    triggerHaptic("selection");
    setEditorMode("note");
  });
}

if (tabModeChecklist) {
  tabModeChecklist.addEventListener("click", () => {
    triggerHaptic("selection");
    setEditorMode("checklist");
  });
}

function createBuilderRow(text = "", done = false, autoFocus = false) {
  if (!checklistRowsContainer) return null;
  const rowId = "ci_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
  const row = document.createElement("div");
  row.className = "builder-row";
  row.dataset.rowId = rowId;

  row.innerHTML = `
    <button type="button" class="builder-row-check ${done ? "checked" : ""}" title="Toggle Complete">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>
    <input type="text" class="builder-row-input ${done ? "checked" : ""}" placeholder="List item..." value="${escapeHtml(text)}">
    <button type="button" class="builder-row-del" title="Delete row">✕</button>
  `;

  const checkBtn = row.querySelector(".builder-row-check");
  const input = row.querySelector(".builder-row-input");
  const delBtn = row.querySelector(".builder-row-del");

  checkBtn.addEventListener("click", () => {
    triggerHaptic("selection");
    checkBtn.classList.toggle("checked");
    input.classList.toggle("checked");
  });

  delBtn.addEventListener("click", () => {
    triggerHaptic("light");
    row.remove();
    if (checklistRowsContainer.children.length === 0) {
      createBuilderRow("", false, true);
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextRow = createBuilderRow("", false, true);
      row.after(nextRow);
    } else if (e.key === "Backspace" && input.value === "" && checklistRowsContainer.children.length > 1) {
      e.preventDefault();
      const prev = row.previousElementSibling;
      row.remove();
      if (prev) {
        const prevInput = prev.querySelector(".builder-row-input");
        if (prevInput) prevInput.focus();
      }
    }
  });

  checklistRowsContainer.appendChild(row);
  if (autoFocus) {
    setTimeout(() => input.focus(), 50);
  }
  return row;
}

function getBuilderChecklistItems() {
  const items = [];
  if (!checklistRowsContainer) return items;
  checklistRowsContainer.querySelectorAll(".builder-row").forEach(row => {
    const input = row.querySelector(".builder-row-input");
    const checkBtn = row.querySelector(".builder-row-check");
    const text = input ? input.value.trim() : "";
    if (text) {
      items.push({
        id: row.dataset.rowId || ("ci_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4)),
        text: text,
        done: checkBtn ? checkBtn.classList.contains("checked") : false
      });
    }
  });
  return items;
}

function populateBuilderChecklist(items = []) {
  if (!checklistRowsContainer) return;
  checklistRowsContainer.innerHTML = "";
  if (!items || items.length === 0) {
    createBuilderRow("", false, false);
  } else {
    items.forEach(it => createBuilderRow(it.text, it.done, false));
  }
}

if (btnAddChecklistRow) {
  btnAddChecklistRow.addEventListener("click", () => {
    triggerHaptic("light");
    createBuilderRow("", false, true);
  });
}

function openChecklistBuilderIosMenu() {
  const checkSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const uncheckSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect></svg>`;
  const clearSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>`;
  const trashSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

  showIosMenu({
    title: "Checklist Actions",
    items: [
      {
        label: "Mark All Complete",
        icon: checkSvg,
        action: () => {
          checklistRowsContainer.querySelectorAll(".builder-row").forEach(row => {
            row.querySelector(".builder-row-check")?.classList.add("checked");
            row.querySelector(".builder-row-input")?.classList.add("checked");
          });
          triggerHaptic("medium");
        }
      },
      {
        label: "Unmark All",
        icon: uncheckSvg,
        action: () => {
          checklistRowsContainer.querySelectorAll(".builder-row").forEach(row => {
            row.querySelector(".builder-row-check")?.classList.remove("checked");
            row.querySelector(".builder-row-input")?.classList.remove("checked");
          });
          triggerHaptic("medium");
        }
      },
      {
        label: "Clear Completed Items",
        icon: clearSvg,
        action: () => {
          checklistRowsContainer.querySelectorAll(".builder-row").forEach(row => {
            if (row.querySelector(".builder-row-check")?.classList.contains("checked")) {
              row.remove();
            }
          });
          if (checklistRowsContainer.children.length === 0) {
            createBuilderRow("", false, false);
          }
          triggerHaptic("light");
        }
      },
      {
        label: "Delete All Items",
        icon: trashSvg,
        destructive: true,
        action: () => {
          checklistRowsContainer.innerHTML = "";
          createBuilderRow("", false, true);
          triggerDeleteHaptic();
        }
      }
    ]
  });
}

if (btnChecklistMenu) {
  btnChecklistMenu.addEventListener("click", () => {
    openChecklistBuilderIosMenu();
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
      if (activeFilterCategory === filter) {
        activeFilterCategory = null;
        chip.classList.remove("active");
      } else {
        activeFilterCategory = filter;
        categoryFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
      }
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
  const noteType = document.getElementById("input-note-type")?.value || "note";
  const rawBody = document.getElementById("input-body").value.trim();
  const checklistItems = (noteType === "checklist") ? getBuilderChecklistItems() : [];

  let body = rawBody;
  if (noteType === "checklist") {
    body = checklistItems.map(i => (i.done ? "[✓] " : "[ ] ") + i.text).join("\n");
  }

  const isPinned = document.getElementById("input-pin-note").checked;
  const toggleDue = document.getElementById("toggle-due-time");
  const isDueActive = toggleDue ? toggleDue.checked : false;
  const rawDueVal = document.getElementById("input-due-time") ? document.getElementById("input-due-time").value : "";
  const dueTimeVal = (isDueActive && rawDueVal) ? rawDueVal : null;
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
      reminders[index].type = noteType;
      reminders[index].body = body;
      reminders[index].checklistItems = checklistItems;
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
      type: noteType,
      body,
      checklistItems,
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
    activeFilterCategory = null;
    if (categoryFilters) {
      categoryFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    }
  }

  persistAndSync();
  closeModal("splash-modal");
});

// Tips Carousel
let currentSlide = 0;
const totalSlides = 6;
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

// Universal Responsive Viewport Height Calculation for All iPhones
function updateViewportHeight() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = Boolean(window.navigator && window.navigator.standalone) || 
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  let actualHeight;
  if (isIOS && isStandalone) {
    // In iOS PWA standalone mode with black-translucent,
    // window.screen.height is the true edge-to-edge physical screen height (e.g. 852px on iPhone 14 Pro)
    const screenH = window.screen ? window.screen.height : 0;
    actualHeight = Math.max(screenH, window.innerHeight || 0);
  } else if (window.visualViewport) {
    actualHeight = window.visualViewport.height;
  } else {
    actualHeight = window.innerHeight;
  }

  document.documentElement.style.setProperty("--real-vh", `${actualHeight}px`);
  document.documentElement.style.setProperty("--app-height", `${actualHeight}px`);

  const vp = document.getElementById("app-viewport");
  if (vp) {
    if (isIOS && isStandalone) {
      vp.style.height = `${actualHeight}px`;
      vp.style.minHeight = `${actualHeight}px`;
      document.body.style.height = `${actualHeight}px`;
      document.body.style.minHeight = `${actualHeight}px`;
    } else {
      vp.style.height = "";
      vp.style.minHeight = "";
      document.body.style.height = "";
      document.body.style.minHeight = "";
    }
  }
}

window.addEventListener("resize", updateViewportHeight);
window.addEventListener("orientationchange", updateViewportHeight);
window.addEventListener("pageshow", updateViewportHeight);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateViewportHeight();
  }
});

updateViewportHeight();
setupDynamicAppIcon();
setupLabelSelector();
updateNotifyButton();
syncVersionDisplay();
updateTrashBadge();
updateAppBadge();
render();
applyHapticOverlays();
