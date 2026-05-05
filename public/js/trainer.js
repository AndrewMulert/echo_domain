export async function uploadCalibrationData(scanData, actualDistance) {
    const motionNoise = Math.abs(scanData.position.x) + Math.abs(scanData.position.y);

    const leftAudio = Array.from(scanData.leftSnapshot);
    const rightAudio = Array.from(scanData.rightSnapshot);

    const deviceData = {
        model: navigator.userAgent,
        audioLeft: leftAudio,
        audioRight: rightAudio,
        orientation: { ...scanData.orientation },
        position: { ...scanData.position },
        distance: actualDistance,
        motionStability: motionNoise < 0.01 ? "high" : "low",
        timestamp: Date.now()
    };

    const normalize = (val) => Math.max(0, Math.min(1, (val + 100) / 70));
    const normalizedInput = [
        ...leftAudio.map(normalize),
        ...rightAudio.map(normalize),
        scanData.orientation.pitch || 0,
        scanData.orientation.yaw || 0,
        scanData.orientation.roll || 0,
        scanData.position.x || 0,
        scanData.position.y || 0,
        scanData.position.z || 0,
        (scanData.meta.delay || 0) / 100,
        (scanData.meta.freq || 0) / 20000,
        scanData.meta.volume || 0,
        (scanData.stereoYawOffset || 0) / 45
    ];

    await fetch('/api/upload-calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...deviceData, 
            rawTrainingInput: normalizedInput
        })
    });
}