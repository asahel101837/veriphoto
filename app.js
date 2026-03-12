import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// 1. CONFIGURACIÓN DE FIREBASE
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

let selectedFile;
let coordsActuales = null;
let mostrandoExito = false; // Llave para que el GPS no borre el folio
const statusTxt = document.getElementById("status");

// --- 2. BLOQUEO DE ESCRITORIO ---
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
if (!isMobile) {
    document.body.innerHTML = "<h1>🚫 ACCESO DENEGADO</h1><p>VeriPhoto solo funciona en dispositivos móviles.</p>";
    throw new Error("PWA bloqueada en PC");
}

// --- 3. GPS EN TIEMPO REAL (CORREGIDO) ---
window.activarGPS = function() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                coordsActuales = pos.coords;
                // Solo actualizamos el texto si NO acabamos de subir una foto con éxito
                if (!mostrandoExito) {
                    statusTxt.innerText = `GPS Conectado (Precisión: ${Math.round(pos.coords.accuracy)}m) ✅`;
                    statusTxt.style.color = "green";
                }
            },
            (err) => {
                if (!mostrandoExito) {
                    statusTxt.innerText = "⚠️ Error: Activa la ubicación en tu celular.";
                    statusTxt.style.color = "red";
                }
            },
            { enableHighAccuracy: true }
        );
    }
}
activarGPS();

// --- 4. VALIDACIÓN DE CÁMARA ---
document.getElementById("cameraInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ahora = Date.now();
    const tiempoArchivo = file.lastModified;
    const desfase = (ahora - tiempoArchivo) / 1000;

    if (desfase > 120) {
        alert("❌ ERROR: La foto no es reciente. Captúrala en vivo.");
        e.target.value = "";
        selectedFile = null;
        document.getElementById("btnSubir").style.display = "none";
    } else {
        selectedFile = file;
        mostrandoExito = false; // Resetear la llave si se toma una nueva foto
        statusTxt.innerText = "Foto capturada y validada 📸";
        statusTxt.style.color = "#007bff";
        document.getElementById("btnSubir").style.display = "block";
    }
});

// --- 5. COMPRESIÓN DE IMAGEN ---
async function optimizarImagen(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1600;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- 6. SUBIDA FINAL CON BLOQUEO DE GPS ---
window.subirEvidencia = async function() {
    if(!selectedFile) return alert("Primero captura una foto.");
    if(!coordsActuales) return alert("Esperando señal de GPS...");

    statusTxt.innerText = "⏳ Certificando evidencia...";
    statusTxt.style.color = "orange";
    document.getElementById("btnSubir").style.display = "none";

    try {
        const fotoBase64 = await optimizarImagen(selectedFile);
        
        // Generar Hash SHA-256
        const buffer = await selectedFile.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
        
        const folio = "VP-" + Date.now();

        // Subida a Firestore
        await addDoc(collection(db, "evidencias"), {
            folio: folio,
            hash: hash,
            lat: coordsActuales.latitude,
            lon: coordsActuales.longitude,
            precision: coordsActuales.accuracy,
            foto: fotoBase64,
            fecha_celular: new Date().toISOString(),
            fecha_servidor: serverTimestamp(),
            verificado: true
        });

        // ACTIVAR BLOQUEO DE TEXTO PARA MOSTRAR FOLIO
        mostrandoExito = true;

        statusTxt.innerHTML = `
            <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 10px; border: 1px solid #c3e6cb; margin-top: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <strong style="font-size: 1.2rem;">✅ ¡Subida Exitosa!</strong><br>
                <span style="font-size: 0.9rem;">Folio único de certificación:</span><br>
                <code style="font-size: 1.1rem; background: white; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 8px; border: 1px solid #ddd; color: #333;">${folio}</code>
                <p style="font-size: 0.8rem; margin-top: 10px; color: #666;">Copia este folio para tu reporte.</p>
            </div>
        `;
        
        alert("✅ Evidencia certificada.\n\nFolio: " + folio);

        // Resetear variables internas pero dejar el mensaje en pantalla
        selectedFile = null;
        document.getElementById("cameraInput").value = "";

    } catch (error) {
        console.error(error);
        mostrandoExito = false;
        statusTxt.innerText = "❌ Error al subir. Revisa tu internet.";
        statusTxt.style.color = "red";
        document.getElementById("btnSubir").style.display = "block";
        alert("Error al conectar con VeriPhoto Cloud.");
    }
};
