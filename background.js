// background.js

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

async function setNormalMode(percent) {
    await browser.alarms.clear("usage-check");
    // Вызываем обновление UI
    await updateUI("normal", percent);

    const data = await browser.storage.local.get("monitor");
    if (data.monitor === true) {
        await createNormalAlarm();
    } else {
        console.log("Monitoring DISABLED");
    }
}


async function setLimitReachedMode(resetTime) {
    await browser.alarms.clear("usage-check");
    await updateUI("limit");

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
        // Закрываем техническую вкладку сразу после получения данных
        console.log("CLOSE CHECK:", {
            senderTabId: sender.tab?.id,
            usageTabId: usageTabId
        });
        if (sender.tab && sender.tab.id === usageTabId) {
            console.log("CLOSING USAGE TAB:", usageTabId);
            try {
                await browser.tabs.remove(usageTabId);
                console.log("USAGE TAB CLOSED");
            } catch (error) {
                console.error("Failed to close usage tab:", error);
            }
            usageTabId = null;
        }
        // После закрытия вкладки устанавливаем нужный режим
        if (current >= 100) {
            await setLimitReachedMode(currentReset);
        } else {
            await setNormalMode(current);
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
            // 
            await updateUI("pause");
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


// привязка иконок к процентам
async function updateUI(state, percent = 0) {
    let iconName = "icon.svg";

    switch (true) {
        case (state === "pause" && percent != 0):
            iconName = "icon-pause.svg";
            break;
        case (state === "pause" && percent == 0):
            iconName = "icon-red.svg";
            break;
        case (state === "limit"):
            iconName = "icon-red.svg";
            break;
        case (state === "normal" && percent <= 75):
            iconName = "icon-green.svg";
            break;
        case (state === "normal" && percent <= 85):
            iconName = "icon-yellow.svg";
            break;
        case (state === "normal" && percent <= 100):
            iconName = "icon-orange.svg";
            break;
        case (state === "limit"):
            iconName = "icon-red.svg";
            break;
        default:
            iconName = "icon.svg";
    }

    try {
        await browser.action.setIcon({
            path: {
                "16": iconName,
                "32": iconName
            }
        });
        console.log(`UI updated: state=${state}, percent=${percent}, icon=${iconName}`);
    } catch (error) {
        console.error("Failed to set icon:", error);
    }
}