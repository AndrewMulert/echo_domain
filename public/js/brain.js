import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js';

const tf = window.tf;

async function initTF() {
    await tf.ready();
    if (tf.engine().backendName !== 'webgpu') {
        await tf.setBackend('webgl');
    }
    console.log("TensorFlow.js initialized on:", tf.getBackend());
}
initTF();

export function createEchoModel() {
    const model = tf.sequential();

    model.add(tf.layers.dense({
        units: 128,
        inputShape: [4108],
        activation: 'relu'
    }));

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu'
    }));

    model.add(tf.layers.dense({ units: 1 }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
    });

    return model;
}

export async function predictWithEchoBrain(model, scanData) {
    if (!scanData || !scanData.leftSnapshot || !scanData.rightSnapshot) return 0;
    
    return tf.tidy(() => {
        const normalize = (val) => Math.max(0, Math.min(1, (val + 100) / 70));

        const findPeak = (arr) => {
            let max = -Infinity;
            let index = 0;
            for(let i=0; i<arr.length; i++) {
                if(arr[i] > max) { max = arr[i]; index = i; }
            }
            return index / arr.length;
        }

        const leftAudio = Array.from(scanData.leftSnapshot).map(normalize);
        const rightAudio = Array.from(scanData.rightSnapshot).map(normalize)

        const motionInput = [
            scanData.orientation.pitch || 0,
            scanData.orientation.yaw || 0,
            scanData.orientation.roll || 0,
            scanData.position.x || 0,
            scanData.position.y || 0,
            scanData.position.z || 0
        ];

        const metaInput = [
            scanData.meta.delay / 100,
            scanData.meta.freq / 20000,
            scanData.meta.volume || 0,
            (scanData.stereoYawOffset || 0) / 45,
            findPeak(scanData.leftSnapshot),
            findPeak(scanData.rightSnapshot)
        ];

        const combinedInput = [...leftAudio, ...rightAudio, ...motionInput, ...metaInput];

        if (combinedInput.length !== 4108) {
            console.error(`Input shape error! Expected 4108, got ${combinedInput.length}. L:${leftAudio.length} R:${rightAudio.length}`);
            return 0;
        }

        const inputTensor = tf.tensor2d([combinedInput], [1, 4108]);
        const prediction = model.predict(inputTensor);

        return prediction.dataSync()[0];
    });
}

export async function trainEchoBrain(model, trainingData, onProgress) {
    const inputs = tf.tensor2d(trainingData.map(d => d.input));
    const outputs = tf.tensor2d(trainingData.map(d => d.output));

    await model.fit(inputs, outputs, {
        epochs: 50,
        batchSize: 32,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                if (onProgress) onProgress(epoch, logs.loss);
            }
        }
    });

    inputs.dispose();
    outputs.dispose();
}