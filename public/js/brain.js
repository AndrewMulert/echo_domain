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
        units: 64,
        inputShape: [2054],
        activation: 'relu'
    }));

    model.add(tf.layers.dense({
        units: 32,
        activation: 'relu'
    }));

    model.add(tf.layers.dense({ units: 1}));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
    });

    return model;
}

export async function predictWithEchoBrain(model, scanData) {
    if (!scanData || !scanData.audioSnapshot) return 0;
    
    return tf.tidy(() => {
        const audioInput = Array.from(scanData.audioSnapshot);
        const motionInput = [
            scanData.orientation.pitch || 0,
            scanData.orientation.yaw || 0,
            scanData.orientation.roll || 0,
            scanData.position.x || 0,
            scanData.position.y || 0,
            scanData.position.z || 0
        ];

        const combinedInput = [...audioInput, ...motionInput];

        const inputTensor = tf.tensor2d([combinedInput]);
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