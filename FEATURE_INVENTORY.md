# Feature Inventory and Regression Contract

This document provides a complete checklist of all functional specifications, state models, UI components, gestures, storage keys, and edge cases in the application. Every item listed here must be preserved in the redesign.

---

## Pass 1: Complete System Audit

### 1. Data Models and Storage

#### Storage Keys (localStorage)
- postr_notes_db: JSON array containing active reminders and notes.
- postr_trash_db: JSON array containing deleted notes held for 24-hour retention.
- postr_morning_briefing_enabled: Boolean flag stored as string ("true" or "false").
- postr_last_morning_briefing_date: ISO date string ("YYYY-MM-DD") recording the last date the morning briefing was triggered.
- postr_app_lock_enabled: Boolean flag stored as string ("true" or "false").
- postr_pin_code: 4-digit numeric string for passcode protection.
- postr_webauthn_id: Base64-encoded credential ID string for biometric authentication.

#### Note / Reminder Entity Schema
- id: String identifier generated as "postr_" + Date.now().
- title: String title (required, trimmed).
- type: String indicating note format ("note" or "checklist").
- body: String text content. For checklists, formatted with item indicators.
- checklistItems: Array of objects, each containing:
  - id: String identifier ("ci_" + timestamp + random suffix).
  - text: String item text (trimmed).
  - done: Boolean completion flag.
- label: String category name or null ("School", "Work", "Shopping", "Personal", "Tasks").
- pinned: Boolean flag indicating top-pinned status.
- dueTime: ISO 8601 datetime-local string or null.
- dueTimeTriggered: Boolean flag to prevent duplicate due-time notification alerts.
- pingMinutes: Number indicating recurring alarm interval in minutes (0 for off, 1, 5, 10, or custom minutes/hours).
- createdAt: Timestamp number in milliseconds.
- lastPing: Timestamp number in milliseconds of the last recurring ping.
- _justRestored: Transient boolean flag used for highlighting restored notes.

#### Trashed Note Entity Schema
- Inherits all Note / Reminder fields.
- deletedAt: Timestamp number in milliseconds when moved to trash.
- Retention period: Exactly 24 hours (86,400,000 milliseconds). Automatically purged once expired.

---

### 2. Navigation and Header Controls

- POSTR Logo:
  - Text button in top navigation.
  - Tapping opens the About and Preferences modal.
- Trash Button:
  - Bin icon with dynamic counter badge.
  - Badge displays number of trashed items; hidden when trash is empty.
  - Tapping opens the 24-hour trash modal.
- Notification Permission Bell:
  - Bell icon button.
  - Displays active class / highlight when Notification.permission is "granted".
  - Hidden on platforms lacking Notification API support.
  - Tapping requests notification permission and triggers a test notification upon approval.
- Tips / Guide Button:
  - Lightbulb icon button.
  - Tapping resets carousel index to 0 and opens the multi-screen tips modal.

---

### 3. Search and Category Filtering

- Search Input:
  - Text input with real-time query filtering across title, body, and category label.
  - Clear button appears when query is not empty; tapping resets query and hides clear button.
- Category Filter Chips:
  - Five preset categories: School, Work, Shopping, Personal, Tasks.
  - Each chip has a dedicated pastel color styling.
  - Tapping an inactive chip filters the feed to that category.
  - Tapping the currently active chip clears the filter and displays all notes.
  - Search query and category filter work concurrently (AND logic).

---

### 4. Feed and Card List

- Empty State:
  - Displayed when no reminders match active filters or when database is empty.
  - Title: "NO ACTIVE POSTS".
  - Subtitle: "Tap + to pin a persistent reminder."
- Card Rendering and Content:
  - Pinned cards are displayed at the top of the feed ahead of unpinned cards.
  - Within pinned and unpinned groups, manual drag-and-drop ordering is preserved.
  - Card title row displays title text and a quick pin toggle button.
  - Card body displays either:
    - Text body with paragraph wrapping for standard notes.
    - Interactive checklist container with progress bar, completion ratio label ("X OF Y DONE • Z%"), and item checkboxes.
  - Metadata tags row:
    - "PINNED" badge if pinned is true.
    - Category pastel pill if label is set.
    - Due time tag:
      - Normal due tag displaying formatted month, day, and time ("DUE: Mon DD HH:MM").
      - Overdue state displaying "OVERDUE • Xm ago" / "Xh ago" / "Xd ago" if current time exceeds due time.
    - Snooze +15m button next to due tag; tapping adds 15 minutes to dueTime.
    - Recurring alarm label if pingMinutes is greater than zero ("ALARM: EVERY XM" or "ALARM: EVERY XH").
  - Card Action Column:
    - Complete / checkmark button: moves note to trash with animation.
    - Options button (three dots): opens native iOS action sheet context menu.

---

### 5. Gestures and Direct Manipulation

- Swipe Left (Delete):
  - Card translates horizontally with touch or mouse pointer.
  - Underlay reveals red background and trash icon.
  - Trash icon scales and rotates proportionally to swipe distance.
  - Crossing threshold (42% of width or 130px) triggers deletion on release.
  - Releasing before threshold animates card back to origin.
- Swipe Right (Edit):
  - Card translates rightwards revealing orange underlay and edit icon.
  - Edit icon scales and rotates proportionally to swipe distance.
  - Crossing threshold triggers opening the edit modal on release.
- Long Press and Drag to Reorder:
  - Holding for 340ms without horizontal movement initiates reordering.
  - Dragged card is lifted with a shadow.
  - Ghost placeholder reserves space in the list.
  - Moving above or below siblings swaps placeholder position dynamically.
  - Auto-scrolls feed when dragging near the top or bottom edge of the container.
  - Reordering automatically updates pinned flag if moved across pinned/unpinned boundary.
  - Reordered position is persisted to localStorage.

---

### 6. Quick Pin / Creator Modal

- Segmented Mode Switcher:
  - Toggle between Note and Checklist mode.
  - In Note mode: body textarea is displayed.
  - In Checklist mode: body textarea is hidden, and the interactive checklist builder is displayed.
- Form Inputs:
  - Title input (required, autofocus).
  - Body textarea (optional).
  - Checklist builder:
    - Add item button adds a new row.
    - Each row includes a completion checkbox, text input, and delete row button.
    - Keyboard Enter on a row creates a new row below it and focuses it.
    - Keyboard Backspace on an empty row removes it and focuses the preceding row.
    - Checklist actions menu (three dots): Mark All Complete, Unmark All, Clear Completed Items, Delete All Items.
  - Category selector:
    - Five pastel pills (School, Work, Shopping, Personal, Tasks).
    - Tapping selects label; tapping again deselects.
  - Pin to Top toggle switch.
  - Specific Due Time toggle switch:
    - Enabling reveals and activates datetime-local input.
    - Clear button to reset date value.
    - Defaults to nearest upcoming hour rounded to 5 minutes if empty.
  - Recurring Alarm radio segmented control:
    - Presets: Off (0), 1m (1), 5m (5), 10m (10), Custom.
    - Selecting Custom reveals numeric quantity input (1 to 1000) and unit selector (minutes or hours).
- Form Submission:
  - Validates title presence.
  - Creates new note or updates existing note based on hidden edit ID.
  - Closes modal, syncs storage, updates app icon and badges, and renders feed.

---

### 7. Trash / Recently Deleted Modal

- Header and Banner:
  - Title: "RECENTLY DELETED".
  - 24-hour retention notice banner.
- List and Items:
  - Displays each trashed note with title, body snippet, and dynamic expiration countdown ("Xh Ym left" or "Xm left").
  - Restore button: removes note from trash, restores to top of active reminders, and displays confirmation.
  - Delete Now button: permanently removes note immediately.
  - Removal animation slides item out and smoothly shifts sibling cards upward.
- Empty State:
  - Displayed when trash is empty: "Trash is empty".
- Empty Entire Trash Button:
  - Confirms action via prompt.
  - Stagger-animates all trash cards and clears trash storage.

---

### 8. iOS Context Menu Action Sheet

- Dynamic Action Sheet triggered from card options button or checklist menu:
  - Card options menu includes:
    - Pin Note to Top / Unpin Note.
    - Edit Note (opens edit modal).
    - Duplicate Note (creates copy with "(Copy)" suffix and current timestamp).
    - Snooze 15 Minutes (available if dueTime exists).
    - Snooze 1 Hour (available if dueTime exists).
    - Snooze to Tomorrow 9 AM (available if dueTime exists).
    - Complete All Items / Uncheck All Items (available for checklists).
    - Move to Trash (destructive red styling).
    - Separate Cancel button at bottom.
  - Checklist builder menu includes:
    - Mark All Complete.
    - Unmark All.
    - Clear Completed Items.
    - Delete All Items (destructive red styling).
    - Separate Cancel button at bottom.
  - Tapping backdrop or cancel button dismisses menu with animation.

---

### 9. About and Preferences Modal

- Application branding and version information.
- Specifications summary table (palette, gestures, trash retention, engine).
- Daily Morning Briefing toggle:
  - When enabled, triggers an 8:00 AM summary notification detailing total, pinned, and scheduled counts.
  - Prompts for notification permission if not yet granted.
- App Lock toggle:
  - Enables passcode and biometric protection.
  - If no PIN is configured, opens the PIN setup modal.
  - Shows Change 4-Digit PIN button when PIN is active.
- Data Backup and Restore:
  - Export Backup (JSON): downloads file named postr-backup-YYYY-MM-DD.json.
  - Import Backup: file picker reads and validates JSON, restores reminders and trash, and alerts on invalid structure.

---

### 10. Security and App Lock Screen

- App Lock Screen Overlay:
  - Activates when postr_app_lock_enabled is true and app is opened or unhidden.
  - Biometric authentication trigger (Face ID / Touch ID / WebAuthn).
  - 4-digit PIN indicator dots with animated fill and shake-on-error animation.
  - Custom numeric keypad (digits 0 through 9, biometric icon, delete button).
  - Automatically verifies when 4th digit is keyed in; unlocks on match, clears and shakes on mismatch.
- PIN Setup and Change Modal:
  - Inputs for Passcode (4 Digits) and Confirm 4-Digit PIN.
  - Enforces numeric 4-digit format and match validation.
  - Saves PIN, enables lock, and initiates WebAuthn credential registration if supported.
- Lifecycle auto-lock:
  - document.visibilitychange locks app whenever document enters "hidden" state.

---

### 11. Tips and Guide Carousel

- Six instructional slides:
  - Slide 1: Swipe Actions (Swipe right to edit, swipe left to delete).
  - Slide 2: 24-Hour Trash and Restore.
  - Slide 3: Checklists and iOS Menus.
  - Slide 4: Pin to Top and Categories.
  - Slide 5: Due Dates and Alarm.
  - Slide 6: Data Backup and Back Tap (Shortcut integration instructions).
- Touch and mouse swipe gestures across carousel viewport with 40px threshold.
- Interactive slide indicator dots.

---

### 12. Background Engine and Service Worker

- Service Worker (sw.js):
  - Listens for TRIGGER_NOTIFICATION postMessages.
  - Shows notification with custom icon, tag, requireInteraction, renotify, and action buttons ("Snooze 15m", "Done").
  - Handles notification click:
    - Snooze 15m sends NOTIFICATION_ACTION_SNOOZE back to client window.
    - Done sends NOTIFICATION_ACTION_DONE back to client window.
    - Body click sends NOTIFICATION_CLICK_OPEN, focuses window, and scrolls note into view.
- 1-Second Background Interval Loop:
  - Scans reminders for reached due times and triggers due notifications.
  - Scans reminders for recurring ping intervals and triggers repeat notifications.
  - Checks morning briefing trigger criteria.
  - Cleans up expired trash items older than 24 hours.
- Dynamic App Icon Canvas:
  - Renders 512x512 canvas with dark silhouette, SF Pro 'P' glyph, and red indicator dot.
  - Updates dynamic-apple-icon and dynamic-favicon links with PNG data URLs.
- App Badges:
  - Updates navigator.setAppBadge with count of active reminders.
  - Clears badge when active reminder count is zero.

---

## Second Pass: In-Depth Edge Cases, Niche Behaviors, and Gaps

The following niche details and edge cases were identified during the second audit pass:

1. Missing Toast Feedback Implementation:
   - In the existing codebase, multiple actions call `showToast(...)` (for note restoration, trash emptying, snooze confirmation, morning briefing toggle, biometric unlock, PIN save, and lock toggle).
   - `showToast` is currently undefined in the global scope. A native iOS style toast banner / pill must be implemented to fulfill all these calls cleanly.

2. Due Time Input Formatting and Clearing:
   - When enabling the due time toggle, if no date is set, the input automatically pre-fills with the next upcoming hour rounded up to the nearest 5-minute increment.
   - Disabling the due time toggle disables the datetime-local input and clears/disables the clear button.
   - When a due note is edited and saved, `dueTimeTriggered` is reset to false so that modified due times can fire again.

3. Drag-and-Drop Pin Status Transition:
   - When dragging an item across the boundary between pinned notes and unpinned notes, its `pinned` property is automatically flipped:
     - Dragging a pinned note below any unpinned note sets `pinned = false`.
     - Dragging an unpinned note above any pinned note sets `pinned = true`.

4. Checklist Notification Summarization:
   - When a checklist item triggers a due or recurring notification, the notification body is dynamically composed:
     - If all items are completed: fallback to note body or "All checklist items completed."
     - If items are pending: lists the first 3 pending items formatted as "□ ItemText", followed by "(+X more items)" if more than 3 remain.

5. Service Worker Fallback Mode:
   - If the service worker is not active or supported, the notification trigger falls back to the browser `Notification` constructor if permission is granted.
   - Fallback catches and handles permission denial without throwing uncaught exceptions.

6. App Lock Biometrics Lifecycle:
   - Biometrics use the WebAuthn credential API (`PublicKeyCredential`).
   - If user verification fails or is canceled by the user, the app silently falls back to the 4-digit PIN keypad without locking the user out.
   - Switching app tabs or minimizing the browser immediately re-engages the lock screen if enabled.

7. Custom Time Unit Conversions:
   - When editing a note with recurring alarm, if `pingMinutes` is a multiple of 60, the editor displays the unit as "Hours" with the quotient as value.
   - Otherwise, the unit displays "Minutes".

8. Safe Area and Standalone Viewport Resizing:
   - On iOS standalone PWA mode with `black-translucent`, `window.screen.height` is used to prevent viewport collapse behind the home indicator or dynamic island.
   - Visual viewport resizing dynamically sets `--real-vh` and `--app-height` custom properties.

9. Search Filter Clearing and Reset:
   - Submitting a new reminder automatically clears the active category filter so the newly created reminder is immediately visible in the feed.

10. HTML Escaping:
    - All user-supplied title, body, checklist text, and category strings are sanitized via `escapeHtml` to prevent markup injection across feeds, trash, and action menus.
