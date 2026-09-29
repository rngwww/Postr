# Changelog

## Overview
This document records the visual redesign and functional enhancements applied to Postr. The interface has been rebuilt using the Apple iOS 14 design language as the primary reference for layout, spacing, and controls, combined with the iOS 26 Liquid Glass material specification for translucent surfaces, navigation bars, menus, and the bottom tab bar.

All existing features, data models, persistence keys, and background engines remain fully intact.

---

## Design Kit Conflicts and Liquid Glass Exceptions

### Conflict Resolution Rule
In accordance with the design specification, wherever the iOS 14 UI Kit and the iOS 26 UI Kit presented differing patterns, the iOS 14 Kit served as the baseline for layout, component proportions, form patterns, and typography.

### Liquid Glass Exception Applications
The Liquid Glass material was applied as an exception across the following container components:
1. Bottom Tab Bar: Replaced the fixed black panel with a translucent glass material featuring backdrop blur, saturation boost, hairline specular top border, and subtle drop shadow.
2. Large Title Navigation Bar: Rendered headers with translucent glass backgrounds.
3. Modals and Sheets: Quick Pin creator, Passcode Setup, and User Guide sheets use Liquid Glass backdrops and rounded top sheet contours with an iOS grabber handle.
4. Action Sheet and Context Menus: Built with translucent glass groupings and hairline separators.
5. Reminder Cards: Displayed on translucent glass card surfaces with specular border highlights and soft elevation shadows.
6. Keypad and Lock Screen: Passcode overlay uses full-screen translucent glass with circular glass key buttons.
7. Toast Notification Pill: Built as a top-floating glass capsule.

---

## Typography and Typography Fallbacks

- Font Stack: "Helvetica Neue", Helvetica, Arial, sans-serif.
- Font Weight: 300 (Light).
- Scaling: Layout and typography use relative units (rem) to adapt to user text size settings.
- Platform Fallbacks:
  - Apple devices (iOS, iPadOS, macOS): Renders native Helvetica Neue Light.
  - Windows: Falls back to Arial/sans-serif, maintaining a clean grotesque sans-serif appearance.
  - Android: Falls back to Roboto/sans-serif, maintaining proportional legible spacing.

---

## Themes and Appearance

1. Theme Modes: Added System, Light, and Dark modes. When set to System, the interface synchronizes dynamically with prefers-color-scheme.
2. Background Wallpapers: Bound optimized WebP abstract wallpapers with soft blur to the active theme (wallpaper-dark.webp for dark mode, wallpaper-light.webp for light mode).
3. Theme Color Meta Tags: Meta theme-color dynamically switches between #0a0a0c (dark) and #f2f2f7 (light).
4. Accent Color Customization: Integrated an accent color engine with an 8-color preset palette (Blue, Red, Orange, Green, Teal, Indigo, Purple, Pink) plus an HTML5 color input for arbitrary color selection, persisted to localStorage under postr_accent_color.

---

## Freemium System and Entitlements

A centralized entitlement module (premiumManager) manages plan states and limits.

### Plan Tiers
- Free Plan:
  - Up to 5 active reminders simultaneously.
  - Standard recurring alarm presets (Off, 1m, 5m, 10m).
  - Full checklist functionality, 24-hour trash retention, App Lock (Face ID / Passcode), and JSON backup export/import.
- Premium Plan:
  - Unlimited active reminders.
  - Arbitrary custom recurring alarm intervals (minutes and hours).
  - Custom palette accents and full theme customization.

### Mock Payment System
- Payment is a local simulation for development and testing. No external payment providers (Stripe, StoreKit) are connected.
- The upgrade screen displays a prominent label: "Development mode: no real payment".
- Tapping "Test Purchase" updates the plan to Premium in localStorage and provides immediate confirmation.
- Settings includes a "Cancel Test Subscription" button to revert to Free.
- A development-only toggle switch ("Test Plan Switch") is provided in Settings to test limit behaviors.

---

## Direct Manipulation and Gesture Preservation

1. Swipe Left (Delete): 1:1 translation with red underlay, trash icon scaling, and threshold trigger at 42% or 130px.
2. Swipe Right (Edit): 1:1 translation with orange underlay, edit icon scaling, and threshold trigger.
3. Drag to Reorder: Long press (340ms) lifts card with drop shadow, creates ghost placeholder, supports boundary auto-scrolling, swaps live sibling positions, and persists reordered state to localStorage. Pinned flag flips automatically when moving across the pinned boundary.
4. Interactive Checklists: In-card progress bars and item checkboxes toggle and update completion ratios without opening the editor.

---

## iOS Safari and Device Optimizations

1. Safe Area Insets: Bound to env(safe-area-inset-top), env(safe-area-inset-bottom), env(safe-area-inset-left), and env(safe-area-inset-right).
2. Dynamic Viewport Height: Styled using 100dvh to eliminate address bar shifting on Safari.
3. Form Inputs: Configured with minimum 16px font sizes to prevent Safari auto-zoom on focus.
4. Touch Delays: Applied touch-action: manipulation and disabled tap highlight flashing.
5. Modals: Configured with overscroll-behavior: contain to eliminate scroll chaining.
6. Emoji Removal: Removed all emoji characters from UI text, code, notifications, and documentation, replacing them with semantic SVG icons or plain text.

---

## iOS 26 Kit Menu Redesign and Tab Navigation Alignment

1. **Tab Bar Reordering & Symmetry**:
   - Reordered main bottom navigation tabs: **Trash** (left), **Reminders** (middle), and **Settings** (right).
   - Preserved default active state for **Reminders** (`view-feed`) in the center upon launch.
   - Retained live numeric counter badge on the Trash tab.

2. **iOS 26 Kit Liquid Glass Menu Look and Feel**:
   - Bottom Tab Bar: Integrated 32px backdrop blur with 210% saturation boost, 0.5px specular highlight border, dual-pass inner specular lighting (`inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)` and `inset 0 -1px 1px 0 rgba(0, 0, 0, 0.15)`), and elevated ambient shadow.
   - Active Tab Indicator: Added glowing translucent capsule pill behind active icon with specular edge reflection and spring transition.
   - Action Sheet / Context Menus: Refined group cards to 1.125rem (18px) continuous curvature with 36px blur, 200% saturation, specular borders, and active press selection highlights inspired by the iOS kit selection specification (`Selection.png`).
   - Card Menu & Checklist Buttons: Applied subtle rounded glass hover states and smooth spring response.

3. **Typography Compliance**:
   - Strictly preserved **Helvetica Neue Light** (`font-weight: 300`) across all tab labels, context menu items, menu headers, settings sections, and segmented controls.

---

## iOS 26 Kit Literal UI Integration & Modern Interface Redesign

1. **Floating Liquid Glass Dock Navigation**:
   - Re-architected bottom navigation from a static edge dock into an elevated **Floating Liquid Glass Capsule Dock** with 32px squircle curvature, 36px backdrop blur, 220% saturation boost, and multi-pass specular rim lighting (`box-shadow: inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 1px 0 rgba(0, 0, 0, 0.2), 0 16px 40px rgba(0, 0, 0, 0.45)`).
   - Floating Action Button (+) dynamically floats directly above the dock with glowing accent physics.
   - Symmetrical 3-tab layout: **Trash** (left), **Reminders** (middle, active), **Settings** (right).

2. **Literal iOS Kit Assets Integrated into the UI**:
   - **Keypad / Passcode Screen**: Integrated literal kit asset `assets/ios_kit/delete-dark.png` into the delete key, styled numeric buttons matching `Number Pad@3x.png` with dual digit and letter subtext (e.g. 2 A B C, 3 D E F).
   - **Action Sheet / Context Menu**: Embedded literal kit selection texture `assets/ios_kit/selection.png` into menu item hover and active states.
   - **SVG Filter Defs**: Embedded specular inner-shadow filter `#ios26-liquid-glass` derived from kit `Shape.svg`.
   - **Widget Ecosystem Showcase**: Embedded literal kit asset `assets/ios_kit/widgets-preview.png` in Settings demonstrating lock screen and desktop widget synchronization.
   - **Cards**: Enhanced reminder cards with 20px squircle curvature, specular top borders, and glowing interactive status chips.

3. **Typography**:
   - Strictly maintained **Helvetica Neue Light** (`font-weight: 300`) across all components, headers, buttons, and subtext.
