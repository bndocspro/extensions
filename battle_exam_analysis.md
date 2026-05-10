# Battle Exam UI Analysis

This document details the behavior of the "Battle Exam" mode on `chorcha.net`, specifically focusing on the DOM structure, question loading system, option selection, and interaction flow. This analysis is intended to inform the auto-click logic in `console.js`.

## 1. Question Loading System
- **Dynamic DOM Updates**: The system replaces the DOM content dynamically for each new question and its options. It **does not** load all questions into the DOM at once (hidden).
- **Loading State & Transition**: When an option is clicked, or time runs out, a transition state occurs. A message stating "**পরবর্তী প্রশ্নে যাওয়া হচ্ছে**" (Going to the next question) appears.
- **No Traditional Spinners**: Instead of a spinning loader, a progress bar at the top and the transition text act as the loading indicator.

## 2. Option Selection & CSS Selectors
- **Option Buttons**: The option buttons (A, B, C, D) can be reliably identified by the class `custom-scrollbar`.
- **CSS Selectors**:
  - `button.custom-scrollbar` (Most direct and robust)
  - `div.grid.gap-1.5 button.custom-scrollbar` (If you need to scope it strictly to the options container)
- **Attributes**: The buttons do **not** have custom data attributes like `data-answer` or `data-index`. The text of the option is located within a `<p>` tag inside the button.
- **Current `console.js` Check**: The current selector `button.flex.w-full.custom-scrollbar` used in `console.js` is accurate and functional, though it could be shortened to `button.custom-scrollbar` to be more resilient to minor styling class changes.

## 3. Interaction Flow & Question Transition
- **Immediate Feedback**: Clicking an option immediately changes the button's background color:
  - **Correct Answer**: Green (`bg-[#1899181A]`)
  - **Incorrect Answer**: Red (`bg-[#FFF1F1]`)
- **Auto-Transition**: After an option is selected, the system automatically transitions to the next question. There is **no "Next" or "Submit" button** that needs to be clicked.
- **Transition Delay**: There is a short delay of approximately 3-5 seconds while the transition message is displayed before the new question is fully injected into the DOM.

## 4. General DOM Structure
- **Question Text**: The text for the question is located directly above the option buttons container, usually within a `div` or `<p>` tag.
- **Progress Bar**: A yellow/green progress bar exists at the top of the question area to indicate remaining time.

## 5. Implications for Auto-Click Logic (`console.js`)
- **Timing**: The current `setInterval` of `10000ms` (10 seconds) in `console.js` is generally safe because it accounts for the 3-5 second transition delay. However, a blindly incrementing interval could fail if the network is slow or if the UI takes longer to transition.
- **Better Synchronization Strategy**: Instead of a fixed 10-second interval, a more robust approach would be to:
  1. Click the correct option.
  2. Wait for the transition message ("পরবর্তী প্রশ্নে যাওয়া হচ্ছে") to appear.
  3. Wait for the transition message to *disappear* and the new options (`button.custom-scrollbar`) to become available in the DOM again before clicking the next answer.
- **Selector Stability**: The buttons are currently grabbed and assumed to be in A, B, C, D order mapping to `buttonMap = {A:0, B:1, C:2, D:3}`. Since the DOM is fully replaced, selecting `document.querySelectorAll('button.custom-scrollbar')` and picking the index will correctly match the new question's options.
