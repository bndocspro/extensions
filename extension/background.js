chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "GET_AI_ANSWER") {
        fetchAiAnswer(request.question, request.options, request.config)
            .then(answer => sendResponse({ answer: answer }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep message channel open for async response
    }
});

async function fetchAiAnswer(question, optionsText, config) {
    const prompt = `You are an automated multiple-choice quiz solver.
You MUST output ONLY a single letter representing the correct option: A, B, C, or D.
DO NOT write any explanations.
DO NOT use markdown.
DO NOT output JSON.
JUST THE LETTER.

Question: ${question}
Options:
${optionsText}`;

    const apiKey = config.apiKey;
    let model = config.modelName || "gemma-4-31b-it";
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1
            }
        })
    });
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
    }
    
    const data = await response.json();
    let text = "";
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
        text = data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("Invalid response format from API");
    }
    
    // Clean markdown if present
    text = text.replace(/```[a-z]*/gi, '').trim();
    
    // Ideal case: AI just outputs exactly one letter (A, B, C, or D)
    const exactMatch = text.match(/^\s*([A-D])\s*$/i);
    if (exactMatch) {
        return exactMatch[1].toUpperCase();
    }
    
    // Split the text into lines or bullet point fragments
    const fragments = text.split(/(?:\n|\* )/);
    
    // Search for the specific fragment marked as Correct (and not incorrect)
    for (let frag of fragments) {
        const lower = frag.toLowerCase();
        // If this fragment explicitly says it's correct and avoids the word incorrect
        if (lower.includes('correct') && !lower.includes('incorrect')) {
            // Find an isolated A, B, C, or D in this specific fragment
            const m = frag.match(/\b([A-D])\b/i);
            if (m) return m[1].toUpperCase();
        }
    }

    // Regex fallback for other common phrasings
    const match = text.match(/(?:answer["']?\s*:\s*["']?|answer is\s*|correct option is\s*|correct answer:\s*|corresponds to(?: option)?\s*)([A-D])/i);
    if (match) return match[1].toUpperCase();

    // Secondary fallback: look for "Option X" anywhere, prioritizing the last one
    const optionMatches = [...text.matchAll(/option\s*([A-D])/gi)];
    if (optionMatches.length > 0) {
        return optionMatches[optionMatches.length - 1][1].toUpperCase();
    }

    // Last resort: find the very last standalone A, B, C, or D near the end of the text
    const lastResort = text.match(/\b([A-D])\b[^\w]*$/i);
    if (lastResort) return lastResort[1].toUpperCase();

    throw new Error(`Could not parse answer from AI response. Raw text: "${text}"`);
}
