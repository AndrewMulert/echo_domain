export const getDeviceProfile = async (modelName) => {
    try {
        const response = await fetch(`/api/device-profile?model=${encodeURIComponent(modelName)}`);
        if (response.ok) {
            const data = await response.json();
            console.log(data.isGeneric ? "Using Global Average Profile" : "Using Model-Specific Profile");
            return data;
        }
    } catch (e) {
        console.warn("Could not fetch remote profile, using defaults.");
    }
    
    return { micLatency: 0.05, sensitivityBoost: 1.0 };
};