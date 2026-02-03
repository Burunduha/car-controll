/* =====================================================
   CLEAN BLUEFY BLE CONTROLLER (HM-10)
   ===================================================== */

let bleAvailable = false;
let bleConnected = false;

/* ---------- Detect BLE API once ---------- */
(function detectBLE() {
    if (window.bluefy && typeof window.bluefy.scan === "function") {
        bleAvailable = true;
        console.log("Bluefy BLE API (bluefy.*) available");
        return;
    }

    if (
        window.webkit &&
        window.webkit.messageHandlers &&
        window.webkit.messageHandlers.bluefy
    ) {
        bleAvailable = true;
        console.log("Bluefy BLE API (webkit bridge) available");
        return;
    }

    console.warn("Bluefy BLE API NOT injected");
})();

/* ---------- Connect ---------- */
document.getElementById("connect").onclick = () => {
    if (!bleAvailable) {
        alert(
            "Bluetooth API is not available on this page.\n\n" +
            "This usually happens when the site is opened from\n" +
            "an online editor / sandbox (like PlayCode).\n\n" +
            "Host the files on a normal HTTPS site (GitHub Pages, Netlify)."
        );
        return;
    }

    // New Bluefy API
    if (window.bluefy && window.bluefy.scan) {
        window.bluefy.scan(["FFE0"]);
        return;
    }

    // WebKit bridge API
    window.webkit.messageHandlers.bluefy.postMessage({
        action: "scan",
        services: ["FFE0"]
    });
};

/* ---------- Bluefy callbacks ---------- */
window.bluefyDeviceConnected = function (device) {
    console.log("BLE connected:", device);
    bleConnected = true;
    alert("Bluetooth connected");
};

window.bluefyDeviceDisconnected = function () {
    bleConnected = false;
    alert("Bluetooth disconnected");
};

/* ---------- Send data ---------- */
function send(cmd) {
    if (!bleConnected) return;

    if (window.bluefy && window.bluefy.write) {
        window.bluefy.write("FFE0", "FFE1", cmd);
        return;
    }

    window.webkit.messageHandlers.bluefy.postMessage({
        action: "write",
        service: "FFE0",
        characteristic: "FFE1",
        value: cmd
    });
}

/* =====================================================
   UI LOGIC (unchanged)
   ===================================================== */

/* Orientation */
setInterval(() => {
    const warn = document.getElementById("landscape-warning");
    if (!warn) return;
    warn.style.display =
        window.innerWidth < window.innerHeight ? "flex" : "none";
}, 300);

/* Mode switch */
const buttonMode = document.getElementById("button-mode");
const sticksMode = document.getElementById("sticks-mode");
const mode = document.getElementById("mode");

if (mode) {
    mode.onchange = () => {
        buttonMode.style.display = mode.value === "buttons" ? "block" : "none";
        sticksMode.style.display  = mode.value === "sticks"  ? "block" : "none";
    };
}

/* Buttons */
function bindButton(id, down, up = "STOP") {
    const b = document.getElementById(id);
    if (!b) return;

    b.addEventListener("touchstart", e => {
        e.preventDefault();
        b.classList.add("active");
        send(down);
    });

    b.addEventListener("touchend", e => {
        e.preventDefault();
        b.classList.remove("active");
        send(up);
    });

    b.addEventListener("touchcancel", () => {
        b.classList.remove("active");
        send(up);
    });
}

bindButton("btn-left", "LEFT");
bindButton("btn-right", "RIGHT");
bindButton("btn-gas", "GAS");
bindButton("btn-brake", "BRAKE");

/* Floating sticks (multi-touch) */
function setupStick(areaId, stickId, label) {
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

        const d = Math.hypot(dx, dy);
        const m = 60;
        if (d > m) {
            dx = dx / d * m;
            dy = dy / d * m;
        }

        dot.style.left = dx + 45 + "px";
        dot.style.top  = dy + 45 + "px";

        send(label + Math.round(dx) + "," + Math.round(dy));
    });

    function reset() {
        finger = null;
        stick.style.display = "none";
        dot.style.left = "45px";
        dot.style.top  = "45px";
        send(label + "0,0");
    }

    area.addEventListener("touchend", e => {
        if ([...e.changedTouches].some(t => t.identifier === finger)) reset();
    });

    area.addEventListener("touchcancel", reset);
}

setupStick("stick-left-area",  "stick-left",  "TURN:");
setupStick("stick-right-area", "stick-right", "DRIVE:");
