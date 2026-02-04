/* =====================================================
   ANDROID WEB BLUETOOTH CONTROLLER (HM-10)
   ALL-IN-ONE JS FILE
   ===================================================== */

/* ---------- BLE CONSTANTS (HM-10) ---------- */
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID    = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleDevice = null;
let bleServer = null;
let bleService = null;
let bleCharacteristic = null;

/* =====================================================
   BLUETOOTH CONNECT
   ===================================================== */
document.getElementById("connect").onclick = async () => {
    try {
        console.log("Requesting BLE device...");

        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }],
            optionalServices: [SERVICE_UUID]
        });

        bleDevice.addEventListener(
            "gattserverdisconnected",
            onDisconnected
        );

        console.log("Connecting to GATT...");
        bleServer = await bleDevice.gatt.connect();

        console.log("Getting service...");
        bleService = await bleServer.getPrimaryService(SERVICE_UUID);

        console.log("Getting characteristic...");
        bleCharacteristic = await bleService.getCharacteristic(CHAR_UUID);

        alert("Bluetooth connected!");
    } catch (err) {
        console.error(err);
        alert("Bluetooth error:\n" + err);
    }
};

/* ---------- SEND DATA ---------- */
function send(cmd) {
    if (!bleCharacteristic) return;

    const data = new TextEncoder().encode(cmd);
    bleCharacteristic.writeValue(data);
}

/* ---------- DISCONNECT ---------- */
function onDisconnected() {
    bleCharacteristic = null;
    alert("Bluetooth disconnected");
}

/* =====================================================
   ORIENTATION CHECK (LANDSCAPE ONLY)
   ===================================================== */
setInterval(() => {
    const warn = document.getElementById("landscape-warning");
    if (!warn) return;

    warn.style.display =
        window.innerWidth < window.innerHeight ? "flex" : "none";
}, 300);

/* =====================================================
   MODE SWITCH (BUTTONS / STICKS)
   ===================================================== */
const buttonMode = document.getElementById("button-mode");
const sticksMode = document.getElementById("sticks-mode");
const modeSelect = document.getElementById("mode");

modeSelect.onchange = () => {
    const m = modeSelect.value;
    buttonMode.style.display = m === "buttons" ? "block" : "none";
    sticksMode.style.display  = m === "sticks"  ? "block" : "none";
};

/* =====================================================
   BUTTON CONTROLS (WITH ANIMATION)
   ===================================================== */
function bindButton(id, pressCmd, releaseCmd = "STOP") {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener("touchstart", e => {
        e.preventDefault();
        btn.classList.add("active");
        send(pressCmd);
    });

    btn.addEventListener("touchend", e => {
        e.preventDefault();
        btn.classList.remove("active");
        send(releaseCmd);
    });

    btn.addEventListener("touchcancel", () => {
        btn.classList.remove("active");
        send(releaseCmd);
    });
}

bindButton("btn-left",  "LEFT");
bindButton("btn-right", "RIGHT");
bindButton("btn-gas",   "GAS");
bindButton("btn-brake", "BRAKE");

/* =====================================================
   FLOATING STICKS (TRUE MULTI-TOUCH)
   ===================================================== */
function setupStick(areaId, stickId, label) {
    const area  = document.getElementById(areaId);
    const stick = document.getElementById(stickId);
    if (!area || !stick) return;

    const dot = stick.children[0];
    let fingerId = null;

    area.addEventListener("touchstart", e => {
        if (fingerId !== null) return;

        const t = e.changedTouches[0];
        fingerId = t.identifier;

        stick.style.left = t.clientX + "px";
        stick.style.top  = t.clientY + "px";
        stick.style.display = "block";
    });

    area.addEventListener("touchmove", e => {
        if (fingerId === null) return;

        const t = [...e.changedTouches].find(x => x.identifier === fingerId);
        if (!t) return;

        const rect = stick.getBoundingClientRect();
        let dx = t.clientX - (rect.left + 70);
        let dy = t.clientY - (rect.top  + 70);

        const dist = Math.hypot(dx, dy);
        const max = 60;

        if (dist > max) {
            dx = dx / dist * max;
            dy = dy / dist * max;
        }

        dot.style.left = (dx + 45) + "px";
        dot.style.top  = (dy + 45) + "px";

        send(label + Math.round(dx) + "," + Math.round(dy));
    });

    function resetStick() {
        fingerId = null;
        stick.style.display = "none";
        dot.style.left = "45px";
        dot.style.top  = "45px";
        send(label + "0,0");
    }

    area.addEventListener("touchend", e => {
        if ([...e.changedTouches].some(t => t.identifier === fingerId)) {
            resetStick();
        }
    });

    area.addEventListener("touchcancel", resetStick);
}

/* LEFT = steering, RIGHT = throttle */
setupStick("stick-left-area",  "stick-left",  "TURN:");
setupStick("stick-right-area", "stick-right", "DRIVE:");
