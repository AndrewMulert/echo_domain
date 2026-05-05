import { startEcholocation } from "./collect.js";
import { createEchoModel, predictWithEchoBrain, trainEchoBrain }  from './brain.js';
import { addPoint, initScene, updateCloud } from './world-view.js';
import { generateSyntheticScan } from './simulator.js';
import { uploadCalibrationData } from './trainer.js';

const yearSpan = document.querySelector("#year");
const startBtn = document.querySelector("#start-scan-btn");
const videoElement = document.querySelector("#preview");

if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
};

let isScanning = false;
let echoModel = createEchoModel();

startBtn.addEventListener('click', async () => {
    isScanning = !isScanning;
    startBtn.textContent = isScanning ? "Stop Scanning" : "Start Scan";

    if (isScanning) {
        console.log("Starting Echo Session...");
        runMachineGun();
    } else {
        stopHardware();
    }
});

function stopHardware() {
    if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    console.log("Hardware released.");
}

async function runMachineGun() {
    while (isScanning) {
        try {
            const result = await startEcholocation();

            if (!result) {
                console.warn("No data returned from sensors. Stopping scan.");
                isScanning = false;
                break;
            }

            const { stream, scanData } = result;

            if (videoElement && !videoElement.srcObject) {
                videoElement.srcObject = stream;
                await videoElement.play()
            }

            const distance = await predictWithEchoBrain(echoModel, scanData);

            const adjustedOrientation = {
                ...scanData.orientation,
                yaw: scanData.orientation.yaw + (scanData.stereoYawOffset || 0)
            };

            console.groupCollapsed(`📡 Ping: ${distance.toFixed(2)}m`);
            console.log("Predicted Distance:", distance);
            console.log("Sensor Raw Position:", {
                x: scanData.position.x.toFixed(4),
                y: scanData.position.y.toFixed(4),
                z: scanData.position.z.toFixed(4)
            });
            console.log("Sensor Orientation (Yaw/Pitch):", 
                scanData.orientation.yaw.toFixed(2), 
                scanData.orientation.pitch.toFixed(2)
            );
            console.groupEnd();

            const r = Math.min(255, (distance / 5) * 255);
            const b = 255 - r;
            addPoint(distance, adjustedOrientation, scanData.orientation, scanData.position, { r, g: 100, b });
            updateCloud();

            console.log(`Detected object at: ${distance.toFixed(2)} meters`);

            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
            console.error("Ping error:", err);
            toggleScanning(false);
            break;
        }
    }
}

function toggleScanning(state) {
    isScanning = state;
    startBtn.textContent = isScanning ? "Stop Scanning" : "Start Scan";
    if (!state) stopHardware();
}

async function performSyntheticTraining(model) {
    console.log("Generating synthetic training data...");
    const trainingSet = [];

    for (let i = 0; i < 500; i++) {
        const dist = Math.random() * 5;
        const leftScan = generateSyntheticScan(dist);
        const rightScan = generateSyntheticScan(dist);

        const simDelay = 40 + Math.random() * 60;
        const simFreq = 14000 + Math.random() * 6000;
        const simVol = 0.2;
        const simStereoOffset = 0;

        trainingSet.push({
            input: [
                ...Array.from(leftScan.audioSnapshot), 
                ...Array.from(rightScan.audioSnapshot), 
                ...[0,0,0,0,0,0],
                ...[simDelay / 100, simFreq / 20000, simVol, simStereoOffset]
            ],
            output: [dist]
        });
    }

    await trainEchoBrain(model, trainingSet, (epoch, loss) => {
        if (epoch % 10 === 0) console.log(`Sim Training - Epoch ${epoch}: Loss ${loss}`);   
    });
    console.log("Base physics training complete.");
}

async function startApp() {
    console.log("Echo Domain App Ready");
    const container = document.querySelector("#viewport-container");
    if (container) {
        initScene(container);
    }

    await performSyntheticTraining(echoModel);
    console.log("Echo Domain App Ready & Pre-trained");
}

window.addEventListener('load', startApp);