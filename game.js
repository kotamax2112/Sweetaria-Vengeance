/* =========================================================
   SWEETARIA: VENGEANCE — STABLE 3.1 (DEV + CLUES + JETPACK)
   ========================================================= */
(() => {
  'use strict';

  // --- SHORTCUTS ---
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const clamp = (v,l,h) => Math.max(l, Math.min(h,v));
  const randRange = (a,b) => a + Math.random()*(b-a);
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const $ = id => document.getElementById(id);

  // --- AUDIO ---
  let actx, musInt;
  const Sound = {
    init(){
      if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
      if(actx.state === 'suspended') actx.resume();
    },
    play(freq,type,vol=0.1,dur=0.3){
      if(!SV.settings.sfx || !actx) return;
      try{
        const o=actx.createOscillator(), g=actx.createGain();
        o.type=type; o.frequency.value=freq;
        g.gain.setValueAtTime(vol, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime+dur);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime+dur);
      }catch(e){ console.error("Audio error:",e); }
    },
    startMusic(){
      if(musInt) clearInterval(musInt);
      if(!SV.settings.music || !actx) return;
      let t=0;
      musInt = setInterval(()=>{
        if(SV.paused) return;
        const f=[110,110,130,110,165,146,130,110][t%8];
        Sound.play(f,'triangle',0.05,0.2);
        t++;
      },250);
    },
    stopMusic(){
      if(musInt) clearInterval(musInt);
    }
  };

  // --- STORAGE ---
  const Store = {
    get(k,v){ try{ return JSON.parse(localStorage.getItem(k)) ?? v; }catch{ return v; } },
    set(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  };

  // --- GLOBAL GAME STATE ---
  const SV = {
    progress: Store.get('sv_prog', {
      lastCheckpoint: 1,
      allTimeScore: 0,
      ach: {},
      endlessUnlocked: false,
      cluesUnlocked: false
    }),
    settings: Store.get('sv_set', {
      music:true,
      sfx:true,
      playerName:'Hero',
      gender:'m',
      hairStyle:'short',
      skinTone:'#ffd5a3',
      shirt:'#4ea8ff',
      pants:'#2d3549',
      item:null,
      skin:null
    }),
    clues: Store.get('sv_clues', []),

    running:false,
    paused:false,
    level:1,
    score:0,
    lastTs:0,
    levelTime:0,

    player:{ x:120, y:296, w:42, h:64, vy:0, onGround:true, jumpsUsed:0 },
    groundY:360,
    gravity:0.0018,
    scrollSpd:0.34,

    hazards:[],
    powerups:[],
    particles:[],
    hazardTimer:0,
    nextHazard:1000,

    shield:0,
    jetpack:false,
    jetpackTime:0,
    tesla:0,
    invuln:0,

    boss1:{ active:false, hp:1, y:200, anim:0, quote:'', quoteTimer:0, dodged:0 },
    rpg:{ active:false, hp:100, max:100 },

    devClicks:0
  };

  // --- DEV SYSTEM ---
  const Dev = {
    invincible:false,
    slowmo:false,
    warpLevel(l){ startRun(l); },
    clearHazards(){ SV.hazards=[]; },
    grantShield(){ SV.shield=3; },
    grantTesla(){ SV.tesla=5000; },
    grantJet(){ SV.jetpack=true; SV.jetpackTime=8000; },
    unlockEndless(){ SV.progress.endlessUnlocked=true; Store.set('sv_prog',SV.progress); alert("Endless Unlocked."); },
    toggleInvincible(){ this.invincible=!this.invincible; alert("Invincible: "+(this.invincible?"ON":"OFF")); },
    toggleSlowmo(){ this.slowmo=!this.slowmo; alert("SlowMo: "+(this.slowmo?"ON":"OFF")); },
    debugState(){ console.log(JSON.parse(JSON.stringify(SV))); alert("State logged."); },

    addClue(){
      const t = prompt("Enter new clue:");
      if(!t) return;
      SV.clues.push(t);
      Store.set('sv_clues', SV.clues);
      SV.progress.cluesUnlocked = true;
      Store.set('sv_prog',SV.progress);
      alert("Clue added & Clue Menu enabled.");
    }
  };

  // --- CLUES MENU HELPERS ---
  function ensureCluesPopup(){
    if(qs('#clues-popup')) return;
    const wrap = document.createElement('div');
    wrap.id='clues-popup';
    wrap.className='popup hidden';
    wrap.innerHTML = `
      <div class="panel">
        <h3>CLUES</h3>
        <div id="clues-list" class="scroll-col" style="font-size:0.8rem;text-align:left;"></div>
        <button class="btn secondary" id="clues-close-btn" style="margin-top:10px;">Close</button>
      </div>`;
    document.body.appendChild(wrap);
    qs('#clues-close-btn').onclick = ()=> closePopup('clues-popup');
  }

  function showClues(){
    ensureCluesPopup();
    const box = qs('#clues-list');
    box.innerHTML = "";
    if(!SV.clues.length){
      box.innerHTML = "<i>No clues yet.</i>";
    } else {
      SV.clues.forEach((c,i)=>{
        const p=document.createElement('p');
        p.textContent = `${i+1}. ${c}`;
        box.appendChild(p);
      });
    }
    openPopup('clues-popup');
  }

  // --- DEV MENU INJECTION ---
  function initDevMenu(){
    const panel = qs('#dev-menu .panel');
    if(!panel || panel.dataset.devInit) return;
    panel.dataset.devInit="1";

    const row=document.createElement('div');
    row.className='row';
    row.style.marginTop='10px';

    const mk=(label,tool)=>{
      const b=document.createElement('button');
      b.className='btn small';
      b.textContent=label;
      b.dataset.devtool=tool;
      row.appendChild(b);
    };

    mk("Invincible","inv");
    mk("SlowMo","slow");
    mk("Clear Hazards","clear");
    mk("Unlock Endless","endless");
    mk("Debug State","debug");
    mk("Clues","clues");

    const closeBtn = panel.querySelector('.close-btn');
    panel.insertBefore(row, closeBtn);

    panel.onclick = e=>{
      const b=e.target.closest('button');
      if(!b) return;
      const t=b.dataset.devtool;
      if(!t) return;
      if(t==='inv') Dev.toggleInvincible();
      if(t==='slow') Dev.toggleSlowmo();
      if(t==='clear') Dev.clearHazards();
      if(t==='endless') Dev.unlockEndless();
      if(t==='debug') Dev.debugState();
      if(t==='clues') Dev.addClue();
    };
  }

  // --- POPUP HELPERS ---
  function openPopup(id){ qs('#'+id).classList.remove('hidden'); }
  function closePopup(id){ qs('#'+id).classList.add('hidden'); }

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    const canvas = qs('#game-canvas');
    SV.ctx = canvas.getContext('2d');

    // Powerup chip styling
    const pInd = qs('#powerup-indicator');
    if(pInd){
      pInd.style.display='inline-block';
      pInd.style.marginTop='2px';
      pInd.style.marginLeft='6px';
      pInd.style.padding='2px 8px';
      pInd.style.borderRadius='12px';
      pInd.style.background='rgba(10,15,30,0.85)';
      pInd.style.border='1px solid #4e9cff';
      pInd.style.fontSize='0.65rem';
    }

    // Audio unlock
    const unlock=()=>{ Sound.init(); if(SV.settings.music) Sound.startMusic(); document.removeEventListener('pointerdown',unlock); };
    document.addEventListener('pointerdown',unlock);

    // Title → Home
    qs('#title-screen').onclick = ()=>{
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
    };

    // Home buttons
    qs('#play-btn').onclick = ()=> startRun( SV.progress.lastCheckpoint > 1 ? 'popup' : 1 );
    qs('#endless-btn').onclick = ()=>{
      if(SV.progress.endlessUnlocked) startRun(99);
      else alert("You must beat Story Mode to unlock Endless.");
    };
    qs('#wardrobe-btn').onclick = ()=> openPopup('wardrobe-popup');
    qs('#lore-btn').onclick = ()=> openPopup('lore-popup');
    qs('#achievements-btn').onclick = ()=> openPopup('achievements-popup');
    qs('#share-btn').onclick = ()=> openPopup('share-popup');
    qs('#settings-btn').onclick = ()=> openPopup('settings-popup');
    qs('#open-credits-btn').onclick = ()=>{ closePopup('settings-popup'); openPopup('credits-popup'); };
    qs('#return-title-btn').onclick = ()=> location.reload();

    // Start Popup
    qs('#start-at-last').onclick = ()=>{ closePopup('start-popup'); startRun(SV.progress.lastCheckpoint||1); };
    qs('#start-beginning').onclick = ()=>{ closePopup('start-popup'); startRun(1); };

    // Settings toggles
    const updateSet=()=>{
      ['#music-toggle','#pause-music-btn'].forEach(id=>{
        const el=qs(id); if(el) el.textContent="Music: "+(SV.settings.music?"ON":"OFF");
      });
      ['#sfx-toggle','#pause-sfx-btn'].forEach(id=>{
        const el=qs(id); if(el) el.textContent="SFX: "+(SV.settings.sfx?"ON":"OFF");
      });
      Store.set('sv_set',SV.settings);
    };
    const tMus=()=>{ SV.settings.music=!SV.settings.music; SV.settings.music?Sound.startMusic():Sound.stopMusic(); updateSet(); };
    const tSfx=()=>{ SV.settings.sfx=!SV.settings.sfx; updateSet(); };

    qs('#music-toggle').onclick=tMus;
    qs('#pause-music-btn').onclick=tMus;
    qs('#sfx-toggle').onclick=tSfx;
    qs('#pause-sfx-btn').onclick=tSfx;

    qs('#reset-progress-btn').onclick=()=>{
      if(confirm("Reset ALL data?")){
        localStorage.clear();
        location.reload();
      }
    };

    // Pause menu
    qs('#pause-btn').onclick = ()=>{
      SV.paused=true;
      openPopup('pause-menu');
    };
    qs('#resume-btn').onclick = ()=>{
      closePopup('pause-menu');
      SV.paused=false;
      SV.lastTs=performance.now();
      loop();
    };
    qs('#quit-btn').onclick = ()=> location.reload();

    // Death
    qs('#death-restart-checkpoint').onclick = ()=>{
      closePopup('death-popup');
      startRun(SV.progress.lastCheckpoint||1);
    };
    qs('#death-exit-main').onclick = ()=> location.reload();

    // Jump
    const jump=(e)=>{
      if(!SV.running || SV.paused) return;
      if(e.type==='keydown' && e.code!=='Space') return;
      e.preventDefault();
      const p=SV.player;
      if(p.jumpsUsed<2){
        p.vy = p.jumpsUsed===0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround=false;
        Sound.play(300,'square',0.1);
      }
    };
    qs('#jump-btn').onpointerdown=jump;
    window.onkeydown=jump;
    qs('#game-canvas').onpointerdown=jump;

    // Clues hotkey
    window.addEventListener('keydown', e=>{
      if(e.code==='KeyC' && SV.progress.cluesUnlocked && !SV.paused){
        e.preventDefault();
        showClues();
      }
    });

    // Dev trigger → 5 taps → code → dev menu
    qs('#dev-trigger-zone').addEventListener('pointerdown',()=>{
      SV.devClicks++;
      setTimeout(()=>SV.devClicks=0,2000);
      if(SV.devClicks>=5){
        if(prompt("Code?")==='2112'){
          openPopup('dev-menu');
          initDevMenu();
        }
        SV.devClicks=0;
      }
    });

    // Dev menu: Level warp
    qsa('#dev-menu .dev-btn').forEach(b=>{
      b.onclick=()=>{
        closePopup('dev-menu');
        SV.running=false;
        Dev.warpLevel(parseInt(b.dataset.level,10));
      };
    });

    // Dev menu: powers
    qsa('#dev-menu button[data-power]').forEach(b=>{
      b.onclick=()=>{
        if(b.dataset.power==='shield') Dev.grantShield();
        if(b.dataset.power==='tesla') Dev.grantTesla();
        if(b.dataset.power==='jetpack') Dev.grantJet();
        closePopup('dev-menu');
      };
    });

    // Close buttons
    qsa('.close-btn').forEach(b=> b.onclick=()=> b.closest('.popup').classList.add('hidden'));

    updateSet();
  }

  // --- START RUN ---
  function startRun(lv){
    if(lv==='popup'){ openPopup('start-popup'); return; }

    ['home-screen','start-popup','death-popup','rpg-overlay'].forEach(id=>{
      const el=qs('#'+id);
      if(el) el.classList.add('hidden');
    });

    qs('#game-screen').classList.remove('hidden');

    SV.level = typeof lv==='number' ? lv : 1;
    SV.score=0;
    SV.levelTime=0;
    SV.hazards=[];
    SV.powerups=[];
    SV.particles=[];
    SV.player.x=120;
    SV.player.y=296;
    SV.player.vy=0;
    SV.player.onGround=true;
    SV.player.jumpsUsed=0;
    SV.shield=0;
    SV.jetpack=false;
    SV.jetpackTime=0;
    SV.tesla=0;
    SV.boss1.active=false;
    SV.boss1.dodged=0;
    SV.rpg.active=false;
    SV.rpg.hp=SV.rpg.max;

    const nameEl = qs('#player-name-display');
    if(nameEl) nameEl.textContent = SV.settings.playerName || 'Hero';

    const lvlEl = qs('#level-display');
    if(lvlEl) lvlEl.textContent = "Lv "+SV.level;

    SV.running=true;
    SV.paused=false;
    SV.lastTs=performance.now();

    loop();
  }

  // --- GAME LOOP ---
  function loop(ts){
    if(!SV.running) return;
    if(SV.paused){ requestAnimationFrame(loop); return; }

    const dt = ts - SV.lastTs || 16;
    SV.lastTs = ts;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // --- UPDATE ---
  function update(dt){
    if(SV.rpg.active) return;

    if(Dev.slowmo) dt*=0.4;

    // 1 minute per level
    SV.levelTime+=dt;
    if(SV.levelTime>=60000){
      SV.level++;
      SV.levelTime=0;
      const lvlEl=qs('#level-display');
      if(lvlEl) lvlEl.textContent="Lv "+SV.level;
    }

    // Score
    SV.score += dt*0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore||0);

    if(SV.score > (SV.progress.allTimeScore||0)){
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_prog', SV.progress);
    }

    // Powerup UI
    const pInd = qs('#powerup-indicator');
    if(SV.tesla>0){
      SV.tesla-=dt;
      if(pInd){ pInd.textContent="⚡ TESLA"; pInd.classList.remove('hidden'); }
    }
    else if(SV.jetpack){
      SV.jetpackTime-=dt;
      if(SV.jetpackTime<=0) SV.jetpack=false;
      if(pInd){ pInd.textContent="🚀 JETPACK"; pInd.classList.remove('hidden'); }
    }
    else if(SV.shield>0){
      if(pInd){ pInd.textContent="🛡️ SHIELD ×"+SV.shield; pInd.classList.remove('hidden'); }
    }
    else if(pInd){
      pInd.classList.add('hidden');
    }

    // Tesla auto-zap
    if(SV.tesla>0){
      const t = SV.hazards.find(h => h.x>SV.player.x && h.x<SV.player.x+400);
      if(t){
        SV.hazards = SV.hazards.filter(h=>h!==t);
        Sound.play(600,'sawtooth',0.1);
      }
    }

    const p = SV.player;

    // Jetpack flight
    if(SV.jetpack){
      p.vy=0;
      p.y = 160 + Math.sin(Date.now()*0.005)*5;
      p.onGround=false;
      p.jumpsUsed=0;
    } else {
      p.vy += SV.gravity*dt;
      p.y += p.vy*dt;
      if(p.y>=296){
        p.y=296;
        p.vy=0;
        p.onGround=true;
        p.jumpsUsed=0;
      }
    }

    // Spawn hazards
    if(Math.random()<0.015){
      const ty = Math.random()>0.7 ? 'mine' : 'slime';
      SV.hazards.push({ x:850, y:ty==='mine'?230:296, w:36, h:36, type:ty });
    }

    // Spawn powerups (ground + sky)
    if(Math.random()<0.005){
      const sky = Math.random()<0.5;
      const y = sky ? randRange(140,210) : 260;
      SV.powerups.push({ x:850, y, w:40, h:40, type:pick(['shield','tesla','jetpack']) });
    }

    // Scroll
    SV.hazards.forEach(h=> h.x -= SV.scrollSpd*dt);
    SV.powerups.forEach(pu=> pu.x -= SV.scrollSpd*dt);

    // Collisions
    if(!SV.jetpack && !Dev.invincible){
      SV.hazards.forEach((h,i)=>{
        if(rectHit(p.x,p.y,p.w,p.h, h.x,h.y,h.w,h.h)){
          if(SV.shield>0){
            SV.shield--;
            SV.hazards.splice(i,1);
          } else {
            SV.running=false;
            return onPlayerDeath();
          }
        }
      });
    }

    SV.powerups.forEach((pw,i)=>{
      if(rectHit(p.x,p.y,p.w,p.h, pw.x,pw.y,40,40)){
        SV.powerups.splice(i,1);
        Sound.play(600,'sine');
        if(pw.type==='shield') SV.shield=3;
        if(pw.type==='tesla') SV.tesla=5000;
        if(pw.type==='jetpack'){ SV.jetpack=true; SV.jetpackTime=8000; }
      }
    });
  }

  function onPlayerDeath(){
    Sound.play(60,'sawtooth',0.5);
    openPopup('death-popup');
  }

  function rectHit(x1,y1,w1,h1, x2,y2,w2,h2){
    return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1);
  }

  // --- DRAW ---
  function draw(){
    const ctx=SV.ctx;
    ctx.clearRect(0,0,800,480);

    // BG
    const g=ctx.createLinearGradient(0,0,0,480);
    g.addColorStop(0,'#060914');
    g.addColorStop(0.5,'#081021');
    g.addColorStop(1,'#05060b');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,800,480);

    // Floor
    ctx.fillStyle='#1a2435';
    ctx.fillRect(0,360,800,120);

    // Hazards
    SV.hazards.forEach(h=>{
      if(h.type==='mine'){
        ctx.fillStyle='#555';
        ctx.beginPath();
        ctx.arc(h.x+18,h.y+18,18,0,7);
        ctx.fill();
        ctx.strokeStyle='#f00'; ctx.lineWidth=3;
        for(let i=0;i<8;i++){
          const a=i*(Math.PI/4)+Date.now()*0.001;
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
        ctx.fillRect(h.x+8,h.y+10,6,6);
        ctx.fillRect(h.x+22,h.y+10,6,6);
      }
    });

    // Powerups
    SV.powerups.forEach(p=>{
      ctx.shadowBlur=15; ctx.shadowColor='#fff';
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
      if(p.type==='tesla') ctx.fillText('⚡',cx,cy);
      if(p.type==='jetpack') ctx.fillText('🚀',cx,cy);
    });

    drawPlayer(ctx, SV.player.x, SV.player.y);
  }

  // --- PLAYER DRAW ---
  const HAIRS = {
    m:['short','side','spiky','mohawk','long'],
    f:['bob','long','ponytail','side'],
    o:['short','bob','side','spiky']
  };

  const ITEMS=['sword','scepter','mallet','cleaver'];

  const SKINS=[];  // (Your skin system remains intact; untouched)

  function drawPlayer(ctx,x,y){
    const s=SV.settings;

    // Body
    ctx.fillStyle=s.shirt;
    ctx.fillRect(x,y,42,64);

    // Head
    ctx.fillStyle=s.skinTone;
    ctx.fillRect(x+8,y-16,26,16);

    // Pants
    ctx.fillStyle=s.pants;
    ctx.fillRect(x+4,y+36,12,28);
    ctx.fillRect(x+26,y+36,12,28);

    // Hair
    ctx.fillStyle='#70421b';
    const wind = Math.sin(Date.now()*0.005)*2;

    if(s.hairStyle==='long'){
      ctx.fillRect(x+8,y-20,26,10);
      ctx.fillRect(x+4+wind,y-10,6,24);
    }
    else if(s.hairStyle==='ponytail'){
      ctx.fillRect(x+8,y-20,24,8);
      ctx.fillRect(x+26+wind,y-12,6,16);
    }
    else if(s.hairStyle==='short'){
      ctx.fillRect(x+8,y-20,26,8);
    }
    else if(s.hairStyle==='bob'){
      ctx.fillRect(x+6,y-20,28,12);
    }
    else if(s.hairStyle==='side'){
      ctx.fillRect(x+6,y-20,28,10);
      ctx.fillRect(x+30,y-12,4,10);
    }
    else if(s.hairStyle==='spiky'){
      for(let i=0;i<5;i++)
        ctx.fillRect(x+10+i*5, y-24, 4,10);
    }
    else if(s.hairStyle==='mohawk'){
      ctx.fillRect(x+18,y-24,6,12);
    }

    // Item
    ctx.fillStyle='#999';
    if(s.item==='sword'){
      ctx.fillRect(x+45,y+20,4,8);
      ctx.fillRect(x+35,y+26,24,4);
    }
    if(s.item==='scepter'){
      ctx.fillRect(x+45,y+20,4,30);
      ctx.fillStyle='#ff0';
      ctx.beginPath();
      ctx.arc(x+47,y+15,6,0,7);
      ctx.fill();
    }
    if(s.item==='mallet'){
      ctx.fillRect(x+45,y+20,4,20);
      ctx.fillStyle='#8b4513';
      ctx.fillRect(x+38,y,20,15);
    }
    if(s.item==='cleaver'){
      ctx.fillRect(x+45,y+20,4,15);
      ctx.fillRect(x+38,y+15,20,10);
    }
  }

})();
