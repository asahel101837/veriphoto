let selectedFile;
const input = document.getElementById("cameraInput");
input.addEventListener("change", (event)=>{
selectedFile = event.target.files[0];
document.getElementById("status").innerText =
"Foto capturada";
});

let lat;
let lon;
let precision;
navigator.geolocation.getCurrentPosition((pos)=>{
lat = pos.coords.latitude;
lon = pos.coords.longitude;
precision = pos.coords.accuracy;
});
async function generarHash(file){

const buffer = await file.arrayBuffer();

const hashBuffer =
await crypto.subtle.digest("SHA-256", buffer);

const hashArray =
Array.from(new Uint8Array(hashBuffer));

return hashArray
.map(b => b.toString(16).padStart(2,"0"))
.join("");

}
