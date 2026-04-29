export function generateSyntheticScan(targetDistance) {
    const fftSize = 2048;
    const audioSnapshot = new Float32Array(fftSize).fill(-100);

    const speedOfSound = 343;
    const roundTripTime = (targetDistance * 2) / speedOfSound;
    const targetBin = Math.floor(roundTripTime * 44100 / (4096 / fftSize));

    if (targetBin < fftSize) {
        audioSnapshot[targetBin] = -30;
    }

    for (let i = 0; i < fftSize; i++) {
        audioSnapshot[i] += (Math.random() * 10);
    }

    return {
        audioSnapshot,
        orientation: { pitch: Math.random() * 360, yaw: Math.random() * 360, roll: 0},
        position: { x: 0, y: 0, z: 0 }
    }
}