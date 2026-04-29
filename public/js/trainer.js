export async function uploadCalibrationData(scanData, actualDistance) {
    const motionNoise = Math.abs(scanData.position.x) + Math.abs(scanData.position.y);

    const deviceData = {
        model: navigator.userAgent,
        audio: Array.from(scanData.audioSnapshot),
        distance: actualDistance,
        motionStability: motionNoise < 0.01 ? "high" : "low",
        timestamp: Date.now()
    };

    await fetch('/api/upload-calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceData)
    });
}