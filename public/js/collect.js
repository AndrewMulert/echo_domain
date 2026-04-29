export async function startEcholocation() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        const audioInputs = devices.filter(device => device.kind === 'audioinput');

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 2,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            video: { 
                facingMode: "environment"
            }
        });

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 4096;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyzer);

        const scanData = {
            timestamp: Date.now(),
            orientation: { pitch: 0, yaw: 0, roll: 0 },
            audioSnapshot: new Float32Array(analyzer.frequencyBitCount)
        };

        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            await DeviceOrientationEvent.requestPermission();
        }

        window.addEventListener('deviceorientation', (e) => {
            scanData.orientation = { pitch: e.beta, yaw: e.alpha, roll: e.gamma };
            console.log(`Pitch: ${e.beta}, Yaw: ${e.alpha}, roll: ${e.gamma}`);
        });

        let relativePosition = { x: 0, y: 0, z: 0 };

        window.addEventListener('devicemotion', (e) => {
            const acc = e.acceleration;
            const dt = e.interval / 1000;

            relativePosition.x += acc.x * dt * dt;
            relativePosition.y += acc.y * dt * dt;
            relativePosition.z += acc.z * dt * dt;
        });

        scanData.position = { ...relativePosition };

        playChirp(audioCtx);

        const canvas = document.createElement('canvas');
        const video = document.querySelector("#preview");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        scanData.visualSnapshot = canvas.toDataURL('image/jpeg', 0.5);

        return new Promise((resolve) => {
            setTimeout(() => {
                analyzer.getFloatFrequencyData(scanData.audioSnapshot);
                console.log("Scan Captured", scanData);
                resolve({ stream, scanData });
            }, 200);
        })
    } catch (err) {
        console.error("Permission denied or hardware error:", err);
    }
}

function playChirp(ctx) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(15000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20000, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}