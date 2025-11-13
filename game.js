(() => {
  'use strict';

  // --- HELPERS ---
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const randRange = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // --- AUDIO ENGINE ---
  let actx = null;
  let musicInterval = null;

  const Sound = {
    init: () => {
      if (!actx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        actx = new AudioContext();
      }
      if (actx.state === 'suspended') actx.resume();
    },
    play: (freq, type, dur, vol = 0.1) => {
      if (!SV.settings.sfx || !actx) return;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, actx.currentTime);
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    },
    startMusic: () => {
      if (musicInterval) clearInterval(musicInterval);
      if (!SV.settings.music || !actx) return;
      let tick = 0;
      const melody = [110, 110, 130, 110, 165, 146, 130, 110];
      musicInterval = setInterval(() => {
        // Play music in Menu AND Game unless paused
        if (SV.paused) return;
        const f = melody[tick % melody.length];
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, actx.currentTime);
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.linearRampToValueAtTime(0, actx.currentTime + 0.2);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + 0.2);
        tick++;
      }, 250);
    },
    stopMusic: () => { if (musicInterval) clearInterval(musicInterval); }
  };

  // --- DATA ---
  const SKIN_TONES = ['#ffd5a3', '#e8b788', '#c78d62', '#a86b47', '#7f4d30', '#5e391f'];
  const PANTS = ['#2d3549', '#39445f', '#4e5b7a', '#273244', '#1f2738'];
  const HAIR_STYLES = { m: ['short', 'side', 'spiky'], f: ['bob', 'long', 'ponytail'], o: ['short', 'long', 'mohawk'] };

  const SKINS = [
    { id:'skin1', name:'Cone Knight', requires:'beat_boss1', color:'#ff5a5a' },
    { id:'skin2', name:'Blizzard Mage', requires:'long_run', color:'#4e9cff' },
    { id:'skin3', name:'Kind Legend', requires:'kind_only', color:'#ff7bc5' },
    { id:'skin4', name:'Boss Slayer', requires:'beat_boss2', color:'#3ba55d' }
  ];

  const BOSS1_QUOTES = ["Ratio.", "Touch grass.", "Screenshotted.", "Cringe.", "Bestie no."];
  const BOSS2_ATTACKS = [
    { text: 'Student Debt', dmg: 10, kind: false, reaction: "Pay it back!" },
    { text: 'Avocado Toast', dmg: 5, kind: false, reaction: "Stop buying brunch!" },
    { text: 'Kindness', dmg: 8, kind: true, reaction: "Ugh! My one weakness!" },
    { text: 'Unionize', dmg: 12, kind: false, reaction: "My profits!!" }
  ];
  const ACHIEVEMENTS = [
    { id: 'beat_boss1', title: 'Emoji Dodger', desc: 'Defeat Teen Troll (Lv5)' },
    { id: 'beat_boss2', title: 'Final Blow', desc: 'Defeat Big Boss Head (Lv10)' },
    { id: 'kind_only', title: 'Kindness Wins', desc: 'Defeat Boss 2 using ONLY Kindness' },
    { id: '100_jumps', title: 'Hops Master', desc: '100 Jumps total' },
    { id: 'long_run', title: 'Endurer', desc: 'Survive 10m in one run' },
    { id: 'die_lot', title: 'Glutton', desc: 'Die 10 times' },
    { id: 'shield_max', title: 'Invincible', desc: '3 Shields at once' },
    { id: 'all_skins', title: 'Fashionista', desc: 'Unlock all skins' },
    { id: 'secret_dev', title: 'The 2112', desc: 'Find Dev Menu' }
  ];

  // --- STATE ---
  const Store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    del: (k) => localStorage.removeItem(k)
  };

  const SV = {
    settings: Store.get('sv_set', { music: true, sfx: true, playerName: 'Hero', gender: 'm', shirt: 'red', pants: '#2d3549', skinTone: '#ffd5a3', hairStyle: 'short', item: 'none', skin: null }),
    progress: Store.get('sv_prog', { ach: {}, jumps: 0, lastCheckpoint: 0, beatBoss1: false, beatBoss2: false, endlessUnlocked: false }),
    running: false, paused: false, level: 1, score: 0, lastTs: 0, levelTime: 0,
    player: { x: 120, y: 300, w: 42, h: 64, vy: 0, onGround: false, jumpsUsed: 0 },
    groundY: 360, gravity: 0.0018, scrollSpd: 0.34,
    hazards: [], powerups: [], particles: [], hazardTimer: 0, nextHazard: 1000,
    shield: 0, jetpack: false, laser: 0, invuln: 0, jetTime: 0,
    boss1: { active: false, hp: 1, y: 200, anim: 0, quote: '', quoteTimer: 0, dodged: 0 },
    rpg: { active: false, hp: 100, max: 100, pool: [], kindOnly: true },
    devClicks: 0
  };

  // --- INIT ---
  function init() {
    const cvs = qs('#game-canvas');
    SV.ctx = cvs.getContext('2d');

    // Start Game (Unlock Audio)
    const handleStart = (e) => {
      e.preventDefault();
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
      try { Sound.init(); } catch (err) {}
      if (SV.settings.music) Sound.startMusic(); // Start music on Main Menu
    };
    qs('#title-screen').addEventListener('pointerdown', handleStart);
    qs('#title-screen').addEventListener('click', handleStart);

    // Buttons
    qs('#play-btn').onclick = () => { Sound.play(400, 'sine', 0.1); startRun(SV.progress.lastCheckpoint > 1 ? 'popup' : 1); };
    qs('#start-at-last').onclick = () => { closePopup('start-popup'); startRun(SV.progress.lastCheckpoint || 1); };
    qs('#start-beginning').onclick = () => { closePopup('start-popup'); startRun(1); };
    
    qs('#wardrobe-btn').onclick = () => { openPopup('wardrobe-popup'); initWardrobe(); };
    qs('#lore-btn').onclick = () => { openPopup('lore-popup'); setTimeout(drawLore, 50); };
    qs('#achievements-btn').onclick = () => { buildAch(); openPopup('achievements-popup'); };
    qs('#share-btn').onclick = () => openPopup('share-popup');
    
    qs('#settings-btn').onclick = () => openPopup('settings-popup');
    qs('#open-credits-btn').onclick = () => { closePopup('settings-popup'); openPopup('credits-popup'); };
    qs('#return-title-btn').onclick = () => location.reload(); // Simple return

    // Pause Logic
    qs('#pause-btn').onclick = () => { SV.paused = true; openPopup('pause-menu'); };
    qs('#resume-btn').onclick = () => { closePopup('pause-menu'); SV.paused = false; loop(); };
    qs('#quit-btn').onclick = () => location.reload();

    // Controls
    const jump = (e) => { 
      if(!SV.running || SV.paused) return;
      if(e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      if (SV.player.jumpsUsed < 2) {
        SV.player.vy = SV.player.jumpsUsed === 0 ? -0.66 : -0.58;
        SV.player.jumpsUsed++; SV.player.onGround = false;
        Sound.play(300 + (SV.player.jumpsUsed*100), 'square', 0.1);
      }
    };
    qs('#jump-btn').addEventListener('pointerdown', jump);
    document.addEventListener('keydown', jump);
    qs('#game-canvas').addEventListener('pointerdown', jump);

    // DEV TRIGGER (Top Right > window width - 80)
    document.addEventListener('pointerdown', e => {
      if (e.clientX > window.innerWidth - 80 && e.clientY < 80) {
        SV.devClicks++; setTimeout(() => SV.devClicks = 0, 2000);
        if (SV.devClicks >= 5) {
          SV.devClicks = 0;
          if (prompt('Code?') === '2112') { openPopup('dev-menu'); award('secret_dev'); }
        }
      }
    });

    // Window Globals for HTML clicks
    window.devJump = (lv) => { closePopup('dev-menu'); if (lv === 10) startRpgBoss(); else startRun(lv); };
    window.devPower = (type) => {
      if (type === 'shield') SV.shield = 3;
      if (type === 'laser') SV.laser = 5000;
      if (type === 'jetpack') { SV.jetpack = true; SV.jetTime = 8000; }
      closePopup('dev-menu');
    };

    qsa('.close-btn').forEach(b => b.onclick = () => b.closest('.popup').classList.add('hidden'));
    requestAnimationFrame(loop);
  }

  function openPopup(id) { qs('#' + id).classList.remove('hidden'); }
  function closePopup(id) { qs('#' + id).classList.add('hidden'); }

  // --- GAME ENGINE ---
  function startRun(lv) {
    if (lv === 'popup') { openPopup('start-popup'); return; }
    ['home-screen', 'start-popup', 'death-popup', 'rpg-overlay'].forEach(id => qs('#' + id).classList.add('hidden'));
    qs('#game-screen').classList.remove('hidden');

    SV.level = lv; SV.score = 0; SV.hazards = []; SV.powerups = []; SV.particles = [];
    SV.player.y = SV.groundY - 64; SV.player.vy = 0; SV.player.onGround = true;
    SV.shield = 0; SV.jetpack = false; SV.laser = 0;
    SV.boss1.active = false; SV.boss1.dodged = 0;
    SV.rpg.active = false;

    SV.running = true; SV.paused = false; SV.lastTs = performance.now();
  }

  function loop(ts) {
    if (!SV.running || SV.paused) { requestAnimationFrame(loop); return; }
    const dt = ts - SV.lastTs || 16; SV.lastTs = ts;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (SV.rpg.active) return;
    SV.levelTime += dt; SV.score += dt * 0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#shield-indicator').classList.toggle('hidden', SV.shield <= 0);
    qs('#shield-indicator').textContent = `🛡️ ${SV.shield}`;

    // Progress
    if (SV.level !== 5 && SV.level !== 10) {
      const pct = (SV.levelTime / 60000) * 100;
      qs('#level-progress-fill').style.width = clamp(pct, 0, 100) + '%';
      if (SV.levelTime > 60000) {
        if (SV.level === 4) { SV.progress.lastCheckpoint = 5; Store.set('sv_prog', SV.progress); }
        if (SV.level < 10) { SV.level++; SV.levelTime = 0; SV.hazards = []; qs('#level-display').textContent = `Lv ${SV.level}`; }
        else startRpgBoss();
      }
    } else qs('#level-progress-fill').style.width = '0%';

    // Physics
    const p = SV.player;
    if (SV.jetpack) {
      SV.jetTime -= dt; if(SV.jetTime <= 0) SV.jetpack = false;
      p.vy = 0; p.y = (SV.groundY - 100) + Math.sin(performance.now() * 0.005) * 10; p.onGround = false;
    } else {
      p.vy += SV.gravity * dt; p.y += p.vy * dt;
      if (p.y >= SV.groundY - p.h) { p.y = SV.groundY - p.h; p.vy = 0; p.onGround = true; p.jumpsUsed = 0; }
      else p.onGround = false;
    }
    if (SV.invuln > 0) SV.invuln -= dt;
    if (SV.laser > 0) SV.laser -= dt;

    // Boss 1
    if (SV.level === 5) updateBoss1(dt);
    else {
      SV.hazardTimer += dt;
      if (SV.hazardTimer > SV.nextHazard) { SV.hazardTimer = 0; SV.nextHazard = randRange(900, 1500); spawnHazard(); }
    }
    updateEntities(dt); checkCollisions();
  }

  function spawnHazard() {
    const type = Math.random() > 0.7 ? 'mine' : 'slime';
    const y = type === 'mine' ? SV.groundY - 70 : SV.groundY - 36;
    SV.hazards.push({ x: 850, y, w: 36, h: 36, type });
  }

  function updateBoss1(dt) {
    const b = SV.boss1;
    if (!b.active) { b.active = true; b.dodged = 0; }
    b.anim += dt * 0.005; b.y = 200 + Math.sin(b.anim) * 40;
    
    SV.hazardTimer += dt;
    if (SV.hazardTimer > 900) {
      SV.hazardTimer = 0;
      SV.hazards.push({ x: 800, y: pick([SV.groundY - 36, SV.groundY - 110, SV.groundY - 180]), w: 34, h: 34, type: 'emoji' });
    }
    b.quoteTimer += dt;
    if (b.quoteTimer > 2500) { b.quoteTimer = 0; b.quote = pick(BOSS1_QUOTES); }
    
    if (b.dodged >= 40) {
      award('beat_boss1'); alert("TEEN TROLL DEFEATED!");
      SV.progress.lastCheckpoint = 6; Store.set('sv_prog', SV.progress); startRun(6);
    }
  }

  function updateEntities(dt) {
    if (Math.random() < 0.002) SV.powerups.push({ x: 850, y: SV.groundY - 90, w: 40, h: 40, type: pick(['shield', 'laser', 'jetpack']) });
    
    for (let i = SV.hazards.length - 1; i >= 0; i--) {
      const h = SV.hazards[i]; h.x -= SV.scrollSpd * dt;
      if (h.x < -50) { SV.hazards.splice(i, 1); if (SV.level === 5) SV.boss1.dodged++; }
    }
    for (let i = SV.powerups.length - 1; i >= 0; i--) {
      const p = SV.powerups[i]; p.x -= SV.scrollSpd * dt;
      if (p.x < -50) SV.powerups.splice(i, 1);
    }
  }

  function checkCollisions() {
    const p = SV.player;
    const inv = SV.invuln > 0 || SV.jetpack;

    SV.powerups.forEach((pw, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, pw.x, pw.y, 40, 40)) {
        SV.powerups.splice(i, 1); Sound.play(600, 'sine', 0.1);
        if (pw.type === 'shield') SV.shield = 3;
        if (pw.type === 'laser') SV.laser = 5000;
        if (pw.type === 'jetpack') { SV.jetpack = true; SV.jetTime = 8000; }
      }
    });

    if (SV.laser > 0) {
      const ly = p.onGround ? p.y + 6 : p.y + 2;
      SV.hazards.forEach((h, i) => {
        if (h.x < 800 && h.x > p.x && h.y + h.h > ly) { SV.hazards.splice(i, 1); Sound.noise(0.1); }
      });
    }

    if (!inv) {
      SV.hazards.forEach((h, i) => {
        if (rectHit(p.x + 10, p.y + 10, p.w - 20, p.h - 20, h.x, h.y, h.w, h.h)) {
          if (SV.shield > 0) { SV.shield--; SV.invuln = 1000; SV.hazards.splice(i, 1); Sound.play(150, 'sawtooth', 0.2); }
          else { SV.running = false; Sound.play(60, 'sawtooth', 0.5); qs('#death-popup').classList.remove('hidden'); award('die_lot'); }
        }
      });
    }
  }

  function rectHit(x1, y1, w1, h1, x2, y2, w2, h2) { return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1); }

  function draw() {
    const ctx = SV.ctx; ctx.clearRect(0, 0, 800, 480);
    // BG
    const g = ctx.createLinearGradient(0, 0, 0, 480);
    let top = '#060914', bot = '#0b1220';
    if (SV.level === 5) { top = '#2d0b35'; bot = '#ff7bc5'; }
    else if (SV.level === 10) { top = '#330000'; bot = '#660000'; }
    g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 800, 480);
    ctx.fillStyle = '#1a2435'; ctx.fillRect(0, SV.groundY, 800, 480 - SV.groundY);

    // Boss 1
    if (SV.level === 5) {
      const bx = 700, by = SV.boss1.y;
      ctx.fillStyle = '#5e6c8c'; ctx.fillRect(bx, by, 30, 40);
      ctx.fillStyle = '#ff91e0'; ctx.fillRect(bx - 5, by - 10, 40, 15); // Female Hair
      if (SV.boss1.quote) { ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText(SV.boss1.quote, bx - 60, by - 20); }
    }

    // Hazards
    SV.hazards.forEach(h => {
      if (h.type === 'mine') {
        ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(h.x + 18, h.y + 18, 18, 0, 7); ctx.fill();
        ctx.strokeStyle = '#f00'; ctx.lineWidth = 2; ctx.stroke();
      } else if (h.type === 'slime') {
        ctx.fillStyle = '#0f0'; ctx.beginPath(); ctx.arc(h.x + 18, h.y, 18, Math.PI, 0); ctx.fill();
        ctx.fillRect(h.x, h.y, 36, 36); ctx.fillStyle = '#000'; ctx.fillRect(h.x+8, h.y+10, 6, 6); ctx.fillRect(h.x+22, h.y+10, 6, 6);
      } else {
        ctx.fillStyle = '#ffec65'; ctx.beginPath(); ctx.arc(h.x + 17, h.y + 17, 17, 0, 7); ctx.fill();
      }
    });

    // Powerups (Larger Icons)
    SV.powerups.forEach(p => {
      ctx.save();
      ctx.translate(p.x + 20, p.y + 20);
      // Glow
      ctx.shadowBlur = 10; ctx.shadowColor = '#fff';
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000'; ctx.font = '20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (p.type === 'shield') ctx.fillText('🛡️', 0, 0);
      if (p.type === 'laser') ctx.fillText('⚡', 0, 0);
      if (p.type === 'jetpack') ctx.fillText('🚀', 0, 0);
      ctx.restore();
    });

    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    // Laser
    if (SV.laser > 0) {
      ctx.fillStyle = `rgba(100, 255, 255, ${Math.random()})`;
      const by = SV.player.onGround ? SV.player.y + 20 : SV.player.y + 2;
      ctx.fillRect(SV.player.x + 42, by, 800, SV.groundY - by);
    }
  }

  function drawPlayerSprite(ctx, x, y) {
    const s = SV.settings;
    // Skin Override
    if(s.skin) {
      const sk = SKINS.find(k => k.id === s.skin);
      ctx.fillStyle = sk ? sk.color : s.shirt;
    } else {
      ctx.fillStyle = s.shirt === 'red' ? '#ff5a5a' : s.shirt;
    }
    ctx.fillRect(x, y, 42, 64);
    ctx.fillStyle = s.skinTone; ctx.fillRect(x + 8, y - 16, 26, 16);
    ctx.fillStyle = s.pants; ctx.fillRect(x + 4, y + 36, 12, 28); ctx.fillRect(x + 26, y + 36, 12, 28);
  }

  // --- WARDROBE & LORE ---
  function initWardrobe() {
    const prev = qs('#player-preview'); prev.innerHTML = '';
    const cvs = document.createElement('canvas'); cvs.width = 300; cvs.height = 180;
    prev.appendChild(cvs); const ctx = cvs.getContext('2d');
    const render = () => { ctx.clearRect(0, 0, 300, 180); drawPlayerSprite(ctx, 130, 80); };
    render();

    qsa('.color-swatch').forEach(b => b.onclick = () => { SV.settings.shirt = b.dataset.color; SV.settings.skin = null; Store.set('sv_set', SV.settings); render(); });
    const tabs = qsa('.wardrobe-tab');
    tabs.forEach(t => t.onclick = () => {
      tabs.forEach(x => x.classList.remove('active')); t.classList.add('active');
      qsa('.wardrobe-tab-content').forEach(c => c.classList.remove('active'));
      qs('#' + t.dataset.tab + '-tab').classList.add('active');
    });

    // Build Skins Grid
    const grid = qs('#skins-grid'); grid.innerHTML = '';
    const have = SV.progress.ach || {};
    SKINS.forEach(s => {
      const d = document.createElement('div');
      d.className = `skin-card ${have[s.requires] ? '' : 'locked'} ${SV.settings.skin === s.id ? 'selected' : ''}`;
      d.innerHTML = `<b>${s.name}</b>`;
      if(have[s.requires]) {
        d.onclick = () => { SV.settings.skin = s.id; Store.set('sv_set', SV.settings); initWardrobe(); };
      } else {
        d.innerHTML += `<br><small>Locked</small>`;
      }
      grid.appendChild(d);
    });
    qs('#clear-skin').onclick = () => { SV.settings.skin = null; Store.set('sv_set', SV.settings); initWardrobe(); };
  }

  function drawLore() {
    // Female Troll
    const c1 = qs('#lore-boss1');
    if (c1) {
      const ctx = c1.getContext('2d');
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#5e6c8c'; ctx.fillRect(30, 40, 40, 50);
      ctx.fillStyle = '#ff91e0'; ctx.fillRect(25, 25, 50, 20); // Pink Hair
      ctx.fillStyle = '#ffd5b5'; ctx.fillRect(35, 30, 30, 30); // Face
    }
    // Boss Head
    const c2 = qs('#lore-boss2');
    if (c2) {
      const ctx = c2.getContext('2d');
      ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, 100, 100);
      ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(50, 50, 35, 0, 7); ctx.fill();
    }
  }

  function buildAch() {
    const grid = qs('#achievements-grid'); grid.innerHTML = '';
    const have = SV.progress.ach || {};
    ACHIEVEMENTS.forEach(a => {
      const div = document.createElement('div');
      div.className = `achievement-tile ${have[a.id] ? 'unlocked' : ''}`;
      div.innerHTML = `<b>${a.title}</b><br>${a.desc}`;
      grid.appendChild(div);
    });
  }

  function award(id) { if (!SV.progress.ach[id]) { SV.progress.ach[id] = true; Store.set('sv_prog', SV.progress); } }
  
  function startRpgBoss(){ 
    SV.running=false; SV.rpg.active=true; 
    openPopup('rpg-overlay');
    SV.rpg.hp=100; 
    // Simple RPG Loop
    qsa('.insult-btn').forEach(b => {
      b.textContent = "Attack"; 
      b.onclick = () => {
        SV.rpg.hp -= 10; qs('#boss-hp-bar').style.width = SV.rpg.hp+'%';
        if(SV.rpg.hp <= 0) { alert("YOU WON!"); SV.progress.endlessUnlocked=true; Store.set('sv_prog', SV.progress); location.reload(); }
      };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
