
import * as THREE from 'three';

export class Player {
    constructor(data, scene, materials) {
        this.id = data.id;
        this.team = data.team;
        this.role = data.role;
        this.mesh = new THREE.Group();
        
        this.initMesh(materials);
        
        this.nameLabel = this.createLabel(data.name || "", "#ffffff", 40, 8); 
        this.numberLabel = this.createLabel(data.number ? data.number.toString() : "", "#ffff55", 30, 8);
        this.bubble = this.createBubble();

        this.mesh.add(this.nameLabel);
        this.mesh.add(this.numberLabel);
        this.mesh.add(this.bubble);
        
        this.nameLabel.position.y = 21;
        this.numberLabel.position.y = 18;
        this.bubble.position.y = 45; // Aumentado de 35 para 45 para não cobrir o jogador 

        scene.add(this.mesh);
        this.update(data);
    }

    initMesh(mats) {
        let matShirt, matShorts;
        if (this.team === 'A') {
            matShirt = this.role === 'GK' ? mats.braGK : mats.braShirt;
            matShorts = mats.braShorts;
        } else {
            matShirt = this.role === 'GK' ? mats.argGK : mats.argShirt;
            matShorts = mats.argShorts;
        }

        // Torso
        const torsoGeo = new THREE.BoxGeometry(6, 6, 4);
        this.torso = new THREE.Mesh(torsoGeo, matShirt);
        this.torso.position.y = 10;
        this.torso.castShadow = true;
        this.mesh.add(this.torso);

        // Cabeça
        const headGeo = new THREE.BoxGeometry(4, 4, 4);
        this.head = new THREE.Mesh(headGeo, mats.skin);
        this.head.position.y = 15;
        this.head.castShadow = true;
        
        const faceGeo = new THREE.BoxGeometry(3, 1, 0.5);
        const face = new THREE.Mesh(faceGeo, mats.eye);
        face.position.set(0, 0.5, 2); 
        this.head.add(face);
        this.mesh.add(this.head);

        // Braços
        const armGeo = new THREE.BoxGeometry(2, 5, 2);
        armGeo.translate(0, -2.5, 0); 
        
        this.armL = new THREE.Mesh(armGeo, mats.skin);
        this.armL.position.set(-4, 13, 0);
        this.armL.castShadow = true;
        this.mesh.add(this.armL);
        
        this.armR = new THREE.Mesh(armGeo, mats.skin);
        this.armR.position.set(4, 13, 0);
        this.armR.castShadow = true;
        this.mesh.add(this.armR);

        // Pernas (com calções)
        const legGeo = new THREE.BoxGeometry(2.5, 7, 2.5);
        legGeo.translate(0, -3.5, 0); 
        
        const shortsGeo = new THREE.BoxGeometry(2.6, 3.5, 2.6);
        shortsGeo.translate(0, -1.75, 0); 
        
        this.legGroupL = new THREE.Group();
        this.legGroupL.position.set(-1.5, 7, 0);
        const lowerLegL = new THREE.Mesh(legGeo, mats.skin);
        lowerLegL.castShadow = true;
        const shortsL = new THREE.Mesh(shortsGeo, matShorts);
        this.legGroupL.add(lowerLegL, shortsL);
        this.mesh.add(this.legGroupL);

        this.legGroupR = new THREE.Group();
        this.legGroupR.position.set(1.5, 7, 0);
        const lowerLegR = new THREE.Mesh(legGeo, mats.skin);
        lowerLegR.castShadow = true;
        const shortsR = new THREE.Mesh(shortsGeo, matShorts);
        this.legGroupR.add(lowerLegR, shortsR);
        this.mesh.add(this.legGroupR);

        this.walkCycle = 0;
    }

    createLabel(text, color, baseFontSize, scaleFactor) {
        const spriteMat = new THREE.SpriteMaterial({ transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.userData = { color, baseFontSize, scaleFactor };
        this.updateLabel(sprite, text);
        return sprite;
    }

    updateLabel(sprite, text) {
        const { color, baseFontSize, scaleFactor } = sprite.userData;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        ctx.font = `bold ${baseFontSize}px Inter, Arial`;
        const metrics = ctx.measureText(text);
        const textWidth = Math.max(metrics.width, 10); // Evitar width 0
        const padding = 20;

        canvas.width = textWidth + padding * 2;
        canvas.height = baseFontSize + padding * 2;

        ctx.font = `bold ${baseFontSize}px Inter, Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const oldMap = sprite.material.map;
        sprite.material.map = new THREE.CanvasTexture(canvas);
        if (oldMap) oldMap.dispose();

        sprite.scale.set(canvas.width / scaleFactor, canvas.height / scaleFactor, 1);
    }

    createBubble() {
        const spriteMat = new THREE.SpriteMaterial({ transparent: true });
        const bubbleSprite = new THREE.Sprite(spriteMat);
        bubbleSprite.visible = false;
        return bubbleSprite;
    }

    updateBubble(text) {
        if (!text) {
            this.bubble.visible = false;
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 90; // Diminuído levemente de 110 para 90
        const maxWidth = 850; 
        const lineHeight = fontSize * 1.2;
        const padding = 70;

        ctx.font = `bold ${fontSize}px Inter, Arial`;

        // Função para quebrar o texto
        const getLines = (ctx, text, maxWidth) => {
            const words = text.split(' ');
            const lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        const lines = getLines(ctx, text, maxWidth);
        
        // Calcular dimensões finais
        let maxLineWidth = 0;
        lines.forEach(line => {
            const width = ctx.measureText(line).width;
            if (width > maxLineWidth) maxLineWidth = width;
        });

        const bubbleWidth = maxLineWidth + padding * 2;
        const bubbleHeight = (lines.length * lineHeight) + padding;

        canvas.width = bubbleWidth;
        canvas.height = bubbleHeight + 60; // Extra para a ponta

        // Desenhar balão (corpo)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.roundRect(0, 0, bubbleWidth, bubbleHeight, 50);
        ctx.fill();

        // Ponta do balão
        ctx.beginPath();
        ctx.moveTo(bubbleWidth / 2 - 40, bubbleHeight);
        ctx.lineTo(bubbleWidth / 2, bubbleHeight + 50);
        ctx.lineTo(bubbleWidth / 2 + 40, bubbleHeight);
        ctx.fill();

        // Texto Multilinha
        ctx.fillStyle = 'black';
        ctx.font = `bold ${fontSize}px Inter, Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        lines.forEach((line, index) => {
            ctx.fillText(line, bubbleWidth / 2, (padding / 2) + (index * lineHeight));
        });

        const oldMap = this.bubble.material.map;
        this.bubble.material.map = new THREE.CanvasTexture(canvas);
        if (oldMap) oldMap.dispose();
        
        // Ajustado o divisor para 20 para deixar o balão um pouco menor após diminuir a fonte
        this.bubble.scale.set(canvas.width / 20, canvas.height / 20, 1); 
        this.bubble.visible = true; 
    }

    update(data) {
        const targetX = data.x;
        const targetZ = data.z;
        
        const dx = targetX - this.mesh.position.x;
        const dz = targetZ - this.mesh.position.z;

        if (Math.abs(dx) > 0.5 || Math.abs(dz) > 0.5) {
            this.walkCycle += 0.4;
            const swing = Math.sin(this.walkCycle) * 0.6;
            this.legGroupL.rotation.x = swing;
            this.legGroupR.rotation.x = -swing;
            this.armL.rotation.x = -swing;
            this.armR.rotation.x = swing;
            
            // Rotação baseada na direção que o servidor informou (8 direções)
            if (data.facingX !== undefined && data.facingZ !== undefined) {
                // THREE.js usa o eixo Y como vertical, então rotacionamos em torno dele
                this.mesh.rotation.y = Math.atan2(data.facingX, data.facingZ);
            }
        } else {
            this.walkCycle = 0;
            this.legGroupL.rotation.x = 0;
            this.legGroupR.rotation.x = 0;
            this.armL.rotation.x = 0;
            this.armR.rotation.x = 0;
        }

        this.mesh.position.x += dx * 0.2;
        this.mesh.position.z += dz * 0.2;

        if (data.name !== this._lastName) {
            this.updateLabel(this.nameLabel, data.name);
            this._lastName = data.name;
        }
        if (data.number !== this._lastNumber) {
            this.updateLabel(this.numberLabel, data.number.toString());
            this._lastNumber = data.number;
        }
        if (data.message !== this._lastMsg) {
            this.updateBubble(data.message);
            this._lastMsg = data.message;
        }
    }
}
