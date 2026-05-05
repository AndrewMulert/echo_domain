import { startEcholocation, extractColorFromSnapshot } from "./collect.js";
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

let sweepCounter = 0;
let currentPitch = -15;
let pitchDirection = 1;
const PITCH_STEP = 2;
const MAX_PITCH = 25;
const SWEEP_AMPLITUDE = 60;

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

            const rawDistance = await predictWithEchoBrain(echoModel, scanData);
            const distance = Math.max(0.1, Math.abs(rawDistance));

            sweepCounter += 0.15;
            const virtualSweep = Math.sin(sweepCounter) * SWEEP_AMPLITUDE;

            if (Math.abs(virtualSweep) > (SWEEP_AMPLITUDE - 1)) {
                currentPitch += (PITCH_STEP * pitchDirection);
                if (currentPitch >= MAX_PITCH || currentPitch <= -MAX_PITCH) {
                    pitchDirection *= -1;
                }
            }

            const adjustedOrientation = {
                ...scanData.orientation,
                yaw: scanData.orientation.yaw + (scanData.stereoYawOffset || 0) + virtualSweep,
                pitch: scanData.orientation.pitch + currentPitch
            };

            const hue = (distance / 5) * 240;
            const r = Math.floor(Math.sin(distance) * 127 + 128);
            const g = 100;
            const b = Math.floor(Math.cos(distance) * 127 + 128);

            let pointColor = { r: 150, g: 150, b: 150 };
            if (scanData.visualSnapshot) {
                pointColor = await extractColorFromSnapshot(scanData.visualSnapshot);
            }

             const logMsg = `📡 Ping: ${distance.toFixed(2)}m | ` +
                           `Pos: [${scanData.position.x.toFixed(2)}, ${scanData.position.y.toFixed(2)}, ${scanData.position.z.toFixed(2)}] | ` +
                           `Yaw: ${(scanData.orientation.yaw + scanData.stereoYawOffset).toFixed(1)}° | ` +
                           `Delay: ${scanData.meta.delay.toFixed(0)}ms` +
                           `Color: rgb(${pointColor.r},${pointColor.g},${pointColor.b})`;
            
            console.log(logMsg);

            addPoint(distance, adjustedOrientation, scanData.position, pointColor);
            updateCloud();

            console.log(`📡 Ping: ${distance.toFixed(2)}m | Sweep: ${virtualSweep.toFixed(1)}° | Yaw: ${adjustedOrientation.yaw.toFixed(1)}° | Delay: ${scanData.meta.delay.toFixed(0)}ms`);

            await new Promise(resolve => setTimeout(resolve, 40));
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
        const dist = 0.5 + (Math.random() * 4.5);
        const leftScan = generateSyntheticScan(dist);
        const rightScan = generateSyntheticScan(dist);

        const simDelay = 40 + Math.random() * 60;
        const simFreq = 14000 + Math.random() * 6000;
        const simVol = 0.2;
        const simStereoOffset = (Math.random() * 2 - 1);

        const simLeftPeak = Math.random();
        const simRightPeak = Math.random();

        trainingSet.push({
            input: [
                ...Array.from(leftScan.audioSnapshot), 
                ...Array.from(rightScan.audioSnapshot), 
                ...[0,0,0,0,0,0],
                ...[simDelay / 100, simFreq / 20000, simVol, simStereoOffset],
                simLeftPeak,
                simRightPeak
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