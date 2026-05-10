document.addEventListener('DOMContentLoaded', () => {
    // ─── Element References ───────────────────────────────
    const jsonBtn    = document.getElementById('btn-json');
    const aiBtn      = document.getElementById('btn-ai');
    const apiBtn     = document.getElementById('btn-api');
    const battleBtn  = document.getElementById('btn-battle');
    const quickBtn   = document.getElementById('btn-quick');
    const panelJson  = document.getElementById('panel-json');
    const panelAi    = document.getElementById('panel-ai');
    const panelApi   = document.getElementById('panel-api');
    const panelBattle = document.getElementById('panel-battle');
    const panelQuick = document.getElementById('panel-quick');
    const jsonData   = document.getElementById('json-data');
    const examUrl    = document.getElementById('exam-url');
    const fetchBtn   = document.getElementById('fetch-btn');
    const copyJson   = document.getElementById('copy-json');
    const apiKey     = document.getElementById('api-key');
    const modelName  = document.getElementById('model-name');
    const toggleKey  = document.getElementById('toggle-key');
    const startBtn   = document.getElementById('start-btn');
    const stopBtn    = document.getElementById('stop-btn');
    const statusDot  = document.getElementById('status-dot');
    const statusCard = document.getElementById('status');
    const statusText = document.getElementById('status-text');
    const progressWrap  = document.getElementById('progress-wrap');
    const progressBar   = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const logArea    = document.getElementById('log-area');
    const clearLog   = document.getElementById('clear-log');

    // ─── API Fetch Panel Elements ──────────────────────────
    const apiFetchBtn     = document.getElementById('api-fetch-btn');
    const apiFetchIcon    = document.getElementById('api-fetch-icon');
    const apiMetaRow      = document.getElementById('api-meta-row');
    const apiKeyVal       = document.getElementById('api-key-val');
    const apiCountVal     = document.getElementById('api-count-val');
    const apiResponseWrap = document.getElementById('api-response-wrap');
    const apiResponseBox  = document.getElementById('api-response-box');
    const apiCopyBtn      = document.getElementById('api-copy-btn');
    const apiClearBtn     = document.getElementById('api-clear-btn');
    const apiPlaceholder  = document.getElementById('api-placeholder');

    let currentMode = 'json';
    let lastApiJson  = '';   // cached decoded JSON string

    // ─── Persist / Restore Settings ──────────────────────
    chrome.storage.local.get(['mode', 'jsonData', 'apiKey', 'modelName', 'examUrl'], (res) => {
        if (res.mode)      setMode(res.mode);
        if (res.jsonData)  jsonData.value  = res.jsonData;
        if (res.apiKey)    apiKey.value    = res.apiKey;
        if (res.modelName) modelName.value = res.modelName;
        if (res.examUrl)   examUrl.value   = res.examUrl;
    });

    jsonData.addEventListener('input',   () => chrome.storage.local.set({ jsonData: jsonData.value }));
    apiKey.addEventListener('input',     () => chrome.storage.local.set({ apiKey: apiKey.value }));
    modelName.addEventListener('input',  () => chrome.storage.local.set({ modelName: modelName.value }));
    examUrl.addEventListener('input',    () => chrome.storage.local.set({ examUrl: examUrl.value }));

    // ─── Mode Toggle ──────────────────────────────────────
    const navSlider = document.querySelector('.nav-slider');
    const modeOrder = ['json', 'ai', 'api', 'battle', 'quick'];

    function setMode(mode) {
        currentMode = mode;
        jsonBtn.classList.toggle('active',   mode === 'json');
        aiBtn.classList.toggle('active',     mode === 'ai');
        apiBtn.classList.toggle('active',    mode === 'api');
        if (battleBtn) battleBtn.classList.toggle('active', mode === 'battle');
        if (quickBtn)  quickBtn.classList.toggle('active',  mode === 'quick');

        panelJson.classList.toggle('active',   mode === 'json');
        panelAi.classList.toggle('active',     mode === 'ai');
        panelApi.classList.toggle('active',    mode === 'api');
        if (panelBattle) panelBattle.classList.toggle('active', mode === 'battle');
        if (panelQuick)  panelQuick.classList.toggle('active',  mode === 'quick');

        // Animate nav slider (5 tabs → 20% each)
        if (navSlider) {
            const idx = modeOrder.indexOf(mode);
            if (idx >= 0) {
                navSlider.style.left = `calc(${idx} * 20% + 4px)`;
            }
        }

        chrome.storage.local.set({ mode });
    }

    jsonBtn.addEventListener('click',   () => setMode('json'));
    aiBtn.addEventListener('click',     () => setMode('ai'));
    apiBtn.addEventListener('click',    () => setMode('api'));
    if (battleBtn) battleBtn.addEventListener('click', () => setMode('battle'));
    if (quickBtn)  quickBtn.addEventListener('click',  () => setMode('quick'));

    // ─── Show/Hide API Key ────────────────────────────────
    toggleKey.addEventListener('click', () => {
        const isHidden = apiKey.type === 'password';
        apiKey.type = isHidden ? 'text' : 'password';
        toggleKey.innerHTML = isHidden
            ? '<span class="material-symbols-rounded">visibility_off</span>'
            : '<span class="material-symbols-rounded">visibility</span>';
    });

    // ─── Log Utility ─────────────────────────────────────
    function addLog(msg, type = 'default') {
        const empty = logArea.querySelector('.log-empty');
        if (empty) empty.remove();

        const now = new Date();
        const time = now.toTimeString().slice(0, 8);

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-msg ${type}">${msg}</span>
        `;
        logArea.appendChild(entry);
        logArea.scrollTop = logArea.scrollHeight;
    }

    clearLog.addEventListener('click', () => {
        logArea.innerHTML = '<div class="log-empty">No activity yet</div>';
    });

    // ─── Copy JSON ────────────────────────────────────────
    copyJson.addEventListener('click', () => {
        if (!jsonData.value.trim()) return;
        navigator.clipboard.writeText(jsonData.value).then(() => {
            copyJson.classList.add('copied');
            setTimeout(() => copyJson.classList.remove('copied'), 1500);
        });
    });

    // ─── Copy Quick Answers ───────────────────────────────
    const quickCopyBtn = document.getElementById('quick-copy-btn');
    if (quickCopyBtn) {
        quickCopyBtn.addEventListener('click', () => {
            const box = document.getElementById('quick-response-box');
            if (!box || !box.textContent.trim()) return;
            navigator.clipboard.writeText(box.textContent).then(() => {
                quickCopyBtn.innerHTML = `<span class="material-symbols-rounded">check</span>`;
                setTimeout(() => {
                    quickCopyBtn.innerHTML = `<span class="material-symbols-rounded">content_copy</span>`;
                }, 1500);
            });
        });
    }

    // ─── Fetch Answers ────────────────────────────────────
    fetchBtn.addEventListener('click', async () => {
        const urlRaw = examUrl.value.trim();
        if (!urlRaw) {
            setStatus('Enter an exam URL first.', 'error');
            addLog('No URL provided', 'err');
            return;
        }

        // Extract exam slug/path from the URL
        // Supports: https://chorcha.net/exam/Thy0e_7th_ or with ?teacher=...
        let apiUrl;
        try {
            const parsed = new URL(urlRaw);
            // Build API URL: mujib.chorcha.net + same path + original query
            apiUrl = `https://mujib.chorcha.net${parsed.pathname}${parsed.search}`;
        } catch(e) {
            setStatus('Invalid URL format.', 'error');
            addLog('Invalid URL: ' + urlRaw, 'err');
            return;
        }

        fetchBtn.disabled = true;
        fetchBtn.classList.add('loading');
        setStatus('Fetching answers from API...', 'running');
        addLog('Fetching: ' + apiUrl, 'info');

        try {
            // Ask the active tab's content script to fetch (it has cookie access)
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url.includes('chorcha.net')) {
                throw new Error('Open a chorcha.net tab first so cookies are available.');
            }

            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'FETCH_EXAM_ANSWERS',
                apiUrl: apiUrl
            });

            if (response.status === 'error') {
                throw new Error(response.message);
            }

            // response.answers = { "1": "C", "2": "A", ... }
            const answers = response.answers;
            const count   = Object.keys(answers).length;

            if (count === 0) {
                throw new Error('No answers found in the API response.');
            }

            // Build clean flat JSON: {"1":"C","2":"A",...}
            const serialJson = JSON.stringify(answers, null, 2);

            jsonData.value = serialJson;
            chrome.storage.local.set({ jsonData: serialJson });

            setStatus(`Fetched ${count} answers successfully.`, 'success');
            addLog(`Loaded ${count} answers into JSON field`, 'ok');

        } catch(e) {
            setStatus('Fetch failed: ' + e.message, 'error');
            addLog('Fetch error: ' + e.message, 'err');
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.classList.remove('loading');
        }
    });

    // ─── CDN API Lookup (find answers by _id) ────────────
    const CDN_DATA_URL = 'https://ansapi.pages.dev/data.json';
    const cdnLookupBtn  = document.getElementById('cdn-lookup-btn');
    const cdnLookupText = document.getElementById('cdn-lookup-text');

    cdnLookupBtn.addEventListener('click', async () => {
        cdnLookupBtn.disabled = true;
        cdnLookupText.textContent = 'Searching...';
        setStatus('Fetching exam questions & CDN data...', 'running');
        addLog('CDN lookup started', 'info');

        try {
            // 1. Get the ordered question _ids from the active chorcha.net tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.url || !tab.url.includes('chorcha.net')) {
                throw new Error('Open a chorcha.net exam tab first.');
            }

            const execResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    const urlMatch = window.location.href.match(/\/exam\/([^/?#]+)/);
                    if (!urlMatch) throw new Error('No exam ID found in URL.');
                    const examId = urlMatch[1];
                    const res = await fetch(
                        `https://mujib.chorcha.net/exam/${examId}?teacher=null`,
                        { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } }
                    );
                    if (!res.ok) throw new Error(`API ${res.status}`);
                    const json = await res.json();
                    const questions = (json.data && json.data.exam && json.data.exam.questions) || [];
                    // Return serial order + _id pairs
                    return questions.map((item, idx) => ({
                        serial: idx + 1,
                        id: item.q && item.q._id
                    }));
                }
            });

            const questionList = execResults && execResults[0] && execResults[0].result;
            if (!questionList || questionList.length === 0) {
                throw new Error('Could not retrieve question list from the exam tab.');
            }

            addLog(`Got ${questionList.length} question IDs from exam`, 'ok');

            // 2. Fetch data.json from CDN
            addLog('Fetching CDN data.json...', 'info');
            const cdnRes = await fetch(CDN_DATA_URL);
            if (!cdnRes.ok) throw new Error(`CDN fetch failed: HTTP ${cdnRes.status}`);
            const cdnJson = await cdnRes.json();

            // 3. Build _id → answer lookup map from data.json
            const answerMap = {};
            const exams = Array.isArray(cdnJson) ? cdnJson : [cdnJson];
            
            for (const examObj of exams) {
                const questions = (examObj.data && examObj.data.exam && examObj.data.exam.questions) || [];
                for (const item of questions) {
                    if (item.q && item.q._id && item.q.answer) {
                        answerMap[item.q._id] = item.q.answer;
                    }
                }
            }

            addLog(`CDN indexed ${Object.keys(answerMap).length} answers from ${exams.length} exam(s)`, 'info');

            // 4. Match each exam question _id → answer
            let matched = 0;
            let missed  = 0;
            const result = {};
            for (const { serial, id } of questionList) {
                if (id && answerMap[id]) {
                    result[String(serial)] = answerMap[id];
                    matched++;
                } else {
                    missed++;
                    addLog(`Q${serial}: _id "${id}" not found in CDN`, 'warn');
                }
            }

            if (matched === 0) throw new Error('No matching answers found in CDN data.json.');

            // Build clean flat JSON: {"1":"C","2":"A",...}
            const serialJson = JSON.stringify(result, null, 2);

            jsonData.value = serialJson;
            chrome.storage.local.set({ jsonData: serialJson });

            setStatus(`Found ${matched}/${questionList.length} answers from CDN API`, 'success');
            addLog(`✓ ${matched} matched, ${missed} not found — answers loaded into JSON field`, 'ok');

            // Switch to JSON panel so user sees the result
            setMode('json');

        } catch (err) {
            setStatus('CDN Lookup failed: ' + err.message, 'error');
            addLog('CDN error: ' + err.message, 'err');
        } finally {
            cdnLookupBtn.disabled = false;
            cdnLookupText.textContent = 'Find Answers via CDN API';
        }
    });


    const ICONS = {
        spinner: `<span class="material-symbols-rounded status-icon spinner">progress_activity</span>`,
        check:   `<span class="material-symbols-rounded status-icon">check_circle</span>`,
        x:       `<span class="material-symbols-rounded status-icon">error</span>`,
        warn:    `<span class="material-symbols-rounded status-icon">warning</span>`,
        info:    `<span class="material-symbols-rounded status-icon">info</span>`
    };

    function setStatus(msg, state = '') {
        const icon = state === 'running' ? ICONS.spinner
                   : state === 'success' ? ICONS.check
                   : state === 'error'   ? ICONS.x
                   : state === 'warning' ? ICONS.warn
                   : ICONS.info;

        statusCard.className = `status-card ${state}`;
        statusCard.innerHTML = `${icon}<span id="status-text">${msg}</span>`;

        statusDot.className = `status-dot ${state || 'idle'}`;
    }

    function setProgress(done, total) {
        if (total <= 0) {
            progressWrap.classList.add('hidden');
            return;
        }
        progressWrap.classList.remove('hidden');
        const pct = Math.round((done / total) * 100);
        progressBar.style.width = pct + '%';
        progressLabel.textContent = `${done} / ${total}`;
    }

    // ─── Start Automation ─────────────────────────────────
    startBtn.addEventListener('click', async () => {
        startBtn.disabled = true;
        stopBtn.disabled  = false;
        startBtn.innerHTML = `<span class="material-symbols-rounded spinner">progress_activity</span><span>Running...</span>`;

        setStatus('Connecting to tab...', 'running');
        addLog('Automation started', 'info');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.url.includes('chorcha.net')) {
                throw new Error('Please navigate to a chorcha.net quiz page first.');
            }

            const config = {
                mode:      currentMode,
                jsonData:  jsonData.value,
                apiKey:    apiKey.value,
                modelName: modelName.value
            };

            setStatus('Automation running... Please wait.', 'running');
            addLog(`Mode: ${currentMode.toUpperCase()} | Tab: ${tab.title.slice(0, 35)}...`, 'info');

            // Listen for progress updates from content script
            const progressListener = (msg) => {
                if (msg.action === 'PROGRESS_UPDATE') {
                    setProgress(msg.done, msg.total);
                    addLog(`Answered Q${msg.done} of ${msg.total}`, 'ok');
                } else if (msg.action === 'RECHECK_START') {
                    setStatus('Re-checking missed questions...', 'running');
                    addLog(`Re-checking ${msg.count} missed question(s)`, 'warn');
                } else if (msg.action === 'LOG') {
                    addLog(msg.text, msg.level || 'default');
                }
            };
            chrome.runtime.onMessage.addListener(progressListener);

            let response;
            if (currentMode === 'battle') {
                response = await chrome.tabs.sendMessage(tab.id, { action: 'BATTLE_DEPLOY' });
                // For battle mode, the automation runs indefinitely in the background.
                // We keep the stop button enabled.
                startBtn.disabled = true;
                stopBtn.disabled = false;
                startBtn.innerHTML = `<span class="material-symbols-rounded spinner">progress_activity</span><span>Battle Active</span>`;
                return; // skip the 'finally' block so it stays disabled
            } else {
                response = await chrome.tabs.sendMessage(tab.id, { action: 'START_AUTOMATION', config: config });
            }

            chrome.runtime.onMessage.removeListener(progressListener);

            if (response && response.status === 'stopped') {
                setStatus('Automation stopped by user.', 'warning');
                addLog('Stopped by user', 'warn');
            } else if (response && response.status === 'error') {
                throw new Error(response.message);
            } else {
                const answered = response && response.answered != null ? response.answered : '?';
                const total    = response && response.total != null ? response.total : '?';
                setStatus(`Done! Answered ${answered} of ${total} questions.`, 'success');
                addLog(`Completed: ${answered}/${total} answered`, 'ok');
                if (response && response.skipped > 0) {
                    addLog(`${response.skipped} question(s) could not be answered`, 'warn');
                }
            }
        } catch (error) {
            setStatus('Error: ' + error.message, 'error');
            addLog('Error: ' + error.message, 'err');
        } finally {
            startBtn.disabled = false;
            stopBtn.disabled  = true;
            startBtn.innerHTML = `<span class="material-symbols-rounded">rocket_launch</span><span>Start Automation</span>`;
            progressWrap.classList.add('hidden');
        }
    });

    // ─── Stop Automation ──────────────────────────────────
    stopBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                if (currentMode === 'battle') {
                    await chrome.tabs.sendMessage(tab.id, { action: 'BATTLE_REMOVE' });
                    startBtn.disabled = false;
                    startBtn.innerHTML = `<span class="material-symbols-rounded">rocket_launch</span><span>Start Automation</span>`;
                } else {
                    await chrome.tabs.sendMessage(tab.id, { action: 'STOP_AUTOMATION' });
                }
                addLog('Stop signal sent', 'warn');
                setStatus('Stopping...', 'warning');
            }
        } catch (e) {
            addLog('Could not send stop signal: ' + e.message, 'err');
        }
        stopBtn.disabled = true;
    });

    // ─── API Fetch & Decode ───────────────────────────────
    apiFetchBtn.addEventListener('click', async () => {
        // Set loading state
        apiFetchBtn.disabled = true;
        apiFetchBtn.classList.add('loading');
        apiFetchIcon.className = 'bi bi-arrow-repeat spinner';
        setStatus('Fetching & decoding exam API...', 'running');
        addLog('Running Chorcha API fetcher...', 'info');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) throw new Error('No active tab found.');
            if (!tab.url || !tab.url.includes('chorcha.net')) {
                throw new Error('Please open a chorcha.net exam page first.');
            }

            // Inject and execute the fetch+decode logic directly in the page context
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: async () => {
                    // ── Inline decode logic (same as chorcha_api_fetcher.js) ──
                    const urlMatch = window.location.href.match(/\/exam\/([^/?]+)/);
                    const examId = urlMatch ? urlMatch[1] : null;
                    if (!examId) throw new Error('Could not find exam ID in page URL.');

                    const apiUrl = `https://mujib.chorcha.net/exam/${examId}?teacher=null`;

                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        credentials: 'include',
                        headers: { 'Accept': 'application/json' }
                    });

                    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

                    const xChorchaId = response.headers.get('x-chorcha-id');
                    const rawData    = await response.json();

                    function decode(str, key) {
                        if (str === null || str === undefined || str === '') return str;
                        let result = '';
                        for (let i = 0; i < str.length; i++) {
                            const cp = str.charCodeAt(i);
                            const kc = key.charCodeAt(i % key.length);
                            result += String.fromCharCode((cp - kc + 65536) % 65536);
                        }
                        return result;
                    }

                    const decodedData = JSON.parse(JSON.stringify(rawData));

                    if (xChorchaId && rawData.data && rawData.data.exam && rawData.data.exam.questions) {
                        decodedData.data.exam.questions = rawData.data.exam.questions.map((item, idx) => ({
                            ...item,
                            q: {
                                ...item.q,
                                question: decode(item.q.question, xChorchaId),
                                A:        decode(item.q.A, xChorchaId),
                                B:        decode(item.q.B, xChorchaId),
                                C:        decode(item.q.C, xChorchaId),
                                D:        decode(item.q.D, xChorchaId),
                                E:        (item.q.E !== null && item.q.E !== undefined) ? decode(item.q.E, xChorchaId) : item.q.E,
                                solution: decode(item.q.solution, xChorchaId)
                            },
                            _questionIndex: idx + 1
                        }));
                    }

                    // Store globally in page context too
                    window.__chorchaData = { key: xChorchaId, rawResponse: rawData, decoded: decodedData };

                    // Build a clean answer map: { "1": "A", "2": "B", ... }
                    // Only include each question ONCE by serial index
                    const questions = (decodedData.data && decodedData.data.exam && decodedData.data.exam.questions) || [];
                    const answerMap = {};
                    let qSerial = 1;

                    for (const item of questions) {
                        if (item.type === 'MCQ_N' && item.q && item.q.meta && Array.isArray(item.q.meta.question)) {
                            // MCQ_N: each sub-question in meta.question is a separate question
                            for (const sub of item.q.meta.question) {
                                if (sub.answer) {
                                    answerMap[String(qSerial)] = sub.answer.toUpperCase();
                                }
                                qSerial++;
                            }
                        } else {
                            // Regular MCQ
                            const ans = item.q && item.q.answer;
                            if (ans) {
                                answerMap[String(qSerial)] = ans.toUpperCase();
                            }
                            qSerial++;
                        }
                    }

                    return {
                        key:       xChorchaId,
                        count:     questions.length,
                        totalQs:   qSerial - 1,
                        examId:    (decodedData.data && decodedData.data.exam) ? decodedData.data.exam._id : examId,
                        answerMap: answerMap,
                        jsonStr:   JSON.stringify(decodedData, null, 2),
                        status:    rawData.status || 'unknown'
                    };
                }
            });

            const result = results && results[0] && results[0].result;

            if (!result) throw new Error('No result returned from the injected script.');
            if (result instanceof Error || (result && result.__error)) {
                throw new Error(result.message || 'Unknown error from page script.');
            }

            // ── Show meta chips ──
            apiKeyVal.textContent   = result.key || '—';
            const ansCount = Object.keys(result.answerMap || {}).length;
            apiCountVal.textContent = `${ansCount} answers (${result.count} items)`;
            apiMetaRow.classList.remove('hidden');

            // ── Show code box ──
            lastApiJson = result.jsonStr;
            apiResponseBox.textContent = lastApiJson;
            apiResponseWrap.classList.remove('hidden');
            apiPlaceholder.classList.add('hidden');

            setStatus(`Fetched & decoded ${result.count} questions (${result.examId})`, 'success');
            addLog(`✓ ${result.count} questions decoded | key: ${result.key}`, 'ok');

        } catch (err) {
            setStatus('API Fetch failed: ' + err.message, 'error');
            addLog('API error: ' + err.message, 'err');
            apiPlaceholder.classList.remove('hidden');
        } finally {
            apiFetchBtn.disabled = false;
            apiFetchBtn.classList.remove('loading');
            apiFetchIcon.className = 'bi bi-play-fill';
        }
    });

    // ─── Copy decoded JSON ────────────────────────────────
    apiCopyBtn.addEventListener('click', () => {
        const text = apiResponseBox.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            apiCopyBtn.classList.add('copied');
            apiCopyBtn.innerHTML = `<span class="material-symbols-rounded">check</span>`;
            setTimeout(() => {
                apiCopyBtn.classList.remove('copied');
                apiCopyBtn.innerHTML = `<span class="material-symbols-rounded">content_copy</span>`;
            }, 2000);
        }).catch(() => {
            addLog('Clipboard write failed', 'err');
        });
    });


    // ─── Clear decoded JSON ───────────────────────────────
    apiClearBtn.addEventListener('click', () => {
        lastApiJson = '';
        apiResponseBox.textContent = '';
        apiResponseWrap.classList.add('hidden');
        apiMetaRow.classList.add('hidden');
        apiPlaceholder.classList.remove('hidden');
        setStatus('Ready to automate', '');
        addLog('API response cleared', 'warn');
    });

    // ─── Global Message Listeners ───────────────────────────
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'LOG') {
            addLog(msg.text, msg.level || 'default');
        }
        if (msg.action === 'BATTLE_STOPPED') {
            const startBtn = document.getElementById('start-btn');
            const stopBtn = document.getElementById('stop-btn');
            if (startBtn && stopBtn) {
                startBtn.disabled = false;
                stopBtn.disabled = true;
                startBtn.innerHTML = `<span class="material-symbols-rounded">rocket_launch</span><span>Start Automation</span>`;
                setStatus('Battle automation finished.', 'success');
            }
        }
        if (msg.action === 'QUICK_EXAM_DATA' && msg.data) {
            const quickResponseWrap = document.getElementById('quick-response-wrap');
            const quickResponseBox = document.getElementById('quick-response-box');
            
            if (quickResponseWrap && quickResponseBox) {
                quickResponseWrap.classList.remove('hidden');
                quickResponseBox.textContent = JSON.stringify(msg.data, null, 2);
                addLog('Quick Exam answers intercepted!', 'ok');
            }

            // Auto-load into battle intercepted answers
            battleInterceptedAnswers = msg.data;
        }

    });
});
