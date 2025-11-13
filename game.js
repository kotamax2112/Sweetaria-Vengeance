(() => {
  'use strict';

  // --- UTILS ---
  const qs = (s)=>document.querySelector(s);
  const qsa = (s)=>document.querySelectorAll(s);
  const clamp = (v,l,h)=>Math.max(l,Math.min(h,v));
  const rand = (a,b)=>a+Math.random()*(b-a);
  const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];

  // --- AUDIO (Safe Mode) ---
  let actx, musInt;
  const Sound = {
    init: () => {
      if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
      if(actx.state==='suspended') actx.resume();
    },
    play: (freq,type,vol=0.1) => {
      if(!SV.set.sfx || !actx) return;
      const o=actx.createOscillator(), g=actx.createGain();
      o.type=type; o.frequency.value=freq;
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime+0.3);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime+0.3);
    },
    startMusic: () => {
      if(musInt) clearInterval(musInt);
      if(!SV.set.music || !actx) return;
      let t=0;
      musInt = setInterval(()=>{
        if(SV.pause) return;
        const freq = [110,110,130,110,165,146,130,110][t%8];
        Sound.play(freq,'triangle',0.05);
        t++;
      }, 250);
    },
    stopMusic: () => clearInterval(musInt)
  };

  // --- PIXEL ART (32x32 HD Maps) ---
  // 0=Trans, 1=Skin, 2=PinkHair, 3=BlueCoat, 4=White, 5=Red, 6=BlackEye
  const ART = {
    troll: [
      "00000000000022222200000000000000",
      "00000000002222222222000000000000",
      "00000000222222222222220000000000",
      "00000022222222222222222200000000",
      "00000022222222222222222200000000",
      "00000022222222222222222200000000",
      "00000022221111111111222200000000",
      "00000022211111111111122200000000",
      "00000022216111111611122200000000",
      "00000022216111111611122200000000",
      "00000022211111111111122200000000",
      "00000022221111111111222200000000",
      "00000022222222222222222200000000",
      "00000003333333333333333000000000",
      "00000033333333333333333300000000",
      "00000033344444444444433300000000",
      "00000033344444444444433300000000",
      "00000033344444444444433300000000"
    ],
    head: [
      "00000000000555555550000000000000",
      "00000000555555555555500000000000",
      "00000055555555555555555000000000",
      "00000555555555555555555500000000",
      "00005555555555555555555550000000",
      "00005555555555555555555550000000",
      "00005555444555555444555550000000",
      "00005555444555555444555550000000",
      "00005555555555555555555550000000",
      "00005555555555555555555550000000",
      "00005555554444444455555550000000",
      "00005555554444444455555550000000",
      "00005555555555555555555550000000",
      "00000555555555555555555500000000",
      "00000055555555555555555000000000",
      "00000000000555555550000000000000"
    ],
    cols: {'1':'#ffd5a3','2':'#ff91e0','3':'#5e6c8c','4':'#fff','5':'#ff3860','6':'#000'}
  };

  // --- DATA ---
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
  const BOSS2_ATTACKS = [
    {text:'Student Debt', dmg:10}, {text:'Avocado Toast', dmg:5}, 
    {text:'Kindness', dmg:8}, {text:'Unionize', dmg:12}
  ];
  const ACHIEVEMENTS = [
    { id:'beat_boss1', title:'Emoji Dodger', desc:'Defeat Teen Troll' },
    { id:'beat_boss2', title:'Final Blow', desc:'Defeat Boss Head' },
    { id:'kind_only', title:'Kindness', desc:'Pacifist Run' },
    { id:'share_game', title:'Influencer', desc:'Share the game' },
    { id:'long_run', title:'Endurer', desc:'Survive 10m' },
    { id:'die_lot', title:'Glutton', desc:'Die 10 times' },
    { id:'secret_dev', title:'The 2112', desc:'Find Dev Menu' }
  ];

  // --- STATE ---
  const SV = {
    set: JSON.parse(localStorage.getItem('sv_set')||'{"music":true,"sfx":true,"name":"Hero","gen":"m","shirt":"#ff5a5a","pants":"#2d3549","skin":"#ffd5a3","hair":"short","item":"none"}'),
    prog: JSON.parse(localStorage.getItem('sv_prog')||'{"ach":{},"lastCheckpoint":0,"allTimeScore":0}'),
    run:false, pause:false, score:0,
    // FIX: Player object initialized fully
    player: {x:100, y:300, w:42, h:64, vy:0, gr:true, jump:0},
    hazards:[], powers:[], tesla:0, shield:0, jet:0,
    boss1:{active:false, hp:1, y:200, anim:0, quote:'', quoteTimer:0, dodged:0},
    rpg:{active:false, hp:100, max:100},
    devTap:0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas');
    SV.ctx = cvs.getContext('2d');

    // --- GLOBAL CLICK (Unlock Audio) ---
    const unlockAudio = () => {
      Sound.init();
      if(SV.set.music) Sound.startMusic();
      document.removeEventListener('pointerdown', unlockAudio);
    };
    document.addEventListener('pointerdown', unlockAudio);

    // --- BUTTONS ---
    qs('#title-screen').onclick = () => {
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
    };

    qs('#play-btn').onclick = () => startRun(SV.prog.lastCheckpoint > 1 ? 'popup' : 1);
    qs('#wardrobe-btn').onclick = () => { qs('#wardrobe-popup').classList.remove('hidden'); initWardrobe(); };
    qs('#lore-btn').onclick = () => { qs('#lore-popup').classList.remove('hidden'); drawLore(); };
    qs('#achievements-btn').onclick = () => { buildAch(); qs('#achievements-popup').classList.remove('hidden'); };
    qs('#share-btn').onclick = () => qs('#share-popup').classList.remove('hidden');
    qs('#settings-btn').onclick = () => qs('#settings-popup').classList.remove('hidden');
    
    qs('#start-at-last').onclick = () => { closePopup('start-popup'); startRun(SV.prog.lastCheckpoint||1); };
    qs('#start-beginning').onclick = () => { closePopup('start-popup'); startRun(1); };
    qs('#open-credits-btn').onclick = () => { closePopup('settings-popup'); qs('#credits-popup').classList.remove('hidden'); };
    qs('#return-title-btn').onclick = () => location.reload();

    // --- SHARE REWARD ---
    qs('#copy-share-btn').onclick = () => {
      navigator.clipboard.writeText(qs('#share-link').value);
      alert("Link Copied! 'Socialite' Skin Unlocked.");
      award('share_game');
    };

    // --- TOGGLES ---
    const updSet = () => {
      qs('#music-toggle').textContent = qs('#pause-music-btn').textContent = `Music: ${SV.set.music?'ON':'OFF'}`;
      qs('#sfx-toggle').textContent = qs('#pause-sfx-btn').textContent = `SFX: ${SV.set.sfx?'ON':'OFF'}`;
      localStorage.setItem('sv_set', JSON.stringify(SV.set));
    };
    qs('#music-toggle').onclick = qs('#pause-music-btn').onclick = () => { SV.set.music=!SV.set.music; if(SV.set.music) Sound.startMusic(); else Sound.stopMusic(); updSet(); };
    qs('#sfx-toggle').onclick = qs('#pause-sfx-btn').onclick = () => { SV.set.sfx=!SV.set.sfx; updSet(); };
    qs('#reset-progress-btn').onclick = () => { if(confirm("Reset All Data?")) { localStorage.clear(); location.reload(); } };

    // --- PAUSE ---
    qs('#pause-btn').onclick = () => { SV.pause = true; qs('#pause-menu').classList.remove('hidden'); };
    qs('#resume-btn').onclick = () => { qs('#pause-menu').classList.add('hidden'); SV.pause = false; loop(); };
    qs('#quit-btn').onclick = () => location.reload();

    // --- CONTROLS ---
    const jump = (e) => {
      if(!SV.run || SV.pause) return;
      if(e.type==='keydown' && e.code!=='Space') return;
      e.preventDefault();
      if(SV.player.jump < 2){
        SV.player.vy = SV.player.jump === 0 ? -0.66 : -0.58;
        SV.player.jump++; SV.player.gr = false;
        Sound.play(300, 'square');
      }
    };
    qs('#jump-btn').onpointerdown = jump;
    window.onkeydown = jump;
    qs('#game-canvas').onpointerdown = jump;

    // --- DEV MENU ---
    qs('#dev-trigger').addEventListener('pointerdown', () => {
      SV.devTap++; console.log("DevTap:", SV.devTap);
      setTimeout(() => SV.devTap = 0, 2000);
      if(SV.devTap >= 5) {
        if(prompt('Code?') === '2112') { qs('#dev-menu').classList.remove('hidden'); award('secret_dev'); }
        SV.devTap = 0;
      }
    });
    window.devJump = (l) => { closePopup('dev-menu'); if(l===10) startRpgBoss(); else startRun(l); };
    window.devPower = (t) => { closePopup('dev-menu'); if(t==='shield') SV.shield=3; if(t==='tesla') SV.tesla=5000; if(t==='jetpack') { SV.jet=true; SV.jetTime=8000; } };

    qsa('.close-btn').forEach(b=>b.onclick=()=>b.closest('.popup').classList.add('hidden'));
    updSet();
    requestAnimationFrame(loop);
  }

  function closePopup(id){ qs('#'+id).classList.add('hidden'); }

  // --- GAME LOOP ---
  function startRun(lv){
    if(lv==='popup'){ qs('#start-popup').classList.remove('hidden'); return; }
    qsa('.screen').forEach(s=>s.classList.add('hidden')); qs('#game-screen').classList.remove('hidden');
    
    SV.level=lv; SV.score=0; SV.hazards=[]; SV.powers=[];
    SV.player.y=296; SV.player.vy=0; SV.run=true; SV.pause=false;
    SV.lastTs=performance.now();
  }

  function loop(ts){
    if(!SV.run || SV.pause) { requestAnimationFrame(loop); return; }
    const dt = ts - SV.lastTs || 16; SV.lastTs = ts;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  function update(dt){
    if(SV.rpg.active) return;
    
    SV.score += dt*0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#alltime-display').textContent = Math.floor(SV.prog.allTimeScore || 0);
    if(SV.score > (SV.prog.allTimeScore||0)) { SV.prog.allTimeScore = SV.score; localStorage.setItem('sv_prog', JSON.stringify(SV.prog)); }

    // Powerups
    if(SV.tesla>0) { SV.tesla-=dt; qs('#powerup-indicator').classList.remove('hidden'); qs('#powerup-indicator').textContent="⚡ TESLA"; }
    else if(SV.jet) { qs('#powerup-indicator').classList.remove('hidden'); qs('#powerup-indicator').textContent="🚀 JET"; }
    else qs('#powerup-indicator').classList.add('hidden');

    // Tesla Auto-Zap
    if(SV.tesla > 0){
      const target = SV.hazards.find(h => Math.abs(h.x - SV.player.x) < 400);
      if(target){ 
        target.zapped=true; 
        SV.hazards = SV.hazards.filter(h => h !== target); 
        Sound.play(600, 'sawtooth', 0.1); 
      }
    }

    if(SV.jet) { SV.jetTime-=dt; if(SV.jetTime<=0) SV.jet=false; }

    // Physics
    const p = SV.player;
    if(SV.jet) { p.vy=0; p.y=200+Math.sin(Date.now()*0.005)*10; p.gr=false; }
    else {
      p.vy += 0.0018*dt; p.y += p.vy*dt;
      if(p.y >= 296) { p.y=296; p.vy=0; p.gr=true; p.jump=0; }
    }

    // Spawning
    if(Math.random()<0.015) {
      const type = Math.random()>0.7 ? 'mine' : 'slime';
      SV.hazards.push({x:850, y:type==='mine'?230:264, w:36, h:36, type});
    }
    if(Math.random()<0.002) SV.powers.push({x:850, y:200, w:40, h:40, type:pick(['shield','tesla','jetpack'])});

    // Move
    SV.hazards.forEach(h => h.x -= 0.34*dt);
    SV.powers.forEach(p => p.x -= 0.34*dt);

    // Collisions
    SV.hazards.forEach((h,i) => {
      if(rectHit(p.x,p.y,42,64, h.x,h.y,36,36)){
        if(SV.shield>0 || SV.jet) { SV.shield--; SV.hazards.splice(i,1); Sound.play(150,'sawtooth'); }
        else { SV.run=false; qs('#death-popup').classList.remove('hidden'); award('die_lot'); Sound.play(60,'sawtooth',0.5); }
      }
    });
    SV.powers.forEach((pw,i) => {
      if(rectHit(p.x,p.y,42,64, pw.x,pw.y,40,40)){
        SV.powers.splice(i,1); Sound.play(600,'sine');
        if(pw.type==='shield') SV.shield=3;
        if(pw.type==='tesla') SV.tesla=5000;
        if(pw.type==='jetpack') { SV.jet=true; SV.jetTime=8000; }
      }
    });
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
          ctx.moveTo(h.x+18,h.y+18); ctx.lineTo(h.x+18+Math.cos(i)*25, h.y+18+Math.sin(i)*25);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle='#0f0'; ctx.beginPath(); ctx.arc(h.x+18,h.y,18,Math.PI,0); ctx.fill();
        ctx.fillRect(h.x,h.y,36,36);
      }
    });

    SV.powers.forEach(p => {
      ctx.shadowBlur=15; ctx.shadowColor='#fff';
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(p.x+20,p.y+20,20,0,7); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#000'; ctx.font='20px monospace'; ctx.fillText(p.type[0].toUpperCase(), p.x+14, p.y+26);
    });

    drawSprite(ctx, SV.player.x, SV.player.y);

    if(SV.tesla>0 && SV.hazards[0] && SV.hazards[0].x < 600){
      ctx.strokeStyle='#0ff'; ctx.lineWidth=4; ctx.beginPath();
      ctx.moveTo(SV.player.x+20, SV.player.y+30);
      ctx.lineTo(SV.hazards[0].x+18, SV.hazards[0].y+18);
      ctx.stroke();
    }
  }

  function drawSprite(ctx, x, y){
    const s = SV.set;
    let shirt = s.shirt;
    if(s.skin) { const sk = SKINS.find(k=>k.id===s.skin); if(sk) shirt=sk.col; }
    
    ctx.fillStyle = shirt; ctx.fillRect(x,y,42,64);
    ctx.fillStyle = s.skin; ctx.fillRect(x+8,y-16,26,16);
    ctx.fillStyle = s.pants; ctx.fillRect(x+4,y+36,12,28); ctx.fillRect(x+26,y+36,12,28);
    
    ctx.fillStyle = '#70421b'; // Hair
    if(s.hair==='short') ctx.fillRect(x+8,y-20,26,8);
    if(s.hair==='long') { ctx.fillRect(x+8,y-20,26,10); ctx.fillRect(x+4,y-10,6,24); }
    if(s.hair==='mohawk') { ctx.fillRect(x+18,y-24,6,12); }

    ctx.fillStyle = '#ccc';
    if(s.item === 'sword') ctx.fillRect(x-10, y, 8, 40);
    if(s.item === 'cleaver') { ctx.fillRect(x-10, y, 8, 20); ctx.fillRect(x-15, y, 18, 10); }
  }

  // --- WARDROBE ---
  function initWardrobe(){
    const cvs = document.createElement('canvas'); cvs.width=300; cvs.height=180;
    qs('#player-preview').innerHTML=''; qs('#player-preview').appendChild(cvs);
    const ctx = cvs.getContext('2d');
    const render = () => { ctx.clearRect(0,0,300,180); drawSprite(ctx, 130, 80); };
    render();

    // TABS
    qs('#tab-gear').onclick = () => { qs('#content-gear').classList.add('active'); qs('#content-skins').classList.remove('active'); qs('#tab-gear').classList.add('active'); qs('#tab-skins').classList.remove('active'); };
    qs('#tab-skins').onclick = () => { qs('#content-skins').classList.add('active'); qs('#content-gear').classList.remove('active'); qs('#tab-skins').classList.add('active'); qs('#tab-gear').classList.remove('active'); };

    const build = (arr, id, prop, isColor) => {
      const el = qs('#'+id); el.innerHTML='';
      arr.forEach(val => {
        const b = document.createElement('button');
        if(isColor){ b.className='color-swatch'; b.style.background=val; }
        else { b.className='item-swatch'; b.textContent=val; }
        b.onclick = () => { SV.set[prop] = val; localStorage.setItem('sv_set', JSON.stringify(SV.set)); render(); };
        el.appendChild(b);
      });
    };

    const refreshHair = () => { build(HAIRS[SV.set.gen]||HAIRS.m, 'hair-options', 'hair', false); };

    build(COLORS.shirt, 'shirt-options', 'shirt', true);
    build(COLORS.pants, 'pants-options', 'pants', true);
    build(COLORS.skin, 'skin-options', 'skin', true);
    build(ITEMS, 'item-options', 'item', false);
    refreshHair();

    qsa('.gender-btn').forEach(b => b.onclick = () => { SV.set.gen = b.dataset.gender; refreshHair(); render(); });

    const sg = qs('#skins-grid'); sg.innerHTML='';
    SKINS.forEach(s => {
      const d = document.createElement('div');
      d.className = 'skin-card';
      d.innerHTML = `<b>${s.name}</b>`;
      if(SV.prog.ach[s.req]) {
        d.onclick = () => { SV.set.skin = s.id; SV.set.shirt = s.col; render(); };
      } else { d.classList.add('locked'); d.innerHTML += '<br>🔒'; }
      sg.appendChild(d);
    });
    qs('#clear-skin-btn').onclick = () => { SV.set.skin = null; render(); };
  }

  // --- LORE ---
  function drawPixelArt(ctx, map){
    map.forEach((row, y) => {
      [...row].forEach((char, x) => {
        const col = ART.colors[char];
        if(col){ ctx.fillStyle = col; ctx.fillRect(x*8, y*8, 8, 8); }
      });
    });
  }
  function drawLore(){
    const c1 = qs('#lore-canvas-1').getContext('2d'); c1.clearRect(0,0,128,128); drawPixelArt(c1, ART.troll);
    const c2 = qs('#lore-canvas-2').getContext('2d'); c2.clearRect(0,0,128,128); drawPixelArt(c2, ART.head);
  }

  function buildAch() {
    const grid = qs('#achievements-grid'); grid.innerHTML = '';
    const have = SV.prog.ach || {};
    ACHIEVEMENTS.forEach(a => {
      const div = document.createElement('div');
      div.className = `achievement-tile ${have[a.id] ? 'unlocked' : ''}`;
      div.innerHTML = `<b>${a.title}</b><br>${a.desc}`;
      grid.appendChild(div);
    });
  }

  function award(id) { if (!SV.prog.ach[id]) { SV.prog.ach[id] = true; localStorage.setItem('sv_prog', JSON.stringify(SV.prog)); } }
  
  function startRpgBoss(){ 
    SV.running=false; SV.rpg.active=true; openPopup('rpg-overlay'); SV.rpg.hp=100; 
    qsa('.insult-btn').forEach(b => {
      b.textContent = "Attack"; 
      b.onclick = () => {
        SV.rpg.hp -= 10; qs('#boss-hp-bar').style.width = SV.rpg.hp+'%';
        if(SV.rpg.hp <= 0) { alert("YOU WON!"); SV.prog.endlessUnlocked=true; localStorage.setItem('sv_prog', JSON.stringify(SV.prog)); location.reload(); }
      };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
                      
