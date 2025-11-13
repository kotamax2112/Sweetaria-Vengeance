(() => {
  'use strict';

  const qs = (s)=>document.querySelector(s);
  const qsa = (s)=>document.querySelectorAll(s);
  const rand = (a,b)=>a+Math.random()*(b-a);
  const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];

  // --- AUDIO ---
  let actx, musInt;
  const Sound = {
    init: () => { if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==='suspended') actx.resume(); },
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
        const freq = [110,110,130,110,165,146,130,110][t%8];
        Sound.play(freq,'triangle',0.05);
        t++;
      }, 250);
    },
    stopMusic: () => clearInterval(musInt)
  };

  // --- DATA ---
  const COLORS = {
    shirt: ['#ff5a5a','#4ea8ff','#37d67a','#a06bff','#ff8d3b','#17c5b6'],
    pants: ['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'],
    skin:  ['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f']
  };
  const ITEMS = ['none','sword','scepter','mallet','cleaver'];
  const HAIRS = ['short','side','spiky','bob','long','ponytail','mohawk'];
  
  const SKINS = [
    {id:'skin1', name:'Cone Knight', req:'beat_boss1'},
    {id:'skin2', name:'Blizzard', req:'long_run'},
    {id:'skin3', name:'Kindness', req:'kind_only'},
    {id:'skin4', name:'Slayer', req:'beat_boss2'}
  ];

  // --- STATE ---
  const SV = {
    set: JSON.parse(localStorage.getItem('sv_set')||'{"music":true,"sfx":true,"name":"Hero","gen":"m","shirt":"#ff5a5a","pants":"#2d3549","skin":"#ffd5a3","hair":"short","item":"none"}'),
    prog: JSON.parse(localStorage.getItem('sv_prog')||'{"ach":{},"lastCheckpoint":0}'),
    run:false, pause:false, score:0, allTime:0,
    p:{x:100, y:300, vy:0, gr:true, jump:0},
    hazards:[], powers:[], tesla:0, shield:0, jet:0,
    devTap:0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas');
    SV.ctx = cvs.getContext('2d');

    // Title Tap
    qs('#title-screen').onclick = () => {
      Sound.init();
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
      if(SV.set.music) Sound.startMusic();
    };

    // Binds
    qs('#play-btn').onclick = () => startRun(SV.prog.lastCheckpoint>1 ? 'popup' : 1);
    qs('#wardrobe-btn').onclick = () => { qs('#wardrobe-popup').classList.remove('hidden'); initWardrobe(); };
    qs('#lore-btn').onclick = () => { qs('#lore-popup').classList.remove('hidden'); drawLore(); };
    qs('#settings-btn').onclick = () => qs('#settings-popup').classList.remove('hidden');
    
    // Dev Menu Trigger (Top Right)
    document.addEventListener('pointerdown', e => {
      if(e.clientX > window.innerWidth-80 && e.clientY < 80){
        SV.devTap++; setTimeout(()=>SV.devTap=0, 2000);
        if(SV.devTap>=5) { 
          if(prompt('Code?')==='2112') qs('#dev-menu').classList.remove('hidden'); 
          SV.devTap=0; 
        }
      }
    });

    // Global Funcs
    window.devJump = (l) => { qs('#dev-menu').classList.add('hidden'); startRun(l); };
    window.devPower = (t) => { 
      qs('#dev-menu').classList.add('hidden'); 
      if(t==='shield') SV.shield=3; 
      if(t==='tesla') SV.tesla=5000; 
      if(t==='jetpack') { SV.jet=true; SV.jetTime=8000; }
    };

    qsa('.close-btn').forEach(b=>b.onclick=()=>b.closest('.popup').classList.add('hidden'));
    
    // Controls
    const jump = (e) => {
      if(!SV.run || SV.pause) return;
      if(e.type==='keydown' && e.code!=='Space') return;
      if(SV.p.jump<2){ SV.p.vy = SV.p.jump===0?-0.66:-0.58; SV.p.jump++; SV.p.gr=false; Sound.play(300,'square'); }
    };
    qs('#jump-btn').onpointerdown = jump;
    window.onkeydown = jump;
    qs('#game-canvas').onpointerdown = jump;

    requestAnimationFrame(loop);
  }

  // --- GAME LOOP ---
  function startRun(lv){
    if(lv==='popup'){ qs('#start-popup').classList.remove('hidden'); return; }
    qsa('.screen').forEach(s=>s.classList.add('hidden'));
    qs('#game-screen').classList.remove('hidden');
    
    SV.level=lv; SV.score=0; SV.hazards=[]; SV.powers=[];
    SV.p.y = 296; SV.p.vy=0; SV.run=true; SV.pause=false;
    SV.lastTs = performance.now();
  }

  function loop(ts){
    if(!SV.run || SV.pause) { requestAnimationFrame(loop); return; }
    const dt = ts - SV.lastTs || 16; SV.lastTs = ts;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  function update(dt){
    SV.score += dt*0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#alltime-score-display').textContent = Math.floor(SV.prog.allTime || 0);
    if(SV.score > (SV.prog.allTime||0)) { SV.prog.allTime = SV.score; localStorage.setItem('sv_prog', JSON.stringify(SV.prog)); }

    // Timers
    if(SV.tesla>0) SV.tesla-=dt;
    
    // Physics
    const p = SV.p;
    if(SV.jet) { p.vy=0; p.y=200+Math.sin(Date.now()*0.005)*10; }
    else {
      p.vy += 0.0018*dt; p.y += p.vy*dt;
      if(p.y >= 296) { p.y=296; p.vy=0; p.gr=true; p.jump=0; }
    }

    // Tesla Logic (Auto-Aim)
    if(SV.tesla > 0){
      qs('#powerup-indicator').classList.remove('hidden');
      qs('#powerup-indicator').textContent = "⚡ TESLA ACTIVE";
      const target = SV.hazards.find(h => Math.abs(h.x - p.x) < 400);
      if(target){
        // Zap Effect in Draw
        target.zapped = true; 
        // Instant Destroy
        SV.hazards = SV.hazards.filter(h => h !== target);
        Sound.play(600, 'sawtooth', 0.1);
      }
    } else {
      qs('#powerup-indicator').classList.add('hidden');
    }

    // Spawning
    if(Math.random()<0.015) {
      const type = Math.random()>0.7 ? 'mine' : 'slime';
      SV.hazards.push({x:850, y:type==='mine'?230:264, w:36, h:36, type});
    }
    if(Math.random()<0.002) SV.powers.push({x:850, y:200, w:40, h:40, type:pick(['shield','tesla','jet'])});

    // Move & Collide
    SV.hazards.forEach(h => h.x -= 0.34*dt);
    SV.powers.forEach(p => p.x -= 0.34*dt);
    
    // Collision
    SV.hazards.forEach((h,i) => {
      if(rectHit(p.x,p.y,42,64, h.x,h.y,36,36)){
        if(SV.shield>0 || SV.jet) { SV.shield--; SV.hazards.splice(i,1); }
        else { SV.run=false; qs('#death-popup').classList.remove('hidden'); }
      }
    });
    SV.powers.forEach((pw,i) => {
      if(rectHit(p.x,p.y,42,64, pw.x,pw.y,40,40)){
        SV.powers.splice(i,1);
        if(pw.type==='shield') SV.shield=3;
        if(pw.type==='tesla') SV.tesla=5000;
        if(pw.type==='jet') { SV.jet=true; setTimeout(()=>SV.jet=false, 8000); }
      }
    });
  }

  function rectHit(x1,y1,w1,h1, x2,y2,w2,h2){ return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1); }

  // --- DRAWING ---
  function draw(){
    const ctx = SV.ctx; ctx.clearRect(0,0,800,480);
    
    // BG
    const g = ctx.createLinearGradient(0,0,0,480);
    g.addColorStop(0, '#060914'); g.addColorStop(1, '#0b1220');
    ctx.fillStyle=g; ctx.fillRect(0,0,800,480);
    ctx.fillStyle='#1a2435'; ctx.fillRect(0,360,800,120);

    // Hazards
    SV.hazards.forEach(h => {
      if(h.type==='mine'){
        ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(h.x+18,h.y+18,18,0,7); ctx.fill();
        // Spikes
        ctx.strokeStyle='#f00'; ctx.lineWidth=3;
        for(let i=0;i<8;i++){
          ctx.moveTo(h.x+18,h.y+18);
          ctx.lineTo(h.x+18+Math.cos(i)*25, h.y+18+Math.sin(i)*25);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle='#0f0'; ctx.beginPath(); ctx.arc(h.x+18,h.y,18,Math.PI,0); ctx.fill();
        ctx.fillRect(h.x,h.y,36,36);
      }
    });

    // Powers (Big Icons)
    SV.powers.forEach(p => {
      ctx.shadowBlur=15; ctx.shadowColor='#fff';
      ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(p.x+20,p.y+20,20,0,7); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle='#000'; ctx.font='20px sans-serif'; ctx.fillText(p.type[0].toUpperCase(), p.x+14, p.y+26);
    });

    // Player
    drawSprite(ctx, SV.p.x, SV.p.y);

    // Tesla Bolt
    if(SV.tesla>0 && SV.hazards[0] && SV.hazards[0].x < 500){
      ctx.strokeStyle='#0ff'; ctx.lineWidth=4; ctx.beginPath();
      ctx.moveTo(SV.p.x+20, SV.p.y+30);
      ctx.lineTo(SV.hazards[0].x+18, SV.hazards[0].y+18);
      ctx.stroke();
    }
  }

  function drawSprite(ctx, x, y){
    const s = SV.set;
    ctx.fillStyle = s.shirt; ctx.fillRect(x,y,42,64); // Body
    ctx.fillStyle = s.skin; ctx.fillRect(x+8,y-16,26,16); // Head
    ctx.fillStyle = s.pants; ctx.fillRect(x+4,y+36,12,28); ctx.fillRect(x+26,y+36,12,28); // Legs
  }

  // --- WARDROBE FIX (Explicit Binding) ---
  function initWardrobe(){
    // Draw Preview
    const cvs = document.createElement('canvas'); cvs.width=300; cvs.height=180;
    qs('#player-preview').innerHTML=''; qs('#player-preview').appendChild(cvs);
    const ctx = cvs.getContext('2d');
    const render = () => { ctx.clearRect(0,0,300,180); drawSprite(ctx, 130, 80); };
    render();

    // BUILDERS
    const build = (arr, id, prop) => {
      const el = qs('#'+id); el.innerHTML='';
      arr.forEach(val => {
        const b = document.createElement('button');
        // Check if color or text
        if(val.startsWith('#')){ b.className='color-swatch'; b.style.background=val; }
        else { b.className='item-swatch'; b.textContent=val; }
        
        b.onclick = () => { SV.set[prop] = val; localStorage.setItem('sv_set', JSON.stringify(SV.set)); render(); };
        el.appendChild(b);
      });
    };

    build(COLORS.shirt, 'shirt-row', 'shirt');
    build(COLORS.pants, 'pants-row', 'pants');
    build(COLORS.skin, 'skin-row', 'skin');
    build(HAIRS, 'hair-row', 'hair');
    build(ITEMS, 'item-row', 'item');

    // SKINS (Tarot)
    const sg = qs('#skins-grid'); sg.innerHTML='';
    SKINS.forEach(s => {
      const d = document.createElement('div');
      d.className = 'skin-card';
      d.innerHTML = `<b>${s.name}</b>`;
      // Logic for locked/unlocked
      if(SV.prog.ach[s.req]) {
        d.onclick = () => { SV.set.skin = s.id; SV.set.shirt = s.color; render(); };
      } else {
        d.classList.add('locked'); d.innerHTML += '<br>🔒';
      }
      sg.appendChild(d);
    });
  }

  function drawLore(){
    const c1 = qs('#lore-boss1');
    if(c1){
      const ctx = c1.getContext('2d');
      ctx.fillStyle='#0b1220'; ctx.fillRect(0,0,100,100);
      ctx.fillStyle='#5e6c8c'; ctx.fillRect(30,40,40,50); // Body
      ctx.fillStyle='#ff91e0'; ctx.fillRect(20,20,60,20); // Pink Hair
    }
    const c2 = qs('#lore-boss2');
    if(c2){
      const ctx = c2.getContext('2d');
      ctx.fillStyle='#0b1220'; ctx.fillRect(0,0,100,100);
      ctx.fillStyle='#f00'; ctx.beginPath(); ctx.arc(50,50,35,0,7); ctx.fill(); // Head
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
