
import * as THREE from 'three';

export class Ball {
    constructor(data, scene) {
        const geometry = new THREE.IcosahedronGeometry(3, 1);
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        scene.add(this.mesh);
        
        this.update(data);
    }

    update(data) {
        // Interpolação suave para a bola também
        const dx = data.x - this.mesh.position.x;
        const dy = data.y - this.mesh.position.y;
        const dz = data.z - this.mesh.position.z;

        this.mesh.position.x += dx * 0.3;
        this.mesh.position.y += dy * 0.3;
        this.mesh.position.z += dz * 0.3;

        if (data.isMoving) {
            this.mesh.rotation.x += 0.2;
            this.mesh.rotation.z += 0.2;
        }
    }
}
