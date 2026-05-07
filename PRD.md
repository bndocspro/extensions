# PRD: Quiz Auto Pro - Rebuild with WXT

## 1. Project Overview
**Quiz Auto Pro** is a professional Chrome extension designed for automated quiz answering on `chorcha.net`. The goal of the rebuild is to modernize the architecture using the **WXT** framework, implement a high-performance automation engine, and create a modern, sleek user interface.

---

## 2. Core Functionalities

### A. Automation Engine (Content Script)
- **Selector Detection**: Target containers using `div.border.dark\:border-gray-700.rounded-xl.p-5.relative`.
- **Question & Option Parsing**: 
    - Extract question text and indices (handling both Bengali and English numerals).
    - Map option labels (ক, খ, গ, ঘ) to standard letters (A, B, C, D).
- **Smart Interaction**: 
    - Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` before interaction.
    - Use `dispatchEvent` for `mousedown`, `mouseup`, and `click` to bypass React/Next.js event blocking.
- **Execution Flow**:
    - **Fast-Path**: Check `window.battleAnswers` (intercepted battle config) before falling back to other modes.
    - **Batch Processing**: Process questions in batches (default: 5) with `sleep` delays.
    - **Re-check System**: A dedicated second pass for any question containers that failed or were skipped.
- **State & Communication**: Handle `STOP_AUTOMATION` signals; broadcast `PROGRESS_UPDATE` and `LOG` messages to the sidepanel.
- **Auto-Submission**: Post-process logic to find and click `button.btn-primary` (Submit) after completion keep off user sleted what need to do.

### B. Solving Modes
1.  **JSON Mode**: 
    - Map question numbers/IDs to specific answers.
    - **Normalization**: Automatically handle flat maps, single-element arrays, or arrays of key-value pairs (e.g., `{"1":"A"}`).
2.  **AI Mode**: Integration with **Google Gemini API** (`gemma-4-31b-it` or similar) to solve questions in real-time.
3.  **API Fetch**: Internal backend scraper that hits `mujib.chorcha.net`, extracts the `x-chorcha-id` header, and performs **XOR Decryption**.
4.  **CDN Lookup**: Query an external `data.json` from `ansapi.pages.dev` and match by unique question `_id`.

### C. Advanced Interception
- **Battle Interceptor**: Injected script into `window.fetch` to catch `/battle/create`.
- **Decoding Utility**: Shared module for XOR-based string decryption (`(cp - kc + 65536) % 65536`).

---

## 3. Technical Stack (Rebuild)
- **Framework**: [WXT (Web Extension Toolbox)](https://wxt.dev/)
- **UI Framework**: React + Tailwind CSS + Shadcn/ui
- **State Management**: WXT Storage (Sync/Local)
- **Language**: TypeScript
- **Bundler**: Vite (integrated with WXT)

---

## 4. UI/UX Requirements
- **Dashboard**: A sidepanel-based control center.
- **Visual Feedback**:
    - Smooth progress bars (`Answered / Total`).
    - Color-coded activity logs (Info, Success, Warning, Error).
    - Status indicators (Idle, Running, Error).
- **Theme**: Professional Dark Mode by default.
- **Persistence**: Save API keys, selected models, and configuration URLs across sessions.

---

## 5. Security & Manifest (V3)
- **Permissions**: `sidePanel`, `storage`, `scripting`, `activeTab`.
- **Host Permissions**:
    - `*://chorcha.net/*`
    - `*://mujib.chorcha.net/*`
    - `https://generativelanguage.googleapis.com/*`
    - `https://cdn.jsdelivr.net/*`

---

## 6. Implementation Workflow (WXT)
1.  **Init**: Setup project with `npx wxt@latest init`.
2.  **Utilities**: Port the XOR decryption and logic into `src/utils`.
3.  **Content Scripts**: Implement `window.fetch` injection and DOM automation.
4.  **Sidepanel**: Build the multi-mode interface with React + Shadcn.
5.  **Sync**: Ensure real-time communication between Content Script and Sidepanel via `chrome.runtime.onMessage`.
