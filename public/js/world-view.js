import * as THREE from 'https://esm.sh/three@0.150.1';
import { GLTFExporter } from 'https://esm.sh/three@0.150.1/examples/jsm/exporters/GLTFExporter.js';

let scene, camera, renderer, pointsGeometry;
let pointsBufferGeometry = new THREE.BufferGeometry();
let pointsMaterial = new THREE.PointsMaterial({ size: 0.1, vertexColors: true });
let cloud;
const positions = [];
const colors = [];

export function initScene(containerElement) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x111111, 1);
    containerElement.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(10, 10);
    scene.add(grid);

    pointsBufferGeometry = new THREE.BufferGeometry();
    cloud = new THREE.Points(pointsBufferGeometry, pointsMaterial);
    scene.add(cloud);

    camera.position.set(0, 2, 5);
    camera.lookAt(0, 0, 0);

    animate();
}

export function addPoint(distance, orientation, position, colorRGB) {
    const vector = new THREE.Vector3(0, 0, -Math.max(0.1, distance));

    const yaw = THREE.MathUtils.degToRad(orientation.yaw || 0);
    const pitch = THREE.MathUtils.degToRad(orientation.pitch || 0);
    const roll = THREE.MathUtils.degToRad(orientation.roll || 0);

    const euler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
    vector.applyEuler(euler);

    const finalX = vector.x + (position.x || 0);
    const finalY = vector.y + (position.y || 0);
    const finalZ = vector.z + (position.z || 0);

    positions.push(finalX, finalY, finalZ);
    colors.push(colorRGB.r / 255, colorRGB.g / 255, colorRGB.b / 255);
}

export function updateCloud() {
    if (positions.length === 0) return;

    pointsBufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointsBufferGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    pointsBufferGeometry.attributes.position.needsUpdate = true;
    pointsBufferGeometry.attributes.color.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}