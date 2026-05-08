    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const url = args[0]?.url || args[0];
        
        if (typeof url === 'string' && url.includes('/battle/create')) {
            try {
                if (args[1] && args[1].body) {
                    const payload = JSON.parse(args[1].body);
                    if (payload.druto_id) {
                        window.postMessage({ type: 'BATTLE_CREATED', battleId: payload.druto_id }, '*');
                    }
                }
            } catch(e) { console.error('Battle intercept parse error', e); }
        }

        const response = await originalFetch.apply(this, args);

        try {
            if (typeof url === 'string' && url.includes('/exam/quick')) {
                const clone = response.clone();
                const data = await clone.json();
                const chorchaId = response.headers.get("x-chorcha-id");
                window.postMessage({ type: 'QUICK_EXAM_INTERCEPTED', data, chorchaId }, '*');
            }
        } catch(e) { }

        return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            try {
                if (this._url && this._url.includes('/exam/quick')) {
                    const chorchaId = this.getResponseHeader("x-chorcha-id");
                    let data = null;
                    try {
                        data = JSON.parse(this.responseText);
                    } catch (e) {}
                    if (data) {
                        window.postMessage({ type: 'QUICK_EXAM_INTERCEPTED', data, chorchaId }, '*');
                    }
                }
            } catch(e) {}
        });
        return originalSend.apply(this, arguments);
    };
