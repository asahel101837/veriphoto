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

let selectedFile;
let coordsActuales = null;
const statusTxt = document.getElementById("status");

// Función GPS vinculada a Window para que el HTML la vea
window.activarGPS = function() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            coordsActuales = pos.coords;
            statusTxt.innerText = "GPS Conectado ✅";
            statusTxt.style.color = "green";
        }, (err) => {
            statusTxt.innerText = "⚠️ Error: Activa la ubicación";
            statusTxt.style.color = "red";
        }, { enableHighAccuracy: true });
    }
}
activarGPS();

// Manejo de la cámara
document.getElementById("cameraInput").addEventListener("change", (e) => {
    if (e.target.files[0]) {
        selectedFile = e.target.files[0];
        statusTxt.innerText = "Foto capturada 📸";
        // MOSTRAR BOTÓN VERDE
        document.getElementById("btnSubir").style.display = "block";
    }
});

// Función Subida vinculada a Window
window.subirEvidencia = async function() {
    if(!selectedFile || !coordsActuales) return alert("Faltan datos o GPS");

    statusTxt.innerText = "Subiendo...";

    try {
        const folio = "VP-" + Date.now();
        await addDoc(collection(db, "evidencias"), {
            folio: folio,
            lat: coordsActuales.latitude,
            lon: coordsActuales.longitude,
            fecha_servidor: serverTimestamp(),
            // Guardamos el nombre del archivo como prueba inicial
            archivo: selectedFile.name 
        });
        alert("¡Éxito! Folio generado: " + folio);
        statusTxt.innerText = "Certificado enviado ✅";
    } catch (e) {
        console.error(e);
        alert("Error al conectar con Firebase");
    }
};
