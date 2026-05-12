// Tauri IPC - llamadas al backend Rust
let invoke;
try {
    invoke = window.__TAURI__.core.invoke;
} catch (e) {
    // Fallback: mostrar error en la UI si __TAURI__ no esta disponible
    window.addEventListener("DOMContentLoaded", () => {
        document.body.innerHTML = `<div style="padding:40px;text-align:center;font-family:sans-serif">
            <h2 style="color:#c0392b">Error: Tauri IPC not available</h2>
            <p>This app must run inside the Tauri desktop shell.</p>
            <p style="font-size:12px;color:#999">${e.message}</p>
        </div>`;
    });
    invoke = async () => { throw new Error("Tauri IPC unavailable"); };
}

// Configuracion de categorias
const CATEGORIES = [
    { id: "base",   name: "Base",   index: 0 },
    { id: "head",   name: "Head",   index: 1 },
    { id: "ears",   name: "Ears",   index: 2 },
    { id: "eyes",   name: "Eyes",   index: 3 },
    { id: "nose",   name: "Nose",   index: 4 },
    { id: "legs",   name: "Legs",   index: 5 },
    { id: "feet",   name: "Feet",   index: 6 },
    { id: "tail",   name: "Tail",   index: 7 },
    { id: "coat",   name: "Coat",   index: 8 },
    { id: "colour", name: "Colour", index: 9 },
];

// Trigger words for warning
const arachnidTriggers = [
    "spider", "tarantula", "whip spider", "arachnid",
    "scorpion", "centipede", "millipede", "tick", "mite"
];

function showArachnophobiaWarning(animal) {
    document.getElementById("warningText").textContent = "⚠ Arachnophobia Warning: " + animal;
    document.getElementById("warningOverlay").style.display = "flex";
}

function closeWarning() {
    document.getElementById("warningOverlay").style.display = "none";
}

function checkForArachnids(animal) {
    return arachnidTriggers.some(trigger => animal.toLowerCase().includes(trigger));
}

// --- Generacion con animacion ---

async function generateWithAnimation(index) {
    const cat = CATEGORIES[index];
    const button = document.querySelector(`button[data-category="${cat.id}"]`);
    const element = document.getElementById(`num${index}`);
    const counter = document.getElementById(`count${index}`);

    if (!button || !element) return;
    button.disabled = true;

    // Animacion de "spinning"
    let ticks = 0;
    const interval = setInterval(() => {
        element.textContent = ["\u2728", "\ud83d\udd04", "\u267b", "\ud83c\udfaf"][ticks % 4];
        ticks++;
        if (ticks > 12) {
            clearInterval(interval);
            pickFinal(cat, index, button, element, counter);
        }
    }, 30);
}

async function pickFinal(cat, index, button, element, counter) {
    try {
        const selected = await invoke("pick_and_remove", { category: cat.id });
        element.textContent = selected;

        if (checkForArachnids(selected)) {
            showArachnophobiaWarning(selected);
        }

        // Actualizar contador del pool
        const remaining = await invoke("get_pool", { category: cat.id });
        counter.textContent = remaining.length > 0
            ? `${remaining.length} left`
            : "\u26a0 Pool empty";
    } catch (err) {
        element.textContent = "\u2757 " + err;
    } finally {
        button.disabled = false;
    }
}

// --- Extra (sin eliminacion) ---

async function generateExtra() {
    const button = document.querySelector('button[data-category="extras"]');
    const element = document.getElementById("num10");
    if (!button || !element) return;
    button.disabled = true;

    let ticks = 0;
    const interval = setInterval(() => {
        element.textContent = ["\u2728", "\ud83d\udd04", "\u267b", "\ud83c\udfaf"][ticks % 4];
        ticks++;
        if (ticks > 12) {
            clearInterval(interval);
            pickExtraFinal(element, button);
        }
    }, 30);
}

async function pickExtraFinal(element, button) {
    try {
        const selected = await invoke("pick_extra");
        element.textContent = selected;
    } catch (err) {
        element.textContent = "\u2757 " + err;
    } finally {
        button.disabled = false;
    }
}

// --- Reset ---

async function resetAll() {
    if (!confirm("Reset all pools? This will restore every item from the seeder.")) return;

    const btn = document.getElementById("resetBtn");
    btn.disabled = true;
    btn.textContent = "Resetting...";

    try {
        await invoke("reset_pools");
        btn.textContent = "\u2713 Done!";

        // Recargar contadores
        for (let i = 0; i < CATEGORIES.length; i++) {
            const cat = CATEGORIES[i];
            const pool = await invoke("get_pool", { category: cat.id });
            document.getElementById(`count${i}`).textContent = `${pool.length} left`;
            document.getElementById(`num${i}`).textContent = "";
        }

        setTimeout(() => {
            btn.textContent = "\ud83d\udd04 Reset All";
            btn.disabled = false;
        }, 1500);
    } catch (err) {
        btn.textContent = "\u274c Error";
        console.error("Reset failed:", err);
        btn.disabled = false;
    }
}

// --- Inicializacion ---

window.addEventListener("DOMContentLoaded", async () => {
    for (let i = 0; i < CATEGORIES.length; i++) {
        const cat = CATEGORIES[i];
        try {
            const pool = await invoke("get_pool", { category: cat.id });
            document.getElementById(`count${i}`).textContent = `${pool.length} left`;
        } catch (err) {
            document.getElementById(`count${i}`).textContent = "\u274c";
        }
    }
});
