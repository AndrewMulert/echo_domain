import { Router } from 'express';
import EchoCalibration from '../models/EchoCalibration.js';

const router = Router();

router.post('/upload-calibration', async (req, res, next) => {
    try {
        const { model, audio, distance, motionStability } = req.body;

        const newEntry = new EchoCalibration({
            modelName: model,
            audioSnapshot: audio,
            actualDistance: distance,
            motionStability: motionStability
        });

        await newEntry.save();
        res.status(200).json({ message: "Calibration synced to global database."});
    } catch (err) {
        next(err);
    }
});

router.get('/device-profile', async (req, res, next) => {
    try {
        const { model } = req.query;

        const samples = await EchoCalibration.find({ modelName: model, motionStability: 'high' });

        if (samples.length >= 5) {
            const avgSensitivity = samples.reduce((acc, s) => acc + s.sensitivityBoost, 0) / samples.length;
            return res.json({
                micLatency: 0.045,
                sensitivityBoost: avgSensitivity,
                isGeneric: false
            });
        }

        const globalStats = await EchoCalibration.aggregate([
            { $match: { motionStability: 'high' } },
            { $group: {
                _id: null,
                avgLatency: { $avg: "$micLatency" },
                avgBoost: { $avg: "$sensitivityBoost" }
            }}
        ]);

        res.json({
            micLatency: globalStats[0]?.avgLatency || 0.05,
            sensitivityBoost: globalStats[0]?.avgBoost || 1.0,
            isGeneric: true
        });

    } catch (err) {
        next(err);
    }
});


export default router;