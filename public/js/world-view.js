import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';

let scene, camera, renderer, pointsGeometry;
let pointsBufferGeometry = new THREE.BufferGeometry();
let pointsMaterial = new THREE.PointsMaterial({ size: 0.05, vertexColors: true });
let cloud = new THREE.Points(pointsBufferGeometry, pointsMaterial);
const positions = [];
const colors = [];

export function initScene(containerElement) {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    containerElement.appendChild(renderer.domElement);

    const grid = new THREE.GridHelper(10, 10);
    scene.add(grid);

    scene.add(cloud);

    camera.position.z = 5;
    animate();
}

export function addPoint(distance, orientation, position, colorRGB) {
    const pitch = orientation.pitch * (Math.PI / 180);
    const yaw = orientation.yaw * (Math.PI / 180);

    const lx = distance * Math.cos(pitch) * Math.sin(yaw);
    const ly = distance * Math.sin(pitch);
    const lz = distance * Math.cos(pitch) * Math.cos(yaw);

    const finalX = lx + position.x;
    const finalY = ly + position.y;
    const finalZ = lz + position.z;

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