let audioCtx, leftAnalyzer, rightAnalyzer, source, stream;
let relativePosition = { x: 0, y: 0, z: 0 };
let currentOrientation = { pitch: 0, yaw: 0, roll: 0 };
let isInitialized = false;

/**
 * @param {string} base64Data
 * @returns {Promise<{r:number, g:number, b:number}>}
 */

export async function initSensors() {
    if (isInitialized) return { stream };

    stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: 2,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            googEchoCancellation: false,
            googAutoGainControl: false,
            googNoiseSuppression: false,
            sampleRate: 44100
        },
        video: { facingMode: "environment" }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaStreamSource(stream);

    const splitter = audioCtx.createChannelSplitter(2);
    leftAnalyzer = audioCtx.createAnalyser();
    rightAnalyzer = audioCtx.createAnalyser();
    leftAnalyzer.fftSize = 8192;
    rightAnalyzer.fftSize = 8192;

    source.connect(splitter);
    splitter.connect(leftAnalyzer, 0);
    splitter.connect(rightAnalyzer, 1);

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') return;
    }

    const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';

    window.addEventListener(eventName, (e) => {
        currentOrientation = { 
            pitch: e.beta || 0, 
            yaw: e.alpha || 0, 
            roll: e.gamma || 0
        };
    });

    window.addEventListener('devicemotion', (e) => {
        const acc = e.acceleration;
        const dt = e.interval / 1000;
        if (acc.x) {
            relativePosition.x += acc.x * dt * dt;
            relativePosition.y += acc.y * dt * dt;
            relativePosition.z += acc.z * dt * dt;
        }
    });

    isInitialized = true;
    return { stream };
}

export async function startEcholocation() {
    if (!isInitialized) await initSensors();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const startTime = audioCtx.currentTime;
    const dynamicDelay = 100 + Math.sin(audioCtx.currentTime) * 50;
    const signature = playChirp(audioCtx);

    return new Promise((resolve) => {
        const playDuration = signature.duration;
        setTimeout(() => {
            const now = audioCtx.currentTime;
            const actualHardwareDelay = (now - startTime) * 1000;
            const leftFreq = new Float32Array(leftAnalyzer.frequencyBinCount);
            const rightFreq = new Float32Array(rightAnalyzer.frequencyBinCount);
            const leftWave = new Float32Array(leftAnalyzer.fftSize);
            const rightWave = new Float32Array(rightAnalyzer.fftSize);

            leftAnalyzer.getFloatFrequencyData(leftFreq);
            rightAnalyzer.getFloatFrequencyData(rightFreq);
            leftAnalyzer.getFloatTimeDomainData(leftWave);
            rightAnalyzer.getFloatTimeDomainData(rightWave);

            let leftPeak = 0;
            let rightPeak = 0;
            for (let i = 0; i < leftWave.length; i++) {
                const lVal = Math.abs(leftWave[i]);
                const rVal = Math.abs(rightWave[i]);
                if (lVal > leftPeak) leftPeak = lVal;
                if (rVal > rightPeak) rightPeak = rVal;
            }

            const stereoYawOffset = calculateEnhancedTimeDifference(leftWave, rightWave);

            const scanData = {
                timestamp: Date.now(),
                orientation: { ...currentOrientation },
                position: { ...relativePosition },
                stereoYawOffset: stereoYawOffset,
                meta: {
                    delay: actualHardwareDelay,
                    freq: signature.startFreq,
                    volume: signature.volume,
                    leftPeak: leftPeak,
                    rightPeak: rightPeak
                },
                leftSnapshot: leftFreq,
                rightSnapshot: rightFreq
            };

            const video = document.querySelector("#preview");
            if (video && video.videoWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, 256, 256);
                scanData.visualSnapshot = canvas.toDataURL('image/jpeg', 0.6);
            }

            console.log("Captured Audio Length:", scanData.leftSnapshot.length, scanData.rightSnapshot.length);
            resolve({ stream, scanData });
        }, dynamicDelay);
    });
}

function playChirp(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = 16000 + (Math.random() * 2000);
    const endFreq = 20000 + (Math.random() * 2000);
    const duration = 0.05 + (Math.random() * 0.04);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    const outputLevel = 0.3;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(outputLevel, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration + 0.01);

    return { startFreq, endFreq, duration, volume: outputLevel };
}

function calculateEnhancedTimeDifference(left, right) {
    let maxCorr = -Infinity;
    let bestShift = 0;
    const windowSize = 40;

    const leftRMS = Math.sqrt(left.reduce((acc, v) => acc + v*v, 0) / left.length);
    const rightRMS = Math.sqrt(right.reduce((acc, v) => acc + v*v, 0) / right.length);

    const lNorm = leftRMS || 0.000001;
    const rNorm = rightRMS || 0.000001;

    if (leftRMS < 0.001 || rightRMS < 0.001) return 0;

    for (let shift = -windowSize; shift <= windowSize; shift++) {
        let corr = 0;
        for (let i = windowSize; i < left.length - windowSize; i++) {
            corr += (left[i] / (lNorm || 1)) * (right[i + shift] / (rNorm || 1));
        }
        if (corr > maxCorr) {
            maxCorr = corr;
            bestShift = shift;
        }
    }

    return (bestShift / windowSize) * 180;
}

export async function extractColorFromSnapshot(base64Data) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scratchCanvas = document.createElement('canvas');
            scratchCanvas.width = 1;
            scratchCanvas.height = 1;
            const sCtx = scratchCanvas.getContext('2d');

            sCtx.drawImage(img, 128, 128, 1, 1, 0, 0, 1, 1);
            const p = sCtx.getImageData(0, 0, 1, 1).data;

            resolve({ r: p[0], g: p[1], b: p[2] });
        };
        img.onerror = () => resolve({ r: 120, g: 120, b: 120 });
        img.src = base64Data;
    })
}