import { Router } from 'express';
import Home from '../models/Home.js';

const router = Router();
 
// The home page route
router.get('/', async (req, res, next) => {
    try {
        const home = await Home.find().sort({_id: 1 });

        console.log('Fetched Home:', home);
        console.log('Number of Home:', home.length);
        
        res.render('index', { 
            title: 'Echo Domain', 
            description: 'Build realistic 3D Models of an environment using an AI Algorithm with the data gathered by your microphone, speakers, camera, and gyroscope on device.',
            content: 'echo location, echo, location, visual, virtual, world building, virtual world, cameras, view, 3D model, echolocation, microphone, speaker, high frequency',
            scripts: [
                '<script src="/js/main.js" type="module"></script>',
                '<script src="/js/map.js" type="module"></script>'
            ]
        });
    } catch (err) {
        console.error('Error fetching home data:', err);
        next(err);
    }
});

export default router;