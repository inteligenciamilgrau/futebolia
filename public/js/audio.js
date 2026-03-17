
let audioCtx;
const Sound = {
    masterGain: null,
    init: () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            Sound.masterGain = audioCtx.createGain();
            Sound.masterGain.connect(audioCtx.destination);
            const muteToggle = document.getElementById('mute-toggle');
            const volSlider = document.getElementById('volume-slider');
            const vol = (muteToggle && muteToggle.checked) ? 0 : (volSlider ? parseFloat(volSlider.value) : 0.5);
            Sound.masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    },
    beep: () => {
        if(!audioCtx || !Sound.masterGain) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(Sound.masterGain);
        osc.frequency.value = 600;
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    whistle: () => {
        if(!audioCtx || !Sound.masterGain) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(Sound.masterGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(2200, audioCtx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(2000, audioCtx.currentTime + 0.2);
        osc.frequency.linearRampToValueAtTime(2200, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.4);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    },
    kick: () => {
        if(!audioCtx || !Sound.masterGain) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(Sound.masterGain);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
    },
    step: () => {
        if(!audioCtx || !Sound.masterGain) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(Sound.masterGain);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    },
    goal: () => {
        if(!audioCtx || !Sound.masterGain) return;
        const freqs = [261.63, 329.63, 392.00, 523.25];
        freqs.forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(Sound.masterGain);
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1 + (i*0.1));
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime + 1.5);
            gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2.0);
            osc.start();
            osc.stop(audioCtx.currentTime + 2.0);
        });
    }
};

export default Sound;
