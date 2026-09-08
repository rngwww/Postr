// Local persistence store
const STORAGE_KEY = "postr_notes_db";
let reminders = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

// Audio synthesizer for repeating ping alerts
function triggerHapticPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
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

// Save & Sync State
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
      // In-App Sticky Card
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-content">
          <h3>${escapeHtml(item.title)}</h3>
          ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
          ${item.ping > 0 ? `<div class="card-meta">PING: EVERY ${item.ping}M</div>` : ""}
        </div>
        <button class="btn-complete" title="Mark Done" onclick="completeReminder('${item.id}')">✓</button>
      `;
      cardList.appendChild(card);

      // Lock Screen Live Activity Item
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
  reminders = reminders.filter(r => r.id !== id);
  triggerHapticPing();
  persistAndSync();
}

// Notification & Ping Scheduler
setInterval(() => {
  const now = Date.now();
  let alerted = false;
  reminders.forEach(item => {
    if (item.ping > 0) {
      const intervalMs = item.ping * 60 * 1000;
      if (now - item.lastPing >= intervalMs) {
        item.lastPing = now;
        alerted = true;
        if (Notification.permission === "granted") {
          new Notification("POSTR: " + item.title, {
            body: item.body || "Sticky note is still active on lock screen.",
            tag: item.id
          });
        }
      }
    }
  });
  if (alerted) {
    triggerHapticPing();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }
}, 10000);

// Event Handlers
document.getElementById("btn-add").addEventListener("click", () => {
  document.getElementById("modal-title").innerText = "NEW REMINDER";
  document.getElementById("splash-modal").classList.remove("hidden");
  document.getElementById("input-title").focus();
});

document.getElementById("btn-backtap").addEventListener("click", () => {
  document.getElementById("modal-title").innerText = "QUICK PIN (BACK TAP)";
  document.getElementById("splash-modal").classList.remove("hidden");
  document.getElementById("input-title").focus();
  triggerHapticPing();
});

document.getElementById("btn-close-modal").addEventListener("click", () => {
  document.getElementById("splash-modal").classList.add("hidden");
});

document.getElementById("btn-tips").addEventListener("click", () => {
  document.getElementById("tips-modal").classList.remove("hidden");
});

document.getElementById("btn-close-tips").addEventListener("click", () => {
  document.getElementById("tips-modal").classList.add("hidden");
});

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
  triggerHapticPing();

  // Reset form
  document.getElementById("input-title").value = "";
  document.getElementById("input-body").value = "";
  document.getElementById("p0").checked = true;
  document.getElementById("splash-modal").classList.add("hidden");
});

// Request Notification Permission on first user interaction
document.addEventListener("click", () => {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}, { once: true });

// Initial Render
render();