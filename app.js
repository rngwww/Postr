// Postr - Liquid Glass Application Engine (iOS 26 Kit inspired)

// Storage Keys
const STORAGE_KEY = "postr_notes_db";
const TRASH_STORAGE_KEY = "postr_trash_db";
const TRASH_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

const MORNING_BRIEFING_KEY = "postr_morning_briefing_enabled";
const LAST_BRIEFING_DATE_KEY = "postr_last_morning_briefing_date";
const THEME_MODE_KEY = "postr_theme_mode";
const ACCENT_COLOR_KEY = "postr_accent_color";
const SUBSCRIPTION_PLAN_KEY = "postr_subscription_plan";

// State
let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let trashedNotes = JSON.parse(localStorage.getItem(TRASH_STORAGE_KEY) || "[]");
let swRegistration = null;
let activeSelectedLabel = null;
let activeFilterCategory = null;
let searchQuery = "";
let toastTimeout = null;

// Category Badge Helper for Distinct Pastel Tags
function getCategoryBadgeClass(label) {
  if (!label) return "badge-category";
  const l = label.toLowerCase();
  switch (l) {
    case "school": return "badge-category badge-cat-school";
    case "work": return "badge-category badge-cat-work";
    case "shopping": return "badge-category badge-cat-shopping";
    case "personal": return "badge-category badge-cat-personal";
    case "tasks": return "badge-category badge-cat-tasks";
    default: return "badge-category";
  }
}

// ============================================================================
// FREEMIUM ENTITLEMENT MANAGER
// ============================================================================
const premiumManager = {
  limits: {
    maxFreeReminders: 5,
    freeAlarmPresets: [0, 1, 5, 10]
  },

  getPlan() {
    return localStorage.getItem(SUBSCRIPTION_PLAN_KEY) || "free";
  },

  isPremium() {
    return this.getPlan() === "premium";
  },

  canAddReminder() {
    if (this.isPremium()) return true;
    return reminders.length < this.limits.maxFreeReminders;
  },

  canUseCustomAlarm() {
    return this.isPremium();
  },

  setPlan(plan) {
    localStorage.setItem(SUBSCRIPTION_PLAN_KEY, plan);
    syncSubscriptionUI();
    const isPrem = plan === "premium";
    showToast(isPrem ? "Activated Premium Plan" : "Switched to Free Plan");
  },

  startCheckout() {
    openModal("upgrade-modal");
  },

  cancelSubscription() {
    this.setPlan("free");
  }
};

function syncSubscriptionUI() {
  const isPrem = premiumManager.isPremium();
  const badge = document.getElementById("settings-plan-badge");
  const subtitle = document.getElementById("settings-plan-subtitle");
  const cellUpgrade = document.getElementById("cell-upgrade-action");
  const cellCancel = document.getElementById("cell-cancel-subscription");
  const devToggle = document.getElementById("toggle-dev-premium");

  if (badge) {
    badge.textContent = isPrem ? "Premium Plan" : "Free Plan";
    badge.className = isPrem ? "badge-tag badge-pinned" : "badge-tag badge-category";
  }

  if (subtitle) {
    if (isPrem) {
      subtitle.textContent = "Unlimited active reminders unlocked";
    } else {
      subtitle.textContent = `${reminders.length} of ${premiumManager.limits.maxFreeReminders} active reminders used`;
    }
  }

  if (cellUpgrade) {
    cellUpgrade.classList.toggle("hidden", isPrem);
  }

  if (cellCancel) {
    cellCancel.classList.toggle("hidden", !isPrem);
  }

  if (devToggle) {
    devToggle.checked = isPrem;
  }
}

// Development toggle in Settings
const toggleDevPremium = document.getElementById("toggle-dev-premium");
if (toggleDevPremium) {
  toggleDevPremium.addEventListener("change", () => {
    premiumManager.setPlan(toggleDevPremium.checked ? "premium" : "free");
  });
}

// Upgrade Modal Actions
const btnOpenUpgrade = document.getElementById("btn-open-upgrade");
if (btnOpenUpgrade) {
  btnOpenUpgrade.addEventListener("click", () => {
    premiumManager.startCheckout();
  });
}

const btnCloseUpgrade = document.getElementById("btn-close-upgrade");
if (btnCloseUpgrade) {
  btnCloseUpgrade.addEventListener("click", () => {
    closeModal("upgrade-modal");
  });
}

const btnTestPurchase = document.getElementById("btn-test-purchase");
if (btnTestPurchase) {
  btnTestPurchase.addEventListener("click", () => {
    premiumManager.setPlan("premium");
    closeModal("upgrade-modal");
  });
}

const btnCancelSubscription = document.getElementById("btn-cancel-subscription");
if (btnCancelSubscription) {
  btnCancelSubscription.addEventListener("click", () => {
    premiumManager.cancelSubscription();
  });
}

// ============================================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================================
function showToast(message) {
  const pill = document.getElementById("toast-pill");
  const msgEl = document.getElementById("toast-message");
  if (!pill || !msgEl) return;

  msgEl.textContent = message;
  pill.classList.add("visible");

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    pill.classList.remove("visible");
    toastTimeout = null;
  }, 2400);
}

// ============================================================================
// THEMES AND APPEARANCE ENGINE (iOS 26 Atmospheric Themes)
// ============================================================================
function applyTheme(themeMode) {
  let effectiveTheme = themeMode;
  if (themeMode === "auto" || themeMode === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    effectiveTheme = isDark ? "dark" : "light";
  }

  document.documentElement.setAttribute("data-theme", effectiveTheme);

  const metaThemeColor = document.getElementById("meta-theme-color");
  if (metaThemeColor) {
    let color = "#060608";
    if (effectiveTheme === "light") color = "#f2f2f7";
    else if (effectiveTheme === "aurora") color = "#060612";
    else if (effectiveTheme === "sunset") color = "#0f0907";
    metaThemeColor.setAttribute("content", color);
  }

  // Sync segmented buttons
  document.querySelectorAll("#theme-segmented-control .segmented-option").forEach(btn => {
    const val = btn.getAttribute("data-theme-val");
    const isActive = (val === themeMode) || (val === "auto" && themeMode === "system") || (val === "system" && themeMode === "auto");
    btn.classList.toggle("active", isActive);
  });
}

function setThemeMode(themeMode) {
  localStorage.setItem(THEME_MODE_KEY, themeMode);
  applyTheme(themeMode);
  const nameMap = {
    auto: "Auto",
    system: "Auto",
    light: "Light",
    dark: "Dark",
    aurora: "Aurora",
    sunset: "Sunset"
  };
  showToast(nameMap[themeMode] || themeMode);
}

function applyAccentColor(hexColor) {
  if (!hexColor) return;
  document.documentElement.style.setProperty("--accent-color", hexColor);

  const c = hexColor.replace("#", "");
  if (c.length === 6) {
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    document.documentElement.style.setProperty("--accent-color-rgb", `${r}, ${g}, ${b}`);
  }

  // Sync swatches
  document.querySelectorAll("#swatches-palette .swatch-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-color").toLowerCase() === hexColor.toLowerCase());
  });

  const customInput = document.getElementById("input-custom-color");
  if (customInput) {
    customInput.value = hexColor;
  }

  const currentIndicator = document.getElementById("spectrum-current-indicator");
  if (currentIndicator) {
    currentIndicator.style.backgroundColor = hexColor;
  }
}

function setAccentColor(hexColor) {
  localStorage.setItem(ACCENT_COLOR_KEY, hexColor);
  applyAccentColor(hexColor);
}

function initThemeAndAppearance() {
  const savedTheme = localStorage.getItem(THEME_MODE_KEY) || "dark";
  applyTheme(savedTheme);

  const savedColor = localStorage.getItem(ACCENT_COLOR_KEY) || "#007aff";
  applyAccentColor(savedColor);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const currentMode = localStorage.getItem(THEME_MODE_KEY) || "dark";
    if (currentMode === "auto" || currentMode === "system") {
      applyTheme(currentMode);
    }
  });

  document.querySelectorAll("#theme-segmented-control .segmented-option").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-theme-val");
      setThemeMode(mode);
    });
  });

  document.querySelectorAll("#swatches-palette .swatch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const color = btn.getAttribute("data-color");
      setAccentColor(color);
    });
  });

  const customInput = document.getElementById("input-custom-color");
  if (customInput) {
    customInput.addEventListener("input", (e) => {
      setAccentColor(e.target.value);
    });
  }
}

// ============================================================================
// TOP NAVIGATION & SCROLL ELEVATION
// ============================================================================
function initTopNavigation() {
  const reminderContainer = document.getElementById("reminder-container");
  const topNavBar = document.getElementById("top-nav-bar");

  // Dynamic Liquid Glass Elevation when Feed is Scrolled
  if (reminderContainer && topNavBar) {
    reminderContainer.addEventListener("scroll", () => {
      if (reminderContainer.scrollTop > 8) {
        topNavBar.classList.add("scrolled");
      } else {
        topNavBar.classList.remove("scrolled");
      }
    }, { passive: true });
  }

  // Trash Icon in Top Nav
  const btnOpenTrash = document.getElementById("btn-open-trash");
  if (btnOpenTrash) {
    btnOpenTrash.addEventListener("click", () => {
      renderTrashList();
      openModal("trash-modal");
    });
  }

  const btnCloseTrash = document.getElementById("btn-close-trash");
  if (btnCloseTrash) {
    btnCloseTrash.addEventListener("click", () => {
      closeModal("trash-modal");
    });
  }

  // Settings Icon in Top Nav
  const btnOpenSettings = document.getElementById("btn-open-settings");
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener("click", () => {
      syncSubscriptionUI();
      openModal("settings-modal");
    });
  }

  const btnCloseSettings = document.getElementById("btn-close-settings");
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener("click", () => {
      closeModal("settings-modal");
    });
  }

  // Close sheet when tapping on backdrop outside sheet
  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });
  });
}

// ============================================================================
// DYNAMIC APP ICON GENERATION (PNG for iOS Home Screen)
// ============================================================================
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
    ctx.font = "300 340px 'Helvetica Neue', Helvetica, Arial, sans-serif";
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

// ============================================================================
// SERVICE WORKER & NOTIFICATIONS
// ============================================================================
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js?v=" + (window.APP_BUILD_VERSION || Date.now()))
    .then((reg) => {
      swRegistration = reg;
      reg.update();
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        }
      });
    })
    .catch((err) => console.log("SW error:", err));

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (!event.data) return;
    if (event.data.type === "NOTIFICATION_ACTION_SNOOZE") {
      if (event.data.reminderId) {
        snoozeReminderById(event.data.reminderId, 15);
      }
    } else if (event.data.type === "NOTIFICATION_ACTION_DONE") {
      if (event.data.reminderId) {
        moveToTrash(event.data.reminderId);
      }
    } else if (event.data.type === "NOTIFICATION_CLICK_OPEN") {
      if (event.data.reminderId) {
        const el = document.querySelector(`.card-wrapper[data-id="${event.data.reminderId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });
}

function updateNotifyButton() {
  const btn = document.getElementById("btn-notify-perm");
  if (!btn) return;
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

const btnNotifyPerm = document.getElementById("btn-notify-perm");
if (btnNotifyPerm) {
  btnNotifyPerm.addEventListener("click", async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      updateNotifyButton();
      if (perm === "granted") {
        triggerNotification("Reminders Active", "Lock screen alerts and custom intervals enabled.", "perm_granted");
      }
    }
  });
}

function playDueChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.14);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(1760, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(2637, now + 0.32);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.7);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.7);
  } catch (err) {
    console.warn("Chime audio note:", err);
  }
}

function triggerNotification(primaryText, secondaryText, tag, options = {}) {
  const payload = {
    title: primaryText,
    body: secondaryText || "",
    tag: tag || "postr_ping_" + Date.now(),
    icon: "icon.svg",
    badge: "icon.svg",
    data: {
      reminderId: options.reminderId || null
    },
    actions: options.actions || [
      { action: "snooze_15", title: "Snooze 15m" },
      { action: "mark_done", title: "Done" }
    ]
  };

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "TRIGGER_NOTIFICATION",
      ...payload
    });
  } else if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: payload.icon,
        badge: payload.badge
      });
    } catch (e) {}
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

// ============================================================================
// TRASH & RETENTION ENGINE (24 Hours)
// ============================================================================
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

function moveToTrash(id, wrapper = null) {
  if (wrapper) {
    wrapper.classList.add("deleting");
  }

  setTimeout(() => {
    const noteIndex = reminders.findIndex(r => r.id === id);
    if (noteIndex !== -1) {
      const [deletedNote] = reminders.splice(noteIndex, 1);
      deletedNote.deletedAt = Date.now();
      trashedNotes.unshift(deletedNote);
      persistTrash();
      persistAndSync();
    }
  }, wrapper ? 280 : 0);
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
    showToast("Note Restored");
  }
}

function permanentlyDeleteFromTrash(id) {
  trashedNotes = trashedNotes.filter(t => t.id !== id);
  persistTrash();
}

function animateTrashCardRemoval(card, type, callback) {
  if (card.classList.contains("restoring") || card.classList.contains("deleting")) return;
  card.classList.add(type);
  card.style.opacity = "0";
  card.style.transform = type === "restoring" ? "translateY(-20px)" : "translateX(-100%)";
  setTimeout(() => {
    callback();
  }, 260);
}

function emptyEntireTrash() {
  trashedNotes = [];
  persistTrash();
  showToast("Trash Emptied");
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
    if (emptyState) emptyState.style.display = "flex";
    if (emptyBtn) emptyBtn.classList.add("hidden");
  } else {
    if (emptyState) emptyState.style.display = "none";
    if (emptyBtn) emptyBtn.classList.remove("hidden");

    trashedNotes.forEach((item) => {
      const card = document.createElement("div");
      card.className = "trash-item-card";
      card.innerHTML = `
        <div class="trash-item-header">
          <h4>${escapeHtml(item.title)}</h4>
          <span class="trash-expiry-badge">${formatRemainingTime(item.deletedAt)}</span>
        </div>
        ${item.body ? `<div class="trash-item-body">${escapeHtml(item.body)}</div>` : ""}
        <div class="trash-item-actions">
          <button type="button" class="btn-trash-restore" data-id="${item.id}">Restore</button>
          <button type="button" class="btn-trash-delete" data-id="${item.id}">Delete Now</button>
        </div>
      `;

      card.querySelector(".btn-trash-restore").addEventListener("click", (e) => {
        e.stopPropagation();
        animateTrashCardRemoval(card, "restoring", () => {
          restoreFromTrash(item.id);
        });
      });

      card.querySelector(".btn-trash-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        animateTrashCardRemoval(card, "deleting", () => {
          permanentlyDeleteFromTrash(item.id);
        });
      });

      container.appendChild(card);
    });
  }
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

// ============================================================================
// REMINDERS FORMATTING & STATUS HELPERS
// ============================================================================
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

function getDueStatus(isoString) {
  if (!isoString) return { isOverdue: false, label: "", overdueAgo: "" };
  const targetTs = new Date(isoString).getTime();
  if (isNaN(targetTs)) return { isOverdue: false, label: "", overdueAgo: "" };
  const now = Date.now();
  const isOverdue = now > targetTs;
  const label = formatDueTime(isoString);
  let overdueAgo = "";
  if (isOverdue) {
    const diffMins = Math.floor((now - targetTs) / 60000);
    if (diffMins < 1) overdueAgo = "Just now";
    else if (diffMins < 60) overdueAgo = `${diffMins}m ago`;
    else if (diffMins < 1440) overdueAgo = `${Math.floor(diffMins / 60)}h ago`;
    else overdueAgo = `${Math.floor(diffMins / 1440)}d ago`;
  }
  return { isOverdue, label, overdueAgo };
}

function formatChecklistNotificationBody(item) {
  const items = item.checklistItems || [];
  const pending = items.filter(i => !i.done);
  if (pending.length === 0) {
    return item.body || "All checklist items completed.";
  }
  const topPending = pending.slice(0, 3).map(i => `[ ] ${i.text}`).join("\n");
  const remaining = pending.length - 3;
  if (remaining > 0) {
    return `${topPending}\n(+${remaining} more item${remaining === 1 ? "" : "s"})`;
  }
  return topPending;
}

function snoozeReminderById(reminderId, minutes) {
  const item = reminders.find(r => r.id === reminderId);
  if (!item) return;
  const now = Date.now();
  const baseTs = item.dueTime ? Math.max(now, new Date(item.dueTime).getTime()) : now;
  const newDue = new Date(baseTs + minutes * 60 * 1000);
  item.dueTime = newDue.toISOString();
  item.dueTimeTriggered = false;
  persistAndSync();
  renderReminders();
  showToast(`Snoozed for ${minutes}m`);
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

function renderCardBody(item) {
  if (item.type === "checklist" || (item.checklistItems && item.checklistItems.length > 0)) {
    const items = item.checklistItems || [];
    const total = items.length;
    const completed = items.filter(i => i.done).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const itemsHtml = items.map((ci, idx) => `
      <div class="card-checklist-item ${ci.done ? "completed" : ""}" data-item-index="${idx}">
        <button type="button" class="checklist-item-check" aria-label="Toggle ${escapeHtml(ci.text)}">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <span class="checklist-item-text">${escapeHtml(ci.text)}</span>
      </div>
    `).join("");

    return `
      <div class="card-checklist">
        <div class="card-checklist-progress">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
          <div class="progress-pill-row">
            <span class="progress-pill">${completed} OF ${total} DONE • ${percent}%</span>
          </div>
        </div>
        <div class="card-checklist-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }
  if (!item.body) return "";
  return `<p class="card-body-text">${escapeHtml(item.body)}</p>`;
}

// ============================================================================
// FEED RENDERING & INTERACTIONS
// ============================================================================
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
          pingLabel = `EVERY ${item.pingMinutes / 60}H`;
        } else {
          pingLabel = `EVERY ${item.pingMinutes}M`;
        }
      }

      const dueStatus = getDueStatus(item.dueTime);

      wrapper.innerHTML = `
        <div class="swipe-action-underlay underlay-edit">
          <div class="underlay-icon edit-action-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
            </svg>
          </div>
        </div>
        <div class="swipe-action-underlay underlay-delete">
          <div class="underlay-icon trash-can-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </div>
        </div>
        <div class="card">
          <div class="card-content">
            <div class="card-title-row">
              <h4>${escapeHtml(item.title)}</h4>
              <button class="btn-pin-toggle ${item.pinned ? "active" : ""}" title="${item.pinned ? "Unpin note" : "Pin note to top"}" aria-label="Pin">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22"></line>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.8l-1.78.89A2 2 0 0 0 5 15.24V17z"></path>
                </svg>
              </button>
            </div>
            ${renderCardBody(item)}
            <div class="card-tags-row">
              ${item.pinned ? `<span class="badge-tag badge-pinned">PINNED</span>` : ""}
              ${item.label ? `<span class="badge-tag ${getCategoryBadgeClass(item.label)}">${escapeHtml(item.label)}</span>` : ""}
              ${item.dueTime ? (
                dueStatus.isOverdue
                  ? `<span class="badge-tag badge-due is-overdue">OVERDUE • ${dueStatus.overdueAgo}</span><button type="button" class="btn-card-snooze" data-snooze-id="${item.id}">+15m</button>`
                  : `<span class="badge-tag badge-due">DUE: ${dueStatus.label}</span><button type="button" class="btn-card-snooze" data-snooze-id="${item.id}">+15m</button>`
              ) : ""}
              ${pingLabel ? `<span class="badge-tag badge-alarm">${pingLabel}</span>` : ""}
            </div>
          </div>
          <div class="card-actions-col">
            <button class="btn-complete" title="Move to Trash" aria-label="Complete">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
            <button class="btn-card-menu" title="Options" aria-label="Options">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="5" cy="12" r="2"></circle>
                <circle cx="12" cy="12" r="2"></circle>
                <circle cx="19" cy="12" r="2"></circle>
              </svg>
            </button>
          </div>
        </div>
      `;

      cardList.appendChild(wrapper);
      attachCardInteractions(wrapper, item);
    });
  }
  updateTrashBadge();
  updateAppBadge();
  syncSubscriptionUI();
}
const renderReminders = render;

function persistAndSync() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  render();
  updateAppBadge();
  updateTrashBadge();
  syncSubscriptionUI();
}

function escapeHtml(str) {
  if (!str) return "";
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

// 1:1 Physical Touch & Mouse Swipe Sync
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

  const btnSnooze = wrapper.querySelector(".btn-card-snooze");
  if (btnSnooze) {
    btnSnooze.addEventListener("click", (e) => {
      e.stopPropagation();
      snoozeReminderById(item.id, 15);
    });
  }

  wrapper.querySelectorAll(".card-checklist-item").forEach(itemEl => {
    itemEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(itemEl.dataset.itemIndex, 10);
      if (item.checklistItems && item.checklistItems[idx]) {
        item.checklistItems[idx].done = !item.checklistItems[idx].done;
        itemEl.classList.toggle("completed", item.checklistItems[idx].done);

        const items = item.checklistItems || [];
        const total = items.length;
        const completed = items.filter(i => i.done).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const fillEl = wrapper.querySelector(".progress-bar-fill");
        if (fillEl) fillEl.style.width = `${percent}%`;

        const pillEl = wrapper.querySelector(".progress-pill");
        if (pillEl) pillEl.textContent = `${completed} OF ${total} DONE • ${percent}%`;

        persistAndSync();
      }
    });
  });

  btnDone.addEventListener("click", (e) => {
    e.stopPropagation();
    btnDone.style.transform = "scale(1.25)";
    btnDone.style.background = "rgba(52, 199, 89, 0.22)";
    btnDone.style.borderColor = "var(--system-green)";
    btnDone.style.color = "var(--system-green)";
    if ("vibrate" in navigator) {
      try { navigator.vibrate([15, 30, 20]); } catch (err) {}
    }
    setTimeout(() => {
      moveToTrash(item.id, wrapper);
    }, 180);
  });

  let startX = 0;
  let startY = 0;
  let currentOffsetX = 0;
  let currentOffsetY = 0;
  let swipeDirection = null;
  let hasThresholdCrossed = false;
  let isDragging = false;
  let isReordering = false;
  let longPressTimer = null;
  let placeholder = null;
  let initialRect = null;
  let lastHoveredSibling = null;

  let startTime = 0;

  function onPointerStart(e) {
    if (e.target.closest(".btn-complete") || e.target.closest(".btn-pin-toggle") || e.target.closest(".btn-card-menu") || e.target.closest(".card-checklist-item")) return;

    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    startTime = Date.now();
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
    if (trashIcon) trashIcon.style.transition = "none";
    if (editIcon) editIcon.style.transition = "none";
  }

  function startReorder() {
    isReordering = true;
    const cardList = document.getElementById("card-list");
    if (!cardList) return;

    initialRect = wrapper.getBoundingClientRect();

    placeholder = document.createElement("div");
    placeholder.className = "card-placeholder";
    placeholder.style.height = `${initialRect.height}px`;
    placeholder.style.marginBottom = "12px";

    wrapper.parentNode.insertBefore(placeholder, wrapper);

    wrapper.classList.add("is-dragging");
    wrapper.style.position = "fixed";
    wrapper.style.left = `${initialRect.left}px`;
    wrapper.style.top = `${initialRect.top}px`;
    wrapper.style.width = `${initialRect.width}px`;
    wrapper.style.height = `${initialRect.height}px`;
    wrapper.style.zIndex = "1000";

    if ("vibrate" in navigator) {
      try { navigator.vibrate(35); } catch (err) {}
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const point = e.touches ? e.touches[0] : e;
    const deltaX = point.clientX - startX;
    const deltaY = point.clientY - startY;

    if (isReordering) {
      if (e.cancelable) e.preventDefault();
      wrapper.style.top = `${initialRect.top + deltaY}px`;

      const cardList = document.getElementById("card-list");
      if (!cardList) return;

      const siblings = Array.from(cardList.querySelectorAll(".card-wrapper:not(.is-dragging)"));
      for (const sib of siblings) {
        const box = sib.getBoundingClientRect();
        if (point.clientY >= box.top && point.clientY <= box.bottom) {
          if (sib !== lastHoveredSibling) {
            lastHoveredSibling = sib;
            const middle = box.top + box.height / 2;
            if (point.clientY < middle) {
              cardList.insertBefore(placeholder, sib);
            } else {
              cardList.insertBefore(placeholder, sib.nextSibling);
            }
          }
          break;
        }
      }
      return;
    }

    if (!swipeDirection) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        if (longPressTimer) clearTimeout(longPressTimer);
        if (Math.abs(deltaX) * 0.75 > Math.abs(deltaY)) {
          swipeDirection = deltaX < 0 ? "left" : "right";
        } else {
          isDragging = false;
          return;
        }
      } else {
        return;
      }
    }

    if (swipeDirection) {
      if (e.cancelable) e.preventDefault();
      currentOffsetX = deltaX;
      card.style.transform = `translate3d(${currentOffsetX}px, 0px, 0px)`;

      const cardWidth = card.offsetWidth;
      const progress = Math.min(Math.abs(currentOffsetX) / 60, 1.5);
      const isThreshold = Math.abs(currentOffsetX) >= Math.min(cardWidth * 0.22, 60);

      if (isThreshold && !hasThresholdCrossed) {
        hasThresholdCrossed = true;
        if ("vibrate" in navigator) {
          try { navigator.vibrate(10); } catch (err) {}
        }
      } else if (!isThreshold && hasThresholdCrossed) {
        hasThresholdCrossed = false;
      }

      if (currentOffsetX < 0) {
        if (underlayDelete) underlayDelete.style.opacity = Math.min(progress, 1);
        if (underlayEdit) underlayEdit.style.opacity = 0;
        if (trashIcon) {
          trashIcon.style.transform = `scale(${0.8 + progress * 0.35})`;
        }
      } else {
        if (underlayEdit) underlayEdit.style.opacity = Math.min(progress, 1);
        if (underlayDelete) underlayDelete.style.opacity = 0;
        if (editIcon) {
          editIcon.style.transform = `scale(${0.8 + progress * 0.35})`;
        }
      }
    }
  }

  function onPointerEnd() {
    if (longPressTimer) clearTimeout(longPressTimer);
    if (!isDragging) return;
    isDragging = false;

    if (isReordering) {
      isReordering = false;
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(wrapper, placeholder);
        cleanupReorderStyles();
        reorderRemindersArrayFromDOM(item);
      } else {
        cleanupReorderStyles();
      }
      return;
    }

    if (underlayDelete) underlayDelete.style.opacity = 0;
    if (underlayEdit) underlayEdit.style.opacity = 0;

    const cardWidth = card.offsetWidth;
    const dist = Math.abs(currentOffsetX);
    const elapsed = Math.max(1, Date.now() - startTime);
    const velocity = dist / elapsed;
    const isFlick = velocity > 0.32 && dist > 35;
    const threshold = Math.min(cardWidth * 0.22, 60);

    if (swipeDirection === "left") {
      if (dist >= threshold || isFlick) {
        card.style.transition = "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = `translate3d(-${cardWidth + 40}px, 0px, 0px)`;
        setTimeout(() => {
          moveToTrash(item.id, wrapper);
        }, 160);
      } else {
        card.style.transition = "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translate3d(0px, 0px, 0px)";
        if (trashIcon) trashIcon.style.transform = "scale(0.8)";
      }
    } else if (swipeDirection === "right") {
      if (dist >= threshold || isFlick) {
        card.style.transition = "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translate3d(0px, 0px, 0px)";
        setTimeout(() => {
          openEditModal(item);
        }, 140);
      } else {
        card.style.transition = "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)";
        card.style.transform = "translate3d(0px, 0px, 0px)";
        if (editIcon) editIcon.style.transform = "scale(0.8)";
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
    if (placeholder && placeholder.parentNode) {
      placeholder.remove();
      placeholder = null;
    }
  }

  card.addEventListener("touchstart", onPointerStart, { passive: false });
  card.addEventListener("touchmove", onPointerMove, { passive: false });
  card.addEventListener("touchend", onPointerEnd, { passive: false });
  card.addEventListener("touchcancel", onPointerEnd, { passive: false });

  card.addEventListener("mousedown", onPointerStart);
  window.addEventListener("mousemove", (e) => {
    if (isDragging) onPointerMove(e);
  });
  window.addEventListener("mouseup", () => {
    if (isDragging) onPointerEnd();
  });
}

// ============================================================================
// CREATE & EDIT MODAL CONTROLS
// ============================================================================
function setupLabelSelector() {
  const container = document.getElementById("label-selector");
  if (!container) return;
  container.querySelectorAll(".label-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const label = pill.getAttribute("data-label");
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

function setEditorMode(mode) {
  const inputNoteType = document.getElementById("input-note-type");
  const tabModeNote = document.getElementById("tab-mode-note");
  const tabModeChecklist = document.getElementById("tab-mode-checklist");
  const modeSliderTrack = document.getElementById("mode-slider-track");
  const panelModeNote = document.getElementById("panel-mode-note");
  const panelModeChecklist = document.getElementById("panel-mode-checklist");
  const checklistRowsContainer = document.getElementById("checklist-rows-container");

  if (inputNoteType) inputNoteType.value = mode;

  if (mode === "checklist") {
    tabModeChecklist?.classList.add("active");
    tabModeNote?.classList.remove("active");
    if (modeSliderTrack) modeSliderTrack.classList.add("show-checklist");
    if (panelModeNote) panelModeNote.classList.remove("active");
    if (panelModeChecklist) panelModeChecklist.classList.add("active");
    if (checklistRowsContainer && checklistRowsContainer.children.length === 0) {
      createBuilderRow("", false, true);
    }
  } else {
    tabModeNote?.classList.add("active");
    tabModeChecklist?.classList.remove("active");
    if (modeSliderTrack) modeSliderTrack.classList.remove("show-checklist");
    if (panelModeNote) panelModeNote.classList.add("active");
    if (panelModeChecklist) panelModeChecklist.classList.remove("active");
  }
}

const tabModeNote = document.getElementById("tab-mode-note");
if (tabModeNote) {
  tabModeNote.addEventListener("click", () => {
    setEditorMode("note");
  });
}

const tabModeChecklist = document.getElementById("tab-mode-checklist");
if (tabModeChecklist) {
  tabModeChecklist.addEventListener("click", () => {
    setEditorMode("checklist");
  });
}

function setAlarmSelectorValue(val) {
  const alarmInput = document.getElementById("input-alarm-value");
  const alarmLabel = document.getElementById("selected-alarm-label");
  const customTimeRow = document.getElementById("custom-time-row");
  if (!alarmInput || !alarmLabel) return;

  alarmInput.value = String(val);

  if (val === "custom") {
    alarmLabel.textContent = "Custom";
    if (customTimeRow) customTimeRow.classList.remove("hidden");
  } else {
    const num = parseInt(val, 10);
    if (customTimeRow) customTimeRow.classList.add("hidden");
    if (!num || num === 0) {
      alarmLabel.textContent = "Off";
    } else if (num >= 60 && num % 60 === 0) {
      alarmLabel.textContent = `Every ${num / 60}h`;
    } else {
      alarmLabel.textContent = `Every ${num}m`;
    }
  }
}

function initAlarmSelector() {
  const btnSelectAlarm = document.getElementById("btn-select-alarm");
  if (!btnSelectAlarm) return;

  btnSelectAlarm.addEventListener("click", () => {
    showIosMenu({
      title: "Recurring Alarm Interval",
      items: [
        {
          label: "Off (No recurring alarm)",
          onClick: () => setAlarmSelectorValue(0)
        },
        {
          label: "Every 1 Minute",
          onClick: () => setAlarmSelectorValue(1)
        },
        {
          label: "Every 5 Minutes",
          onClick: () => setAlarmSelectorValue(5)
        },
        {
          label: "Every 10 Minutes",
          onClick: () => setAlarmSelectorValue(10)
        },
        {
          label: "Every 15 Minutes",
          onClick: () => {
            if (!premiumManager.canUseCustomAlarm()) {
              premiumManager.startCheckout();
              return;
            }
            setAlarmSelectorValue(15);
          }
        },
        {
          label: "Every 30 Minutes",
          onClick: () => {
            if (!premiumManager.canUseCustomAlarm()) {
              premiumManager.startCheckout();
              return;
            }
            setAlarmSelectorValue(30);
          }
        },
        {
          label: "Every 1 Hour",
          onClick: () => {
            if (!premiumManager.canUseCustomAlarm()) {
              premiumManager.startCheckout();
              return;
            }
            setAlarmSelectorValue(60);
          }
        },
        {
          label: "Custom Interval...",
          onClick: () => {
            if (!premiumManager.canUseCustomAlarm()) {
              premiumManager.startCheckout();
              return;
            }
            setAlarmSelectorValue("custom");
          }
        }
      ]
    });
  });
}

function initDueDateControls() {
  const toggleDueTime = document.getElementById("toggle-due-time");
  const inputDueTime = document.getElementById("input-due-time");
  const btnClearDue = document.getElementById("btn-clear-due-time");
  const btnDuePresets = document.getElementById("btn-due-presets");

  if (!inputDueTime) return;

  function setDueDateTime(dateObj) {
    const pad = n => String(n).padStart(2, "0");
    const formatted = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
    inputDueTime.value = formatted;
    if (toggleDueTime) toggleDueTime.checked = true;
    if (btnClearDue) btnClearDue.classList.remove("hidden");
  }

  inputDueTime.addEventListener("click", () => {
    if (typeof inputDueTime.showPicker === "function") {
      try { inputDueTime.showPicker(); } catch (err) {}
    }
  });

  inputDueTime.addEventListener("change", () => {
    if (inputDueTime.value) {
      if (toggleDueTime) toggleDueTime.checked = true;
      if (btnClearDue) btnClearDue.classList.remove("hidden");
    } else {
      if (toggleDueTime) toggleDueTime.checked = false;
      if (btnClearDue) btnClearDue.classList.add("hidden");
    }
  });

  if (toggleDueTime) {
    toggleDueTime.addEventListener("change", () => {
      if (toggleDueTime.checked) {
        if (!inputDueTime.value) {
          const d = new Date(Date.now() + 3600000);
          d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
          setDueDateTime(d);
        }
        if (btnClearDue) btnClearDue.classList.remove("hidden");
      } else {
        inputDueTime.value = "";
        if (btnClearDue) btnClearDue.classList.add("hidden");
      }
    });
  }

  if (btnClearDue) {
    btnClearDue.addEventListener("click", (e) => {
      e.stopPropagation();
      inputDueTime.value = "";
      if (toggleDueTime) toggleDueTime.checked = false;
      btnClearDue.classList.add("hidden");
    });
  }

  if (btnDuePresets) {
    btnDuePresets.addEventListener("click", (e) => {
      e.stopPropagation();
      showIosMenu({
        title: "Due Date Presets",
        items: [
          {
            label: "In 1 Hour",
            onClick: () => {
              const d = new Date(Date.now() + 3600000);
              d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
              setDueDateTime(d);
            }
          },
          {
            label: "Today at 6:00 PM",
            onClick: () => {
              const d = new Date();
              d.setHours(18, 0, 0, 0);
              if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
              setDueDateTime(d);
            }
          },
          {
            label: "Tomorrow at 9:00 AM",
            onClick: () => {
              const d = new Date();
              d.setDate(d.getDate() + 1);
              d.setHours(9, 0, 0, 0);
              setDueDateTime(d);
            }
          },
          {
            label: "In 2 Days",
            onClick: () => {
              const d = new Date();
              d.setDate(d.getDate() + 2);
              d.setHours(9, 0, 0, 0);
              setDueDateTime(d);
            }
          },
          {
            label: "In 1 Week",
            onClick: () => {
              const d = new Date();
              d.setDate(d.getDate() + 7);
              d.setHours(9, 0, 0, 0);
              setDueDateTime(d);
            }
          },
          {
            label: "Clear Due Date",
            destructive: true,
            onClick: () => {
              inputDueTime.value = "";
              if (toggleDueTime) toggleDueTime.checked = false;
              if (btnClearDue) btnClearDue.classList.add("hidden");
            }
          }
        ]
      });
    });
  }
}

function openCreateModal() {
  if (!premiumManager.canAddReminder()) {
    premiumManager.startCheckout();
    return;
  }

  document.getElementById("modal-title").innerText = "ADD REMINDER";
  document.getElementById("btn-submit").innerText = "PIN TO LOCK SCREEN";
  document.getElementById("edit-reminder-id").value = "";
  document.getElementById("input-title").value = "";
  document.getElementById("input-body").value = "";
  document.getElementById("input-pin-note").checked = false;

  setEditorMode("note");
  populateBuilderChecklist([]);

  const toggleDue = document.getElementById("toggle-due-time");
  const inputDue = document.getElementById("input-due-time");
  const btnClearDue = document.getElementById("btn-clear-due-time");
  if (toggleDue && inputDue) {
    toggleDue.checked = false;
    inputDue.value = "";
    if (btnClearDue) btnClearDue.classList.add("hidden");
  }

  setAlarmSelectorValue(0);
  resetLabelSelection(null);

  openModal("splash-modal");
  setTimeout(() => document.getElementById("input-title")?.focus(), 150);
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
  const inputDue = document.getElementById("input-due-time");
  const btnClearDue = document.getElementById("btn-clear-due-time");
  if (toggleDue && inputDue) {
    if (item.dueTime) {
      toggleDue.checked = true;
      inputDue.value = item.dueTime;
      if (btnClearDue) btnClearDue.classList.remove("hidden");
    } else {
      toggleDue.checked = false;
      inputDue.value = "";
      if (btnClearDue) btnClearDue.classList.add("hidden");
    }
  }

  resetLabelSelection(item.label || null);

  const customTimeRow = document.getElementById("custom-time-row");
  if ([0, 1, 5, 10, 15, 30, 60].includes(item.pingMinutes)) {
    setAlarmSelectorValue(item.pingMinutes);
    if (customTimeRow) customTimeRow.classList.add("hidden");
  } else if (item.pingMinutes > 0) {
    setAlarmSelectorValue("custom");
    if (customTimeRow) {
      customTimeRow.classList.remove("hidden");
      if (item.pingMinutes >= 60 && item.pingMinutes % 60 === 0) {
        document.getElementById("custom-val").value = item.pingMinutes / 60;
        document.getElementById("custom-unit").value = "h";
      } else {
        document.getElementById("custom-val").value = item.pingMinutes;
        document.getElementById("custom-unit").value = "m";
      }
    }
  } else {
    setAlarmSelectorValue(0);
    if (customTimeRow) customTimeRow.classList.add("hidden");
  }

  openModal("splash-modal");
}

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  el.classList.add("active");
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el || !el.classList.contains("active")) return;
  el.classList.remove("active");
}

function initSwipeToDismissModals() {
  const modalBackdrops = document.querySelectorAll(".modal-backdrop, .ios-menu-backdrop");

  modalBackdrops.forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        if (backdrop.id === "ios-context-menu-backdrop") {
          hideIosMenu();
        } else {
          closeModal(backdrop.id);
        }
      }
    });

    const sheet = backdrop.querySelector(".modal-sheet, .ios-context-menu");
    if (!sheet) return;

    let startY = 0;
    let startX = 0;
    let currentDeltaY = 0;
    let isTracking = false;
    let startTime = 0;

    sheet.addEventListener("touchstart", (e) => {
      const touch = e.touches[0];
      startY = touch.clientY;
      startX = touch.clientX;
      currentDeltaY = 0;
      startTime = Date.now();

      const scrollable = sheet.querySelector(".modal-body-scroll, .trash-scroll-container, .settings-scroll-container");
      const scrollTop = scrollable ? scrollable.scrollTop : 0;

      if (scrollTop <= 0) {
        isTracking = true;
      } else {
        isTracking = false;
      }
    }, { passive: true });

    sheet.addEventListener("touchmove", (e) => {
      if (!isTracking) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;
      const deltaX = touch.clientX - startX;

      if (deltaY > 0 && deltaY > Math.abs(deltaX) * 0.75) {
        currentDeltaY = deltaY;
        sheet.classList.add("is-swiping");
        sheet.style.transform = `translate3d(0, ${deltaY}px, 0)`;
        if (e.cancelable) e.preventDefault();
      } else if (deltaY < 0) {
        currentDeltaY = 0;
        sheet.style.transform = "";
        sheet.classList.remove("is-swiping");
      }
    }, { passive: false });

    function handleEnd() {
      if (!isTracking) return;
      isTracking = false;
      sheet.classList.remove("is-swiping");
      sheet.style.transition = "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)";

      const elapsed = Math.max(1, Date.now() - startTime);
      const velocity = currentDeltaY / elapsed;
      const isFlick = velocity > 0.35 && currentDeltaY > 35;

      if (currentDeltaY > 70 || isFlick) {
        sheet.style.transform = "translate3d(0, 100%, 0)";
        setTimeout(() => {
          sheet.style.transform = "";
          sheet.style.transition = "";
          if (backdrop.id === "ios-context-menu-backdrop") {
            hideIosMenu();
          } else {
            closeModal(backdrop.id);
          }
        }, 180);
      } else {
        sheet.style.transform = "";
        setTimeout(() => {
          sheet.style.transition = "";
        }, 280);
      }
      currentDeltaY = 0;
    }

    sheet.addEventListener("touchend", handleEnd, { passive: true });
    sheet.addEventListener("touchcancel", handleEnd, { passive: true });
  });
}

// Background Interval Loop
setInterval(() => {
  const now = Date.now();
  let changed = false;

  reminders.forEach(item => {
    if (item.dueTime && !item.dueTimeTriggered) {
      const targetTs = new Date(item.dueTime).getTime();
      if (!isNaN(targetTs) && now >= targetTs) {
        item.dueTimeTriggered = true;
        changed = true;
        const alertHeading = item.label ? `[${item.label}] ${item.title}` : item.title;
        const noteBody = (item.type === "checklist" || (item.checklistItems && item.checklistItems.length > 0))
          ? formatChecklistNotificationBody(item)
          : (item.body || "Scheduled reminder alert.");

        playDueChime();
        showToast(`⏰ Due: ${item.title}`);

        triggerNotification(`DUE: ${alertHeading}`, noteBody, item.id + "_due", {
          reminderId: item.id,
          actions: [
            { action: "snooze_15", title: "Snooze 15m" },
            { action: "mark_done", title: "Done" }
          ]
        });
      }
    }

    if (item.pingMinutes > 0) {
      const intervalMs = item.pingMinutes * 60 * 1000;
      if (now - item.lastPing >= intervalMs) {
        item.lastPing = now;
        changed = true;
        const alertHeading = item.label ? `[${item.label}] ${item.title}` : item.title;
        const noteBody = (item.type === "checklist" || (item.checklistItems && item.checklistItems.length > 0))
          ? formatChecklistNotificationBody(item)
          : (item.body || "Pinned note remains active.");

        playDueChime();
        showToast(`Alarm: ${item.title}`);

        triggerNotification(alertHeading, noteBody, item.id, {
          reminderId: item.id
        });
      }
    }
  });

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    renderReminders();
  }

  checkDailyMorningBriefing();
  cleanupExpiredTrash();
}, 1000);

const btnAdd = document.getElementById("btn-add");
if (btnAdd) btnAdd.addEventListener("click", openCreateModal);

const btnCloseModal = document.getElementById("btn-close-modal");
if (btnCloseModal) {
  btnCloseModal.addEventListener("click", () => {
    closeModal("splash-modal");
  });
}

// ============================================================================
// CONTEXT MENU / ACTION SHEET (LIQUID GLASS)
// ============================================================================
function showIosMenu({ title = "Options", items = [] }) {
  const backdrop = document.getElementById("ios-context-menu-backdrop");
  const menuTitle = document.getElementById("ios-menu-title");
  const menuItemsContainer = document.getElementById("ios-menu-items");

  if (!backdrop || !menuItemsContainer) return;

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
      <span>${item.icon || ""}</span>
    `;
    btn.addEventListener("click", () => {
      closeIosMenu();
      if (item.action) item.action();
    });
    menuItemsContainer.appendChild(btn);
  });

  backdrop.classList.add("active");
}

function closeIosMenu() {
  const backdrop = document.getElementById("ios-context-menu-backdrop");
  if (!backdrop) return;
  backdrop.classList.remove("active");
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
  const trashSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
  const clockSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;

  const menuItems = [
    {
      label: item.pinned ? "Unpin Note" : "Pin Note to Top",
      icon: pinSvg,
      action: () => {
        item.pinned = !item.pinned;
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
        persistAndSync();
      }
    }
  ];

  if (item.dueTime) {
    menuItems.push(
      {
        label: "Snooze 15 Minutes",
        icon: clockSvg,
        action: () => snoozeReminderById(item.id, 15)
      },
      {
        label: "Snooze 1 Hour",
        icon: clockSvg,
        action: () => snoozeReminderById(item.id, 60)
      },
      {
        label: "Snooze to Tomorrow 9 AM",
        icon: clockSvg,
        action: () => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
          item.dueTime = d.toISOString();
          item.dueTimeTriggered = false;
          persistAndSync();
          renderReminders();
          showToast("Snoozed to tomorrow 9:00 AM");
        }
      }
    );
  }

  if (item.type === "checklist" && item.checklistItems && item.checklistItems.length > 0) {
    const hasUnchecked = item.checklistItems.some(i => !i.done);
    menuItems.push({
      label: hasUnchecked ? "Complete All Items" : "Uncheck All Items",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      action: () => {
        item.checklistItems.forEach(i => i.done = hasUnchecked);
        persistAndSync();
        renderReminders();
      }
    });
  }

  menuItems.push({
    label: "Move to Trash",
    icon: trashSvg,
    destructive: true,
    action: () => {
      moveToTrash(item.id, wrapper);
    }
  });

  showIosMenu({
    title: item.title || "Note Options",
    items: menuItems
  });
}

// Checklist Builder Logic
const checklistRowsContainer = document.getElementById("checklist-rows-container");
const btnAddChecklistRow = document.getElementById("btn-add-checklist-row");
const btnChecklistMenu = document.getElementById("btn-checklist-menu");

function createBuilderRow(text = "", done = false, autoFocus = false) {
  if (!checklistRowsContainer) return null;
  const rowId = "ci_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
  const row = document.createElement("div");
  row.className = "builder-row";
  row.dataset.rowId = rowId;

  row.innerHTML = `
    <button type="button" class="builder-row-check ${done ? "checked" : ""}" title="Toggle Complete">
      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>
    <input type="text" class="builder-row-input ${done ? "checked" : ""}" placeholder="List item..." value="${escapeHtml(text)}">
    <button type="button" class="builder-row-del" title="Delete row">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  const checkBtn = row.querySelector(".builder-row-check");
  const input = row.querySelector(".builder-row-input");
  const delBtn = row.querySelector(".builder-row-del");

  checkBtn.addEventListener("click", () => {
    checkBtn.classList.toggle("checked");
    input.classList.toggle("checked");
  });

  delBtn.addEventListener("click", () => {
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
    createBuilderRow("", false, true);
  });
}

function openChecklistBuilderIosMenu() {
  const checkSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  const uncheckSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect></svg>`;
  const clearSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>`;
  const trashSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

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
        }
      },
      {
        label: "Delete All Items",
        icon: trashSvg,
        destructive: true,
        action: () => {
          checklistRowsContainer.innerHTML = "";
          createBuilderRow("", false, true);
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
      btnClearSearch?.classList.remove("hidden");
    } else {
      btnClearSearch?.classList.add("hidden");
    }
    render();
  });
}

if (btnClearSearch) {
  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    btnClearSearch.classList.add("hidden");
    render();
  });
}

const categoryFilters = document.getElementById("category-filters");
if (categoryFilters) {
  categoryFilters.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const filter = chip.getAttribute("data-filter");
      categoryFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      if (activeFilterCategory === filter || filter === "all") {
        activeFilterCategory = null;
        const allChip = categoryFilters.querySelector('.filter-chip[data-filter="all"]');
        if (allChip) allChip.classList.add("active");
      } else {
        activeFilterCategory = filter;
        chip.classList.add("active");
      }
      render();
    });
  });
}

// Backup Export & Import Functions
function exportBackupData() {
  const data = {
    app: "Postr",
    version: "1.0",
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
  showToast("Backup Exported");
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
        showToast(`Imported ${reminders.length} reminders`);
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Failed to parse backup JSON file.");
    }
  };
  reader.readAsText(file);
}

const btnExportBackup = document.getElementById("btn-export-backup");
if (btnExportBackup) btnExportBackup.addEventListener("click", exportBackupData);

const fileImportBackup = document.getElementById("file-import-backup");
if (fileImportBackup) {
  fileImportBackup.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      importBackupData(e.target.files[0]);
    }
  });
}

// Form Submission
document.getElementById("reminder-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const editId = document.getElementById("edit-reminder-id").value;
  const title = document.getElementById("input-title").value.trim();
  const noteType = document.getElementById("input-note-type")?.value || "note";
  const rawBody = document.getElementById("input-body").value.trim();
  const checklistItems = (noteType === "checklist") ? getBuilderChecklistItems() : [];

  let body = rawBody;
  if (noteType === "checklist") {
    body = checklistItems.map(i => (i.done ? "[x] " : "[ ] ") + i.text).join("\n");
  }

  const isPinned = document.getElementById("input-pin-note").checked;
  const toggleDue = document.getElementById("toggle-due-time");
  const isDueActive = toggleDue ? toggleDue.checked : false;
  const rawDueVal = document.getElementById("input-due-time") ? document.getElementById("input-due-time").value : "";
  const dueTimeVal = (isDueActive && rawDueVal) ? rawDueVal : (rawDueVal || null);

  const alarmInput = document.getElementById("input-alarm-value");
  const selectedAlarm = alarmInput ? alarmInput.value : "0";

  let finalMinutes = 0;
  if (selectedAlarm === "custom") {
    if (!premiumManager.canUseCustomAlarm()) {
      premiumManager.startCheckout();
      return;
    }
    const val = parseInt(document.getElementById("custom-val").value, 10) || 1;
    const unit = document.getElementById("custom-unit").value;
    finalMinutes = (unit === "h") ? (val * 60) : val;
  } else {
    finalMinutes = parseInt(selectedAlarm, 10) || 0;
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
    showToast("Changes Saved");
  } else {
    if (!premiumManager.canAddReminder()) {
      premiumManager.startCheckout();
      return;
    }

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
    const alertHeading = newReminder.label ? `[${newReminder.label}] ${title}` : title;
    triggerNotification(alertHeading, body || "Added to active reminders.", newReminder.id);
    activeFilterCategory = null;
    if (categoryFilters) {
      categoryFilters.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      const allChip = categoryFilters.querySelector('.filter-chip[data-filter="all"]');
      if (allChip) allChip.classList.add("active");
    }
    showToast("Reminder Added");
  }

  persistAndSync();
  closeModal("splash-modal");
});

// Tips Carousel
let currentSlide = 0;
const totalSlides = 5;
const track = document.querySelector(".carousel-slides");
const dots = document.querySelectorAll(".carousel-dots .dot");
let startCarouselX = 0;
let isDraggingCarousel = false;

function updateCarousel() {
  if (!track) return;
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
if (viewport) {
  viewport.addEventListener("touchstart", (e) => {
    startCarouselX = e.touches[0].clientX;
    isDraggingCarousel = true;
  });
  viewport.addEventListener("touchend", (e) => {
    if (!isDraggingCarousel) return;
    const diffX = e.changedTouches[0].clientX - startCarouselX;
    handleCarouselSwipe(diffX);
    isDraggingCarousel = false;
  });
  viewport.addEventListener("mousedown", (e) => {
    startCarouselX = e.clientX;
    isDraggingCarousel = true;
  });
  viewport.addEventListener("mouseup", (e) => {
    if (!isDraggingCarousel) return;
    const diffX = e.clientX - startCarouselX;
    handleCarouselSwipe(diffX);
    isDraggingCarousel = false;
  });
}

function handleCarouselSwipe(diffX) {
  const threshold = 40;
  if (diffX < -threshold && currentSlide < totalSlides - 1) {
    currentSlide++;
    updateCarousel();
  } else if (diffX > threshold && currentSlide > 0) {
    currentSlide--;
    updateCarousel();
  }
}

const btnOpenGuideCell = document.getElementById("btn-open-guide-cell");
if (btnOpenGuideCell) {
  btnOpenGuideCell.addEventListener("click", () => {
    currentSlide = 0;
    updateCarousel();
    openModal("tips-modal");
  });
}

const btnCloseTips = document.getElementById("btn-close-tips");
if (btnCloseTips) {
  btnCloseTips.addEventListener("click", () => {
    closeModal("tips-modal");
  });
}

// Viewport Height Calculation
function updateViewportHeight() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = Boolean(window.navigator && window.navigator.standalone) || 
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  let actualHeight;
  if (isIOS && isStandalone) {
    const screenH = window.screen ? window.screen.height : 0;
    actualHeight = Math.max(screenH, window.innerHeight || 0);
  } else if (window.visualViewport) {
    actualHeight = window.visualViewport.height;
  } else {
    actualHeight = window.innerHeight;
  }

  document.documentElement.style.setProperty("--real-vh", `${actualHeight}px`);
  document.documentElement.style.setProperty("--app-height", `${actualHeight}px`);
}

window.addEventListener("resize", updateViewportHeight);
window.addEventListener("orientationchange", updateViewportHeight);
window.addEventListener("pageshow", updateViewportHeight);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateViewportHeight();
  }
});

// Daily Morning Briefing
function checkDailyMorningBriefing() {
  const isEnabled = localStorage.getItem(MORNING_BRIEFING_KEY) === "true";
  if (!isEnabled) return;

  const now = new Date();
  if (now.getHours() < 8) return;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const lastRun = localStorage.getItem(LAST_BRIEFING_DATE_KEY);

  if (lastRun === todayStr) return;

  localStorage.setItem(LAST_BRIEFING_DATE_KEY, todayStr);

  const totalCount = reminders.length;
  const pinnedCount = reminders.filter(r => r.pinned).length;
  const dueCount = reminders.filter(r => r.dueTime).length;

  if (totalCount === 0) return;

  const msg = `You have ${totalCount} reminder${totalCount === 1 ? "" : "s"} today: ${pinnedCount} pinned, ${dueCount} scheduled.`;
  triggerNotification("Good Morning", msg, "postr_briefing_" + todayStr);
}

const toggleMorningBriefing = document.getElementById("toggle-morning-briefing");
if (toggleMorningBriefing) {
  toggleMorningBriefing.checked = localStorage.getItem(MORNING_BRIEFING_KEY) === "true";
  toggleMorningBriefing.addEventListener("change", () => {
    const enabled = toggleMorningBriefing.checked;
    localStorage.setItem(MORNING_BRIEFING_KEY, enabled ? "true" : "false");
    if (enabled && "Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    showToast(enabled ? "Morning Briefing enabled (8:00 AM)" : "Morning Briefing disabled");
  });
}

// Initial App Bootstrap
initThemeAndAppearance();
initTopNavigation();
initDueDateControls();
initAlarmSelector();
initSwipeToDismissModals();
updateViewportHeight();
setupDynamicAppIcon();
setupLabelSelector();
updateNotifyButton();
updateTrashBadge();
updateAppBadge();
syncSubscriptionUI();
render();
