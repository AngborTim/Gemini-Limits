function getUsageLimits() {
    const text = document.body?.innerText || "";
    const result = {
        current: null,
        currentReset: null
    };
    const match = text.match(
        /Current usage\s+(\d+)%\s+used\s+Resets at\s+([^\n]+)/
    );
    if (match) {
        result.current = Number(match[1]);
        result.currentReset = match[2].trim();
    }
    console.log("USAGE BODY: ", document.body?.innerText || "");
    console.log("RESULT: ", result);
    return result;
}

function check() {
    const limits = getUsageLimits();

    if (limits.current !== null) {
        console.log("GEMINI LIMITS:", limits);
        browser.runtime.sendMessage({
            type: "usage",
            data: limits
        });
    }
}

check();

setTimeout(check, 3000);
setTimeout(check, 10000);