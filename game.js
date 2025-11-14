/* =========================================================
   SWEETARIA: VENGEANCE — STABLE 3.0 + DEV DROPDOWN + TIMER + JETPACK HUD
   ========================================================= */
(() => {
  'use strict';

  // --- UTILS ---
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const randRange = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const $ = (id) => document.getElementById(id);

  // --- AUDIO ENGINE ---
  let actx, musInt;
  const Sound = {
    init: () => {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    },
    play: (freq, type, vol = 0.1, dur = 0.3) => {
      if (!SV.settings.sfx || !actx) return;
      try {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime + dur);
      } catch (e) { console.error("Audio Playback Error:", e); }
    },
    startMusic: () => {
      if (musInt) clearInterval(musInt);
      if (!SV.settings.music || !actx) return;
      let t = 0;
      musInt = setInterval(() => {
        if (SV.paused) return;
        const freq = [110, 110, 130, 110, 165, 146, 130, 110][t % 8];
        Sound.play(freq, 'triangle', 0.05, 0.2);
        t++;
      }, 250);
    },
    stopMusic: () => clearInterval(musInt)
  };

  // --- PIXEL ART (SNES Style) ---
  const ART = {
    // 0=Empty, 1=Skin, 2=Blonde, 3=Gap, 4=BlueCoat, 5=White, 6=BlackEye, 7=Phone, 8=PhoneScreen
    troll: [
      "00000002222222200000",
      "00000222222222222000",
      "00000222222222222000",
      "00000221111111122000",
      "00000221611116112200",
      "00000022111111112200",
      "00000022213113122200", // Gapped teeth
      "00000004444444440000",
      "00000044444444444000",
      "00000044555555544000",
      "00000044555555544000",
      "00000444555555544477", // Holding Phone
      "00000444555555544488",
      "00000444555555544488",
      "00000444555555544477",
      "00000000000000000000"
    ],
    // 0=Empty, 1=Skin, 4=WhiteEye, 6=BlackPupil, 9=GrayHair
    head: [
      "00000000099999900000",
      "00000009999999900000",
      "00000099999999999000",
      "00000991111111199000",
      "00000911111111111900",
      "00000916411116411900", // Eyes
      "00000916411116411900",
      "00000911111111111900",
      "00000091111111190000",
      "00000009111111900000",
      "00000009166661900000", // Mouth
      "00000000911119000000",
      "00000000099990000000"
    ],
    colors: {
      '1': '#ffd5a3',
      '2': '#ffee7a',
      '3': '#000',
      '4': '#fff',
      '5': '#ff3860',
      '6': '#000',
      '7': '#999',
      '8': '#aaf',
      '9': '#ccc'
    }
  };

  // --- GAME DATA ---
  const COLORS = {
    shirt: ['#ff5a5a','#4ea8ff','#37d67a','#a06bff','#ff8d3b','#17c5b6'],
    pants: ['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'],
    skin:  ['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f']
  };
  const ITEMS = ['none','sword','scepter','mallet','cleaver'];
  const HAIRS = {
    m: ['short','side','spiky'],
    f: ['bob','long','ponytail'],
    o: ['short','side','spiky','bob','long','ponytail','mohawk']
  };
  
  // --- SKINS / AWARDS ---
  const SKINS = [
    {id:'skin1', name:'Cone Knight', req:'beat_boss1', col:'#ff5a5a', rarity: 'rare'},
    {id:'skin2', name:'Blizzard', req:'long_run', col:'#4e9cff', rarity: 'rare'},
    {id:'skin3', name:'Kindness', req:'kind_only', col:'#ff7bc5', rarity: 'epic'},
    {id:'skin4', name:'Slayer', req:'beat_boss2', col:'#3ba55d', rarity: 'epic'},
    {id:'skin5', name:'Socialite', req:'share_game', col:'#ffd700', rarity: 'legendary'}
  ];

  const BOSS1_QUOTES = ["Ratio.", "Touch grass.", "Screenshotted.", "Cringe.", "Bestie no."];

  const ACHIEVEMENTS = [
    { id:'beat_boss1', title:'Emoji Dodger', desc:'Defeat Teen Troll' },
    { id:'beat_boss2', title:'Final Blow',   desc:'Defeat Boss Head' },
    { id:'kind_only', title:'Kindness',      desc:'Pacifist Run' },
    { id:'share_game',title:'Influencer',    desc:'Share the game' },
    { id:'long_run',  title:'Endurer',       desc:'Survive 10m' },
    { id:'die_lot',   title:'Glutton',       desc:'Die 10 times' },
    { id:'secret_dev',title:'The 2112',      desc:'Find Dev Menu' }
  ];

  // --- STATE ---
  const Store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };

  const SV = {
    settings: Store.get('sv_set', {
      music: true,
      sfx: true,
      playerName: 'Hero',
      gender: 'm',
      shirt: '#ff5a5a',
      pants: '#2d3549',
      skinTone: '#ffd5a3',
      hairStyle: 'short',
      item: 'none',
      skin: null
    }),
    progress: Store.get('sv_prog', {
      ach: {},
      jumps: 0,
      lastCheckpoint: 0,
      beatBoss1: false,
      beatBoss2: false,
      endlessUnlocked: false,
      allTimeScore: 0
    }),
    
    running: false,
    paused: false,
    level: 1,
    score: 0,
    lastTs: 0,
    levelTime: 0,          // used for 1-minute levels

    player: {x:120, y:296, w:42, h:64, vy:0, onGround:true, jumpsUsed:0},
    groundY: 360,
    gravity: 0.0018,
    scrollSpd: 0.34,
    
    hazards: [],
    powerups: [],
    particles: [],
    hazardTimer: 0,
    nextHazard: 1000,

    shield: 0,
    jetpack: false,
    tesla: 0,
    invuln: 0,
    jetpackTime: 0,
    
    boss1: { active: false, hp: 1, y: 200, anim: 0, quote: '', quoteTimer: 0, dodged: 0 },
    rpg: { active: false, hp: 100, max: 100 },
    devClicks: 0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas');
    if(!cvs) return console.error("FATAL: No Canvas");
    SV.ctx = cvs.getContext('2d');

    // Powerup HUD chip styling in the stats area
    const pInd = qs('#powerup-indicator');
    if (pInd) {
      pInd.style.display = 'inline-block';
      pInd.style.marginLeft = '6px';
      pInd.style.padding = '2px 8px';
      pInd.style.borderRadius = '12px';
      pInd.style.background = 'rgba(10,15,30,0.85)';
      pInd.style.border = '1px solid #4e9cff';
      pInd.style.fontSize = '0.65rem';
    }

    // --- GLOBAL CLICK (Unlock Audio) ---
    const unlockAudio = () => {
      Sound.init();
      if(SV.settings.music) Sound.startMusic();
      document.removeEventListener('pointerdown', unlockAudio);
    };
    document.addEventListener('pointerdown', unlockAudio);

    // --- BUTTON BINDINGS ---
    qs('#title-screen').onclick = () => {
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
    };

    qs('#play-btn').onclick = () => startRun(SV.progress.lastCheckpoint > 1 ? 'popup' : 1);
    qs('#endless-btn').onclick = () => {
      if(SV.progress.endlessUnlocked) startRun(99);
      else alert("You must beat Story Mode to unlock Endless Run!");
    };
    qs('#wardrobe-btn').onclick = () => { openPopup('wardrobe-popup'); initWardrobe(); };
    qs('#lore-btn').onclick = () => { openPopup('lore-popup'); drawLore(); };
    qs('#achievements-btn').onclick = () => { buildAch(); openPopup('achievements-popup'); };
    qs('#share-btn').onclick = () => openPopup('share-popup');
    qs('#settings-btn').onclick = () => openPopup('settings-popup');
    qs('#open-credits-btn').onclick = () => { closePopup('settings-popup'); openPopup('credits-popup'); };
    qs('#return-title-btn').onclick = () => location.reload();
    qs('#copy-share-btn').onclick = () => {
      navigator.clipboard.writeText(qs('#share-link').value);
      alert("Link Copied! 'Socialite' Skin Unlocked.");
      award('share_game');
    };
    qs('#start-at-last').onclick = () => { closePopup('start-popup'); startRun(SV.progress.lastCheckpoint||1); };
    qs('#start-beginning').onclick = () => { closePopup('start-popup'); startRun(1); };

    // --- TOGGLES ---
    const updSet = () => {
      ['#music-toggle', '#pause-music-btn'].forEach(id => qs(id).textContent = `Music: ${SV.settings.music?'ON':'OFF'}`);
      ['#sfx-toggle', '#pause-sfx-btn'].forEach(id => qs(id).textContent = `SFX: ${SV.settings.sfx?'ON':'OFF'}`);
      Store.set('sv_set', SV.settings);
    };
    const toggleMus = () => {
      SV.settings.music = !SV.settings.music;
      if(SV.settings.music) Sound.startMusic(); else Sound.stopMusic();
      updSet();
    };
    const toggleSfx = () => { SV.settings.sfx = !SV.settings.sfx; updSet(); };
    qs('#music-toggle').onclick = toggleMus; qs('#pause-music-btn').onclick = toggleMus;
    qs('#sfx-toggle').onclick = toggleSfx;   qs('#pause-sfx-btn').onclick = toggleSfx;
    qs('#reset-progress-btn').onclick = () => { if(confirm("Reset All Data?")) { localStorage.clear(); location.reload(); } };

    // --- PAUSE ---
    qs('#pause-btn').onclick = () => { SV.paused = true; openPopup('pause-menu'); };
    qs('#resume-btn').onclick = () => { closePopup('pause-menu'); SV.paused = false; SV.lastTs = performance.now(); loop(); };
    qs('#quit-btn').onclick = () => location.reload();
    
    // --- DEATH ---
    qs('#death-restart-checkpoint').onclick = () => { closePopup('death-popup'); startRun(SV.progress.lastCheckpoint || 1); };
    qs('#death-exit-main').onclick = () => location.reload();

    // --- CONTROLS ---
    const jump = (e) => { 
      if(!SV.running || SV.paused) return;
      if(e.type==='keydown' && e.code!=='Space') return;
      e.preventDefault();
      const p = SV.player;
      if(p.jumpsUsed < 2){
        p.vy = p.jumpsUsed===0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround=false;
        Sound.play(300,'square',0.1);
      }
    };
    qs('#jump-btn').onpointerdown = jump;
    window.onkeydown = jump;
    qs('#game-canvas').onpointerdown = jump;

    // --- DEV MENU ---
    qs('#dev-trigger-zone').addEventListener('pointerdown', () => {
      SV.devClicks++;
      console.log("DevTap:", SV.devClicks);
      setTimeout(() => SV.devClicks = 0, 2000);
      if(SV.devClicks >= 5) {
        if(prompt('Code?') === '2112') {
          openPopup('dev-menu');
          award('secret_dev');
          initDevMenu();   // inject dropdown + warp button once
        }
        SV.devClicks = 0;
      }
    });

    // existing dev level buttons (still work)
    qsa('#dev-menu .dev-btn').forEach(b => b.onclick = () => {
      closePopup('dev-menu');
      SV.running=false;
      startRun(parseInt(b.dataset.level, 10));
    });

    // dev power buttons
    qsa('#dev-menu .btn').forEach(b => b.onclick = () => {
      if(b.dataset.power==='shield') SV.shield=3;
      if(b.dataset.power==='tesla')  SV.tesla=5000;
      if(b.dataset.power==='jetpack'){ SV.jetpack=true; SV.jetpackTime=8000; }
      closePopup('dev-menu');
    });

    // Universal Close
    qsa('.close-btn').forEach(b=>b.onclick=()=>b.closest('.popup').classList.add('hidden'));
    
    updSet();
    // game loop starts when startRun() is called
  }

  function openPopup(id) { qs('#' + id).classList.remove('hidden'); }
  function closePopup(id) { qs('#' + id).classList.add('hidden'); }

  // --- DEV MENU DROPDOWN INJECTION ---
  function initDevMenu(){
    const panel = qs('#dev-menu .panel');
    if (!panel || panel.dataset.devInit) return;
    panel.dataset.devInit = '1';

    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '10px';

    const label = document.createElement('span');
    label.textContent = 'Warp to level:';

    const select = document.createElement('select');
    select.id = 'dev-level-select';
    for (let i = 1; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = 'Level ' + i;
      select.appendChild(opt);
    }

    const goBtn = document.createElement('button');
    goBtn.className = 'btn small';
    goBtn.textContent = 'Go';
    goBtn.onclick = () => {
      const lv = parseInt(select.value, 10) || 1;
      closePopup('dev-menu');
      SV.running = false;
      startRun(lv);
    };

    row.appendChild(label);
    row.appendChild(select);
    row.appendChild(goBtn);

    const closeBtn = panel.querySelector('.close-btn');
    panel.insertBefore(row, closeBtn || panel.lastElementChild);
  }

  // --- GAME LOOP ---
  function startRun(lv){
    if(lv === 'popup'){ openPopup('start-popup'); return; }

    ['home-screen', 'start-popup', 'death-popup', 'rpg-overlay'].forEach(id => {
      const el = qs('#' + id);
      if (el) el.classList.add('hidden');
    });
    qs('#game-screen').classList.remove('hidden');

    SV.level = lv;
    SV.score = 0;
    SV.levelTime = 0;
    SV.hazards = [];
    SV.powerups = [];
    SV.particles = [];
    SV.player.x = 120;
    SV.player.y = 296;
    SV.player.vy = 0;
    SV.player.onGround = true;
    SV.player.jumpsUsed = 0;
    SV.shield = 0;
    SV.jetpack = false;
    SV.tesla = 0;
    SV.jetpackTime = 0;
    SV.boss1.active = false;
    SV.boss1.dodged = 0;
    SV.rpg.active = false;
    SV.rpg.hp = SV.rpg.max;

    const label = qs('#player-name-display');
    if (label) label.textContent = SV.settings.playerName || 'Hero';

    const lvlLabel = qs('#level-display');
    if (lvlLabel) lvlLabel.textContent = 'Lv ' + SV.level;

    const bar = qs('#level-progress-fill');
    if (bar) bar.style.width = '0%';

    SV.running = true;
    SV.paused  = false;
    SV.lastTs  = performance.now();
    
    loop();
  }

  function loop(ts){
    if(!SV.running) return;
    if(SV.paused) { requestAnimationFrame(loop); return; }
    
    const dt = ts - SV.lastTs || 16;
    SV.lastTs = ts;
    
    try { update(dt); } catch(e) { console.error(e); SV.running=false; }
    try { draw(); }   catch(e) { console.error(e); SV.running=false; }
    
    requestAnimationFrame(loop);
  }

  function update(dt){
    if(SV.rpg.active) return;
    
    // --- LEVEL TIMER: ~60s per level ---
    SV.levelTime += dt;
    const prog = clamp(SV.levelTime / 60000, 0, 1);
    const progBar = qs('#level-progress-fill');
    if (progBar) progBar.style.width = (prog * 100) + '%';

    if (SV.levelTime >= 60000) {
      SV.level++;
      SV.levelTime = 0;
      const lvlLabel = qs('#level-display');
      if (lvlLabel) lvlLabel.textContent = 'Lv ' + SV.level;
    }

    // --- SCORE / BEST ---
    SV.score += dt*0.01;
    qs('#score-display').textContent   = Math.floor(SV.score);
    qs('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore || 0);
    if(SV.score > (SV.progress.allTimeScore||0)) {
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_prog', SV.progress);
    }

    // --- POWERUP HUD ---
    const pInd = qs('#powerup-indicator');
    if (SV.tesla > 0) {
      SV.tesla -= dt;
      const secs = Math.max(0, Math.ceil(SV.tesla / 1000));
      if (pInd) {
        pInd.textContent = `⚡ TESLA – ${secs}s`;
        pInd.classList.remove('hidden');
      }
    } else if (SV.jetpack) {
      SV.jetpackTime -= dt;
      if (SV.jetpackTime <= 0) SV.jetpack = false;
      const secs = Math.max(0, Math.ceil(SV.jetpackTime / 1000));
      if (pInd) {
        pInd.textContent = `🚀 JETPACK – ${secs}s`;
        pInd.classList.remove('hidden');
      }
    } else if (SV.shield > 0) {
      if (pInd) {
        pInd.textContent = `🛡️ SHIELD ×${SV.shield}`;
        pInd.classList.remove('hidden');
      }
    } else if (pInd) {
      pInd.classList.add('hidden');
    }

    // Tesla auto-zap
    if(SV.tesla > 0){
      const target = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if(target){
        SV.hazards = SV.hazards.filter(h => h !== target);
        Sound.play(600, 'sawtooth', 0.1);
      }
    }

    const p = SV.player;

    // --- JETPACK: FLY ABOVE HAZARDS BUT STILL COLLECT SKY POWERUPS ---
    if (SV.jetpack) {
      p.vy = 0;
      // fly well above ground hazards (mines at y≈230)
      p.y = 160 + Math.sin(Date.now()*0.005)*5;
      p.onGround = false;
      p.jumpsUsed = 0;
    } else {
      p.vy += 0.0018 * dt;
      p.y  += p.vy * dt;
      if(p.y >= 296){
        p.y = 296;
        p.vy = 0;
        p.onGround = true;
        p.jumpsUsed = 0;
      }
    }

    // --- SPAWN HAZARDS ---
    if(Math.random() < 0.015) {
      const type = Math.random() > 0.7 ? 'mine' : 'slime';
      SV.hazards.push({
        x: 850,
        y: type==='mine' ? 230 : 296,
        w: 36,
        h: 36,
        type
      });
    }

    // --- SPAWN POWERUPS (GROUND + SKY) ---
    if(Math.random() < 0.005) {
      const sky = Math.random() < 0.5;
      const y   = sky ? randRange(140, 210) : 260;
      SV.powerups.push({
        x: 850,
        y,
        w: 40,
        h: 40,
        type: pick(['shield','tesla','jetpack'])
      });
    }

    // Scroll world
    SV.hazards.forEach(h => h.x -= 0.34 * dt);
    SV.powerups.forEach(pu => pu.x -= 0.34 * dt); 

    // Hazard collisions (jetpack is safe because you're above them)
    SV.hazards.forEach((h, i) => {
      if(rectHit(p.x,p.y,p.w,p.h, h.x,h.y,h.w,h.h)){
        if(SV.shield > 0){
          SV.shield--;
          SV.hazards.splice(i,1);
        } else {
          SV.running = false;
          onPlayerDeath();
        }
      }
    });

    // Powerup pickups
    SV.powerups.forEach((pw,i) => {
      if(rectHit(p.x,p.y,p.w,p.h, pw.x,pw.y,40,40)){
        SV.powerups.splice(i,1);
        Sound.play(600,'sine');
        if(pw.type==='shield') SV.shield = 3;
        if(pw.type==='tesla')  SV.tesla  = 5000;
        if(pw.type==='jetpack'){ SV.jetpack=true; SV.jetpackTime=8000; }
      }
    });
  }
  
  function onPlayerDeath(){
    Sound.play(60,'sawtooth',0.5);
    award('die_lot');
    openPopup('death-popup');
  }

  function rectHit(x1,y1,w1,h1, x2,y2,w2,h2){
    return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1);
  }

  // --- DRAWING ---
  function draw(){
    if(!SV.ctx) return;
    const ctx = SV.ctx;
    ctx.clearRect(0,0,800,480);

    const t = performance.now()*0.00005;
    const g = ctx.createLinearGradient(0,0,0,480);
    g.addColorStop(0, '#060914');
    g.addColorStop(0.5, '#081021');
    g.addColorStop(1, '#05060b');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,800,480);

    ctx.fillStyle='rgba(40,60,110,0.25)';
    for(let i=0;i<5;i++){
      const offset = ((t*40)+(i*60)) % 1000;
      ctx.fillRect(-offset+100,120+i*24, 260,12);
    }
    
    ctx.fillStyle='#1a2435';
    ctx.fillRect(0,360,800,120);

    // Hazards
    SV.hazards.forEach(h => {
      if(h.type==='mine'){
        ctx.fillStyle='#555';
        ctx.beginPath();
        ctx.arc(h.x+18,h.y+18,18,0,7);
        ctx.fill();
        ctx.strokeStyle='#f00';
        ctx.lineWidth=3;
        for(let i=0;i<8;i++){
          const a = i * (Math.PI/4) + (Date.now()*0.001);
          ctx.beginPath();
          ctx.moveTo(h.x+18,h.y+18);
          ctx.lineTo(h.x+18+Math.cos(a)*25, h.y+18+Math.sin(a)*25);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle='#0f0';
        ctx.beginPath();
        ctx.arc(h.x+18,h.y+18,18,0,7);
        ctx.fill();
        ctx.fillStyle='#000';
        ctx.fillRect(h.x+8, h.y+10,6,6);
        ctx.fillRect(h.x+22,h.y+10,6,6);
      }
    });

    // Powerups
    SV.powerups.forEach(p => { 
      ctx.shadowBlur=15;
      ctx.shadowColor='#fff';
      ctx.fillStyle='#fff';
      ctx.beginPath();
      ctx.arc(p.x+20,p.y+20,20,0,7);
      ctx.fill();
      ctx.shadowBlur=0;

      ctx.fillStyle='#000';
      ctx.font='20px monospace';
      ctx.textAlign='center';
      const cx=p.x+20, cy=p.y+26;
      if(p.type==='shield') ctx.fillText('🛡️',cx,cy);
      if(p.type==='tesla')  ctx.fillText('⚡',cx,cy);
      if(p.type==='jetpack')ctx.fillText('🚀',cx,cy);
    });

    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    // Tesla beam
    if(SV.tesla>0 && SV.hazards.length>0){
      const tgt = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if(tgt){
        ctx.strokeStyle='#0ff';
        ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(SV.player.x+20, SV.player.y+30);
        ctx.lineTo(tgt.x+18, tgt.y+18);
        ctx.stroke();
      }
    }
  }

  function drawPlayerSprite(ctx, x, y){
    const s = SV.settings;
    let shirt = s.shirt;
    if(s.skin){
      const sk = SKINS.find(k=>k.id===s.skin);
      if(sk) shirt = sk.col;
    }
    
    ctx.fillStyle = shirt;
    ctx.fillRect(x,y,42,64); // Body

    ctx.fillStyle = s.skinTone;
    ctx.fillRect(x+8,y-16,26,16); // Head

    ctx.fillStyle = s.pants;
    ctx.fillRect(x+4,y+36,12,28);
    ctx.fillRect(x+26,y+36,12,28); // Legs
    
    ctx.fillStyle = '#70421b'; // Hair
    const wind = Math.sin(Date.now()*0.005) * 2;
    if(s.hairStyle==='long') {
      ctx.fillRect(x+8,y-20,26,10);
      ctx.fillRect(x+4+wind,y-10,6,24);
    } else if(s.hairStyle==='ponytail') {
      ctx.fillRect(x+8,y-20,24,8);
      ctx.fillRect(x+26+wind,y-12,6,16);
    } else if(s.hairStyle==='short') {
      ctx.fillRect(x+8,y-20,26,8);
    } else if(s.hairStyle==='bob') {
      ctx.fillRect(x+6,y-20,28,12);
    } else if(s.hairStyle==='side') {
      ctx.fillRect(x+6,y-20,28,10);
      ctx.fillRect(x+30,y-12,4,10);
    } else if(s.hairStyle==='spiky') {
      for(let i=0; i<5; i++) ctx.fillRect(x+10+i*5, y-24, 4, 10);
    } else if(s.hairStyle==='mohawk') {
      ctx.fillRect(x+18,y-24,6,12);
    }

    ctx.fillStyle = '#999'; // Items
    if(s.item === 'sword') {
      ctx.fillRect(x+45,y+20,4,8);
      ctx.fillRect(x+35,y+26,24,4);
    } else if(s.item === 'scepter') {
      ctx.fillRect(x+45,y+20,4,30);
      ctx.fillStyle='#ff0';
      ctx.beginPath();
      ctx.arc(x+47,y+15,6,0,7);
      ctx.fill();
    } else if(s.item === 'mallet') {
      ctx.fillRect(x+45,y+20,4,20);
      ctx.fillStyle='#8b4513';
      ctx.fillRect(x+38,y,20,15);
    } else if(s.item === 'cleaver') {
      ctx.fillRect(x+45,y+20,4,15);
      ctx.fillRect(x+38,y+15,20,10);
    }
  }

  // --- WARDROBE (unchanged from stable) ---
  function initWardrobe(){
    const cvs = document.createElement('canvas'); cvs.width=300; cvs.height=180;
    qs('#player-preview').innerHTML=''; qs('#player-preview').appendChild(cvs);
    const ctx = cvs.getContext('2d');
    
    const render = () => { ctx.clearRect(0,0,300,180); drawPlayerSprite(ctx, 130, 80); };

    const nameInput = qs('#player-name-input');
    if (nameInput) {
      nameInput.value = SV.settings.playerName || 'Hero';
      nameInput.onchange = (e) => {
        SV.settings.playerName = e.target.value || 'Hero';
        Store.set('sv_set', SV.settings);
      };
    }

    qsa('.wardrobe-tab').forEach(t => t.onclick = (e) => {
      qsa('.wardrobe-tab').forEach(x=>x.classList.remove('active'));
      e.target.classList.add('active');
      qsa('.wardrobe-content').forEach(c=>c.classList.remove('active'));
      qs('#' + e.target.dataset.tab).classList.add('active');
    });
    
    const build = (arr, id, prop, isColor) => {
      const el = qs('#'+id); if(!el) return;
      el.innerHTML='';
      arr.forEach(val => {
        const b = document.createElement('button');
        if(isColor){ b.className='color-swatch'; b.style.background=val; }
        else { b.className='item-swatch'; b.textContent=val; }
        if(SV.settings[prop] === val) b.classList.add('active');
        b.onclick = () => {
          SV.settings[prop] = val;
          if(prop==='shirt') SV.settings.skin = null;
          Store.set('sv_set', SV.settings);
          render();
        };
        el.appendChild(b);
      });
    };

    const refreshHair = () => {
      let styles = HAIRS[SV.settings.gender] || HAIRS.m;
      build(styles, 'hair-options', 'hairStyle', false);
    };

    build(COLORS.shirt, 'shirt-options', 'shirt', true);
    build(COLORS.pants, 'pants-options', 'pants', true);
    build(COLORS.skin,  'skin-options',   'skinTone', true);
    build(ITEMS,        'item-options',   'item', false);
    refreshHair();

    qsa('.gender-btn').forEach(b => {
      b.classList.remove('active');
      if(SV.settings.gender === b.dataset.gender) b.classList.add('active');
      b.onclick = () => {
        SV.settings.gender = b.dataset.gender;
        Store.set('sv_set', SV.settings);
        refreshHair();
        render();
      };
    });

    const sg = qs('#skins-grid'); if (sg) {
      sg.innerHTML='';
      const have = SV.progress.ach || {};
      SKINS.forEach(s => {
        const d = document.createElement('div');
        const isUnlocked = !!have[s.req];
        d.className = `skin-card ${SV.settings.skin===s.id ? 'selected' : ''} ${isUnlocked ? '' : 'locked'} ${isUnlocked ? s.rarity : ''}`;
        
        if (isUnlocked) {
          d.innerHTML = `<b>${s.name}</b>`;
          d.onclick = () => { SV.settings.skin = s.id; Store.set('sv_set', SV.settings); render(); };
        } else {
          d.innerHTML = `<b style="font-size:1.5rem; margin-bottom:10px;">???</b><small>Locked</small>`;
        }
        sg.appendChild(d);
      });
    }
    
    const clearBtn = qs('#clear-skin-btn');
    if (clearBtn) {
      clearBtn.onclick = () => { SV.settings.skin = null; Store.set('sv_set', SV.settings); render(); };
    }

    render();
  }

  // --- LORE (SNES Art) ---
  function drawPixelArt(ctx, map, size){
    map.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const col = ART.colors[char];
        if(col){ ctx.fillStyle = col; ctx.fillRect(x*size, y*size, size, size); }
      });
    });
  }

  function drawLore(){
    const c1 = qs('#lore-canvas-1');
    if(c1) { const ctx1 = c1.getContext('2d'); ctx1.clearRect(0,0,128,128); drawPixelArt(ctx1, ART.troll, 6); }
    const c2 = qs('#lore-canvas-2');
    if(c2) { const ctx2 = c2.getContext('2d'); ctx2.clearRect(0,0,128,128); drawPixelArt(ctx2, ART.head, 6); }
  }

  function buildAch() {
    const grid = qs('#achievements-grid'); if(!grid) return;
    grid.innerHTML = '';
    const have = SV.progress.ach || {}; 
    ACHIEVEMENTS.forEach(a => {
      const div = document.createElement('div');
      div.className = `achievement-tile ${have[a.id] ? 'unlocked' : ''}`;
      div.innerHTML = `<b>${a.title}</b><br><small>${a.desc}</small>`;
      grid.appendChild(div);
    });
  }

  function award(id) { 
    if (!SV.progress.ach[id]) { 
      SV.progress.ach[id] = true; 
      Store.set('sv_prog', SV.progress); 
    } 
  }
  
  function startRpgBoss(){ 
    SV.running=false;
    SV.rpg.active=true;
    openPopup('rpg-overlay');
    SV.rpg.hp=100; 
    qsa('.insult-btn').forEach(b => {
      b.textContent = "Attack"; 
      b.onclick = () => {
        SV.rpg.hp -= 10;
        qs('#boss-hp-bar').style.width = SV.rpg.hp+'%';
        if(SV.rpg.hp <= 0) { 
          alert("YOU WON!"); 
          SV.progress.endlessUnlocked=true; 
          Store.set('sv_prog', SV.progress);
          location.reload(); 
        }
      };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
