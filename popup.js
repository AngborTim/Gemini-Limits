//popup.js

async function load() {
    const data = await browser.storage.local.get([
        "current",
        "currentReset",
        "updatedAt",
        "monitor",
        "interval"
    ]);

    document.getElementById("usage").textContent =
        data.current !== undefined
            ? `${data.current}% used`
            : "No data";

    document.getElementById("reset").textContent =
        data.currentReset
            ? `Resets at ${data.currentReset}`
            : "";

    document.getElementById("updated").textContent =
        data.updatedAt
            ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}`
            : "";

    document.getElementById("monitor").checked =
        data.monitor === true;

    document.getElementById("interval").value =
        data.interval !== undefined
            ? String(data.interval)
            : "60";
}

document.getElementById("monitor").addEventListener(
    "change",
    async (event) => {
        await browser.storage.local.set({
            monitor: event.target.checked
        });
        browser.runtime.sendMessage({
            type: "monitor-changed",
            enabled: event.target.checked
        });
    }
);

document.getElementById("interval").addEventListener(
    "change",
    async (event) => {
        const interval = Number(event.target.value);
        await browser.storage.local.set({
            interval
        });
        browser.runtime.sendMessage({
            type: "interval-changed",
            interval
        });
    }
);

load();