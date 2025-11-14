(() => {
  'use strict';

  // --- UTILS ---
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => document.querySelectorAll(s);
  const clamp = (v, l, h) => Math.max(l, Math.min(h, v));
  const randRange = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const $ = (id) => document.getElementById(id); // Shorthand

  // --- AUDIO ENGINE ---
  let actx, musInt;
  const Sound = {
    init: () => {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    },
    play: (freq, type, vol = 0.1, dur = 0.3) => {
      if (!SV.settings.sfx || !actx) return;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
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

  // --- PIXEL ART DATA (32x32 Detailed Sprites) ---
  // 0=Empty, 1=Skin, 2=PinkHair, 3=BlueCoat, 4=White, 5=Red, 6=BlackEye, 7=Gray, 8=Phone, 9=Horn
  const ART = {
    troll: [
      "00000002222222200000",
      "00000222222222222000",
      "00000222222222222000",
      "00000221111111122000",
      "00000221611116112200",
      "00000022111111112200",
      "00000022211111122200",
      "00000003333333330000",
      "00000033333333333000",
      "00000033444444433000",
      "00000033444444433000",
      "00000333444444433300",
      "00000333444444433300",
      "00000333444444433300",
      "00000333444444433300",
      "00000000000888800000",
      "00000000000888800000",
      "00000000000888800000"
    ],
    head: [
      "00000990000000990000",
      "00009959000000959900",
      "00009555900009555900",
      "00009555599995555900",
      "00000955555555559000",
      "00000095555555590000",
      "00055555555555555500",
      "00555555555555555550",
      "00554445555555444550",
      "00554445555555444550",
      "00555555555555555550",
      "00555555444444555550",
      "00555555444444555550",
      "00055555555555555500",
      "00000955555555590000",
      "00000099999999900000"
    ],
    colors: { '1':'#ffd5a3','2':'#ff91e0','3':'#5e6c8c','4':'#fff','5':'#ff3860','6':'#000','7':'#555','8':'#999','9':'#aa0000' }
  };

  // --- GAME DATA ---
  const COLORS = {
    shirt: ['#ff5a5a','#4ea8ff','#37d67a','#a06bff','#ff8d3b','#17c5b6'],
    pants: ['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'],
    skin:  ['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f']
  };
  const ITEMS = ['none','sword','scepter','mallet','cleaver'];
  const HAIRS = {
    m: ['short','side','spiky'], f: ['bob','long','ponytail'], o: ['short','long','mohawk']
  };
  
  const SKINS = [
    {id:'skin1', name:'Cone Knight', req:'beat_boss1', col:'#ff5a5a'},
    {id:'skin2', name:'Blizzard', req:'long_run', col:'#4e9cff'},
    {id:'skin3', name:'Kindness', req:'kind_only', col:'#ff7bc5'},
    {id:'skin4', name:'Slayer', req:'beat_boss2', col:'#3ba55d'},
    {id:'skin5', name:'Socialite', req:'share_game', col:'#ffd700'}
  ];

  const BOSS1_QUOTES = ["Ratio.", "Touch grass.", "Screenshotted.", "Cringe.", "Bestie no."];
  const ACHIEVEMENTS = [
    { id: 'beat_boss1', title: 'Emoji Dodger', desc: 'Defeat Teen Troll' },
    { id: 'beat_boss2', title: 'Final Blow', desc: 'Defeat Boss Head' },
    { id: 'kind_only', title: 'Kindness', desc: 'Pacifist Run' },
    { id: 'share_game', title: 'Influencer', desc: 'Share the game' },
    { id: 'long_run', title: 'Endurer', desc: 'Survive 10m' },
    { id: 'die_lot', title: 'Glutton', desc: 'Die 10 times' },
    { id: 'secret_dev', title: 'The 2112', desc: 'Find Dev Menu' }
  ];

  // --- STATE ---
  const Store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };

  const SV = {
    settings: Store.get('sv_set', { music: true, sfx: true, playerName: 'Hero', gender: 'm', shirt: '#ff5a5a', pants: '#2d3549', skinTone: '#ffd5a3', hairStyle: 'short', item: 'none', skin: null }),
    progress: Store.get('sv_prog', { ach: {}, jumps: 0, lastCheckpoint: 0, beatBoss1: false, beatBoss2: false, endlessUnlocked: false, allTimeScore: 0 }),
    
    running: false, paused: false, level: 1, score: 0, lastTs: 0, levelTime: 0,
    player: {x:100, y:296, w:42, h:64, vy:0, onGround:true, jumpsUsed:0}, // Corrected full variable name
    groundY: 360, gravity: 0.0018, scrollSpd: 0.34,
    
    hazards: [], powerups: [], particles: [], hazardTimer: 0, nextHazard: 1000,
    shield: 0, jetpack: false, tesla: 0, invuln: 0, jetTime: 0,
    
    boss1: { active: false, hp: 1, y: 200, anim: 0, quote: '', quoteTimer: 0, dodged: 0 },
    rpg: { active: false, hp: 100, max: 100 },
    devClicks: 0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas');
    if(!cvs) return console.error("FATAL: No Canvas Found");
    SV.ctx = cvs.getContext('2d');

    // Title Tap
    qs('#title-screen').onclick = () => {
      Sound.init();
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
      if(SV.settings.music) Sound.startMusic();
    };

    // --- BUTTON BINDINGS (Explicit) ---
    qs('#play-btn').onclick = () => startRun(SV.progress.lastCheckpoint > 1 ? 'popup' : 1);
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
    const toggleMus = () => { SV.settings.music=!SV.settings.music; if(SV.settings.music) Sound.startMusic(); else Sound.stopMusic(); updSet(); };
    const toggleSfx = () => { SV.settings.sfx=!SV.settings.sfx; updSet(); };
    qs('#music-toggle').onclick = toggleMus; qs('#pause-music-btn').onclick = toggleMus;
    qs('#sfx-toggle').onclick = toggleSfx; qs('#pause-sfx-btn').onclick = toggleSfx;
    qs('#reset-progress-btn').onclick = () => { if(confirm("Reset All Data?")) { localStorage.clear(); location.reload(); } };

    // --- PAUSE ---
    qs('#pause-btn').onclick = () => { SV.paused = true; openPopup('pause-menu'); };
    qs('#resume-btn').onclick = () => { closePopup('pause-menu'); SV.paused = false; loop(); };
    qs('#quit-btn').onclick = () => location.reload();

    // --- CONTROLS ---
    const jump = (e) => { 
      if(!SV.running || SV.paused) return;
      if(e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      const p = SV.player;
      if(p.jumpsUsed < 2){ p.vy = p.jumpsUsed===0?-0.66:-0.58; p.jumpsUsed++; p.onGround=false; Sound.play(300,'square',0.1); }
    };
    qs('#jump-btn').onpointerdown = jump; window.onkeydown = jump; qs('#game-canvas').onpointerdown = jump;

    // --- DEV MENU (Top Left) ---
    qs('#dev-trigger').addEventListener('pointerdown', () => {
      SV.devClicks++; console.log("DevTap:", SV.devClicks);
      setTimeout(() => SV.devClicks = 0, 2000);
      if(SV.devClicks >= 5) {
        if(prompt('Code?') === '2112') { openPopup('dev-menu'); award('secret_dev'); }
        SV.devClicks = 0;
      }
    });
    window.devJump = (l) => { closePopup('dev-menu'); if(l===10) startRpgBoss(); else startRun(l); };
    window.devPower = (t) => {
      if(t==='shield') SV.shield=3; if(t==='tesla') SV.tesla=5000;
      if(t==='jetpack') { SV.jetpack=true; SV.jetTime=8000; }
      closePopup('dev-menu');
    };

    qsa('.close-btn').forEach(b=>b.onclick=()=>b.closest('.popup').classList.add('hidden'));
    updSet();
    requestAnimationFrame(loop);
  }

  function openPopup(id) { qs('#' + id).classList.remove('hidden'); }
  function closePopup(id) { qs('#' + id).classList.add('hidden'); }

  // --- GAME LOOP ---
  function startRun(lv){
    if(lv==='popup'){ openPopup('start-popup'); return; }
    ['home-screen', 'start-popup', 'death-popup', 'rpg-overlay'].forEach(id => qs('#' + id).classList.add('hidden'));
    qs('#game-screen').classList.remove('hidden');

    SV.level=lv; SV.score=0; SV.hazards=[]; SV.powerups=[];
    SV.player.y=296; SV.player.vy=0; SV.player.onGround=true;
    SV.shield=0; SV.jetpack=false; SV.tesla=0;
    SV.running=true; SV.paused=false; SV.lastTs=performance.now();
  }

  function loop(ts){
    if(!SV.running) return;
    if(SV.paused) { requestAnimationFrame(loop); return; }
    
    const dt = ts - SV.lastTs || 16; SV.lastTs = ts;
    update(dt);
    draw(); // Draw now that update is complete
    requestAnimationFrame(loop);
  }

  function update(dt){
    if(SV.rpg.active) return;
    SV.score += dt*0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore || 0);
    if(SV.score > (SV.progress.allTimeScore||0)) { SV.progress.allTimeScore = SV.score; Store.set('sv_prog', SV.progress); }

    // Powerups
    if(SV.tesla>0) { SV.tesla-=dt; qs('#powerup-indicator').classList.remove('hidden'); qs('#powerup-indicator').textContent="⚡ TESLA"; }
    else if(SV.jetpack) { SV.jetpackTime-=dt; if(SV.jetpackTime<=0) SV.jetpack=false; qs('#powerup-indicator').classList.remove('hidden'); qs('#powerup-indicator').textContent="🚀 JET"; }
    else qs('#powerup-indicator').classList.add('hidden');

    // Tesla
    if(SV.tesla > 0){
      const target = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if(target){ target.zapped = true; SV.hazards = SV.hazards.filter(h => h !== target); Sound.play(600, 'sawtooth', 0.1); }
    }

    // Physics
    const p = SV.player;
    if(SV.jetpack) { p.vy=0; p.y=200+Math.sin(Date.now()*0.005)*10; p.onGround=false; }
    else {
      p.vy += 0.0018*dt; p.y += p.vy*dt;
      if(p.y >= 296) { p.y=296; p.vy=0; p.onGround=true; p.jumpsUsed=0; }
    }

    // Spawning
    if(Math.random()<0.015) {
      const type = Math.random()>0.7 ? 'mine' : 'slime';
      SV.hazards.push({x:850, y:type==='mine'?230:264, w:36, h:36, type});
    }
    if(Math.random()<0.002) SV.powers.push({x:850, y:200, w:40, h:40, type:pick(['shield','tesla','jetpack'])});

    SV.hazards.forEach(h => h.x -= 0.34*dt);
    SV.powers.forEach(p => p.x -= 0.34*dt);

    // Collisions
    SV.hazards.forEach((h,i) => {
      if(rectHit(p.x,p.y,p.w,p.h, h.x,h.y,h.w,h.h)){
        if(SV.shield>0 || SV.jetpack) { SV.shield--; SV.hazards.splice(i,1); }
        else { SV.running=false; onPlayerDeath(); }
      }
    });
    SV.powers.forEach((pw,i) => {
      if(rectHit(p.x,p.y,p.w,p.h, pw.x,pw.y,40,40)){
        SV.powers.splice(i,1); Sound.play(600,'sine');
        if(pw.type==='shield') SV.shield=3;
        if(pw.type==='tesla') SV.tesla=5000;
        if(pw.type==='jetpack') { SV.jetpack=true; SV.jetpackTime=8000; }
      }
    });
  }
  
  function onPlayerDeath(){
    Sound.play(60,'sawtooth',0.5);
    award('die_lot');
    openPopup('death-popup');
    qs('#death-restart-checkpoint').onclick = () => { closePopup('death-popup'); startRun(SV.progress.lastCheckpoint || 1); };
    qs('#death-exit-main').onclick = () => location.reload();
  }

  function rectHit(x1,y1,w1,h1, x2,y2,w2,h2){ return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1); }

  // --- DRAWING ---
  function draw(){
    const ctx = SV.ctx; ctx.clearRect(0,0,800,480);
    const g = ctx.createLinearGradient(0,0,0,480);
    g.addColorStop(0, '#060914'); g.addColorStop(1, '#0b1220');
    ctx.fillStyle=g; ctx.fillRect(0,0,800,480);
    ctx.fillStyle='#1a2435'; ctx.fillRect(0,360,800,120);

    SV.hazards.forEach(h => {
      if(h.type==='mine'){
        ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(h.x+18,h.y+18,18,0,7); ctx.fill();
        ctx.strokeStyle='#f00'; ctx.lineWidth=3;
        for(let i=0;i<8;i++){
          const a = i * (Math.PI/4) + (Date.now()*0.001); // Spin
          ctx.beginPath(); ctx.moveTo(h.x+18,h.y+18); ctx.lineTo(h.x+18+Math.cos(a)*25, h.y+18+Math.sin(a)*25); ctx.stroke();
        }
      } else {
        ctx.fillStyle='#0f0'; ctx.beginPath(); ctx.arc(h.x+18,h.y,18,Math.PI,0); ctx.fill();
        ctx.fillRect(h.x,h.y,36,36);
      }
    });

    SV.powers.forEach(p => {
      ctx.shadowBlur=15; ctx.shadowColor='#fff';
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(p.x+20,p.y+20,20,0,7); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#000'; ctx.font='20px monospace';
      if(p.type==='shield') ctx.fillText('🛡️',p.x+10,p.y+26);
      if(p.type==='tesla') ctx.fillText('⚡',p.x+10,p.y+26);
      if(p.type==='jetpack') ctx.fillText('🚀',p.x+10,p.y+26);
    });

    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    if(SV.tesla>0 && SV.hazards.length>0){
      const t = SV.hazards[0];
      if(t.x < 600 && t.x > SV.player.x){
        ctx.strokeStyle='#0ff'; ctx.lineWidth=3; ctx.beginPath();
        ctx.moveTo(SV.player.x+20, SV.player.y+30);
        ctx.lineTo(t.x+18, t.y+18);
        ctx.stroke();
      }
    }
  }

  function drawPlayerSprite(ctx, x, y){
    const s = SV.settings;
    let shirt = s.shirt;
    if(s.skin) { const sk = SKINS.find(k=>k.id===s.skin); if(sk) shirt=sk.col; }
    
    ctx.fillStyle = shirt; ctx.fillRect(x,y,42,64); // Body
    ctx.fillStyle = s.skinTone; ctx.fillRect(x+8,y-16,26,16); // Head
    ctx.fillStyle = s.pants; ctx.fillRect(x+4,y+36,12,28); ctx.fillRect(x+26,y+36,12,28); // Legs
    
    ctx.fillStyle = '#70421b'; // Hair
    const wind = Math.sin(Date.now()*0.005) * 2;
    if(s.hairStyle==='short') ctx.fillRect(x+8,y-20,26,8);
    if(s.hairStyle==='long') { ctx.fillRect(x+8,y-20,26,10); ctx.fillRect(x+4+wind,y-10,6,24); }
    if(s.hairStyle==='ponytail') { ctx.fillRect(x+8,y-20,24,8); ctx.fillRect(x+26+wind,y-12,6,16); }
    if(s.hairStyle==='mohawk') { ctx.fillRect(x+18,y-24,6,12); }

    ctx.fillStyle = '#ccc'; // Items
    if(s.item === 'sword') ctx.fillRect(x-10, y+10, 8, 40);
    if(s.item === 'scepter') { ctx.fillRect(x-6,y+10,4,30); ctx.fillStyle='#ff0'; ctx.fillRect(x-8,y,8,8); }
    if(s.item === 'mallet') { ctx.fillRect(x-6,y+10,4,20); ctx.fillStyle='#8b4513'; ctx.fillRect(x-15,y,20,15); }
    if(s.item === 'cleaver') { ctx.fillRect(x-6,y+10,4,15); ctx.fillRect(x-15,y+5,20,10); }
  }

  // --- WARDROBE (Fixed) ---
  function initWardrobe(){
    const cvs = document.createElement('canvas'); cvs.width=300; cvs.height=180;
    qs('#player-preview').innerHTML=''; qs('#player-preview').appendChild(cvs);
    const ctx = cvs.getContext('2d');
    
    const render = () => {
      ctx.clearRect(0,0,300,180);
      drawPlayerSprite(ctx, 130, 80); 
    };
    
    qs('#player-name-input').value = SV.settings.name;
    qs('#player-name-input').onchange = (e) => SV.settings.name = e.target.value;

    // TABS
    qsa('.wardrobe-tab').forEach(t => t.onclick = (e) => {
      qsa('.wardrobe-tab').forEach(x=>x.classList.remove('active'));
      e.target.classList.add('active');
      qsa('.wardrobe-content').forEach(c=>c.classList.remove('active'));
      qs('#' + e.target.dataset.tab).classList.add('active');
    });
    
    // BUILDER
    const build = (arr, id, prop, isColor) => {
      const el = qs('#'+id); el.innerHTML='';
      arr.forEach(val => {
        const b = document.createElement('button');
        if(isColor){ b.className='color-swatch'; b.style.background=val; }
        else { b.className='item-swatch'; b.textContent=val; }
        if(SV.settings[prop] === val) b.classList.add('active');
        b.onclick = () => {
          SV.settings[prop] = val;
          if(prop==='shirt') SV.settings.skin = null; // Unequip skin
          Store.set('sv_set', SV.settings);
          initWardrobe(); // Re-render all
        };
        el.appendChild(b);
      });
    };

    const refreshHair = () => {
      const styles = HAIRS[SV.settings.gender] || HAIRS.m;
      build(styles, 'hair-options', 'hairStyle', false);
    };

    build(COLORS.shirt, 'shirt-options', 'shirt', true);
    build(COLORS.pants, 'pants-options', 'pants', true);
    build(COLORS.skin, 'skin-options', 'skinTone', true);
    build(ITEMS, 'item-options', 'item', false);
    refreshHair();

    qsa('.gender-btn').forEach(b => {
      if(SV.settings.gender === b.dataset.gender) b.classList.add('active');
      b.onclick = () => { 
        SV.settings.gender = b.dataset.gender; 
        initWardrobe(); 
      };
    });

    const sg = qs('#skins-grid'); sg.innerHTML='';
    SKINS.forEach(s => {
      const d = document.createElement('div');
      d.className = `skin-card ${SV.settings.skin===s.id ? 'selected' : ''} ${SV.prog.ach[s.req] ? '' : 'locked'}`;
      d.innerHTML = `<b>${s.name}</b>`;
      if(SV.prog.ach[s.req]) {
        d.onclick = () => { SV.settings.skin = s.id; initWardrobe(); };
      }
      sg.appendChild(d);
    });
    
    qs('#clear-skin-btn').onclick = () => { SV.settings.skin = null; initWardrobe(); };
    render();
  }

  // --- LORE (Detailed Art) ---
  function drawPixelArt(ctx, map, pal, size){
    map.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const col = pal[char];
        if(col){ ctx.fillStyle = col; ctx.fillRect(x*size, y*size, size, size); }
      });
    });
  }

  function drawLore(){
    const c1 = qs('#lore-canvas-1');
    if(c1) { c1.getContext('2d').clearRect(0,0,128,128); drawPixelArt(c1.getContext('2d'), ART.troll, ART.colors, 6); }
    const c2 = qs('#lore-canvas-2');
    if(c2) { c2.getContext('2d').clearRect(0,0,128,128); drawPixelArt(c2.getContext('2d'), ART.head, ART.colors, 6); }
  }

  function buildAch() {
    const grid = qs('#achievements-grid'); grid.innerHTML = '';
    const have = SV.prog.ach || {};
    ACHIEVEMENTS.forEach(a => {
      const div = document.createElement('div');
      div.className = `achievement-tile ${have[a.id] ? 'unlocked' : ''}`;
      div.innerHTML = `<b>${a.title}</b><br><small>${a.desc}</small>`;
      grid.appendChild(div);
    });
  }

  function award(id) { if (!SV.prog.ach[id]) { SV.prog.ach[id] = true; Store.set('sv_prog', SV.prog); } }
  
  // --- RPG ---
  function startRpgBoss(){ 
    SV.running=false; SV.rpg.active=true; openPopup('rpg-overlay'); SV.rpg.hp=100; 
    qsa('.insult-btn').forEach(b => {
      b.textContent = "Attack"; 
      b.onclick = () => {
        SV.rpg.hp -= 10; qs('#boss-hp-bar').style.width = SV.rpg.hp+'%';
        if(SV.rpg.hp <= 0) { alert("YOU WON!"); SV.prog.endlessUnlocked=true; Store.set('sv_prog', SV.prog); location.reload(); }
      };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
