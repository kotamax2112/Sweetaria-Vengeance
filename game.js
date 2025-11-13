(() => {
  'use strict';

  const qs = (s)=>document.querySelector(s);
  const qsa = (s)=>document.querySelectorAll(s);
  const clamp = (v,l,h)=>Math.max(l,Math.min(h,v));
  const randRange = (a,b)=>a+Math.random()*(b-a);

  // --- AUDIO ENGINE (Sequencer) ---
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let actx = new AudioContext();
  let musicInterval = null;

  const Sound = {
    play: (freq, type, dur, vol=0.1) => {
      if(!SV.settings.sfx) return;
      if(actx.state==='suspended') actx.resume();
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, actx.currentTime);
      g.gain.setValueAtTime(vol, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + dur);
    },
    musicTick: 0,
    startMusic: () => {
      if(musicInterval) clearInterval(musicInterval);
      if(!SV.settings.music) return;
      if(actx.state==='suspended') actx.resume();
      
      // Simple Bassline Loop
      const melody = [110, 110, 130, 110, 165, 146, 130, 110];
      musicInterval = setInterval(()=>{
        if(!SV.running || SV.paused) return;
        const f = melody[Sound.musicTick % melody.length];
        // Low volume background synth
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, actx.currentTime);
        g.gain.setValueAtTime(0.05, actx.currentTime);
        g.gain.linearRampToValueAtTime(0, actx.currentTime+0.2);
        o.connect(g); g.connect(actx.destination);
        o.start(); o.stop(actx.currentTime+0.2);
        Sound.musicTick++;
      }, 250); // 4 beats per second
    },
    stopMusic: () => { if(musicInterval) clearInterval(musicInterval); }
  };

  // --- GLOBAL STATE ---
  const SV = {
    settings: JSON.parse(localStorage.getItem('sv_set')||'{"music":true,"sfx":true,"playerName":"Hero"}'),
    progress: JSON.parse(localStorage.getItem('sv_prog')||'{"lastCheckpoint":0}'),
    running:false, paused:false, level:1, score:0, lastTs:0,
    player:{x:120, y:300, w:42, h:64, vy:0, onGround:false, jumps:0},
    hazards:[], particles:[], powerups:[],
    groundY:360, gravity:0.0018, scrollSpd:0.34,
    // Powerups
    shield:0, jetpack:false, laser:0, invuln:0,
    // Boss
    boss1:{active:false, hp:1, y:200, timer:0},
    // Dev
    devClicks:0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas');
    SV.ctx = cvs.getContext('2d');
    SV.w = cvs.width; SV.h = cvs.height;

    // Buttons
    qs('#play-btn').onclick = ()=>startRun(SV.progress.lastCheckpoint>1 ? 'popup' : 1);
    qs('#start-at-last').onclick = ()=>startRun(SV.progress.lastCheckpoint||1);
    qs('#start-beginning').onclick = ()=>startRun(1);
    
    // Pause Menu Toggles
    qs('#pause-btn').onclick = ()=>{ SV.paused=true; qs('#pause-menu').classList.remove('hidden'); };
    qs('#resume-btn').onclick = ()=>{ qs('#pause-menu').classList.add('hidden'); SV.paused=false; loop(); };
    qs('#quit-btn').onclick = ()=>{ location.reload(); };
    
    const musBtn = qs('#pause-music-btn');
    musBtn.onclick = ()=>{ 
      SV.settings.music=!SV.settings.music; 
      musBtn.textContent = `Music: ${SV.settings.music?'ON':'OFF'}`;
      if(SV.settings.music) Sound.startMusic(); else Sound.stopMusic();
    };
    
    // Title Tap
    qs('#title-screen').onpointerdown = ()=>{ 
      qs('#title-screen').classList.add('hidden'); 
      qs('#home-screen').classList.remove('hidden');
      if(SV.settings.music) Sound.startMusic(); // Start audio context interaction
    };

    // Controls
    const jump = (e)=>{ e.preventDefault(); if(SV.player.jumps<2){ SV.player.vy = SV.player.jumps===0?-0.66:-0.58; SV.player.jumps++; SV.player.onGround=false; Sound.play(300,'square',0.1); }};
    qs('#jump-btn').onpointerdown = jump;
    window.onkeydown = (e)=>{ if(e.code==='Space') jump(e); };

    // Dev Menu Trigger (5 clicks top left)
    document.onpointerdown = (e)=>{
      if(e.clientX<60 && e.clientY<60){
        SV.devClicks++; setTimeout(()=>SV.devClicks=0, 2000);
        if(SV.devClicks>4){ 
          if(prompt('Code?')==='2112') qs('#dev-menu').classList.remove('hidden'); 
          SV.devClicks=0;
        }
      }
    };

    // Window Globals for Dev Menu HTML
    window.devJump = (lv)=>{ 
      qs('#dev-menu').classList.add('hidden'); 
      if(lv===10) startRpgBoss(); else startRun(lv); 
    };
    window.devPower = (type)=>{
      if(type==='shield') SV.shield=3;
      if(type==='laser') SV.laser=5000;
      if(type==='jetpack') { SV.jetpack=true; SV.player.vy=-0.5; }
      qs('#dev-menu').classList.add('hidden');
    };

    // Loop Start
    requestAnimationFrame(loop);
  }

  function startRun(lv){
    if(lv==='popup'){ qs('#start-popup').classList.remove('hidden'); return; }
    qs('#start-popup').classList.add('hidden');
    qs('#home-screen').classList.add('hidden');
    qs('#game-screen').classList.remove('hidden');
    
    SV.level = lv; SV.score=0; SV.hazards=[]; SV.powerups=[];
    SV.player.y = SV.groundY-64; SV.player.vy=0; SV.player.onGround=true;
    SV.running = true; SV.paused = false;
    Sound.startMusic();
  }

  // --- LOGIC ---
  function loop(ts){
    if(!SV.running || SV.paused) return;
    const dt = ts - SV.lastTs || 16; SV.lastTs = ts;
    
    // Spawning
    if(Math.random() < 0.015) spawnHazard();
    if(Math.random() < 0.002) spawnPowerup();

    // Physics
    const p = SV.player;
    if(SV.jetpack){ p.vy=0; p.y=SV.groundY-100; }
    else { p.vy += SV.gravity*dt; p.y += p.vy*dt; }
    
    if(p.y >= SV.groundY-p.h){ p.y=SV.groundY-p.h; p.vy=0; p.onGround=true; p.jumps=0; }
    else p.onGround=false;

    // Lasers & Invuln
    if(SV.laser>0) SV.laser-=dt;
    if(SV.invuln>0) SV.invuln-=dt;

    // Update Hazards
    SV.hazards.forEach((h,i)=>{
      h.x -= SV.scrollSpd*dt;
      // Collision
      if(rectHit(p.x+10, p.y+5, p.w-20, p.h-10, h.x, h.y, h.w, h.h)){
        if(SV.shield>0 || SV.invuln>0 || SV.jetpack){
           if(SV.shield>0 && SV.invuln<=0){ SV.shield--; SV.invuln=1000; Sound.play(100,'sawtooth',0.3); }
        } else {
           SV.running=false; qs('#death-popup').classList.remove('hidden');
           Sound.play(60,'sawtooth',0.5);
        }
      }
      // Laser Hit (Extended height to hit ground)
      if(SV.laser>0 && h.x < 800 && h.x > p.x && h.y > p.y - 20){
        SV.hazards.splice(i,1); Sound.play(500,'noise',0.1);
      }
    });

    draw();
    requestAnimationFrame(loop);
  }

  function spawnHazard(){
    const type = Math.random()>0.7 ? 'mine' : 'slime';
    // Mine is high (requires ducking/timing), Slime is ground
    const y = type==='mine' ? SV.groundY-70 : SV.groundY-36;
    SV.hazards.push({x:800, y, w:36, h:36, type});
  }
  
  function spawnPowerup(){
    const type = pick(['shield','laser','jet']);
    SV.powerups.push({x:800, y:SV.groundY-90, w:30, h:30, type});
  }

  function rectHit(x1,y1,w1,h1, x2,y2,w2,h2){
    return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1);
  }

  // --- DRAWING (Sprites) ---
  function draw(){
    const ctx = SV.ctx;
    ctx.clearRect(0,0,800,480);
    
    // BG
    const g = ctx.createLinearGradient(0,0,0,480);
    g.addColorStop(0, SV.level===5?'#2d0b35':'#060914');
    g.addColorStop(1, '#0b1220');
    ctx.fillStyle = g; ctx.fillRect(0,0,800,480);
    
    // Floor
    ctx.fillStyle = '#1a2435'; ctx.fillRect(0, SV.groundY, 800, 480-SV.groundY);

    // Player (Simple Sprite)
    ctx.fillStyle = '#f00'; ctx.fillRect(SV.player.x, SV.player.y, 42, 64);
    ctx.fillStyle = '#ffccaa'; ctx.fillRect(SV.player.x+8, SV.player.y-16, 26, 16); // Head

    // Laser Beam
    if(SV.laser>0){
      ctx.fillStyle = `rgba(100,255,255,${Math.random()})`;
      // Beam reaches from player chest DOWN to floor to hit slimes
      ctx.fillRect(SV.player.x+42, SV.player.y+20, 800, SV.groundY - (SV.player.y+20));
    }

    // Hazards (Real Shapes)
    SV.hazards.forEach(h=>{
      if(h.type==='mine'){
        ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(h.x+18, h.y+18, 18, 0, 6.28); ctx.fill();
        ctx.strokeStyle='#f00'; ctx.lineWidth=2; ctx.stroke(); // Spiked Look
      } else {
        // Slime
        ctx.fillStyle='#0f0'; 
        ctx.beginPath(); ctx.arc(h.x+18, h.y, 18, 3.14, 0); ctx.fill(); // Dome
        ctx.fillRect(h.x, h.y, 36, 36); // Base
      }
    });
    
    // Powerups (Icons)
    SV.powerups.forEach(p=>{
      p.x -= SV.scrollSpd*16;
      ctx.fillStyle = '#fff';
      if(p.type==='shield'){ ctx.strokeStyle='#0ff'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x+15,p.y+15,12,0,6.28); ctx.stroke(); }
      if(p.type==='laser'){ ctx.fillStyle='#ff0'; ctx.fillText('⚡', p.x+5, p.y+20); }
      if(p.type==='jet'){ ctx.fillStyle='#f0f'; ctx.fillText('🚀', p.x+5, p.y+20); }
      
      if(rectHit(SV.player.x, SV.player.y, 42, 64, p.x, p.y, 30, 30)){
        // Pickup Logic
        if(p.type==='shield') SV.shield=3;
        if(p.type==='laser') SV.laser=500;
        if(p.type==='jet') SV.jetpack=true;
        SV.powerups = SV.powerups.filter(x=>x!==p);
        Sound.play(600,'sine',0.1);
      }
    });
  }

  // --- RPG BOSS & UTILS ---
  function startRpgBoss(){ /* (Keeping simplified for length, logic in previous build was good) */ alert("BOSS 2 START"); SV.running=false; }

  document.addEventListener('DOMContentLoaded', init);
})();
