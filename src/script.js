/* =====================================================
   CAR CONTROLLER — BUTTONS + STICKS (STABLE)
   ===================================================== */

/* ---------- BLE UUIDs (HM-10) ---------- */
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID    = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleChar = null;

/* ---------- State ---------- */
let currentAngle = "CENTER";
let gasActive = false;

/* ---------- Throttle ---------- */
let lastSent = "";
let lastTime = 0;
const SEND_INTERVAL = 40;

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
        bleChar = await service.getCharacteristic(CHAR_UUID);
        alert("Bluetooth connected");
    } catch (e) {
        alert("Bluetooth error:\n" + e);
    }
};

/* =====================================================
   SEND COMMAND
   ===================================================== */
function sendCommand(force = false) {
    if (!bleChar) return;

    const speed = gasActive ? "GAS" : "0";
    const cmd = `${currentAngle};${speed}\n`;
    const now = Date.now();

    if (!force) {
        if (cmd === lastSent) return;
        if (now - lastTime < SEND_INTERVAL) return;
    }

    lastSent = cmd;
    lastTime = now;

    bleChar.writeValue(new TextEncoder().encode(cmd));
}

/* =====================================================
   MODE SWITCH
   ===================================================== */
const buttonMode = document.getElementById("button-mode");
const sticksMode = document.getElementById("sticks-mode");
const modeSelect = document.getElementById("mode");

function setMode(mode) {
    if (mode === "buttons") {
        buttonMode.style.display = "block";
        sticksMode.style.display = "none";
        sticksMode.classList.remove("active");
    } else {
        buttonMode.style.display = "none";
        sticksMode.style.display = "block";
        sticksMode.classList.add("active");
    }

    gasActive = false;
    currentAngle = "CENTER";
    sendCommand(true);
}

setMode(modeSelect.value);
modeSelect.onchange = () => setMode(modeSelect.value);

/* =====================================================
   BUTTONS
   ===================================================== */
function bindButton(id, press, release) {
    const b = document.getElementById(id);
    if (!b) return;

    b.addEventListener("touchstart", e => {
        e.preventDefault();
        b.classList.add("active");
        press();
        sendCommand(true);
    });

    b.addEventListener("touchend", e => {
        e.preventDefault();
        b.classList.remove("active");
        release();
        sendCommand(true);
    });

    b.addEventListener("touchcancel", () => {
        b.classList.remove("active");
        release();
        sendCommand(true);
    });
}

bindButton("btn-left",
    () => currentAngle = "LEFT",
    () => currentAngle = "CENTER"
);

bindButton("btn-right",
    () => currentAngle = "RIGHT",
    () => currentAngle = "CENTER"
);

bindButton("btn-gas",
    () => gasActive = true,
    () => gasActive = false
);

bindButton("btn-brake",
    () => gasActive = false,
    () => gasActive = false
);

/* =====================================================
   STICKS
   ===================================================== */
function setupStick(areaId, stickId, type) {
    const area = document.getElementById(areaId);
    const stick = document.getElementById(stickId);
    const dot = stick.querySelector(".stick-dot");
    let finger = null;

    area.addEventListener("touchstart", e => {
        if (finger !== null) return;
        const t = e.changedTouches[0];
        finger = t.identifier;
        stick.style.left = t.clientX + "px";
        stick.style.top = t.clientY + "px";
        stick.style.display = "block";
    });

    area.addEventListener("touchmove", e => {
        if (finger === null) return;
        const t = [...e.changedTouches].find(x => x.identifier === finger);
        if (!t) return;

        const r = stick.getBoundingClientRect();
        let dx = t.clientX - (r.left + 70);
        let dy = t.clientY - (r.top + 70);

        const max = 60;
        const d = Math.hypot(dx, dy);
        if (d > max) {
            dx = dx / d * max;
            dy = dy / d * max;
        }

        dot.style.left = dx + 45 + "px";
        dot.style.top = dy + 45 + "px";

        if (type === "STEER") {
            currentAngle = Math.round(90 - (dx / max) * 90);
        }

        if (type === "THROTTLE") {
            gasActive = dy < -15;
        }

        sendCommand();
    });

    function reset() {
        finger = null;
        stick.style.display = "none";
        dot.style.left = "45px";
        dot.style.top = "45px";
        if (type === "STEER") currentAngle = "CENTER";
        if (type === "THROTTLE") gasActive = false;
        sendCommand(true);
    }

    area.addEventListener("touchend", reset);
    area.addEventListener("touchcancel", reset);
}

setupStick("stick-left-area", "stick-left", "STEER");
setupStick("stick-right-area", "stick-right", "THROTTLE");
