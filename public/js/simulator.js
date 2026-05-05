/**
 * @param {number} targetDistance - The distance to simulate in meters.
 * @param {number} numBins - The number of frequency bins (4096 for 8192 FFT).
 */

export function generateSyntheticScan(targetDistance, numBins = 4096) {
    const audioSnapshot = new Float32Array(numBins).fill(-100);

    const speedOfSound = 343;
    const roundTripTime = (targetDistance * 2) / speedOfSound;
    const targetBin = Math.floor(roundTripTime * 44100 / (8192 / numBins));

    if (targetBin < numBins) {
        audioSnapshot[targetBin] = -30;
    }

    for (let i = 0; i < numBins; i++) {
        audioSnapshot[i] += (Math.random() * 10);
    }

    return {
        audioSnapshot,
        orientation: { pitch: Math.random() * 360, yaw: Math.random() * 360, roll: 0},
        position: { x: 0, y: 0, z: 0 }
    }
}