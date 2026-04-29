import { startEcholocation } from "./collect.js";
import { createEchoModel, predictWithEchoBrain }  from './brain.js';
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
        runMachineGun();
    }
});

async function runMachineGun() {
    while (isScanning) {
        try {
            const { stream, scanData } = await startEcholocation();

            if (videoElement && !videoElement.srcObject) {
                videoElement.srcObject = stream;
                videoElement.play();
            }

            const distance = await predictWithEchoBrain(echoModel, scanData);

            const r = Math.min(255, (distance / 5) * 255);
            const b = 255 - r;

            addPoint(distance, scanData.orientation, scanData.position, { r: r, g: 100, b: b });

            updateCloud();

            console.log(`Detected object at: ${distance.toFixed(2)} meters`);

            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
            console.error("Machine gun error:", err);
            isScanning = false;
        }
    }
}

async function performSyntheticTraining(model) {
    console.log("Generating synthetic training data...");
    const trainingSet = [];

    for (let i = 0; i < 500; i++) {
        const dist = Math.random() * 5;
        const scan = generateSyntheticScan(dist);

        trainingSet.push({
            input: [...Array.from(scan.audioSnapshot), ...[0,0,0,0,0,0]],
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