// 1. LAS IMPORTACIONES (Esto va hasta arriba)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

// 2. TUS CREDENCIALES
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
const storage = getStorage(app);

// 4. TU LÓGICA DE LA CÁMARA Y GPS (Lo que ya tenías)
let selectedFile;
const input = document.getElementById("cameraInput");
input.addEventListener("change", (event) => {
    selectedFile = event.target.files[0];
    document.getElementById("status").innerText = "Foto capturada";
});

let lat, lon, precision;
navigator.geolocation.getCurrentPosition((pos) => {
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    precision = pos.coords.accuracy;
});

async function generarHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// 5. FUNCIÓN PARA SUBIR TODO A FIREBASE
window.subirEvidencia = async function() {
    if(!selectedFile) return alert("Primero captura una foto");
    
    document.getElementById("status").innerText = "Obteniendo ubicación y subiendo...";

    // Forzamos la petición de GPS justo antes de subir
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const precision = pos.coords.accuracy;

        try {
            const hash = await generarHash(selectedFile);
            const folio = "VP-" + Date.now();
            
            // 1. Subir imagen a Storage
            const storageRef = ref(storage, 'fotos/' + folio);
            const snapshot = await uploadBytes(storageRef, selectedFile);
            const url = await getDownloadURL(snapshot.ref);

            // 2. Guardar datos en Firestore
            await addDoc(collection(db, "evidencias"), {
                folio: folio,
                hash: hash,
                lat: lat,
                lon: lon,
                precision: precision,
                url: url,
                fecha: serverTimestamp()
            });

            document.getElementById("status").innerText = "¡Éxito! Folio: " + folio;
            alert("Evidencia guardada con éxito. Folio: " + folio);
            
        } catch (error) {
            console.error(error);
            document.getElementById("status").innerText = "Error al subir. Revisa tu conexión.";
        }
    }, (error) => {
        alert("Por favor activa el GPS para poder certificar la foto.");
        document.getElementById("status").innerText = "Error: GPS necesario.";
    });
};
