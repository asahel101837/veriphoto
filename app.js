import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCDrXohcOJZcsMgqmvXakk4SJnaj7hgzDo",
    authDomain: "veriphoto-2c95d.firebaseapp.com",
    projectId: "veriphoto-2c95d",
    storageBucket: "veriphoto-2c95d.firebasestorage.app",
    messagingSenderId: "1005950289147",
    appId: "1:1005950289147:web:a8fddbf7ab082f99335c5e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let coordsActuales = null;
let mostrandoExito = false;
const statusTxt = document.getElementById("status");
const btnPrincipal = document.getElementById("btnPrincipal");

// --- GPS Y CONTROL DE BOTÓN ACTUALIZADO ---
function activarGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                // Creamos un objeto personalizado para asegurar que el timestamp sea actual
                coordsActuales = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    timestamp: Date.now() // <--- ESTO ES LA CLAVE
                };

                if (!mostrandoExito) {
                    statusTxt.innerHTML = `<i class="bi bi-geo-alt-fill text-success"></i> GPS Activo (±${Math.round(pos.coords.accuracy)}m)`;
                    statusTxt.className = "status-box bg-success-subtle text-success border border-success-subtle";
                    btnPrincipal.disabled = false;
                }
            },
            () => {
                coordsActuales = null;
                statusTxt.innerHTML = `<i class="bi bi-geo-off text-danger"></i> Error: Activa tu ubicación`;
                statusTxt.className = "status-box bg-danger-subtle text-danger border border-danger-subtle";
                btnPrincipal.disabled = true;
            },
            { 
                enableHighAccuracy: true, 
                timeout: 10000, 
                maximumAge: 0 
            }
        );
    }
}


// --- 4. PROCESAMIENTO Y VALIDACIÓN (FECHA EXIF + GPS NAVEGADOR) ---
document.getElementById("cameraInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // BLOQUEO GPS NAVEGADOR: Verificamos señal activa (máximo 20s de antigüedad)
    const señalGpsReciente = coordsActuales && (Date.now() - coordsActuales.timestamp < 20000);

    if (!señalGpsReciente) {
        alert("❌ SEÑAL GPS DÉBIL: Asegúrate de que el recuadro verde indique 'GPS Activo' antes de capturar.");
        e.target.value = "";
        return; 
    }

    btnPrincipal.disabled = true;
    btnPrincipal.innerHTML = `<span class="spinner-border spinner-border-sm"></span> CERTIFICANDO...`;
    statusTxt.innerText = "Validando integridad temporal...";

    try {
        const exifData = await obtenerExif(file);
        const horaDispositivo = new Date();
        const horaFoto = exifData.DateTime ? parseExifDate(exifData.DateTime) : new Date(file.lastModified);

        // --- 1. CÁLCULO DE DIFERENCIA DE TIEMPO ---
        const desfaseTiempo = Math.abs((horaDispositivo - horaFoto) / 1000);
        
        // --- 2. VALIDACIÓN CRÍTICA ---
        // Si la foto se tomó hace más de 2 minutos respecto al reloj del sistema, se considera fraude.
        if (desfaseTiempo > 120) {
            throw new Error("FRAUDE DETECTADO: La hora de captura no coincide con la hora actual.");
        }

        // --- 3. PREPARACIÓN DE SEGURIDAD (HASH Y OPTIMIZACIÓN) ---
        statusTxt.innerText = "Sellando evidencia...";
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        const fotoBase64 = await procesarImagen(file);

        // --- 4. SUBIDA A FIRESTORE ---
        const folio = "VP-" + Date.now();
        await addDoc(collection(db, "evidencias"), {
            folio: folio,
            hash: hash,
            foto: fotoBase64,
            
            // Ubicación REAL del navegador (Obligatoria)
            lat: coordsActuales.latitude,
            lon: coordsActuales.longitude,
            precision: coordsActuales.accuracy,
            
            // Validación de Tiempo
            exif_fecha: horaFoto.toISOString(),
            fecha_celular: horaDispositivo.toISOString(),
            fecha_servidor: serverTimestamp(),
            desfase_segundos: Math.round(desfaseTiempo),
            
            // Datos EXIF de ubicación (Se guardan como N/A para evitar errores de permisos)
            exif_lat: "NO_SOLICITADO",
            verificado: true
        });

        // --- 5. ÉXITO ---
        mostrandoExito = true;
        statusTxt.className = "status-box bg-success text-white px-2";
        statusTxt.innerHTML = `✅ CERTIFICADA <code class="d-block text-white">${folio}</code>`;
        btnPrincipal.disabled = false;
        btnPrincipal.innerHTML = `<i class="bi bi-camera-fill"></i> NUEVA CAPTURA`;
        btnPrincipal.className = "btn btn-outline-primary w-100 mb-3";

    } catch (error) {
        alert(`❌ ERROR DE CERTIFICACIÓN\n${error.message}`);
        btnPrincipal.disabled = false;
        btnPrincipal.innerHTML = `<i class="bi bi-camera-fill"></i> REINTENTAR`;
        e.target.value = "";
    }
});



// ================================================================

// --- FUNCIONES TÉCNICAS (NO MODIFICAR) ---
function obtenerExif(file) {
    return new Promise((resolve) => {
        EXIF.getData(file, function() {
            resolve(EXIF.getAllTags(this));
        });
    });
}

function parseExifDate(dateStr) {
    const parts = dateStr.split(/[: ]/);
    return new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
}

function convertEXIFtoDecimal(coords, ref) {
    let decimal = coords[0] + coords[1] / 60 + coords[2] / 3600;
    return (ref === "S" || ref === "W") ? decimal * -1 : decimal;
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function procesarImagen(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 1600;
                let w = img.width, h = img.height;
                if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
                else { if (h > MAX) { w *= MAX / h; h = MAX; } }
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}
