(function () {

    console.clear();
    console.log("%c Chorcha Interceptor Loaded ",
        "background:#000;color:#00ff88;padding:6px 12px;font-size:14px;border-radius:4px;"
    );

    function prettyLog(source, url, chorchaId, data) {

        console.log(
            `%c ${source} CAPTURED `,
            "background:#111;color:#00e0ff;padding:4px 10px;font-weight:bold;border-radius:4px;"
        );

        console.group("%c Request Info", "color:#ff9800;font-weight:bold;");
        console.log("URL:", url);
        console.log("x-chorcha-id:", chorchaId);
        console.groupEnd();

        console.group("%c Full JSON Response", "color:#00c853;font-weight:bold;");
        console.dir(data);
        console.groupEnd();

        console.group("%c Pretty JSON", "color:#e91e63;font-weight:bold;");
        console.log(JSON.stringify(data, null, 2));
        console.groupEnd();

        window.chorchaData = {
            source,
            url,
            chorchaId,
            data
        };

        console.log(
            "%c Saved to window.chorchaData ",
            "background:#222;color:#fff;padding:4px 8px;border-radius:4px;"
        );
    }

    // ====================================
    // FETCH
    // ====================================

    const originalFetch = window.fetch;

    window.fetch = async function (...args) {

        const response = await originalFetch.apply(this, args);

        try {

            const url = args[0]?.url || args[0];

            if (url && url.includes('/exam/quick')) {

                const clone = response.clone();

                const data = await clone.json();

                const chorchaId =
                    response.headers.get("x-chorcha-id");

                prettyLog(
                    "FETCH",
                    url,
                    chorchaId,
                    data
                );
            }

        } catch (e) {
            console.error("FETCH ERROR:", e);
        }

        return response;
    };

    // ====================================
    // XHR
    // ====================================

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {

        this.addEventListener("load", function () {

            try {

                if (
                    this._url &&
                    this._url.includes("/exam/quick")
                ) {

                    const chorchaId =
                        this.getResponseHeader("x-chorcha-id");

                    let data = null;

                    try {
                        data = JSON.parse(this.responseText);
                    } catch (e) {}

                    prettyLog(
                        "XHR",
                        this._url,
                        chorchaId,
                        data
                    );
                }

            } catch (err) {
                console.error("XHR ERROR:", err);
            }
        });

        return originalSend.apply(this, arguments);
    };

})();