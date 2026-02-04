/* =====================================================
   ANDROID WEB BLUETOOTH → ARDUINO CAR
   PROTOCOL: ANGLE;SPEED\n
   ===================================================== */

/* ---------- BLE UUIDs (HM-10) ---------- */
const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHAR_UUID    = '0000ffe1-0000-1000-8000-00805f9b34fb';

let bleCharacteristic = null;

/* ---------- Control state ---------- */
let currentAngle = "CENTER"; // LEFT / RIGHT / CENTER / number
let currentSpeed = 0;        // GAS / BRAKE / number

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

/* ---------- Send combined command ---------- */
function sendCommand() {
    if (!bleCharacteristic) return;

    const cmd = `${currentAngle};${currentSpeed}\n`;
    bleCharacteristic.writeValue(
        new TextEncoder().encode(cmd)
    );

    console.log(cmd.trim());
}

/* =====================================================
   BUTTONS
   ===================================================== */
function bindButton(id, onPress, onRelease) {
    const btn = document.getElementById(id);

    btn.addEventListener("touchstart", e => {
        e.preventDefault();
        btn.classList.add("active");
        onPress();
        sendCommand();
    });

    btn.addEventListener("touchend", e => {
        e.preventDefault();
        btn.classList.remove("active");
        onRelease();
        sendCommand();
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
    () => currentSpeed = "GAS",
    () => currentSpeed = 0
);

bindButton("btn-brake",
    () => currentSpeed = "BRAKE",
    () => currentSpeed = 0
);

/* =====================================================
   FLOATING STICKS
   ===================================================== */
function setupStick(areaId, stickId, type) {
    const area = document.getElementById(areaId);
    const stick = document.getElementById(stickId);
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

        const dist = Math.hypot(dx, dy);
        const max = 60;
        if (dist > max) {
            dx = dx / dist * max;
            dy = dy / dist * max;
        }

        dot.style.left = dx + 45 + "px";
        dot.style.top  = dy + 45 + "px";

        if (type === "STEER") {
            // dx: -60..60 → angle 180..0
            const angle = Math.round(
                90 - (dx / max) * 90
            );
            currentAngle = angle;
        }

        if (type === "THROTTLE") {
            // dy: -60..60 → speed
            if (dy < 0) {
                currentSpeed = Math.round(2500 * (-dy / max));
            } else {
                currentSpeed = Math.round(2000 * (dy / max));
            }
        }

        sendCommand();
    });

    function reset() {
        finger = null;
        stick.style.display = "none";
        dot.style.left = "45px";
        dot.style.top  = "45px";

        if (type === "STEER") currentAngle = "CENTER";
        if (type === "THROTTLE") currentSpeed = 0;

        sendCommand();
    }

    area.addEventListener("touchend", reset);
    area.addEventListener("touchcancel", reset);
}

/* Left stick = steering, Right stick = throttle */
setupStick("stick-left-area",  "stick-left",  "STEER");
setupStick("stick-right-area", "stick-right", "THROTTLE");
