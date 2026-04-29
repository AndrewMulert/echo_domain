import mongoose from 'mongoose';

const echoCalibrationSchema = new mongoose.Schema({
    modelName : { 
        type: String, 
        required: true 
    },
    audioSnapshot: { 
        type: [Number],
        required: true
    },
    actualDistance: { 
        type: Number, 
        required: true
    },
    motionStability: {
        type: String, 
        enum: ['high', 'low']
    },
    micLatency: { 
        type: Number, 
        default: 0.05 
    },
    sensitivityBoost: {
        type: Number,
        default: 1.0
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
}, { collection: 'echo_calibrations'});

const EchoCalibration = mongoose.model('EchoCalibration', echoCalibrationSchema);
export default EchoCalibration;