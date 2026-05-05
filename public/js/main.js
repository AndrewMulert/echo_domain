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
let currentPitch = -20;
let pitchDirection = 1;
const PITCH_STEP = 3;
const MAX_PITCH = 45;
const SWEEP_AMPLITUDE = 90;

function isValidPoint(distance, scanData) {
    if (distance <= 0.05 || distance > 15) return false;
    if (scanData.meta.leftPeak < 0.01 && scanData.meta.rightPeak < 0.01) return false;
    return true;
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

            const rawDistance = await predictWithEchoBrain(echoModel, scanData);
            const distance = Math.abs(rawDistance);

            if (distance < 0.6) {
                console.log("Initial Close Point (User/Obstacle) detected.");
            } else if (distance > 3.0) {
                console.log("Far Point (Wall/Boundary) detected.");
            }

            const left = scanData.meta?.leftPeak || 0;
            const right = scanData.meta?.rightPeak || 0;

            const stereoDiff = left - right;
            const acousticYawShift = stereoDiff * 45;

            const subtleOscillation = Math.sin(sweepCounter) * 10;
            const finalYaw = (scanData.orientation?.yaw || 0) +
                            (Number.isNaN(acousticYawShift) ? 0 : acousticYawShift) +
                            subtleOscillation;

            const adjustedOrientation = {
                ...scanData.orientation,
                yaw:finalYaw,
                pitch: (scanData.orientation?.pitch || 0) + currentPitch
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

            if (isValidPoint(distance, scanData)) {
                addPoint(distance, adjustedOrientation, scanData.position, pointColor);
                updateCloud();
            }

            console.log(`📡 Ping: ${distance.toFixed(2)}m | Acoustic Shift: ${acousticYawShift.toFixed(1)}° | Yaw: ${adjustedOrientation.yaw.toFixed(1)}° | Delay: ${scanData.meta.delay.toFixed(0)}ms`);

            currentPitch += (PITCH_STEP * pitchDirection);

            if (currentPitch >= MAX_PITCH || currentPitch <= -MAX_PITCH) {
                pitchDirection *= -1;
            }

            sweepCounter += 0.15;
            await new Promise(resolve => setTimeout(resolve, 80));
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

    for (let i = 0; i < 600; i++) {
        const dist = 0.1 + (Math.random() * 11.9);
        const leftScan = generateSyntheticScan(dist, 4096);
        const rightScan = generateSyntheticScan(dist, 4096);

        const simDelay = 40 + Math.random() * 160;
        const simFreq = 16000 + Math.random() * 5000;
        const simVol = 0.3;
        const simStereoOffset = (Math.random() * 2 - 1);

        const simLeftPeak = Math.random();
        const simRightPeak = Math.random();

        trainingSet.push({
            input: [
                ...Array.from(leftScan.audioSnapshot), 
                ...Array.from(rightScan.audioSnapshot), 
                0,0,0,0,0,0,
                simDelay / 200, 
                simFreq / 22000, 
                simVol, 
                simStereoOffset / 60,
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