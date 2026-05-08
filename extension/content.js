// ─── Stop flag ───────────────────────────────────────────
let isStopped = false;

// ─── Message listener ────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_AUTOMATION') {
        isStopped = false; // reset on each start
        
        // Use quick solver if in quick mode, answers exist, and single question layout is present
        if (request.config.mode === 'quick' && window.quickExamAnswers && document.querySelector('div.grid.gap-2')) {
            startQuickPracticeSolver(window.quickExamAnswers)
                .then(() => sendResponse({ status: 'done', answered: Object.keys(window.quickExamAnswers).length, total: Object.keys(window.quickExamAnswers).length, skipped: 0 }))
                .catch(err => sendResponse({ status: 'error', message: err.message }));
        } else {
            startAutomation(request.config)
                .then(result => sendResponse(result))
                .catch(err  => sendResponse({ status: 'error', message: err.message }));
        }
        return true; // keep channel open for async
    }

    if (request.action === 'STOP_AUTOMATION') {
        isStopped = true;
        sendResponse({ status: 'ok' });
    }

    if (request.action === 'FETCH_EXAM_ANSWERS') {
        fetchExamAnswers(request.apiUrl)
            .then(answers => sendResponse({ status: 'ok', answers }))
            .catch(err   => sendResponse({ status: 'error', message: err.message }));
        return true; // async
    }
});

// ─── Battle and Quick Exam Solver Injection ─────────────────────────────
const injectScript = document.createElement('script');
injectScript.src = chrome.runtime.getURL('inject.js');
injectScript.onload = function() {
    this.remove();
};
document.documentElement.appendChild(injectScript);

// ─── Decode utilities ────────────────────────────────────
function decodeValue(encodedStr, key) {
    if (!key) return encodedStr;
    let decoded = '';
    for (let i = 0; i < encodedStr.length; i++) {
        const cp = encodedStr.charCodeAt(i);
        const kc = key.charCodeAt(i % key.length);
        decoded += String.fromCharCode((cp - kc + 65536) % 65536);
    }
    return decoded;
}

function decodeObject(obj, key) {
    if (typeof obj === 'string')  return decodeValue(obj, key);
    if (Array.isArray(obj))       return obj.map(item => decodeObject(item, key));
    if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const k in obj) result[k] = decodeObject(obj[k], key);
        return result;
    }
    return obj;
}

// ─── Battle and Quick Exam answer cache ─────────────────────────────────
window.battleAnswers = null;
window.quickExamAnswers = null;

window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data) return;
    
    if (event.data.type === 'BATTLE_CREATED') {
        const battleId = event.data.battleId;
        console.log('Quiz Auto Pro: Intercepted Battle ID:', battleId);

        try {
            const response = await fetch('https://mujib.chorcha.net/battle/exam-config', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Chorcha-Mode': 'api',
                    'X-Chorcha-Platform': 'web'
                },
                body: JSON.stringify({ druto_id: battleId })
            });
            const chorchaId = response.headers.get('x-chorcha-id');
            const data = await response.json();
            window.battleAnswers = decodeObject(data, chorchaId);
            console.log('Quiz Auto Pro: Battle config loaded.', window.battleAnswers);
        } catch(e) {
            console.error('Quiz Auto Pro: Failed to fetch battle config:', e);
        }
    }

    if (event.data.type === 'QUICK_EXAM_INTERCEPTED') {
        const { data, chorchaId } = event.data;
        const decodedData = decodeObject(data, chorchaId);
        
        console.log('Quiz Auto Pro: Quick Exam config loaded.', decodedData);
        
        try {
            // Support both questions array and answers array based on API response
            const items =
                decodedData?.data?.answers         ||
                decodedData?.answers               ||
                decodedData?.data?.exam?.questions ||
                decodedData?.exam?.questions       ||
                decodedData?.data?.questions       ||
                decodedData?.questions;

            if (Array.isArray(items) && items.length > 0) {
                const answers = {};
                items.forEach((item, idx) => {
                    const serial = String(idx + 1);
                    const answerVal = item?.answer ?? item?.q?.answer;

                    if (answerVal === undefined || answerVal === null) return;

                    if (typeof answerVal === 'string' && /^[A-Ea-e]$/.test(answerVal.trim())) {
                        answers[serial] = answerVal.trim().toUpperCase();
                    } else if (typeof answerVal === 'number' && answerVal >= 0 && answerVal <= 4) {
                        answers[serial] = ['A','B','C','D','E'][answerVal];
                    } else if (typeof answerVal === 'string' && /^[0-4]$/.test(answerVal)) {
                        answers[serial] = ['A','B','C','D','E'][parseInt(answerVal)];
                    } else {
                        answers[serial] = String(answerVal).toUpperCase();
                    }
                });
                
                window.quickExamAnswers = answers;
                console.log('Quiz Auto Pro: Quick Exam extracted answers map:', window.quickExamAnswers);
                
                // Send the answers map to the sidepanel/background immediately
                chrome.runtime.sendMessage({
                    action: 'QUICK_EXAM_DATA',
                    data: window.quickExamAnswers
                }).catch(() => {});
            }
        } catch (e) {
            console.error('Quiz Auto Pro: Failed to parse quick exam answers', e);
        }
    }
});

// ─── Helpers ─────────────────────────────────────────────
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendLog(text, level = 'default') {
    chrome.runtime.sendMessage({ action: 'LOG', text, level }).catch(() => {});
}

function sendProgress(done, total) {
    chrome.runtime.sendMessage({ action: 'PROGRESS_UPDATE', done, total }).catch(() => {});
}

// ─── Main Automation ─────────────────────────────────────
async function startAutomation(config) {
    console.log('Quiz Auto Pro: Starting automation...', config.mode);

    const SELECTOR = 'div.border.dark\\:border-gray-700.rounded-xl.p-5.relative';
    const allContainers = Array.from(document.querySelectorAll(SELECTOR));

    if (allContainers.length === 0) {
        throw new Error('No questions found on the page.');
    }

    const total = allContainers.length;
    let answeredCount = 0;
    let failedContainers = [];

    // ── Pass 1: Answer all pending questions ──────────────
    const pendingContainers = allContainers.filter(c => c.dataset.qaAnswered !== 'true');

    if (pendingContainers.length === 0) {
        console.log('Quiz Auto Pro: All questions already answered!');
        return { status: 'done', answered: total, total, skipped: 0 };
    }

    console.log(`Quiz Auto Pro: ${pendingContainers.length} pending questions.`);

    const BATCH_SIZE = 5;

    for (let i = 0; i < pendingContainers.length; i += BATCH_SIZE) {
        if (isStopped) {
            return { status: 'stopped' };
        }

        const batch = pendingContainers.slice(i, i + BATCH_SIZE);
        batch[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(250);

        const results = await Promise.allSettled(
            batch.map(async (container) => {
                const idx = allContainers.indexOf(container);
                await processQuestion(container, idx, config);
                container.dataset.qaAnswered = 'true';
            })
        );

        results.forEach((r, ri) => {
            if (r.status === 'fulfilled') {
                answeredCount++;
                sendProgress(answeredCount, total);
            } else {
                console.error('Pass-1 error:', r.reason);
                failedContainers.push(batch[ri]);
                // qaAnswered NOT set → will retry
            }
        });

        await sleep(150);
    }

    // ── Pass 2: Re-check any missed questions ─────────────
    if (failedContainers.length > 0 && !isStopped) {
        chrome.runtime.sendMessage({
            action: 'RECHECK_START',
            count: failedContainers.length
        }).catch(() => {});

        console.log(`Quiz Auto Pro: Re-checking ${failedContainers.length} missed question(s)...`);
        await sleep(400);

        const stillFailed = [];

        for (const container of failedContainers) {
            if (isStopped) break;

            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);

            const idx = allContainers.indexOf(container);
            try {
                await processQuestion(container, idx, config);
                container.dataset.qaAnswered = 'true';
                answeredCount++;
                sendProgress(answeredCount, total);
                sendLog(`Re-check OK: Q${idx + 1}`, 'ok');
            } catch(e) {
                console.error('Re-check failed for Q' + (idx + 1) + ':', e);
                sendLog(`Re-check failed: Q${idx + 1}`, 'err');
                stillFailed.push(container);
            }

            await sleep(200);
        }

        failedContainers = stillFailed;
    }

    if (isStopped) {
        return { status: 'stopped' };
    }

    const skipped = failedContainers.length;
    console.log(`Quiz Auto Pro: Done. Answered ${answeredCount}/${total}. Skipped: ${skipped}`);

    return { status: 'done', answered: answeredCount, total, skipped };
}

// ─── Process a single question ───────────────────────────
async function processQuestion(container, originalIndex, config) {
    const qElement = container.querySelector('div.pr-8.mb-2.font-medium.text-card-foreground');
    if (!qElement) throw new Error('Question text element not found');

    const qText = qElement.innerText.trim();
    let qNumber  = (originalIndex + 1).toString();
    const numMatch = qText.match(/^(\d+|[১-৯০]+)/);
    if (numMatch) qNumber = numMatch[1];

    // Build options list
    const optionBtns = container.querySelectorAll('button.cursor-pointer');
    const options = [];
    const optionMap = { 'ক': 'A', 'খ': 'B', 'গ': 'C', 'ঘ': 'D' };

    optionBtns.forEach((btn, index) => {
        const span  = btn.querySelector('span');
        let letter  = span ? span.innerText.trim() : '';
        letter = letter.replace(/[\.)\s]/g, '');
        const label = optionMap[letter] || String.fromCharCode(65 + index);
        let text    = btn.innerText;
        if (span) text = text.replace(span.innerText, '').trim();
        options.push({ label, text, element: btn });
    });

    // ── Fast-path: Battle answer cache ───────────────────
    if (window.battleAnswers?.data?.exam_questions) {
        const questions = window.battleAnswers.data.exam_questions;
        if (originalIndex < questions.length) {
            const correctIndex = questions[originalIndex].correct_answer;
            if (correctIndex !== undefined && correctIndex >= 0 && correctIndex < options.length) {
                options[correctIndex].element.click();
                console.log(`Quiz Auto Pro [Battle]: Q${originalIndex + 1} → index ${correctIndex}`);
                return;
            }
        }
    }

    let answerLabel = null;

    // ── Fast-path: Quick Exam answer cache ───────────────
    if (window.quickExamAnswers) {
        if (window.quickExamAnswers[qNumber]) {
            answerLabel = window.quickExamAnswers[qNumber];
        } else {
            const engNum = qNumber.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
            if (window.quickExamAnswers[engNum]) {
                answerLabel = window.quickExamAnswers[engNum];
            } else if (window.quickExamAnswers[(originalIndex + 1).toString()]) {
                answerLabel = window.quickExamAnswers[(originalIndex + 1).toString()];
            }
        }
    }

    if (!answerLabel) {
        if (config.mode === 'json') {
        let answersData = JSON.parse(config.jsonData);

        // Normalize: handle flat object, single-element array, or array-of-single-key-objects
        if (Array.isArray(answersData)) {
            if (answersData.length === 0) {
                answersData = {};
            } else if (answersData.length === 1) {
                // [{"1":"C","2":"A",...}] or [{"1":"C"}]
                answersData = answersData[0];
            } else {
                // [{"1":"C"},{"2":"A"},{"3":"B"},...] — merge all into one flat map
                answersData = Object.assign({}, ...answersData);
            }
        }

        answerLabel = answersData[qNumber];

        if (!answerLabel) {
            const engNum = qNumber.replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d).toString());
            answerLabel = answersData[engNum];
        }
        if (!answerLabel) {
            answerLabel = answersData[(originalIndex + 1).toString()];
        }

        } else if (config.mode === 'ai') {
            if (!config.apiKey) throw new Error('API Key is missing for AI Mode.');
            answerLabel = await getAiAnswer(qText, options, config);
        }
    }

    if (answerLabel) {
        const target = options.find(o => o.label.toUpperCase() === answerLabel.toUpperCase());
        if (target) {
            // Use dispatchEvent (bubbles) for React/Next.js — bare .click() is often ignored
            ['mousedown','mouseup','click'].forEach(type =>
                target.element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
            );
            console.log(`Quiz Auto Pro: Q${qNumber} → ${answerLabel}`);
            await sleep(80); // let React re-render before moving on
        } else {
            console.warn(`Quiz Auto Pro: Option "${answerLabel}" not found for Q${qNumber}`);
        }
    }
}

// ─── Submit quiz ─────────────────────────────────────────
async function submitQuiz() {
    await sleep(800);
    const submitBtn = document.querySelector('button.btn-primary');
    if (submitBtn) {
        submitBtn.click();
        console.log('Quiz Auto Pro: Submit clicked.');
    }
}

// ─── AI Answer via background ─────────────────────────────
function getAiAnswer(question, options, config) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action:   'GET_AI_ANSWER',
            question: question,
            options:  options.map(o => `${o.label}: ${o.text}`).join('\n'),
            config:   config
        }, response => {
            if (!response)          reject(new Error('Background script did not respond.'));
            else if (response.error) reject(new Error(response.error));
            else                    resolve(response.answer);
        });
    });
}

// ─── Fetch Exam Answers from API ─────────────────────────
// Uses browser cookies (credentials: "include") since content scripts
// run in the page's origin context. Extracts q._id → q.answer from
// data.exam.questions[] and returns a clean serial map { "1": "C", ... }
async function fetchExamAnswers(apiUrl) {
    const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
            'X-Chorcha-Mode': 'api',
            'X-Chorcha-Platform': 'web'
        }
    });

    if (!response.ok) {
        throw new Error(`API responded with HTTP ${response.status}`);
    }

    const data = await response.json();

    // API returns: { status, data: { exam: { questions: [] } } }
    // Try all known paths in order
    const questions =
        data?.data?.exam?.questions ||
        data?.exam?.questions       ||
        data?.data?.questions       ||
        data?.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No questions array found in API response.');
    }

    // Answer letter map: index 0 = A, 1 = B, 2 = C, 3 = D
    const LETTERS = ['A', 'B', 'C', 'D'];

    // Build serial map { "1": "C", "2": "A", ... }
    // Each item structure: { p, q: { _id, answer, question, A, B, C, D }, s, t, type }
    const answers = {};
    questions.forEach((item, idx) => {
        const serial = String(idx + 1);
        // Answer is at item.q.answer (primary) or item.answer (fallback)
        const answerVal = item?.q?.answer ?? item?.answer;

        if (answerVal === undefined || answerVal === null) return;

        // If answer is already a letter string (A/B/C/D), use it directly
        if (typeof answerVal === 'string' && /^[A-Ea-e]$/.test(answerVal.trim())) {
            answers[serial] = answerVal.trim().toUpperCase();
        }
        // If answer is a numeric index (0-4), convert to letter
        else if (typeof answerVal === 'number' && answerVal >= 0 && answerVal <= 4) {
            answers[serial] = ['A','B','C','D','E'][answerVal];
        }
        // If answer is a string digit "0"-"4"
        else if (typeof answerVal === 'string' && /^[0-4]$/.test(answerVal)) {
            answers[serial] = ['A','B','C','D','E'][parseInt(answerVal)];
        }
        // Otherwise keep the raw value
        else {
            answers[serial] = String(answerVal).toUpperCase();
        }
    });

    console.log('Quiz Auto Pro: Fetched answers map:', answers);
    return answers;
}

// ─── Quick Practice Exam Automation ─────────────────────────────
async function startQuickPracticeSolver(answersMap) {
    console.log('Quiz Auto Pro: Starting Quick Practice Automation...');
    let currentQuestionSerial = 1;
    let maxQuestions = Object.keys(answersMap).length;

    while (currentQuestionSerial <= maxQuestions) {
        if (isStopped) {
            console.log('Quiz Auto Pro: Quick Practice Automation Stopped.');
            break;
        }

        const answerLabel = answersMap[String(currentQuestionSerial)];
        if (!answerLabel) {
            console.warn(`No answer found for Q${currentQuestionSerial}`);
            currentQuestionSerial++;
            continue;
        }

        // Wait for question options to appear
        let retries = 2; // Wait up to 15 seconds
        let options = [];
        while (retries > 0 && !isStopped) {
            const grid = document.querySelector('div.grid.gap-2');
            if (grid) {
                options = grid.querySelectorAll('button');
            }
            if (!options || options.length === 0) {
                // Fallback selector
                options = document.querySelectorAll('button.flex.w-full.gap-2.rounded-xl.py-3.px-4.items-center.border');
            }
            
            if (options.length > 0) break;
            await sleep(500);
            retries--;
        }

        if (options.length === 0) {
            console.error('Options not found, stopping quick practice automation.');
            break;
        }

        // Map answer letter to option index
        const letterToIndex = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };
        const index = letterToIndex[answerLabel.toUpperCase()];
        
        if (index !== undefined && options[index]) {
            ['mousedown','mouseup','click'].forEach(type =>
                options[index].dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
            );
            console.log(`Quiz Auto Pro: Clicked option ${answerLabel} for Q${currentQuestionSerial}`);
        } else {
            console.warn(`Quiz Auto Pro: Option ${answerLabel} not found in DOM for Q${currentQuestionSerial}`);
        }

        await sleep(500); // Wait for the Next button to become active

        // Click Next or Submit
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.innerText.includes('পরের প্রশ্ন') || b.innerText.includes('শেষ করুন') || b.innerText.includes('Submit'));

        if (nextBtn) {
            ['mousedown','mouseup','click'].forEach(type =>
                nextBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
            );
            
            if (nextBtn.innerText.includes('শেষ করুন') || nextBtn.innerText.includes('Submit')) {
                console.log('Quiz Auto Pro: Finished quick practice exam.');
                break;
            }
        } else {
            console.warn('Quiz Auto Pro: Next button not found!');
        }

        currentQuestionSerial++;
        await sleep(1000); // Wait for the next question to render
    }
}
