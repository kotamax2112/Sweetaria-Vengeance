(() => {
  'use strict';

  const qs = (s)=>document.querySelector(s);
  const qsa = (s)=>document.querySelectorAll(s);
  const clamp = (v,l,h)=>Math.max(l,Math.min(h,v));
  const randRange = (a,b)=>a+Math.random()*(b-a);
  const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];

  // --- AUDIO ENGINE ---
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let actx = new AudioContext();
  let musicInterval = null;

  const Sound = {
    play: (freq, type, dur, vol=0.1) => {
      if(!SV.settings.sfx) return;
      if(actx.state === 'suspended') actx.resume();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, actx.currentTime);
      gain.gain.setValueAtTime(vol, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
      osc.connect(gain); gain.connect(actx.destination);
      osc.start(); osc.stop(actx.currentTime + dur);
    },
    noise: (dur) => {
      if(!SV.settings.sfx) return;
      if(actx.state === 'suspended') actx.resume();
      const bufSize = actx.sampleRate * dur;
      const buf = actx.createBuffer(1, bufSize, actx.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0; i<bufSize; i++) data[i] = Math.random()*2 - 1;
      const src = actx.createBufferSource();
      src.buffer = buf;
      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.2, actx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
      src.connect(gain); gain.connect(actx.destination);
      src.start();
    },
    startMusic: () => {
      if(musicInterval) clearInterval(musicInterval);
      if(!SV.settings.music) return;
      if(actx.state==='suspended') actx.resume();
      let tick = 0;
      const melody = [110, 110, 130, 110, 165, 146, 130, 110];
      musicInterval = setInterval(()=>{
        if(!SV.running || SV.paused) return;
        const f = melody[tick % melody.length];
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, actx.currentTime);
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.linearRampToValueAtTime(0, actx.currentTime+0.2);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime+0.2);
        tick++;
      }, 250);
    },
    stopMusic: () => { if(musicInterval) clearInterval(musicInterval); }
  };

  // --- DATA ---
  const SKIN_TONES = ['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f'];
  const PANTS = ['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'];
  const HAIR_STYLES = { m:['short','side','spiky'], f:['bob','long','ponytail'], o:['short','long','mohawk'] };
  
  const BOSS1_QUOTES = ["Ratio + L + bozo.", "Touch grass.", "Screenshotted.", "Cringe.", "Bestie no.", "Flop era."];
  const BOSS2_ATTACKS = [
    { text:'Student Debt', dmg:10, kind:false, reaction:"Pay it back!" },
    { text:'Avocado Toast', dmg:5, kind:false, reaction:"Stop buying brunch!" },
    { text:'Kindness', dmg:8, kind:true, reaction:"Ugh! My one weakness!" },
    { text:'Unionize', dmg:12, kind:false, reaction:"My profits!!" }
  ];
  const ACHIEVEMENTS = [
    { id:'beat_boss1', title:'Emoji Dodger', desc:'Defeat Teen Troll (Lv5)' },
    { id:'beat_boss2', title:'Final Blow', desc:'Defeat Big Boss Head (Lv10)' },
    { id:'kind_only', title:'Kindness Wins', desc:'Defeat Boss 2 using ONLY Kindness' },
    { id:'100_jumps', title:'Hops Master', desc:'100 Jumps total' },
    { id:'long_run', title:'Endurer', desc:'Survive 10m in one run' },
    { id:'die_lot', title:'Glutton', desc:'Die 10 times' },
    { id:'shield_max', title:'Invincible', desc:'3 Shields at once' },
    { id:'all_skins', title:'Fashionista', desc:'Unlock all skins' },
    { id:'secret_dev', title:'The 2112', desc:'Find Dev Menu' }
  ];

  // --- STATE ---
  const SV = {
    settings: JSON.parse(localStorage.getItem('sv_set')||'{"music":true,"sfx":true,"playerName":"Hero","gender":"m","shirt":"red","pants":"#2d3549","skinTone":"#ffd5a3","hairStyle":"short","item":"none"}'),
    progress: JSON.parse(localStorage.getItem('sv_prog')||'{"ach":{},"jumps":0,"lastCheckpoint":0,"beatBoss1":false,"beatBoss2":false}'),
    running:false, paused:false, level:1, score:0, lastTs:0, levelTime:0,
    player:{x:120, y:300, w:42, h:64, vy:0, onGround:false, jumpsUsed:0},
    groundY:360, gravity:0.0018, scrollSpd:0.34,
    hazards:[], powerups:[], particles:[], hazardTimer:0, nextHazard:1000,
    shield:0, jetpack:false, laser:0, invuln:0, jetTime:0,
    boss1:{active:false, hp:1, y:200, anim:0, quote:'', quoteTimer:0, dodged:0},
    rpg:{active:false, hp:100, max:100, pool:[], kindOnly:true},
    devClicks:0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas'); SV.ctx = cvs.getContext('2d');
    
    // Title Tap (Use both pointerdown and click for redundancy)
    const title = qs('#title-screen');
    const startGame = () => {
      title.classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
      if(SV.settings.music && actx.state==='suspended') actx.resume();
    };
    title.addEventListener('pointerdown', startGame);
    title.addEventListener('click', startGame);

    // Binds
    qs('#play-btn').onclick = () => startRun(SV.progress.lastCheckpoint>1 ? 'popup' : 1);
    qs('#start-at-last').onclick = () => { qs('#start-popup').classList.add('hidden'); startRun(SV.progress.lastCheckpoint||1); };
    qs('#start-beginning').onclick = () => { qs('#start-popup').classList.add('hidden'); startRun(1); };
    qs('#wardrobe-btn').onclick = () => { qs('#wardrobe-popup').classList.remove('hidden'); initWardrobe(); };
    qs('#lore-btn').onclick = () => { qs('#lore-popup').classList.remove('hidden'); requestAnimationFrame(drawLore); };
    qs('#achievements-btn').onclick = () => { buildAch(); qs('#achievements-popup').classList.remove('hidden'); };
    qs('#share-btn').onclick = () => qs('#share-popup').classList.remove('hidden');
    qs('#settings-btn').onclick = () => qs('#settings-popup').classList.remove('hidden');
    qs('#open-credits-btn').onclick = () => { qs('#settings-popup').classList.add('hidden'); qs('#credits-popup').classList.remove('hidden'); };
    
    // Pause & Audio Toggles
    qs('#pause-btn').onclick = () => { SV.paused=true; qs('#pause-menu').classList.remove('hidden'); };
    qs('#resume-btn').onclick = () => { qs('#pause-menu').classList.add('hidden'); SV.paused=false; loop(); };
    qs('#quit-btn').onclick = () => location.reload();
    
    const musBtn = qs('#pause-music-btn');
    const sfxBtn = qs('#pause-sfx-btn');
    musBtn.onclick = () => { 
      SV.settings.music = !SV.settings.music; 
      musBtn.textContent = `Music: ${SV.settings.music?'ON':'OFF'}`;
      if(SV.settings.music) Sound.startMusic(); else Sound.stopMusic();
      localStorage.setItem('sv_set', JSON.stringify(SV.settings));
    };
    sfxBtn.onclick = () => { 
      SV.settings.sfx = !SV.settings.sfx; 
      sfxBtn.textContent = `SFX: ${SV.settings.sfx?'ON':'OFF'}`;
      localStorage.setItem('sv_set', JSON.stringify(SV.settings));
    };

    // Controls
    const jump = (e) => { e.preventDefault(); doJump(); };
    qs('#jump-btn').addEventListener('pointerdown', jump);
    window.addEventListener('keydown', e => { if(e.code==='Space') jump(e); });

    // Dev Menu Trigger
    document.addEventListener('pointerdown', e => {
      if(e.clientX<60 && e.clientY<60){
        SV.devClicks++; setTimeout(()=>SV.devClicks=0, 2000);
        if(SV.devClicks>4){ if(prompt('Code?')==='2112') qs('#dev-menu').classList.remove('hidden'); SV.devClicks=0; }
      }
    });

    // Window Globals for Dev Menu HTML
    window.devJump = (lv) => { 
      qs('#dev-menu').classList.add('hidden'); 
      if(lv===10) startRpgBoss(); else startRun(lv); 
    };
    window.devPower = (type) => {
      if(type==='shield') SV.shield=3;
      if(type==='laser') SV.laser=5000;
      if(type==='jetpack') { SV.jetpack=true; SV.jetTime=8000; }
      qs('#dev-menu').classList.add('hidden');
    };

    // Closers
    qsa('.close-btn').forEach(b=>b.onclick = ()=>b.closest('.popup').classList.add('hidden'));

    requestAnimationFrame(loop);
  }

  // --- GAME ENGINE ---
  function startRun(lv){
    if(lv==='popup'){ qs('#start-popup').classList.remove('hidden'); return; }
    ['home-screen','start-popup','death-popup'].forEach(id=>qs('#'+id).classList.add('hidden'));
    qs('#game-screen').classList.remove('hidden');
    
    SV.level = lv; SV.score=0; SV.hazards=[]; SV.powerups=[]; SV.particles=[];
    SV.player.y = SV.groundY-64; SV.player.vy=0; SV.player.onGround=true;
    SV.shield=0; SV.jetpack=false; SV.laser=0;
    SV.boss1.active=false; SV.boss1.dodged=0; SV.boss1.hp=1;
    SV.rpg.active=false; qs('#rpg-overlay').classList.add('hidden');
    
    SV.running=true; SV.paused=false; SV.lastTs=performance.now();
    Sound.startMusic();
    requestAnimationFrame(loop);
  }

  function loop(ts){
    if(!SV.running || SV.paused) return;
    const dt = ts - SV.lastTs || 16; SV.lastTs = ts;
    update(dt); draw();
    requestAnimationFrame(loop);
  }

  function update(dt){
    if(SV.rpg.active) return;
    SV.levelTime += dt; SV.score += dt*0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#shield-indicator').classList.toggle('hidden', SV.shield<=0);

    // Level Progress
    if(SV.level!==5 && SV.level!==10){
      const pct = (SV.levelTime/60000)*100;
      qs('#level-progress-fill').style.width = clamp(pct,0,100)+'%';
      if(SV.levelTime > 60000){
        if(SV.level===4) { SV.progress.lastCheckpoint=5; localStorage.setItem('sv_prog', JSON.stringify(SV.progress)); }
        if(SV.level<10) { SV.level++; SV.levelTime=0; SV.hazards=[]; }
        else startRpgBoss();
      }
    } else qs('#level-progress-fill').style.width='0%';

    // Timers
    if(SV.invuln>0) SV.invuln-=dt;
    if(SV.laser>0) SV.laser-=dt;
    if(SV.jetpack) { SV.jetTime-=dt; if(SV.jetTime<=0) SV.jetpack=false; }

    // Player
    const p = SV.player;
    if(SV.jetpack) { p.vy=0; p.y=SV.groundY-100; }
    else {
      p.vy += SV.gravity*dt; p.y += p.vy*dt;
      if(p.y >= SV.groundY-p.h) { p.y=SV.groundY-p.h; p.vy=0; p.onGround=true; p.jumpsUsed=0; }
      else p.onGround=false;
    }

    // Boss / Hazards
    if(SV.level===5) updateBoss1(dt);
    else {
      SV.hazardTimer += dt;
      if(SV.hazardTimer > SV.nextHazard){
        SV.hazardTimer=0; SV.nextHazard = randRange(900, 1500);
        spawnHazard();
      }
    }
    
    updateEntities(dt); checkCollisions();
  }

  function spawnHazard(){
    const type = Math.random()>0.7 ? 'mine' : 'slime';
    const y = type==='mine' ? SV.groundY-70 : SV.groundY-36;
    SV.hazards.push({x:800, y, w:36, h:36, type});
  }

  function updateBoss1(dt){
    const b = SV.boss1;
    if(!b.active) { b.active=true; b.dodged=0; }
    b.anim += dt*0.005; b.y = 200 + Math.sin(b.anim)*40;
    
    SV.hazardTimer += dt;
    if(SV.hazardTimer > 900) {
      SV.hazardTimer=0;
      SV.hazards.push({x:800, y:pick([SV.groundY-36, SV.groundY-110, SV.groundY-180]), w:34, h:34, type:'emoji'});
    }
    b.quoteTimer += dt;
    if(b.quoteTimer > 2500) { b.quoteTimer=0; b.quote=pick(BOSS1_QUOTES); }
    
    if(b.dodged >= 40) {
      alert("BOSS DEFEATED!"); SV.progress.lastCheckpoint=6; 
      localStorage.setItem('sv_prog', JSON.stringify(SV.progress));
      startRun(6);
    }
  }

  function updateEntities(dt){
    if(Math.random()<0.002) SV.powerups.push({x:800, y:SV.groundY-90, w:30, h:30, type:pick(['shield','laser','jetpack'])});
    
    for(let i=SV.hazards.length-1; i>=0; i--){
      const h = SV.hazards[i]; h.x -= 0.34*dt;
      if(h.x < -50) { SV.hazards.splice(i,1); if(SV.level===5) SV.boss1.dodged++; }
    }
    for(let i=SV.powerups.length-1; i>=0; i--){
      const p = SV.powerups[i]; p.x -= 0.34*dt;
      if(p.x < -50) SV.powerups.splice(i,1);
    }
  }

  function doJump(){
    if(SV.player.jumpsUsed < 2){
      SV.player.vy = SV.player.jumpsUsed===0 ? -0.66 : -0.58;
      SV.player.jumpsUsed++; SV.player.onGround=false;
      Sound.play(300, 'square', 0.1);
    }
  }

  function checkCollisions(){
    const p = SV.player;
    const inv = SV.invuln>0 || SV.jetpack;
    
    // Powerups
    SV.powerups.forEach((pw,i)=>{
      if(rectHit(p.x,p.y,p.w,p.h, pw.x,pw.y,30,30)){
        SV.powerups.splice(i,1); Sound.play(600,'sine',0.1);
        if(pw.type==='shield') SV.shield=3;
        if(pw.type==='laser') SV.laser=5000;
        if(pw.type==='jetpack') { SV.jetpack=true; SV.jetTime=8000; }
      }
    });

    // Laser
    if(SV.laser>0){
      const ly = p.onGround ? p.y+6 : p.y+2;
      const lh = p.onGround ? 24 : 32;
      SV.hazards.forEach((h,i)=>{
        if(h.x<800 && h.y+h.h > ly && h.y < ly+lh){
          SV.hazards.splice(i,1); Sound.noise(0.1);
        }
      });
    }

    // Hazards
    if(!inv){
      SV.hazards.forEach((h,i)=>{
        if(rectHit(p.x+10,p.y+5,p.w-20,p.h-10, h.x,h.y,h.w,h.h)){
          if(SV.shield>0) { SV.shield--; SV.invuln=1000; SV.hazards.splice(i,1); Sound.play(150,'sawtooth',0.2); }
          else { SV.running=false; Sound.play(60,'sawtooth',0.5); qs('#death-popup').classList.remove('hidden'); }
        }
      });
    }
  }

  function rectHit(x1,y1,w1,h1, x2,y2,w2,h2){ return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1); }

  // --- DRAWING ---
  function draw(){
    const ctx = SV.ctx; ctx.clearRect(0,0,800,480);
    
    // BG
    const g = ctx.createLinearGradient(0,0,0,480);
    let c1='#060914', c2='#0b1220';
    if(SV.level===5) { c1='#2d0b35'; c2='#ff7bc5'; }
    else if(SV.level>5 && SV.level<10) { c1='#001f1f'; c2='#004444'; }
    else if(SV.level===10) { c1='#330000'; c2='#660000'; }
    g.addColorStop(0,c1); g.addColorStop(1,c2);
    ctx.fillStyle=g; ctx.fillRect(0,0,800,480);
    ctx.fillStyle='#1a2435'; ctx.fillRect(0,SV.groundY,800,480-SV.groundY);

    // Entities
    SV.hazards.forEach(h=>{
      if(h.type==='mine'){ ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(h.x+18,h.y+18,18,0,7); ctx.fill(); ctx.strokeStyle='#f00'; ctx.lineWidth=2; ctx.stroke(); }
      else if(h.type==='emoji'){ ctx.fillStyle='#ffec65'; ctx.beginPath(); ctx.arc(h.x+17,h.y+17,17,0,7); ctx.fill(); }
      else { ctx.fillStyle='#0f0'; ctx.fillRect(h.x,h.y,36,36); }
    });
    SV.powerups.forEach(p=>{
      ctx.fillStyle='#fff';
      if(p.type==='shield'){ ctx.strokeStyle='#0ff'; ctx.beginPath(); ctx.arc(p.x+15,p.y+15,12,0,7); ctx.stroke(); }
      if(p.type==='laser') ctx.fillText('⚡',p.x+5,p.y+20);
      if(p.type==='jetpack') ctx.fillText('🚀',p.x+5,p.y+20);
    });

    // Boss 1
    if(SV.level===5){
      ctx.fillStyle='#5e6c8c'; ctx.fillRect(700, SV.boss1.y, 30, 40);
      ctx.fillStyle='#ff91e0'; ctx.fillRect(695, SV.boss1.y-10, 40, 15);
      if(SV.boss1.quote) { ctx.fillStyle='#fff'; ctx.font='10px monospace'; ctx.fillText(SV.boss1.quote, 640, SV.boss1.y-20); }
    }

    // Player
    drawSprite(ctx, SV.player.x, SV.player.y);

    // Laser
    if(SV.laser>0){
      ctx.fillStyle=`rgba(100,255,255,${Math.random()})`;
      const y = SV.player.onGround ? SV.player.y+20 : SV.player.y+2;
      ctx.fillRect(SV.player.x+42, y, 800, SV.groundY-y);
    }
  }

  function drawSprite(c, x, y){
    const s = SV.settings;
    c.fillStyle = s.shirt==='red'?'#ff5a5a':s.shirt; c.fillRect(x,y,42,64);
    c.fillStyle = s.skinTone; c.fillRect(x+8,y-16,26,16);
    c.fillStyle = '#70421b';
    if(s.hairStyle==='short') c.fillRect(x+8,y-20,26,8);
    if(s.hairStyle==='long') { c.fillRect(x+8,y-20,26,10); c.fillRect(x+4,y-10,6,24); c.fillRect(x+32,y-10,6,24); }
    c.fillStyle=s.pants; c.fillRect(x+4,y+36,12,28); c.fillRect(x+26,y+36,12,28);
  }

  // --- RPG BOSS ---
  function startRpgBoss(){
    SV.running=false; SV.rpg.active=true;
    qs('#rpg-overlay').classList.remove('hidden');
    SV.rpg.hp=100; renderRpgBtns();
  }
  function renderRpgBtns(){
    const btns = qsa('.insult-btn');
    const opts = [];
    while(opts.length<4) opts.push(pick(BOSS2_ATTACKS));
    btns.forEach((b,i)=>{
      b.textContent=opts[i].text;
      b.onclick=()=>{
        SV.rpg.hp -= opts[i].dmg;
        qs('#boss-hp-bar').style.width = SV.rpg.hp+'%';
        if(SV.rpg.hp<=0){ alert('YOU WON!'); SV.progress.endlessUnlocked=true; localStorage.setItem('sv_prog', JSON.stringify(SV.progress)); location.reload(); }
        renderRpgBtns();
      };
    });
  }

  // --- WARDROBE LOGIC ---
  function initWardrobe(){
    const prev = qs('#player-preview'); prev.innerHTML='';
    const cvs = document.createElement('canvas'); cvs.width=300; cvs.height=180;
    prev.appendChild(cvs);
    const ctx = cvs.getContext('2d');
    const draw = () => { ctx.clearRect(0,0,300,180); drawSprite(ctx, 130, 80); };
    draw();

    // Bind Tabs
    qsa('.wardrobe-tab').forEach(t => t.onclick = () => {
      qsa('.wardrobe-tab').forEach(x=>x.classList.remove('active')); t.classList.add('active');
      qsa('.wardrobe-tab-content').forEach(x=>x.classList.remove('active'));
      qs('#'+t.dataset.tab+'-tab').classList.add('active');
    });

    // Generate Colors
    const shirts = qs('#shirt-options');
    // Note: Colors are static in HTML, bind here:
    qsa('.color-swatch', shirts).forEach(b => b.onclick = () => { SV.settings.shirt=b.dataset.color; saveSet(); draw(); });
    
    // Pants
    const pRow = qs('#pants-row'); pRow.innerHTML='';
    PANTS.forEach(c => {
      const b=document.createElement('button'); b.className='color-swatch'; b.style.background=c;
      b.onclick=()=>{ SV.settings.pants=c; saveSet(); draw(); }; pRow.appendChild(b);
    });
    // Skin
    const sRow = qs('#skin-tone-row'); sRow.innerHTML='';
    SKIN_TONES.forEach(c => {
      const b=document.createElement('button'); b.className='color-swatch'; b.style.background=c;
      b.onclick=()=>{ SV.settings.skinTone=c; saveSet(); draw(); }; sRow.appendChild(b);
    });
    // Hair
    const hRow = qs('#hairstyle-options'); hRow.innerHTML='';
    (HAIR_STYLES[SV.settings.gender]||HAIR_STYLES.m).forEach(h => {
      const b=document.createElement('button'); b.className='item-swatch'; b.textContent=h;
      b.onclick=()=>{ SV.settings.hairStyle=h; saveSet(); draw(); }; hRow.appendChild(b);
    });
    // Gender
    qsa('.gender-btn').forEach(b => b.onclick = () => { 
      SV.settings.gender=b.dataset.gender; saveSet(); initWardrobe(); 
    });
  }
  
  function saveSet(){ localStorage.setItem('sv_set', JSON.stringify(SV.settings)); }
  function buildAch(){ /* Implementation for achievement grid */ }
  function drawLore(){ /* Implementation for lore canvas */ }

  document.addEventListener('DOMContentLoaded', init);
})();
