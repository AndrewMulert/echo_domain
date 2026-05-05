let audioCtx, leftAnalyzer, rightAnalyzer, source, stream;
let relativePosition = { x: 0, y: 0, z: 0 };
let currentOrientation = { pitch: 0, yaw: 0, roll: 0 };
let isInitialized = false;

export async function initSensors() {
    if (isInitialized) return { stream };

    stream = await navigator.mediaDevices.getUserMedia({
        audio: {
            channelCount: 2,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 44100
        },
        video: { facingMode: "environment" }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaStreamSource(stream);

    const splitter = audioCtx.createChannelSplitter(2);
    leftAnalyzer = audioCtx.createAnalyser();
    rightAnalyzer = audioCtx.createAnalyser();
    leftAnalyzer.fftSize = 4096;
    rightAnalyzer.fftSize = 4096;

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

    const timeBase = Date.now() / 1000;
    const dynamicDelay = 70 + Math.sin(timeBase) * 30;
    const signature = playChirp(audioCtx);

    return new Promise((resolve) => {
        setTimeout(() => {
            const leftFreq = new Float32Array(leftAnalyzer.frequencyBinCount);
            const rightFreq = new Float32Array(rightAnalyzer.frequencyBinCount);
            const leftWave = new Float32Array(leftAnalyzer.fftSize);
            const rightWave = new Float32Array(rightAnalyzer.fftSize);

            leftAnalyzer.getFloatFrequencyData(leftFreq);
            rightAnalyzer.getFloatFrequencyData(rightFreq);
            leftAnalyzer.getFloatTimeDomainData(leftWave);
            rightAnalyzer.getFloatTimeDomainData(rightWave);

            const stereoYawOffset = calculateTimeDifference(leftWave, rightWave);

            const scanData = {
                timestamp: Date.now(),
                orientation: { ...currentOrientation },
                position: { ...relativePosition },
                stereoYawOffset: stereoYawOffset,
                meta: {
                    delay: dynamicDelay,
                    freq: signature.startFreq,
                    volume: signature.volume
                },
                leftSnapshot: leftFreq,
                rightSnapshot: rightFreq
            };

            const video = document.querySelector("#preview");
            if (video && video.videoWidth > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, 128, 128);
                scanData.visualSnapshot = canvas.toDataURL('image/jpeg', 0.5);
            }

            console.log("Captured Audio Length:", scanData.leftSnapshot.length, scanData.rightSnapshot.length);
            resolve({ stream, scanData });
        }, dynamicDelay);
    });
}

function playChirp(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = 14000 + (Math.random() * 2000);
    const endFreq = 18000 + (Math.random() * 2000);
    const duration = 0.03 + (Math.random() * 0.04);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    const outputLevel = 0.2;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(outputLevel, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration + 0.01);

    return { startFreq, endFreq, duration, volume: outputLevel };
}

function calculateTimeDifference(left, right) {
    let maxCorr = -Infinity;
    let bestShift = 0;
    const windowSize = 20;

    for (let shift = -windowSize; shift <= windowSize; shift++) {
        let corr = 0;
        for (let i = windowSize; i < left.length - windowSize; i++) {
            corr += left[i] * right[i + shift];
        }
        if (corr > maxCorr) {
            maxCorr = corr;
            bestShift = shift;
        }
    }

    return (bestShift / windowSize) * 45;
}