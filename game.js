/* =========================================================
   SWEETARIA: VENGEANCE — BETA 2.0 (Full Restoration - Corrected)
   - Fixed: ALL syntax errors
   - Fixed: closePopup()
   - Fixed: clicking menus works again
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

  // --- AUDIO ---
  let actx, musInt;
  const Sound = {
    init: () => {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (!actx) return;
      if (actx.state === 'suspended') actx.resume();
    },
    play: (freq, type, vol = 0.1, dur = 0.3) => {
      if (!SV.settings.sfx || !actx) return;
      try {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = type; 
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
        o.connect(g); 
        g.connect(actx.destination);
        o.start(); 
        o.stop(actx.currentTime + dur);
      } catch (e) { console.error("Audio Err:", e); }
    },
    startMusic: () => {
      if (musInt) clearInterval(musInt);
      if (!SV.settings.music || !actx) return;
      let t = 0;
      musInt = setInterval(() => {
        if (SV.paused) return;
        const freq = [110,110,130,110,165,146,130,110][t % 8];
        Sound.play(freq, 'triangle', 0.05, 0.2);
        t++;
      }, 250);
    },
    stopMusic: () => clearInterval(musInt)
  };

  // --- PIXEL ART ---
  const ART = {
    troll: [
      "00000002222222200000",
      "00000222222222222000",
      "00000222222222222000",
      "00000221111111122000",
      "00000221611116112200",
      "00000022111111112200",
      "00000022213113122200",
      "00000004444444440000",
      "00000044444444444000",
      "00000044555555544000",
      "00000044555555544000",
      "00000444555555544477",
      "00000444555555544488",
      "00000444555555544488",
      "00000444555555544477",
      "00000000000000000000"
    ],
    head: [
      "00000000099999900000",
      "00000009999999900000",
      "00000099999999999000",
      "00000991111111199000",
      "00000911111111111900",
      "00000916411116411900",
      "00000916411116411900",
      "00000911111111111900",
      "00000091111111190000",
      "00000009111111900000",
      "00000009166661900000",
      "00000000911119000000",
      "00000000099990000000"
    ],
    colors:{'1':'#ffd5a3','2':'#ffee7a','3':'#000','4':'#fff','5':'#ff3860','6':'#000','7':'#999','8':'#aaf','9':'#ccc'}
  };

  // --- DATA ---
  const COLORS = {
    shirt:['#ff5a5a','#4ea8ff','#37d67a','#a06bff','#ff8d3b','#17c5b6'],
    pants:['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'],
    skin:['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f']
  };
  const ITEMS=['none','sword','scepter','mallet','cleaver'];
  const HAIRS={m:['short','side','spiky'],f:['bob','long','ponytail'],o:['short','side','spiky','bob','long','ponytail','mohawk']};

  const SKINS=[
    {id:'skin1',name:'Cone Knight',req:'beat_boss1',col:'#ff5a5a',rarity:'rare'},
    {id:'skin2',name:'Blizzard',req:'long_run',col:'#4e9cff',rarity:'rare'},
    {id:'skin3',name:'Kindness',req:'kind_only',col:'#ff7bc5',rarity:'epic'},
    {id:'skin4',name:'Slayer',req:'beat_boss2',col:'#3ba55d',rarity:'epic'},
    {id:'skin5',name:'Socialite',req:'share_game',col:'#ffd700',rarity:'legendary'}
  ];

  const ACHIEVEMENTS = [
    {id:'beat_boss1',title:'Emoji Dodger',desc:'Defeat Teen Troll'},
    {id:'beat_boss2',title:'Final Blow',desc:'Defeat Boss Head'},
    {id:'kind_only',title:'Kindness',desc:'Pacifist Run'},
    {id:'share_game',title:'Influencer',desc:'Share the game'},
    {id:'long_run',title:'Endurer',desc:'Survive 10m'},
    {id:'die_lot',title:'Glutton',desc:'Die 10 times'},
    {id:'secret_dev',title:'The 2112',desc:'Find Dev Menu'}
  ];

  // --- STATE ---
  const Store={
    get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))||d;}catch{return d;}},
    set:(k,v)=>localStorage.setItem(k,JSON.stringify(v))
  };

  const SV = {
    settings:Store.get('sv_set',{music:true,sfx:true,playerName:'Hero',gender:'m',shirt:'#ff5a5a',pants:'#2d3549',skinTone:'#ffd5a3',hairStyle:'short',item:'none',skin:null}),
    progress:Store.get('sv_prog',{ach:{},jumps:0,lastCheckpoint:0,beatBoss1:false,beatBoss2:false,endlessUnlocked:false,allTimeScore:0}),
    running:false, paused:false, level:1, score:0, lastTs:0, groundY:360,
    player:{x:120,y:296,w:42,h:64,vy:0,onGround:true,jumpsUsed:0},
    hazards:[], powerups:[], particles:[],
    shield:0, jetpack:false, tesla:0, jetpackTime:0,
    boss1:{active:false,hp:1,y:200,anim:0,quote:'',quoteTimer:0,dodged:0},
    rpg:{active:false,hp:100,max:100},
    devClicks:0
  };

  // --- INIT ---
  function init(){
    const cvs = qs('#game-canvas');
    if(!cvs) return;
    SV.ctx = cvs.getContext('2d');

    // Title
    qs('#title-screen').onclick = () => {
      Sound.init();
      if(SV.settings.music) Sound.startMusic();
      qs('#title-screen').classList.add('hidden');
      qs('#home-screen').classList.remove('hidden');
    };

    // Menu bindings
    qs('#play-btn').onclick = () => startRun(SV.progress.lastCheckpoint>1?'popup':1);
    qs('#endless-btn').onclick = () => {
      if(SV.progress.endlessUnlocked) startRun(99);
      else alert("Beat Story Mode to unlock.");
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
      alert("Link copied! Socialite unlocked.");
      award('share_game');
    };

    qs('#start-at-last').onclick = () => { closePopup('start-popup'); startRun(SV.progress.lastCheckpoint||1); };
    qs('#start-beginning').onclick = () => { closePopup('start-popup'); startRun(1); };

    // Toggles
    const updSet=()=>{
      qs('#music-toggle').textContent=`Music: ${SV.settings.music?'ON':'OFF'}`;
      qs('#pause-music-btn').textContent=`Music: ${SV.settings.music?'ON':'OFF'}`;
      qs('#sfx-toggle').textContent=`SFX: ${SV.settings.sfx?'ON':'OFF'}`;
      qs('#pause-sfx-btn').textContent=`SFX: ${SV.settings.sfx?'ON':'OFF'}`;
      Store.set('sv_set',SV.settings);
    };

    const toggleMus=()=>{SV.settings.music=!SV.settings.music; SV.settings.music?Sound.startMusic():Sound.stopMusic(); updSet();};
    const toggleSfx=()=>{SV.settings.sfx=!SV.settings.sfx; updSet();};

    qs('#music-toggle').onclick = toggleMus;
    qs('#pause-music-btn').onclick = toggleMus;
    qs('#sfx-toggle').onclick = toggleSfx;
    qs('#pause-sfx-btn').onclick = toggleSfx;

    qs('#reset-progress-btn').onclick = () => { if(confirm("Reset all data?")){ localStorage.clear(); location.reload(); } };

    // Pause
    qs('#pause-btn').onclick = () => { SV.paused=true; openPopup('pause-menu'); };
    qs('#resume-btn').onclick = () => { closePopup('pause-menu'); SV.paused=false; SV.lastTs=performance.now(); loop(); };
    qs('#quit-btn').onclick = () => location.reload();

    // Death
    qs('#death-restart-checkpoint').onclick = () => { closePopup('death-popup'); startRun(SV.progress.lastCheckpoint||1); };
    qs('#death-exit-main').onclick = () => location.reload();

    // Jump
    const jump=(e)=>{
      if(!SV.running||SV.paused) return;
      if(e.type==='keydown' && e.code!=='Space') return;
      e.preventDefault();
      const p=SV.player;
      if(p.jumpsUsed<2){
        p.vy = p.jumpsUsed===0?-0.66:-0.58;
        p.jumpsUsed++; 
        p.onGround=false;
        Sound.play(300,'square',0.1);
      }
    };
    qs('#jump-btn').onpointerdown = jump;
    window.onkeydown = jump;
    qs('#game-canvas').onpointerdown = jump;

    // Dev Menu
    qs('#dev-trigger-zone').onpointerdown = () => {
      SV.devClicks++;
      setTimeout(()=>SV.devClicks=0,2000);
      if(SV.devClicks>=5){
        if(prompt("Code?")==="2112"){ openPopup('dev-menu'); award('secret_dev'); }
        SV.devClicks=0;
      }
    };

    qsa('#dev-menu .dev-btn').forEach(b=> b.onclick = ()=>{
      closePopup('dev-menu');
      SV.running=false;
      startRun(parseInt(b.dataset.level));
    });

    qsa('#dev-menu .btn').forEach(b=> b.onclick=()=>{
      if(b.dataset.power==='shield') SV.shield=3;
      if(b.dataset.power==='tesla') SV.tesla=5000;
      if(b.dataset.power==='jetpack'){ SV.jetpack=true; SV.jetpackTime=8000; }
      closePopup('dev-menu');
    });

    // Close buttons
    qsa('.close-btn').forEach(b=> b.onclick = ()=> b.closest('.popup').classList.add('hidden'));

    updSet();
  }

  // FIXED POPUP FUNCTIONS
  function openPopup(id){ qs('#'+id).classList.remove('hidden'); }
  function closePopup(id){ qs('#'+id).classList.add('hidden'); }

  // --- START RUN ---
  function startRun(lv){
    if(lv==='popup'){ openPopup('start-popup'); return;}

    ['home-screen','start-popup','death-popup','rpg-overlay']
      .forEach(id=>qs('#'+id).classList.add('hidden'));

    qs('#game-screen').classList.remove('hidden');

    SV.level=lv;
    SV.score=0;
    SV.player.x=120;
    SV.player.y=296;
    SV.player.vy=0;
    SV.player.jumpsUsed=0;

    SV.hazards=[];
    SV.powerups=[];
    SV.shield=0;
    SV.jetpack=false;
    SV.tesla=0;
    SV.rpg.active=false;

    qs('#player-name-display').textContent = SV.settings.playerName || "Hero";

    SV.running=true;
    SV.paused=false;
    SV.lastTs=performance.now();
    loop();
  }

  // LOOP
  function loop(ts){
    if(!SV.running) return;
    if(SV.paused) return requestAnimationFrame(loop);
    const dt = (ts-SV.lastTs)||16;
    SV.lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // UPDATE
  function update(dt){
    if(SV.rpg.active) return;

    SV.score += dt*0.01;
    qs('#score-display').textContent = Math.floor(SV.score);

    if(SV.score>(SV.progress.allTimeScore||0)){
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_prog',SV.progress);
    }
    qs('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore||0);

    const p = SV.player;

    if(SV.jetpack){
      p.vy=0;
      p.y = 200 + Math.sin(Date.now()*0.005)*10;
      p.onGround=false;
    } else {
      p.vy += 0.0018*dt;
      p.y += p.vy*dt;
      if(p.y >= 296){
        p.y=296;
        p.vy=0;
        p.jumpsUsed=0;
        p.onGround=true;
      }
    }

    // Hazards
    if(Math.random()<0.015){
      const type = Math.random()>0.7?'mine':'slime';
      SV.hazards.push({x:850,y:type==='mine'?230:296,w:36,h:36,type});
    }

    // Powerups
    if(Math.random()<0.005){
      SV.powerups.push({x:850,y:200,w:40,h:40,type:pick(['shield','tesla','jetpack'])});
    }

    SV.hazards.forEach(h=> h.x -= 0.34*dt);
    SV.powerups.forEach(pw=> pw.x -= 0.34*dt);

    // Tesla auto-zap
    if(SV.tesla>0){
      SV.tesla -= dt;
      const t = SV.hazards.find(h=>h.x>p.x && h.x<p.x+400);
      if(t){
        t.zapped=true;
        SV.hazards = SV.hazards.filter(h=>h!==t);
        Sound.play(600,'sawtooth',0.1);
      }
    }

    // Collisions
    SV.hazards.forEach((h,i)=>{
      if(rectHit(p.x,p.y,p.w,p.h,h.x,h.y,h.w,h.h)){
        if(SV.shield>0 || SV.jetpack){
          SV.shield--;
          SV.hazards.splice(i,1);
        } else {
          SV.running=false;
          onPlayerDeath();
        }
      }
    });

    SV.powerups.forEach((pw,i)=>{
      if(rectHit(p.x,p.y,p.w,p.h,pw.x,pw.y,40,40)){
        SV.powerups.splice(i,1);
        Sound.play(600,'sine');
        if(pw.type==='shield') SV.shield=3;
        if(pw.type==='tesla') SV.tesla=5000;
        if(pw.type==='jetpack'){ SV.jetpack=true; SV.jetpackTime=8000; }
      }
    });
  }

  // Death
  function onPlayerDeath(){
    Sound.play(60,'sawtooth',0.5);
    award('die_lot');
    openPopup('death-popup');
  }

  function rectHit(x1,y1,w1,h1,x2,y2,w2,h2){
    return !(x2>x1+w1 || x2+w2<x1 || y2>y1+h1 || y2+h2<y1);
  }

  // DRAW
  function draw(){
    const ctx = SV.ctx;
    ctx.clearRect(0,0,800,480);
    ctx.fillStyle='#111';
    ctx.fillRect(0,0,800,480);

    // ground
    ctx.fillStyle='#1a2435';
    ctx.fillRect(0,360,800,120);

    // hazards
    SV.hazards.forEach(h=>{
      if(h.type==='mine'){
        ctx.fillStyle='#555';
        ctx.beginPath();
        ctx.arc(h.x+18,h.y+18,18,0,Math.PI*2);
        ctx.fill();
      } else {
        ctx.fillStyle='#0f0';
        ctx.beginPath();
        ctx.arc(h.x+18,h.y+18,18,0,Math.PI*2);
        ctx.fill();
      }
    });

    // powerups
    SV.powerups.forEach(p=>{
      ctx.fillStyle='#fff';
      ctx.beginPath();
      ctx.arc(p.x+20,p.y+20,20,0,Math.PI*2);
      ctx.fill();
    });

    // player sprite
    drawPlayerSprite(ctx,SV.player.x,SV.player.y);

    // tesla beam
    if(SV.tesla>0){
      const t = SV.hazards.find(h=>h.x>SV.player.x && h.x<SV.player.x+400);
      if(t){
        ctx.strokeStyle='#0ff';
        ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(SV.player.x+20,SV.player.y+30);
        ctx.lineTo(t.x+18,t.y+18);
        ctx.stroke();
      }
    }
  }

  function drawPlayerSprite(ctx,x,y){
    const s=SV.settings;
    let shirt=s.shirt;
    if(s.skin){
      const sk=SKINS.find(k=>k.id===s.skin);
      if(sk) shirt=sk.col;
    }
    ctx.fillStyle=shirt;
    ctx.fillRect(x,y,42,64);

    ctx.fillStyle=s.skinTone;
    ctx.fillRect(x+8,y-16,26,16);

    ctx.fillStyle=s.pants;
    ctx.fillRect(x+4,y+36,12,28);
    ctx.fillRect(x+26,y+36,12,28);

    ctx.fillStyle='#70421b';
    if(s.hairStyle==='short') ctx.fillRect(x+8,y-20,26,8);
  }

  // Wardrobe
  function initWardrobe(){
    const cvs=document.createElement('canvas');
    cvs.width=300;cvs.height=180;
    qs('#player-preview').innerHTML='';
    qs('#player-preview').appendChild(cvs);
    const ctx=cvs.getContext('2d');

    const render=()=>{ctx.clearRect(0,0,300,180); drawPlayerSprite(ctx,130,80);};

    const nameInput=qs('#player-name-input');
    if(nameInput){
      nameInput.value=SV.settings.playerName;
      nameInput.onchange=e=>{
        SV.settings.playerName=e.target.value||'Hero';
        Store.set('sv_set',SV.settings);
      };
    }

    qsa('.wardrobe-tab').forEach(t=>{
      t.onclick=e=>{
        qsa('.wardrobe-tab').forEach(x=>x.classList.remove('active'));
        e.target.classList.add('active');
        qsa('.wardrobe-content').forEach(c=>c.classList.remove('active'));
        qs('#'+e.target.dataset.tab).classList.add('active');
      };
    });

    const build=(arr,id,prop,isColor)=>{
      const el=qs('#'+id);
      el.innerHTML='';
      arr.forEach(val=>{
        const b=document.createElement('button');
        if(isColor){
          b.className='color-swatch';
          b.style.background=val;
        } else {
          b.className='item-swatch';
          b.textContent=val;
        }
        if(SV.settings[prop]===val) b.classList.add('active');
        b.onclick=()=>{
          SV.settings[prop]=val;
          if(prop==='shirt') SV.settings.skin=null;
          Store.set('sv_set',SV.settings);
          render();
        };
        el.appendChild(b);
      });
    };

    const refreshHair=()=>{
      build(HAIRS[SV.settings.gender], 'hair-options','hairStyle',false);
    };

    build(COLORS.shirt,'shirt-options','shirt',true);
    build(COLORS.pants,'pants-options','pants',true);
    build(COLORS.skin,'skin-options','skinTone',true);
    build(ITEMS,'item-options','item',false);
    refreshHair();

    qsa('.gender-btn').forEach(b=>{
      if(SV.settings.gender===b.dataset.gender) b.classList.add('active');
      b.onclick=()=>{
        SV.settings.gender=b.dataset.gender;
        Store.set('sv_set',SV.settings);
        refreshHair(); render();
      };
    });

    render();
  }

  function drawPixelArt(ctx,map,size){
    map.forEach((row,y)=>{
      [...row].forEach((char,x)=>{
        const col=ART.colors[char];
        if(col){
          ctx.fillStyle=col;
          ctx.fillRect(x*size,y*size,size,size);
        }
      });
    });
  }

  function drawLore(){
    const c1=qs('#lore-canvas-1');
    if(c1){
      const ctx1=c1.getContext('2d');
      ctx1.clearRect(0,0,128,128);
      drawPixelArt(ctx1,ART.troll,6);
    }
    const c2=qs('#lore-canvas-2');
    if(c2){
      const ctx2=c2.getContext('2d');
      ctx2.clearRect(0,0,128,128);
      drawPixelArt(ctx2,ART.head,6);
    }
  }

  function buildAch(){
    const g=qs('#achievements-grid');
    g.innerHTML='';
    const have=SV.progress.ach||{};
    ACHIEVEMENTS.forEach(a=>{
      const d=document.createElement('div');
      d.className=`achievement-tile ${have[a.id]?'unlocked':''}`;
      d.innerHTML=`<b>${a.title}</b><br><small>${a.desc}</small>`;
      g.appendChild(d);
    });
  }

  function award(id){
    if(!SV.progress.ach[id]){
      SV.progress.ach[id]=true;
      Store.set('sv_prog',SV.progress);
    }
  }

  document.addEventListener('DOMContentLoaded',init);
})();
