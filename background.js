let usageTabId = null;
let checking = false;

async function checkUsage() {
    if (checking) {
        console.log("Usage check already running");
        return;
    }
    checking = true;
    try {
        if (usageTabId !== null) {
            try {
                await browser.tabs.get(usageTabId);
                return;
            } catch {
                usageTabId = null;
            }
        }
        const tab = await browser.tabs.create({
            url: "https://gemini.google.com/usage",
            active: false
        });
        usageTabId = tab.id;
        console.log("Usage tab created:", usageTabId);
    } catch (error) {
        console.error("Failed to start usage check:", error);
    } finally {
        checking = false;
    }
}

async function createNormalAlarm() {
    const data = await browser.storage.local.get("interval");
    const interval = data.interval || 60;
    const periodInMinutes = interval / 60;
    await browser.alarms.clear("usage-check");
    await browser.alarms.create("usage-check", {
        periodInMinutes
    });
    console.log(
        "Monitoring interval:",
        interval,
        "seconds"
    );
}

async function setNormalMode() {
    await browser.alarms.clear("usage-check");
    try {
        await browser.action.setIcon({
            path: {
                "16": "icon.svg",
                "32": "icon.svg"
            }
        });
        console.log("Icon changed to NORMAL");
    } catch (error) {
        console.error("Failed to set normal icon:", error);
    }
    const data = await browser.storage.local.get("monitor");
    if (data.monitor === true) {
        await createNormalAlarm();
    } else {
        console.log("Monitoring DISABLED");
    }
}

async function setLimitReachedMode(resetTime) {
    await browser.alarms.clear("usage-check");
    try {
        await browser.action.setIcon({
            path: {
                "16": "icon-red.svg",
                "32": "icon-red.svg"
            }
        });
        console.log("Icon changed to RED");
    } catch (error) {
        console.error("Failed to set red icon:", error);
    }
    const now = new Date();
    const match = resetTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
        console.error("Cannot parse reset time:", resetTime);
        return;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const reset = new Date(now);
    reset.setHours(hours, minutes, 0, 0);
    if (reset <= now) {
        reset.setDate(reset.getDate() + 1);
    }
    reset.setMinutes(reset.getMinutes() + 1);
    await browser.alarms.create("usage-check", {
        when: reset.getTime()
    });
    console.log(
        "Limit reached. Next check:",
        reset.toLocaleString()
    );
}

browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === "usage") {
        console.log("BACKGROUND RECEIVED:", message.data);
        const { current, currentReset } = message.data;
        await browser.storage.local.set({
            current,
            currentReset,
            updatedAt: Date.now()
        });
        if (current >= 100) {
            await setLimitReachedMode(currentReset);
        } else {
            await setNormalMode();
        }
        if (sender.tab && sender.tab.id === usageTabId) {
            try {
                await browser.tabs.remove(usageTabId);
            } catch (error) {
                console.error("Failed to close usage tab:", error);
            }
            usageTabId = null;
        }
        return;
    }

    if (message.type === "monitor-changed") {
        await browser.alarms.clear("usage-check");
        if (message.enabled) {
            console.log("Monitoring enabled");
            await createNormalAlarm();
            checkUsage();
        } else {
            console.log("Monitoring disabled");
        }
        return;
    }


    if (message.type === "interval-changed") {
        console.log(
            "Interval changed:",
            message.interval,
            "seconds"
        );
        const data = await browser.storage.local.get([
            "monitor",
            "current",
            "currentReset"
        ]);
        if (data.monitor !== true) {
            return;
        }
        if (data.current >= 100 && data.currentReset) {
            await setLimitReachedMode(data.currentReset);
        } else {
            await createNormalAlarm();
        }
        return;
    }
});

browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "usage-check") {
        checkUsage();
    }
});

browser.storage.local.get([
    "monitor",
    "interval"
]).then(async (data) => {
    if (data.interval === undefined) {
        await browser.storage.local.set({
            interval: 60
        });
    }
    if (data.monitor === true) {
        checkUsage();
    }
});