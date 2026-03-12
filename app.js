// 1. IMPORTACIONES (Usando la versión 12.10.0 detectada en tu consola)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// 2. CONFIGURACIÓN (Tus credenciales de VeriPhoto)
const firebaseConfig = {
    apiKey: "AIzaSyCDrXohcOJZcsMgqmvXakk4SJnaj7hgzDo",
    authDomain: "veriphoto-2c95d.firebaseapp.com",
    projectId: "veriphoto-2c95d",
    storageBucket: "veriphoto-2c95d.firebasestorage.app",
    messagingSenderId: "1005950289147",
    appId: "1:1005950289147:web:a8fddbf7ab082f99335c5e"
};

// 3. INICIALIZACIÓN
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let selectedFile;
const input = document.getElementById("cameraInput");
const statusTxt = document.getElementById("status");

// Escuchar cuando se toma la foto
input.addEventListener("change", (e) => {
    selectedFile = e.target.files[0];
    statusTxt.innerText = "Foto capturada correctamente";
});

// 4. FUNCIÓN MAESTRA DE COMPRESIÓN (1600x1200 @ 70%)
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
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                // Mantener proporción de aspecto
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Retornar Base64 en JPG al 70% de calidad
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
    });
}

// 5. GENERAR HASH SHA-256
async function generarHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// 6. SUBIR EVIDENCIA A FIRESTORE
window.subirEvidencia = async function() {
    if(!selectedFile) return alert("Por favor, toma una foto primero.");
    
    statusTxt.innerText = "Certificando (Optimizando imagen)...";

    // Pedir GPS justo al momento de subir
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            // Procesar imagen y hash
            const fotoBase64 = await optimizarImagen(selectedFile);
            const hash = await generarHash(selectedFile);
            const folio = "VP-" + Date.now();

            // Guardar en la colección "evidencias" de Firestore
            await addDoc(collection(db, "evidencias"), {
                folio: folio,
                hash: hash,
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                precision: pos.coords.accuracy,
                foto: fotoBase64,
                fecha: serverTimestamp()
            });

            statusTxt.innerText = "¡Éxito! Folio: " + folio;
            alert("Evidencia guardada. Folio: " + folio);
            
        } catch (error) {
            console.error("Error detallado:", error);
            statusTxt.innerText = "Error al subir. Revisa las reglas de Firestore.";
            alert("Hubo un fallo al conectar con Firebase.");
        }
    }, (error) => {
        alert("Error de GPS: Asegúrate de dar permisos de ubicación.");
        statusTxt.innerText = "Error: GPS no disponible.";
    }, { enableHighAccuracy: true });
};
