/* =====================================================
   ANDROID WEB BLUETOOTH CAR CONTROLLER
   BUTTONS + STICKS (FIXED MODE SWITCH)
   PROTOCOL: ANGLE;GAS | ANGLE;0
   ===================================================== */

/* ---------- BLE UUIDs (HM-10) ---------- */
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID    = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleCharacteristic = null;

/* ---------- Control state ---------- */
let currentAngle = "CENTER"; // LEFT / RIGHT / CENTER / number
let gasActive = false;

/* ---------- Send throttling ---------- */
let lastSent = "";
let lastSendTime = 0;
const SEND_INTERVAL_MS = 40; // ~25 Hz

/* =====================================================
   BLUETOOTH CONNECT
   ===================================================== */
document.getElementById("connect").onclick = async () => {
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        bleCharacteristic = await service.getCharacteristic(CHAR_UUID);

        alert("Bluetooth connected");
    } catch (e) {
        alert("Bluetooth error:\n" + e);
    }
};

/* =====================================================
   SEND COMMAND (ANTI-SPAM)
   ===================================================== */
function sendCommand(force = false) {
    if (!bleCharacteristic) return;

    const speed = gasActive ? "GAS" : "0";
    const cmd = `${currentAngle};${speed}\n`;
    const now = Date.now();

    if (!force) {
        if (cmd === lastSent) return;
        if (now - lastSendTime < SEND_INTERVAL_MS) return;
    }

    lastSent = cmd;
    lastSendTime = now;

    bleCharacteristic.writeValue(
        new TextEncoder().encode(cmd)
    );

    console.log(cmd.trim());
}

/* =====================================================
   MODE SWITCH (FIXED)
   ===================================================== */
const buttonMode = document.getElementById("button-mode");
const sticksMode = document.getElementById("sticks-mode");
const modeSelect = document.getElementById("mode");

function setMode(mode) {
    if (mode === "buttons") {
        buttonMode.style.display = "block";
        sticksMode.style.display = "none";
    } else {
        buttonMode.style.display = "none";
        sticksMode.style.display = "block";
    }

    // reset state on mode switch
    gasActive = false;
    currentAngle = "CENTER";
    sendCommand(true);
}

// init
setMode(modeSelect.value);

modeSelect.addEventListener("change", () => {
    setMode(modeSelect.value);
});

/* =====================================================
   BUTTON MODE
   ===================================================== */
function bindButton(id, onPress, onRelease) {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener("touchstart", e => {
        e.preventDefault();
        btn.classList.add("active");
        onPress();
        sendCommand(true);
    });

    btn.addEventListener("touchend", e => {
        e.preventDefault();
        btn.classList.remove("active");
        onRelease();
        sendCommand(true);
    });

    btn.addEventListener("touchcancel", () => {
        btn.classList.remove("active");
        onRelease();
        sendCommand(true);
    });
}

/* --- Steering buttons --- */
bindButton("btn-left",
    () => currentAngle = "LEFT",
    () => currentAngle = "CENTER"
);

bindButton("btn-right",
    () => currentAngle = "RIGHT",
    () => currentAngle = "CENTER"
);

/* --- Throttle buttons --- */
bindButton("btn-gas",
    () => gasActive = true,
    () => gasActive = false
);

bindButton("btn-brake",
    () => gasActive = false,
    () => gasActive = false
);

/* =====================================================
   STICK MODE (MULTI-TOUCH)
   ===================================================== */
function setupStick(areaId, stickId, type) {
    const area = document.getElementById(areaId);
    const stick = document.getElementById(stickId);
    if (!area || !stick) return;

    const dot = stick.children[0];
    let finger = null;

    area.addEventListener("touchstart", e => {
        if (finger !== null) return;
        const t = e.changedTouches[0];
        finger = t.identifier;

        stick.style.left = t.clientX + "px";
        stick.style.top  = t.clientY + "px";
        stick.style.display = "block";
    });

    area.addEventListener("touchmove", e => {
        if (finger === null) return;
        const t = [...e.changedTouches].find(x => x.identifier === finger);
        if (!t) return;

        const r = stick.getBoundingClientRect();
        let dx = t.clientX - (r.left + 70);
        let dy = t.clientY - (r.top  + 70);

        const max = 60;
        const dist = Math.hypot(dx, dy);
        if (dist > max) {
            dx = dx / dist * max;
            dy = dy / dist * max;
        }

        dot.style.left = dx + 45 + "px";
        dot.style.top  = dy + 45 + "px";

        if (type === "STEER") {
            const angle = Math.round(90 - (dx / max) * 90);
            currentAngle = angle;
        }

        if (type === "THROTTLE") {
            gasActive = dy < -15; // up = gas
        }

        sendCommand();
    });

    function reset() {
        finger = null;
        stick.style.display = "none";
        dot.style.left = "45px";
        dot.style.top  = "45px";

        if (type === "STEER") currentAngle = "CENTER";
        if (type === "THROTTLE") gasActive = false;

        sendCommand(true);
    }

    area.addEventListener("touchend", reset);
    area.addEventListener("touchcancel", reset);
}

/* Left stick = steering, Right stick = throttle */
setupStick("stick-left-area",  "stick-left",  "STEER");
setupStick("stick-right-area", "stick-right", "THROTTLE");
