/* =========================================================
   SWEETARIA: VENGEANCE
   Alpha Build 1.1 JS
   - Based on Full Stable Version 1.0 HTML/CSS
   - Adds: bosses, RPG final boss, endless-mode wiring, dev menu,
           credits logic hooks, safer death handling, laser/shield/
           jetpack systems, wardrobe & skins persistence, clues,
           achievements, etc.
   NOTE: This is an ALPHA build layered conceptually on Stable 1.0.
   ========================================================= */

(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const randRange = (a,b) => a + Math.random()*(b-a);
  const pick = (arr) => arr[(Math.random()*arr.length)|0];

  const store = {
    get(k, d=null){
      try{
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      }catch{
        return d;
      }
    },
    set(k, v){
      try{ localStorage.setItem(k, JSON.stringify(v)); }catch{}
    },
    del(k){
      try{ localStorage.removeItem(k); }catch{}
    }
  };

  /* ---------- content / data ---------- */

  const SKIN_TONES = ['#ffd5a3','#e8b788','#c78d62','#a86b47','#7f4d30','#5e391f'];
  const PANTS = ['#2d3549','#39445f','#4e5b7a','#273244','#1f2738'];
  const HAIR_STYLES = {
    m: ['short','side','spiky'],
    f: ['bob','long','ponytail'],
    o: ['short','long','mohawk']
  };

  const POWERUP_KIND = {
    SHIELD:'shield',
    JETPACK:'jetpack',
    LASER:'laser'
  };

  const LV_SECONDS = 60;         // normal level length
  const LV5_PROJECTILES_TARGET = 40; // boss 1 “survive this many”
  const LV5_PROJECTILE_INTERVAL = 900; // ms between shots (tuned to be fair)

  const LASER_BASE_MS = 6500;    // base laser duration
  const LASER_THICKNESS_GROUND = 16;
  const LASER_THICKNESS_AIR = 22;
  const LASER_IFRAME_MS = 1000;

  const SHIELD_INV_MS = 20000;
  const JETPACK_MS = 8000;
  const JETPACK_LAND_IFRAME_MS = 1500;

  const ENDLESS_DIFFICULTY_STEP_MS = 30000; // every 30s harder

  const CLUES = {
    1:"Clue 1: The answer is not where you look, but where you don't.",
    2:"Clue 2: It is kept from the light.",
    3:"Clue 3: What you seek is on the unseen side.",
    4:"Clue 4: It is not a product, nor a price.",
    5:"Clue 5: Find the testament to our work.",
    6:"Clue 6: The secret is kept by a frozen moment.",
    7:"Clue 7: Seek the collection of what is to come.",
    8:"Clue 8: Look for the glimmer of the ascent.",
    9:"Clue 9: It is where the journey upward is celebrated.",
    final:"FINAL: Go to the testament of the journey upward, where the glimmers are shown. The answer lies on the unseen side of a single frozen moment."
  };

  const ACHIEVEMENTS = [
  { id:'beat_boss1',  title:'Emoji Dodger',     desc:'Defeat Cell Phone Teen Troll (Lv5)' },
  { id:'beat_boss2',  title:'Final Blow',       desc:'Defeat Big Boss Head (Lv10)' },
  { id:'kind_only',   title:'Kindness Wins',    desc:'Defeat Boss 2 using ONLY Kindness' },
  { id:'100_jumps',   title:'Hops Master',      desc:'Perform 100 jumps total' },
  { id:'long_run',    title:'Endurer',          desc:'Survive 10 minutes in one run' },
  { id:'die_lot',     title:'Glutton for Punishment', desc:'Die 10 times total' },
  { id:'shield_max',  title:'Invincible',       desc:'Collect 3 shields at once' },
  { id:'sky_high',    title:'Astronaut',        desc:'Use the Jetpack for 30 seconds total' },
  { id:'all_skins',   title:'Fashionista',      desc:'Unlock all skins' },
  { id:'secret_dev',  title:'The 2112',         desc:'Find the Developer Menu' }
];


  const BOSS1_QUOTES = [
    "Omg I just screenshotted that.",
    "Lmao this is going in the group chat.",
    "Ratio + cry about it.",
    "You are getting cooked in my comments.",
    "Ok boomer.",
    "Bestie, touch grass.",
    "No way you posted that for free.",
    "Hold on, my followers need to see this.",
    "You are about to be a meme.",
    "Delete this challenge (you failed)."
  ];

  const BOSS2_ATTACKS = [
    { text:'Student Debt Relief',   dmg:8,  kind:false, reaction:"That sounds like socialism to me!" },
    { text:'Universal Healthcare',  dmg:9,  kind:false, reaction:"Who is going to pay for THAT? Not me!" },
    { text:'Trans Rights',          dmg:11, kind:false, reaction:"Not in my HOA newsletter!" },
    { text:'Young People Buying Homes', dmg:10, kind:false, reaction:"You should have been born in 1950 like I was." },
    { text:'SNAP Benefits',         dmg:8,  kind:false, reaction:"Free groceries?? For the poors??" },
    { text:'Kindness',              dmg:7,  kind:true,  reaction:"Stop that. You are ruining my brand of cruelty." },
    { text:'Climate Action',        dmg:9,  kind:false, reaction:"Back in my day, we breathed pure smog and we liked it!" },
    { text:'Unionizing',            dmg:10, kind:false, reaction:"You will NOT mess with my yacht money!" },
    { text:'Paid Family Leave',     dmg:8,  kind:false, reaction:"Why would workers need families?" },
    { text:'Cancel My Facebook',    dmg:6,  kind:false, reaction:"I do not consent to Facebook… from my Facebook page!" }
  ];

  /* ---------- audio placeholders ---------- */
  const SFX = {
    jump:new Audio(), pickup:new Audio(), click:new Audio(),
    laser:new Audio(), shield:new Audio(), jetpack:new Audio()
  };
  const MUS = {
    title:new Audio(), home:new Audio(), game:new Audio(), boss:new Audio()
  };
  Object.values(MUS).forEach(a=>{ try{ a.loop=true; }catch{} });

  /* ---------- global state ---------- */

  const SV = {
    canvas:null,
    ctx:null,

    screens:{},
    popups:{},

    ui:{},

    settings: store.get('sv_settings', {
      music:true,
      sfx:true,
      playerName:'Hero',
      gender:'m',
      hairStyle:'short',
      skinTone:SKIN_TONES[0],
      shirt:'red',
      pants:PANTS[0],
      item:'none',
      skin:null
    }),

    progress: store.get('sv_progress', {
      allTimeScore:0,
      unlockedClues:{},
      ach:{},
      jumps:0,
      lastCheckpoint:0,
      beatBoss1:false,
      beatBoss2:false,
      endlessUnlocked:false,
      endlessBest:0
    }),

    totalPlayMs: store.get('sv_total_ms', 0),

    running:false,
    paused:false,
    lastTs:0,

    mode:'title',   // title | home | story | endless
    level:1,
    levelTime:0,    // ms within current level
    runTime:0,      // ms within this run (used for long_run)
    score:0,

    player:{
      x:120,
      y:0,
      w:42,
      h:64,
      vy:0,
      onGround:false,
      jumpsUsed:0
    },

    gravity:0.0018,
    jumpStrength:-0.66,
    doubleJumpStrength:-0.58,
    scrollSpeed:0.34,
    baseScrollSpeed:0.34,

    groundY:360,

    hazards:[],
    powerups:[],
    hazardSpawnMs:0,
    nextHazardIn:1200,

    nextPowerupIn:7000,

    invulnMs:0,
    shieldStacks:0,
    shieldInvMs:0,

    laserMs:0,
    laserIframeMs:0,

    jetpack:false,
    jetpackMs:0,
    jetpackLandIframeMs:0,

    // boss1
    boss1Active:false,
    boss1ProjCount:0,
    boss1ProjDodged:0,
    boss1QuoteTimer:0,
    boss1Quote:"",
    boss1HP:1, // conceptual, 0..1 for bar
    // boss2
    rpg:{
      active:false,
      hp:100,
      maxHp:100,
      optionsPool:[],
      kindOnly:true,
      element:null,
      logEl:null,
      buttons:[]
    },

    devTapTimes:[],      // for 5-tap top-left
    shareHoldTimer:null  // for dev from share popup
  };

  // upgrade older saves
  if(typeof SV.progress.endlessUnlocked !== 'boolean'){
    SV.progress.endlessUnlocked = !!SV.progress.beatBoss2;
  }
  if(typeof SV.progress.endlessBest !== 'number'){
    SV.progress.endlessBest = 0;
  }

  /* ---------- DOM cache ---------- */

  function cacheDOM(){
    SV.canvas = qs('#game-canvas');
    SV.ctx = SV.canvas.getContext('2d');

    SV.screens = {
      title: qs('#title-screen'),
      home: qs('#home-screen'),
      game: qs('#game-screen'),
      rpg:  qs('#rpg-overlay')
    };

    SV.popups = {
      pause: qs('#pause-menu'),
      start: qs('#start-popup'),
      wardrobe:qs('#wardrobe-popup'),
      clues:qs('#clues-popup'),
      lore:qs('#lore-popup'),
      achievements:qs('#achievements-popup'),
      share:qs('#share-popup'),
      settings:qs('#settings-popup')
      // credits & death menus may be added later in HTML;
      // JS will handle gracefully if missing.
    };

    SV.ui = {
      playerNameDisplay: qs('#player-name-display'),
      levelDisplay: qs('#level-display'),
      scoreDisplay: qs('#score-display'),
      alltimeDisplay: qs('#alltime-display'),

      shieldChip: qs('#shield-indicator'),
      shieldCount: qs('#shield-count'),
      jetpackChip: qs('#jetpack-indicator'),
      jetpackCount: qs('#jetpack-count'),
      livesChip: qs('#lives-indicator'),

      levelBar: qs('#level-progress-fill'),

      pauseBtn: qs('#pause-btn'),
      jumpBtn: qs('#jump-btn'),

      resumeBtn: qs('#resume-btn'),
      quitBtn: qs('#quit-btn'),

      startAtLast: qs('#start-at-last'),
      startBeginning: qs('#start-beginning')
    };

    // RPG overlay related
    SV.rpg.element = SV.screens.rpg;
    SV.rpg.logEl = qs('#rpg-log', SV.rpg.element);
    SV.rpg.buttons = qsa('.insult-btn', SV.rpg.element);
  }

  /* ---------- screen & popup helpers ---------- */

  function showScreen(name){
    Object.entries(SV.screens).forEach(([k, el])=>{
      if(!el) return;
      if(k===name){
        el.classList.remove('hidden');
      }else{
        el.classList.add('hidden');
      }
    });
    SV.mode = name === 'game' ? SV.mode : name;
  }

  function openPopup(el){
    if(!el) return;
    el.classList.remove('hidden');
  }

  function closePopup(el){
    if(!el) return;
    el.classList.add('hidden');
  }

  /* ---------- audio helpers ---------- */

  function playMusic(which){
    if(!SV.settings.music) return;
    try{
      Object.values(MUS).forEach(a=>{
        try{ a.pause(); a.currentTime=0; }catch{}
      });
      const target = MUS[which];
      if(target){
        target.play().catch(()=>{});
      }
    }catch{}
  }

  function playSfx(audio){
    if(!SV.settings.sfx) return;
    try{
      audio.currentTime=0;
      audio.play().catch(()=>{});
    }catch{}
  }

  /* ---------- UI binding ---------- */

  function bindTitle(){
    const t = SV.screens.title;
    if(!t) return;
    t.addEventListener('click', (e)=>{
      // click near title region
      const content = qs('.title-content', t);
      if(!content) return;
      const r = content.getBoundingClientRect();
      if(
        e.clientX >= r.left-40 && e.clientX <= r.right+40 &&
        e.clientY >= r.top-60 && e.clientY <= r.bottom+80
      ){
        showScreen('home');
        playMusic('home');
      }
    });
  }

  function bindSettings(){
    const btn = qs('#settings-btn');
    if(btn){
      btn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        openPopup(SV.popups.settings);
      });
    }

    const musicToggle = qs('#music-toggle');
    if(musicToggle){
      musicToggle.textContent = `Music: ${SV.settings.music ? 'On' : 'Off'}`;
      musicToggle.addEventListener('click', ()=>{
        SV.settings.music = !SV.settings.music;
        store.set('sv_settings', SV.settings);
        musicToggle.textContent = `Music: ${SV.settings.music ? 'On' : 'Off'}`;
        if(!SV.settings.music){
          Object.values(MUS).forEach(a=>{ try{ a.pause(); }catch{} });
        }else{
          playMusic('home');
        }
      });
    }

    const sfxToggle = qs('#sfx-toggle');
    if(sfxToggle){
      sfxToggle.textContent = `SFX: ${SV.settings.sfx ? 'On' : 'Off'}`;
      sfxToggle.addEventListener('click', ()=>{
        SV.settings.sfx = !SV.settings.sfx;
        store.set('sv_settings', SV.settings);
        sfxToggle.textContent = `SFX: ${SV.settings.sfx ? 'On' : 'Off'}`;
      });
    }

    const resetBtn = qs('#reset-progress-btn');
    if(resetBtn){
      resetBtn.addEventListener('click', ()=>{
        const a = confirm('Reset ALL progress (checkpoints, clues, achievements, endless)?');
        if(!a) return;
        const b = confirm('Really sure? This cannot be undone.');
        if(!b) return;

        store.del('sv_progress');
        store.del('sv_total_ms');
        SV.progress = {
          allTimeScore:0,
          unlockedClues:{},
          ach:{},
          jumps:0,
          lastCheckpoint:0,
          beatBoss1:false,
          beatBoss2:false,
          endlessUnlocked:false,
          endlessBest:0
        };
        SV.totalPlayMs = 0;
        updateHUD();
        buildCluesList();
        buildAchievementsGrid();
        alert('Progress reset.');
      });
    }

    const closeSettings = qs('#close-settings');
    if(closeSettings){
      closeSettings.addEventListener('click', ()=>{
        closePopup(SV.popups.settings);
      });
    }
  }

  function bindHomeMenu(){
    const playBtn = qs('#play-btn');
    if(playBtn){
      playBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        onPlayPressed();
      });
    }

    const wardrobeBtn = qs('#wardrobe-btn');
    if(wardrobeBtn){
      wardrobeBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        openPopup(SV.popups.wardrobe);
        initWardrobe();
      });
    }

    const cluesBtn = qs('#clues-btn');
    if(cluesBtn){
      cluesBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        buildCluesList();
        openPopup(SV.popups.clues);
      });
    }

    const loreBtn = qs('#lore-btn');
    if(loreBtn){
      loreBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        drawLoreCanvases();
        openPopup(SV.popups.lore);
      });
    }

    const achBtn = qs('#achievements-btn');
    if(achBtn){
      achBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        buildAchievementsGrid();
        openPopup(SV.popups.achievements);
      });
    }

    const shareBtn = qs('#share-btn');
    if(shareBtn){
      shareBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        onSharePressed();
      });
    }

    const returnTitle = qs('#return-title-btn');
    if(returnTitle){
      returnTitle.addEventListener('click', ()=>{
        playSfx(SFX.click);
        showScreen('title');
        playMusic('title');
      });
    }
  }

  function bindGameControls(){
    if(SV.ui.pauseBtn){
      SV.ui.pauseBtn.addEventListener('click', ()=>{
        if(!SV.running || SV.paused || SV.rpg.active) return;
        SV.paused = true;
        openPopup(SV.popups.pause);
      });
    }

    if(SV.ui.resumeBtn){
      SV.ui.resumeBtn.addEventListener('click', ()=>{
        closePopup(SV.popups.pause);
        resumeGame();
      });
    }

    if(SV.ui.quitBtn){
      SV.ui.quitBtn.addEventListener('click', ()=>{
        closePopup(SV.popups.pause);
        stopGameToHome();
      });
    }

    // Start-popup
    if(SV.ui.startAtLast){
      SV.ui.startAtLast.addEventListener('click', ()=>{
        closePopup(SV.popups.start);
        const lv = SV.progress.lastCheckpoint || 1;
        startStoryRun(lv, false);
      });
    }
    if(SV.ui.startBeginning){
      SV.ui.startBeginning.addEventListener('click', ()=>{
        closePopup(SV.popups.start);
        SV.progress.lastCheckpoint = 0;
        store.set('sv_progress', SV.progress);
        startStoryRun(1, true);
      });
    }

    // Jump button and canvas tap
    const handleJumpDown = (e)=>{
      e.preventDefault();
      doJump();
    };
    const handleJumpUp = (e)=>{
      e.preventDefault();
    };

    if(SV.ui.jumpBtn){
      SV.ui.jumpBtn.addEventListener('pointerdown', handleJumpDown);
      SV.ui.jumpBtn.addEventListener('pointerup', handleJumpUp);
    }
    if(SV.canvas){
      SV.canvas.addEventListener('pointerdown', handleJumpDown);
      SV.canvas.addEventListener('pointerup', handleJumpUp);
    }

    window.addEventListener('keydown', (e)=>{
      if(e.code === 'Space'){
        e.preventDefault();
        doJump();
      }
    });
  }

  function bindPopupCloses(){
    const closeClues = qs('#close-clues');
    if(closeClues){
      closeClues.addEventListener('click', ()=>{
        closePopup(SV.popups.clues);
      });
    }
    const closeLore = qs('#close-lore');
    if(closeLore){
      closeLore.addEventListener('click', ()=>{
        closePopup(SV.popups.lore);
      });
    }
    const closeAch = qs('#close-achievements');
    if(closeAch){
      closeAch.addEventListener('click', ()=>{
        closePopup(SV.popups.achievements);
      });
    }
    const closeShare = qs('#close-share');
    if(closeShare){
      closeShare.addEventListener('click', ()=>{
        closePopup(SV.popups.share);
      });
    }
    const closeWardrobe = qs('#close-wardrobe');
    if(closeWardrobe){
      closeWardrobe.addEventListener('click', ()=>{
        closePopup(SV.popups.wardrobe);
      });
    }
    const closeSkins = qs('#close-skins');
    if(closeSkins){
      closeSkins.addEventListener('click', ()=>{
        // just close wardrobe popup
        closePopup(SV.popups.wardrobe);
      });
    }
  }

  /* ---------- share & dev menu ---------- */

  function onSharePressed(){
    const link = qs('#share-link');
    const copyBtn = qs('#copy-share-btn');
    openPopup(SV.popups.share);
    if(copyBtn && link){
      copyBtn.onclick = ()=>{
        link.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(()=>{ copyBtn.textContent='Copy Link'; }, 1200);
      };
    }

    // dev menu alt: long press inside share panel, then code “2112”
    const panel = qs('#share-popup .panel');
    if(!panel) return;

    const startHold = ()=>{
      if(SV.shareHoldTimer) clearTimeout(SV.shareHoldTimer);
      SV.shareHoldTimer = setTimeout(()=>{
        const code = prompt('Developer code?');
        if(code === '2112') openDevMenu();
      }, 10000); // 10s hold
    };
    const endHold = ()=>{
      if(SV.shareHoldTimer){
        clearTimeout(SV.shareHoldTimer);
        SV.shareHoldTimer = null;
      }
    };

    panel.addEventListener('pointerdown', startHold, { once:true });
    panel.addEventListener('pointerup', endHold, { once:true });
    panel.addEventListener('pointerleave', endHold, { once:true });
  }

  function setupDevTapCorner(){
    // 5 taps in top-left 80x80 within 2.5s
    document.addEventListener('pointerdown', (e)=>{
      if(e.clientX > 80 || e.clientY > 80) return;
      const now = performance.now();
      SV.devTapTimes = SV.devTapTimes.filter(t => now - t < 2500);
      SV.devTapTimes.push(now);
      if(SV.devTapTimes.length >= 5){
        SV.devTapTimes.length = 0;
        const code = prompt('Developer code?');
        if(code === '2112') openDevMenu();
      }
    });
  }

  function openDevMenu(){
    const choice = prompt('Dev Menu:\n1) Jump to Level\n2) Give Powerup\n\nEnter 1 or 2:','1');
    if(choice === '1'){
      const lv = parseInt(prompt('Level (1-10):', String(SV.level||1)) || '1', 10);
      if(lv>=1 && lv<=10){
        startStoryRun(lv, true);
      }
    }else if(choice === '2'){
      const kind = prompt('Powerup? (shield/jetpack/laser)', 'laser');
      if(kind === 'shield'){
        SV.shieldStacks = clamp(SV.shieldStacks+1, 0, 3);
        SV.shieldInvMs = SHIELD_INV_MS;
      }else if(kind === 'jetpack'){
        SV.jetpack = true;
        SV.jetpackMs = JETPACK_MS;
      }else if(kind === 'laser'){
        SV.laserMs += LASER_BASE_MS;
        SV.laserIframeMs = LASER_IFRAME_MS;
      }
      updateHUD();
    }
  }

  /* ---------- wardrobe ---------- */

  let wardrobePreviewCanvas = null;
  let wardrobePreviewCtx = null;

  function initWardrobe(){
    const holder = qs('#player-preview');
    if(holder){
      holder.innerHTML = '';
      wardrobePreviewCanvas = document.createElement('canvas');
      wardrobePreviewCanvas.width = 800;
      wardrobePreviewCanvas.height = 220;
      wardrobePreviewCanvas.className = 'preview-canvas';
      holder.appendChild(wardrobePreviewCanvas);
      wardrobePreviewCtx = wardrobePreviewCanvas.getContext('2d');
      drawWardrobePreview();
    }

    const nameInput = qs('#player-name-input');
    if(nameInput){
      nameInput.value = SV.settings.playerName || 'Hero';
      nameInput.oninput = ()=>{
        SV.settings.playerName = nameInput.value.slice(0,12) || 'Hero';
        store.set('sv_settings', SV.settings);
        updateHUD();
        drawWardrobePreview();
      };
    }

    // gender
    const genderButtons = qsa('.gender-btn');
    genderButtons.forEach(btn=>{
      const g = btn.getAttribute('data-gender');
      if(g === SV.settings.gender){
        btn.classList.add('primary');
      }else{
        btn.classList.remove('primary');
      }
      btn.onclick = ()=>{
        SV.settings.gender = g;
        store.set('sv_settings', SV.settings);
        genderButtons.forEach(b=>b.classList.remove('primary'));
        btn.classList.add('primary');
        buildHairOptions();
        drawWardrobePreview();
      };
    });

    buildHairOptions();
    buildToneOptions();
    buildPantsOptions();
    buildItemOptions();
    buildSkinsGrid();
  }

  function drawCharacterSprite(ctx, x,y, opts){
    const w = 38;
    const h = 58;
    const shirtMap = {
      red:'#ff5a5a', blue:'#4ea8ff', green:'#37d67a',
      purple:'#a06bff', orange:'#ff8d3b', teal:'#17c5b6'
    };
    const shirt = shirtMap[opts.shirt] || '#ff5a5a';
    const pants = opts.pants || PANTS[0];
    const skin = opts.skinTone || SKIN_TONES[0];
    const hairStyle = opts.hairStyle || 'short';
    let hairColor = '#70421b';

    // torso
    ctx.fillStyle = shirt;
    ctx.fillRect(x, y, w, h);

    // head
    ctx.fillStyle = skin;
    ctx.fillRect(x+6, y-18, 26, 18);

    // hair
    ctx.fillStyle = hairColor;
    if(hairStyle === 'short'){
      ctx.fillRect(x+6, y-20, 26, 8);
    }else if(hairStyle === 'side'){
      ctx.fillRect(x+5, y-20, 27, 7);
      ctx.fillRect(x+27, y-13, 7, 10);
    }else if(hairStyle === 'spiky'){
      ctx.fillRect(x+6, y-21, 26, 6);
      for(let i=0;i<5;i++){
        ctx.fillRect(x+8+i*4, y-26, 3, 6);
      }
    }else if(hairStyle === 'bob'){
      ctx.fillRect(x+4, y-19, 30, 10);
      ctx.fillRect(x+34, y-9, 6, 18);
    }else if(hairStyle === 'long'){
      ctx.fillRect(x+6, y-20, 26, 10);
      ctx.fillRect(x+2, y-10, 6, 28);
      ctx.fillRect(x+32, y-10, 6, 28);
    }else if(hairStyle === 'ponytail'){
      ctx.fillRect(x+8, y-20, 24, 8);
      ctx.fillRect(x+26, y-12, 6, 16);
    }else if(hairStyle === 'mohawk'){
      for(let i=0;i<6;i++){
        ctx.fillRect(x+10+i*3, y-24, 2, 10);
      }
    }

    // eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(x+14, y-12, 3, 3);
    ctx.fillRect(x+22, y-12, 3, 3);

    // legs
    ctx.fillStyle = pants;
    ctx.fillRect(x+4, y+36, 12, 22);
    ctx.fillRect(x+22, y+36, 12, 22);

    // arms
    ctx.fillStyle = shirt;
    ctx.fillRect(x-5, y+8, 6, 16);
    ctx.fillRect(x+w, y+8, 6, 16);

    // held item
    ctx.fillStyle = '#cfd9e8';
    if(opts.item === 'sword'){
      ctx.fillRect(x-11, y, 10, 4);
      ctx.fillRect(x-13, y-12, 4, 24);
    }else if(opts.item === 'scepter'){
      ctx.fillStyle='#b88b2b';
      ctx.fillRect(x-8, y+2, 8, 3);
      ctx.beginPath();
      ctx.fillStyle='#ffd54a';
      ctx.arc(x-10, y-2, 5, 0, Math.PI*2);
      ctx.fill();
    }else if(opts.item === 'mallet'){
      ctx.fillStyle='#8b4f2b';
      ctx.fillRect(x-10, y-2, 8, 6);
      ctx.fillRect(x-12, y-12, 4, 24);
    }else if(opts.item === 'cleaver'){
      ctx.fillRect(x-10, y-4, 10, 8);
      ctx.fillStyle='#8b4f2b';
      ctx.fillRect(x-12, y-6, 4, 16);
    }
  }

  function drawWardrobePreview(){
    if(!wardrobePreviewCtx) return;
    const ctx = wardrobePreviewCtx;
    const w = wardrobePreviewCanvas.width;
    const h = wardrobePreviewCanvas.height;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0,0,w,h);
    drawCharacterSprite(ctx, w/2-20, h/2-10, {
      shirt:SV.settings.shirt,
      pants:SV.settings.pants,
      skinTone:SV.settings.skinTone,
      hairStyle:SV.settings.hairStyle,
      item:SV.settings.item
    });
  }

  function buildHairOptions(){
    const row = qs('#hairstyle-options');
    if(!row) return;
    row.innerHTML='';
    const styles = HAIR_STYLES[SV.settings.gender] || HAIR_STYLES.m;
    styles.forEach(style=>{
      const btn = document.createElement('button');
      btn.className = 'item-swatch';
      btn.textContent = style;
      if(style === SV.settings.hairStyle) btn.classList.add('primary');
      btn.onclick = ()=>{
        SV.settings.hairStyle = style;
        store.set('sv_settings', SV.settings);
        buildHairOptions();
        drawWardrobePreview();
      };
      row.appendChild(btn);
    });
  }

  function buildToneOptions(){
    const row = qs('#skin-tone-row');
    if(!row) return;
    row.innerHTML='';
    SKIN_TONES.forEach(tone=>{
      const b = document.createElement('button');
      b.className = 'color-swatch';
      b.style.background = tone;
      if(tone === SV.settings.skinTone){
        b.style.boxShadow = '0 0 0 3px #fff';
      }
      b.onclick = ()=>{
        SV.settings.skinTone = tone;
        store.set('sv_settings', SV.settings);
        buildToneOptions();
        drawWardrobePreview();
      };
      row.appendChild(b);
    });
  }

  function buildPantsOptions(){
    const row = qs('#pants-row');
    if(!row) return;
    row.innerHTML='';
    PANTS.forEach(col=>{
      const b = document.createElement('button');
      b.className = 'color-swatch';
      b.style.background = col;
      if(col === SV.settings.pants){
        b.style.boxShadow = '0 0 0 3px #fff';
      }
      b.onclick = ()=>{
        SV.settings.pants = col;
        store.set('sv_settings', SV.settings);
        buildPantsOptions();
        drawWardrobePreview();
      };
      row.appendChild(b);
    });
  }

  function buildItemOptions(){
    const row = qs('#item-row');
    if(!row) return;
    const items = qsa('.item-swatch', row);
    items.forEach(btn=>{
      const item = btn.getAttribute('data-item');
      if(item === SV.settings.item){
        btn.classList.add('primary');
      }else{
        btn.classList.remove('primary');
      }
      btn.onclick = ()=>{
        SV.settings.item = item;
        store.set('sv_settings', SV.settings);
        buildItemOptions();
        drawWardrobePreview();
      };
    });
  }

  function buildSkinsGrid(){
    const grid = qs('#skins-grid');
    if(!grid) return;
    grid.innerHTML = '';

    // Use achievements as simple unlock flags
    const unlocked = SV.progress.ach || {};

    const skins = [
      { id:'skin1', name:'Cone Knight', rarity:'uncommon', requires:'beat_boss1' },
      { id:'skin2', name:'Blizzard Mage', rarity:'rare', requires:'long_run' },
      { id:'skin3', name:'Kind Legend', rarity:'epic', requires:'kind_only' },
      { id:'skin4', name:'Final Boss Slayer', rarity:'legendary', requires:'beat_boss2' }
    ];

    skins.forEach(skin=>{
      const card = document.createElement('div');
      card.className = 'skin-card';
      card.dataset.rarity = skin.rarity;

      const inner = document.createElement('div');
      inner.className = 'inner';

      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = skin.name;

      const locked = !unlocked[skin.requires];
      if(locked){
        card.classList.add('locked');
        const q = document.createElement('div');
        q.className = 'qmark';
        q.textContent = '?';
        card.appendChild(q);
      }

      // simple skin preview
      const c = document.createElement('canvas');
      c.width = 80;
      c.height = 110;
      const cctx = c.getContext('2d');
      drawCharacterSprite(cctx, 24, 50, {
        shirt:SV.settings.shirt,
        pants:SV.settings.pants,
        skinTone:SV.settings.skinTone,
        hairStyle:SV.settings.hairStyle,
        item:SV.settings.item
      });

      inner.appendChild(c);
      card.appendChild(inner);
      card.appendChild(label);

      if(!locked){
        if(SV.settings.skin === skin.id){
          card.classList.add('selected');
        }
        card.onclick = ()=>{
          if(SV.settings.skin === skin.id){
            SV.settings.skin = null;
          }else{
            SV.settings.skin = skin.id;
          }
          store.set('sv_settings', SV.settings);
          buildSkinsGrid();
          drawWardrobePreview();
        };
      }

      grid.appendChild(card);
    });

    const saveBtn = qs('#save-skin');
    if(saveBtn){
      saveBtn.onclick = ()=>{
        closePopup(SV.popups.wardrobe);
      };
    }
    const clearBtn = qs('#clear-skin');
    if(clearBtn){
      clearBtn.onclick = ()=>{
        SV.settings.skin = null;
        store.set('sv_settings', SV.settings);
        buildSkinsGrid();
        drawWardrobePreview();
      };
    }
  }

  /* ---------- clues ---------- */

  function buildCluesList(){
    const list = qs('#clues-list');
    if(!list) return;
    list.innerHTML = '';

    const unlocked = SV.progress.unlockedClues || {};
    const entries = [];

    for(let i=1;i<=9;i++){
      if(unlocked[i]) entries.push({ label:`Clue ${i}`, text:CLUES[i] });
    }
    if(unlocked.final){
      entries.push({ label:'Final Clue', text:CLUES.final });
    }

    if(entries.length === 0){
      const li = document.createElement('li');
      li.textContent = 'Play more to unlock clues.';
      list.appendChild(li);
      return;
    }

    entries.forEach(c=>{
      const li = document.createElement('li');
      li.textContent = c.text;
      list.appendChild(li);
    });
  }

  function maybeUnlockClues(deltaMs){
    SV.totalPlayMs += deltaMs;
    store.set('sv_total_ms', SV.totalPlayMs);

    const mins = Math.floor(SV.totalPlayMs / 60000);
    let changed = false;

    for(let i=1;i<=9;i++){
      if(mins >= i && !SV.progress.unlockedClues[i]){
        SV.progress.unlockedClues[i] = true;
        changed = true;
      }
    }
    if(mins >= 45 && !SV.progress.unlockedClues.final){
      SV.progress.unlockedClues.final = true;
      changed = true;
    }
    if(changed){
      store.set('sv_progress', SV.progress);
    }
  }

  /* ---------- lore ---------- */

  function drawLoreCanvases(){
    const c1 = qs('#lore-boss1');
    const c2 = qs('#lore-boss2');
    if(c1){
      const ctx = c1.getContext('2d');
      const w = c1.width, h = c1.height;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0,0,w,h);
      // teen troll: face + phone
      ctx.fillStyle = '#ffd5b5';
      ctx.fillRect(22,18,52,40); // face
      ctx.fillStyle = '#f6c1ff';
      ctx.fillRect(16,10,60,20); // hair block
      ctx.fillStyle = '#000';
      ctx.fillRect(34,30,6,4);
      ctx.fillRect(52,30,6,4);   // eyes
      ctx.fillRect(40,40,12,4);  // mouth
      ctx.fillStyle = '#ddd';
      ctx.fillRect(70,26,10,20); // phone
    }
    if(c2){
      const ctx = c2.getContext('2d');
      const w = c2.width, h = c2.height;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#f2d1a8';
      ctx.beginPath();
      ctx.arc(w/2, h/2+4, 28, 0, Math.PI*2);
      ctx.fill(); // head
      ctx.fillStyle = '#e1b27b';
      ctx.fillRect(w/2-24, h/2-20, 48, 14); // brow
      ctx.fillStyle = '#000';
      ctx.fillRect(w/2-12, h/2-6, 6,4);
      ctx.fillRect(w/2+6,  h/2-6, 6,4);
      ctx.fillRect(w/2-10, h/2+6, 20,3);    // mouth
    }
  }

  /* ---------- achievements ---------- */

  function awardAchievement(id){
    if(!id) return;
    if(!SV.progress.ach) SV.progress.ach = {};
    if(SV.progress.ach[id]) return;
    SV.progress.ach[id] = true;
    store.set('sv_progress', SV.progress);
  }

  function buildAchievementsGrid(){
    const grid = qs('#achievements-grid');
    if(!grid) return;
    grid.innerHTML = '';
    const have = SV.progress.ach || {};
    ACHIEVEMENTS.forEach(a=>{
      const tile = document.createElement('div');
      tile.className = 'achievement-tile';
      if(have[a.id]){
        tile.classList.add('unlocked');
      }else{
        tile.classList.add('locked');
        const lock = document.createElement('div');
        lock.className = 'lock-ghost';
        lock.textContent = '🔒';
        tile.appendChild(lock);
      }
      const title = document.createElement('div');
      title.style.fontWeight = 'bold';
      title.style.marginBottom = '4px';
      title.textContent = a.title;
      const desc = document.createElement('div');
      desc.textContent = a.desc;
      tile.appendChild(title);
      tile.appendChild(desc);
      grid.appendChild(tile);
    });
  }

  /* ---------- HUD ---------- */

  function updateHUD(){
    if(SV.ui.playerNameDisplay){
      SV.ui.playerNameDisplay.textContent = SV.settings.playerName || 'Hero';
    }
    if(SV.ui.levelDisplay){
      SV.ui.levelDisplay.textContent = `Level ${SV.level}`;
    }
    if(SV.ui.scoreDisplay){
      SV.ui.scoreDisplay.textContent = Math.floor(SV.score);
    }
    if(SV.ui.alltimeDisplay){
      SV.ui.alltimeDisplay.textContent = Math.floor(SV.progress.allTimeScore || 0);
    }

    if(SV.ui.shieldChip){
      if(SV.shieldStacks>0 || SV.shieldInvMs>0){
        SV.ui.shieldChip.classList.remove('hidden');
        SV.ui.shieldCount.textContent = SV.shieldStacks;
      }else{
        SV.ui.shieldChip.classList.add('hidden');
      }
    }

    if(SV.ui.jetpackChip){
      if(SV.jetpack){
        SV.ui.jetpackChip.classList.remove('hidden');
        SV.ui.jetpackCount.textContent = Math.ceil(SV.jetpackMs/1000);
      }else{
        SV.ui.jetpackChip.classList.add('hidden');
      }
    }
  }

  function setLevelProgress(percent){
    if(!SV.ui.levelBar) return;
    SV.ui.levelBar.style.width = `${clamp(percent,0,100)}%`;
  }

  /* ---------- play button flow ---------- */

  function onPlayPressed(){
    // story mode only for now; endless unlocked later
    if(SV.progress.lastCheckpoint && SV.progress.lastCheckpoint>1){
      // show choice popup
      openPopup(SV.popups.start);
    }else{
      startStoryRun(1, true);
    }
  }

  /* ---------- game start/stop ---------- */

  function startStoryRun(level, fromBeginning){
    SV.mode = 'story';
    SV.level = level || 1;
    SV.levelTime = 0;
    SV.runTime = 0;
    SV.score = 0;
    SV.hazards.length = 0;
    SV.powerups.length = 0;
    SV.invulnMs = 0;
    SV.shieldStacks = 0;
    SV.shieldInvMs = 0;
    SV.laserMs = 0;
    SV.laserIframeMs = 0;
    SV.jetpack = false;
    SV.jetpackMs = 0;
    SV.jetpackLandIframeMs = 0;
    SV.player.x = 120;
    SV.player.y = SV.groundY - SV.player.h;
    SV.player.vy = 0;
    SV.player.onGround = true;
    SV.player.jumpsUsed = 0;

    // boss flags
    SV.boss1Active = false;
    SV.boss1ProjCount = 0;
    SV.boss1ProjDodged = 0;
    SV.boss1QuoteTimer = 0;
    SV.boss1Quote = '';
    SV.boss1HP = 1;

    SV.rpg.active = false;
    hideRpgOverlay();

    showScreen('game');
    playMusic(level>=5 ? 'boss' : 'game');
    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();
    requestAnimationFrame(gameLoop);

    updateHUD();
  }

  function startEndlessRun(){
    if(!SV.progress.endlessUnlocked){
      alert('Endless Mode unlocks after beating the final boss.');
      return;
    }
    SV.mode = 'endless';
    SV.level = 0; // endless pseudo-level
    SV.levelTime = 0;
    SV.runTime = 0;
    SV.score = 0;
    SV.hazards.length = 0;
    SV.powerups.length = 0;
    SV.invulnMs = 0;
    SV.shieldStacks = 0;
    SV.shieldInvMs = 0;
    SV.laserMs = 0;
    SV.laserIframeMs = 0;
    SV.jetpack = false;
    SV.jetpackMs = 0;
    SV.jetpackLandIframeMs = 0;
    SV.player.x = 120;
    SV.player.y = SV.groundY - SV.player.h;
    SV.player.vy = 0;
    SV.player.onGround = true;
    SV.player.jumpsUsed = 0;

    SV.scrollSpeed = SV.baseScrollSpeed;

    showScreen('game');
    playMusic('game');
    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();
    requestAnimationFrame(gameLoop);
    updateHUD();
  }

  function stopGameToHome(){
    SV.running = false;
    SV.paused = false;
    showScreen('home');
    playMusic('home');
  }

  function resumeGame(){
    if(!SV.running) return;
    SV.paused = false;
    SV.lastTs = performance.now();
    requestAnimationFrame(gameLoop);
  }

  /* ---------- jump ---------- */

  function doJump(){
    if(!SV.running || SV.paused || SV.rpg.active) return;
    const p = SV.player;
    const maxJumps = 2;
    if(p.onGround || p.jumpsUsed < maxJumps){
      playSfx(SFX.jump);
      if(p.jumpsUsed === 0){
        p.vy = SV.jumpStrength;
      }else{
        p.vy = SV.doubleJumpStrength;
      }
      p.onGround = false;
      p.jumpsUsed++;
      SV.progress.jumps = (SV.progress.jumps || 0) + 1;
      if(SV.progress.jumps >= 100) awardAchievement('100_jumps');
      store.set('sv_progress', SV.progress);
    }
  }

  /* ---------- RPG overlay (Boss 2) ---------- */

  function setupRpgOverlay(){
    if(!SV.rpg.element) return;
    SV.rpg.buttons.forEach(btn=>{
      btn.onclick = null;
    });
  }

  function startBoss2Rpg(){
    SV.rpg.active = true;
    SV.running = false; // pause canvas runner
    SV.mode = 'story';
    showRpgOverlay();
    SV.rpg.hp = 100;
    SV.rpg.maxHp = 100;
    SV.rpg.kindOnly = true;
    SV.rpg.optionsPool = shuffleArray(BOSS2_ATTACKS.slice());
    refreshRpgOptions();
    clearRpgLog();
    appendRpgLog("Big Boss Head: \"You again? I thought student loans would finish you off.\"");
  }

  function showRpgOverlay(){
    if(SV.rpg.element){
      SV.rpg.element.classList.remove('hidden');
    }
  }

  function hideRpgOverlay(){
    if(SV.rpg.element){
      SV.rpg.element.classList.add('hidden');
    }
  }

  function refreshRpgOptions(){
    if(!SV.rpg.buttons || SV.rpg.buttons.length === 0) return;
    // ensure pool has options; if not, refill except maybe doesn't repeat all
    if(SV.rpg.optionsPool.length < 4){
      SV.rpg.optionsPool = shuffleArray(BOSS2_ATTACKS.slice());
    }
    const slice = SV.rpg.optionsPool.splice(0,4);
    SV.rpg.buttons.forEach((btn, idx)=>{
      const data = slice[idx];
      if(!data){
        btn.disabled = true;
        btn.textContent = '...';
        btn.onclick = null;
      }else{
        btn.disabled = false;
        btn.textContent = data.text;
        btn.onclick = ()=> handleRpgChoice(data);
      }
    });
    updateBoss2HpBar();
  }

  function handleRpgChoice(data){
    if(!SV.rpg.active) return;
    if(data.kind !== true){
      SV.rpg.kindOnly = false;
    }
    // pseudo-laser and HP
    const dmg = data.dmg || 5;
    SV.rpg.hp = Math.max(0, SV.rpg.hp - dmg);
    appendRpgLog(`You: "${data.text}"`);
    appendRpgLog(`Big Boss Head: "${data.reaction}"`);
    updateBoss2HpBar();

    if(SV.rpg.hp <= 0){
      // boss death
      appendRpgLog('Big Boss Head: "I do not consent to Facebook… from my Facebook page!"');
      SV.progress.beatBoss2 = true;
      SV.progress.endlessUnlocked = true;
      awardAchievement('beat_boss2');
      if(SV.rpg.kindOnly){
        awardAchievement('kind_only');
      }
      SV.progress.lastCheckpoint = 10; // fully cleared
      store.set('sv_progress', SV.progress);
      SV.rpg.active = false;
      setTimeout(()=>{
        hideRpgOverlay();
        showWinAndCreditsPrompt();
      }, 1200);
    }else{
      refreshRpgOptions();
    }
  }

  function showWinAndCreditsPrompt(){
    alert('YOU WIN!\n\nBig Boss Head has been defeated.\nEndless Mode unlocked.');
    // credits hook: if a credits popup/screen exists in your HTML in the future,
    // you can open it here; for now, just return to home.
    stopGameToHome();
  }

  function clearRpgLog(){
    if(SV.rpg.logEl){
      SV.rpg.logEl.innerHTML = '';
    }
  }

  function appendRpgLog(line){
    if(!SV.rpg.logEl) return;
    const div = document.createElement('div');
    div.textContent = line;
    SV.rpg.logEl.appendChild(div);
    SV.rpg.logEl.scrollTop = SV.rpg.logEl.scrollHeight;
  }

  function updateBoss2HpBar(){
    const bar = qs('#boss-hp-bar');
    if(!bar) return;
    const pct = SV.rpg.hp / SV.rpg.maxHp;
    bar.style.width = (pct*100)+'%';
  }

  function shuffleArray(arr){
    for(let i=arr.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ---------- MAIN INIT ---------- */

  function init(){
    cacheDOM();
    bindTitle();
    bindSettings();
    bindHomeMenu();
    bindGameControls();
    bindPopupCloses();
    setupDevTapCorner();
    setupRpgOverlay();
    updateHUD();
    playMusic('title');
    showScreen('title');

    // Endless button (if/when added to HTML) can hook to startEndlessRun
    const endlessBtn = qs('#endless-btn');
    if(endlessBtn){
      endlessBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        startEndlessRun();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

/* ----- END OF PART 1 / CONTINUED BELOW ----- */
 /* =========================================================
   SWEETARIA: VENGEANCE — Alpha JS (Part 2)
   Continues from Part 1, same IIFE scope.
   ========================================================= */

  /* ---------- GAME LOOP ---------- */

  function gameLoop(ts){
    if(!SV.running) return;
    const dt = ts - SV.lastTs;
    SV.lastTs = ts;
    if(!SV.paused && !SV.rpg.active){
      updateGame(dt);
      drawGame();
    }
    requestAnimationFrame(gameLoop);
  }

  function updateGame(dt){
    SV.levelTime += dt;
    SV.runTime += dt;
    SV.score += dt * 0.02;  // score over time
    SV.progress.allTimeScore += dt * 0.02;
    store.set('sv_progress', SV.progress);

    maybeUnlockClues(dt);

    // long_run achievement: 10 min in single run
    if(SV.runTime >= 10*60*1000){
      awardAchievement('long_run');
    }

    updateHUD();

    // endless difficulty scaling
    if(SV.mode === 'endless'){
      const steps = Math.floor(SV.levelTime / ENDLESS_DIFFICULTY_STEP_MS);
      SV.scrollSpeed = SV.baseScrollSpeed * (1 + steps*0.15);
    }

    // level progress bar (hide on bosses)
    if(SV.mode === 'story' && SV.level !== 5 && SV.level !== 10){
      const pct = (SV.levelTime / (LV_SECONDS*1000))*100;
      setLevelProgress(pct);
      if(SV.levelTime >= LV_SECONDS*1000){
        // level complete
        if(SV.level === 4){
          // checkpoint at level 5
          SV.progress.lastCheckpoint = 5;
          store.set('sv_progress', SV.progress);
        }
        if(SV.level < 10){
          SV.level++;
          SV.levelTime = 0;
          SV.hazards.length = 0;
          SV.powerups.length = 0;
          updateHUD();
        }else{
          // finishing level 10 should route into boss 2, but we treat
          // boss2 as a separate path that triggers earlier.
        }
      }
    }else if(SV.mode === 'story' && (SV.level === 5 || SV.level === 10)){
      setLevelProgress(0);
    }else if(SV.mode === 'endless'){
      setLevelProgress(0);
    }

    // timers
    if(SV.invulnMs>0) SV.invulnMs -= dt;
    if(SV.shieldInvMs>0) SV.shieldInvMs -= dt;
    if(SV.laserMs>0) SV.laserMs -= dt;
    if(SV.laserIframeMs>0) SV.laserIframeMs -= dt;
    if(SV.jetpackMs>0){
      SV.jetpackMs -= dt;
      if(SV.jetpackMs<=0){
        SV.jetpack = false;
        SV.jetpackLandIframeMs = JETPACK_LAND_IFRAME_MS;
      }
    }
    if(SV.jetpackLandIframeMs>0){
      SV.jetpackLandIframeMs -= dt;
    }

    // player physics
    updatePlayer(dt);

    // spawn hazards & powerups
    if(SV.level === 5 && SV.mode === 'story'){
      updateBoss1(dt);
    }else if(SV.mode === 'story' || SV.mode === 'endless'){
      updateHazards(dt);
      updatePowerups(dt);
    }

    // collisions
    handleCollisions(dt);
  }

  function updatePlayer(dt){
    const p = SV.player;
    // small tilt for jump float while holding jump could be added later
    if(SV.jetpack){
      // hover slightly above ground
      p.vy = 0;
      p.y = SV.groundY - p.h - 60;
      p.onGround = false;
    }else{
      p.vy += SV.gravity * dt;
      p.y += p.vy * dt;
      if(p.y >= SV.groundY - p.h){
        p.y = SV.groundY - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpsUsed = 0;
      }else{
        p.onGround = false;
      }
    }
  }

  /* ---------- hazard & powerup spawning ---------- */

  function updateHazards(dt){
    SV.hazardSpawnMs += dt;
    if(SV.hazardSpawnMs >= SV.nextHazardIn){
      SV.hazardSpawnMs = 0;
      SV.nextHazardIn = randRange(900, 1600); // base; tuned with +5% difficulty
      spawnHazard();
    }
    // move
    for(let i=SV.hazards.length-1; i>=0; i--){
      const h = SV.hazards[i];
      h.x -= SV.scrollSpeed * dt * h.speedMul;
      if(h.x + h.w < -50){
        SV.hazards.splice(i,1);
      }
    }
  }

  function spawnHazard(){
    const types = ['box','fire','spike'];
    const type = pick(types);
    const baseY = SV.groundY-28;
    let h = { type, x: SV.canvas.width + 40, y: baseY, w:40, h:28, damage:1, speedMul:1 };
    if(type === 'fire'){
      h.h = 34;
      h.y = SV.groundY - h.h;
      h.speedMul = 1.1;
    }else if(type === 'spike'){
      h.w = 30;
      h.h = 26;
      h.y = SV.groundY - h.h;
      h.speedMul = 1.15;
    }else{
      h.speedMul = 1.05;
    }
    SV.hazards.push(h);
  }

  function updatePowerups(dt){
    SV.nextPowerupIn -= dt;
    if(SV.nextPowerupIn <= 0){
      SV.nextPowerupIn = randRange(12000, 22000);
      spawnPowerup();
    }
    for(let i=SV.powerups.length-1;i>=0;i--){
      const p = SV.powerups[i];
      p.x -= SV.scrollSpeed * dt * 0.9;
      if(p.x + p.size < -40){
        SV.powerups.splice(i,1);
      }
    }
  }

  function spawnPowerup(){
    const types = [POWERUP_KIND.SHIELD, POWERUP_KIND.JETPACK, POWERUP_KIND.LASER];
    const kind = pick(types);
    const size = 26;
    const y = SV.groundY - size - randRange(50, 120);
    SV.powerups.push({
      kind,
      x: SV.canvas.width + 40,
      y,
      size
    });
  }

  /* ---------- boss 1 ---------- */

  function updateBoss1(dt){
    if(!SV.boss1Active){
      SV.boss1Active = true;
      SV.boss1ProjCount = 0;
      SV.boss1ProjDodged = 0;
      SV.boss1QuoteTimer = 0;
      SV.boss1Quote = pick(BOSS1_QUOTES);
    }

    SV.hazardSpawnMs += dt;
    if(SV.hazardSpawnMs >= LV5_PROJECTILE_INTERVAL){
      SV.hazardSpawnMs = 0;
      spawnBoss1Projectile();
    }

    // move projectiles
    for(let i=SV.hazards.length-1;i>=0;i--){
      const proj = SV.hazards[i];
      proj.x -= SV.scrollSpeed * dt * 1.1;
      if(proj.x + proj.w < -50){
        SV.hazards.splice(i,1);
        SV.boss1ProjDodged++;
      }
    }

    // quotes
    SV.boss1QuoteTimer += dt;
    if(SV.boss1QuoteTimer >= 2200){
      SV.boss1QuoteTimer = 0;
      SV.boss1Quote = pick(BOSS1_QUOTES);
    }

    // pseudo HP: based on dodge progress
    const progress = clamp(SV.boss1ProjDodged / LV5_PROJECTILES_TARGET, 0, 1);
    SV.boss1HP = 1-progress;

    if(SV.boss1ProjDodged >= LV5_PROJECTILES_TARGET){
      // victory
      SV.progress.beatBoss1 = true;
      awardAchievement('beat_boss1');
      SV.progress.lastCheckpoint = Math.max(SV.progress.lastCheckpoint||0, 6);
      store.set('sv_progress', SV.progress);
      SV.running = false;
      alert('You survived the Cell Phone Teen Troll.\n\nCheckpoint updated to Level 6.');
      stopGameToHome();
    }
  }

  function spawnBoss1Projectile(){
    // emoji bubble from right, at one of three heights
    const lanesY = [
      SV.groundY - 36,
      SV.groundY - 100,
      SV.groundY - 170
    ];
    const y = pick(lanesY);
    SV.hazards.push({
      type:'emoji',
      x: SV.canvas.width + 40,
      y,
      w:34,
      h:34,
      damage:1,
      speedMul:1.05
    });
    SV.boss1ProjCount++;
  }

  /* ---------- collisions ---------- */

  function handleCollisions(dt){
    const p = SV.player;
    const px = p.x;
    const py = p.y;
    const pw = p.w;
    const ph = p.h;

    const invSafe = (SV.invulnMs>0 || SV.shieldInvMs>0 || SV.jetpackLandIframeMs>0 || SV.laserIframeMs>0);

    // powerups
    for(let i=SV.powerups.length-1;i>=0;i--){
      const pow = SV.powerups[i];
      if(rectsOverlap(px,py,pw,ph, pow.x,pow.y,pow.size,pow.size)){
        SV.powerups.splice(i,1);
        if(pow.kind === POWERUP_KIND.SHIELD){
          SV.shieldStacks = clamp(SV.shieldStacks+1,0,3);
          if(SV.shieldStacks >= 3){
            SV.shieldStacks = 0;
            SV.shieldInvMs = SHIELD_INV_MS;
          }
          playSfx(SFX.shield);
        }else if(pow.kind === POWERUP_KIND.JETPACK){
          SV.jetpack = true;
          SV.jetpackMs = JETPACK_MS;
          playSfx(SFX.jetpack);
        }else if(pow.kind === POWERUP_KIND.LASER){
          SV.laserMs += LASER_BASE_MS;
          SV.laserIframeMs = LASER_IFRAME_MS;
          playSfx(SFX.laser);
        }
      }
    }

    // hazards
    for(let i=SV.hazards.length-1;i>=0;i--){
      const h = SV.hazards[i];

      // laser auto-kill
      if(SV.laserMs>0 && SV.level !== 10){
        if(laserHitsHazard(h)){
          SV.hazards.splice(i,1);
          continue;
        }
      }

      if(invSafe) continue;

      if(rectsOverlap(px,py,pw,ph, h.x,h.y,h.w,h.h)){
        // apply shield / invuln
        if(SV.shieldStacks>0){
          SV.shieldStacks--;
          SV.invulnMs = 800;
          SV.hazards.splice(i,1);
          continue;
        }
        if(SV.shieldInvMs>0 || SV.jetpackLandIframeMs>0 || SV.laserIframeMs>0){
          SV.hazards.splice(i,1);
          continue;
        }
        // actual death
        onPlayerDeath();
        break;
      }
    }
  }

  function laserHitsHazard(h){
    if(SV.laserMs<=0) return false;
    const p = SV.player;
    const laserX0 = p.x + p.w;
    const laserX1 = SV.canvas.width + 20;
    let laserY0, laserY1;
    if(p.onGround){
      laserY0 = p.y + 6;
      laserY1 = p.y + 6 + LASER_THICKNESS_GROUND;
    }else{
      laserY0 = p.y + 2;
      laserY1 = p.y + 2 + LASER_THICKNESS_AIR;
    }
    return rectsOverlap(laserX0, laserY0, (laserX1-laserX0), (laserY1-laserY0),
                        h.x, h.y, h.w, h.h);
  }

  function rectsOverlap(x1,y1,w1,h1, x2,y2,w2,h2){
    return !(x1+w1 < x2 || x2+w2 < x1 || y1+h1 < y2 || y2+h2 < x1) &&
           !(y1+h1 < y2 || y2+h2 < y1);
  }

  /* ---------- death handling ---------- */

  function onPlayerDeath(){
    SV.running = false;
    SV.paused = false;

    // endless best
    if(SV.mode === 'endless'){
      if(SV.score > (SV.progress.endlessBest||0)){
        SV.progress.endlessBest = SV.score;
      }
      store.set('sv_progress', SV.progress);
    }

    const msg = SV.mode === 'endless'
      ? `You died.\n\nScore this run: ${Math.floor(SV.score)}\nBest Endless: ${Math.floor(SV.progress.endlessBest||0)}`
      : `You died on Level ${SV.level}.`;

    const choice = prompt(
      msg + `\n\nType:\nC = restart from Checkpoint\nB = restart from Beginning\nM = Exit to Main Menu`,
      'C'
    );
    if(!choice) {
      stopGameToHome();
      return;
    }
    const c = choice.trim().toUpperCase();
    if(c === 'C' && SV.mode === 'story'){
      const lv = SV.progress.lastCheckpoint || 1;
      startStoryRun(lv, false);
    }else if(c === 'B' && SV.mode === 'story'){
      startStoryRun(1, true);
    }else{
      stopGameToHome();
    }
  }

  /* ---------- drawing ---------- */

  function drawGame(){
    const ctx = SV.ctx;
    const w = SV.canvas.width;
    const h = SV.canvas.height;
    ctx.clearRect(0,0,w,h);

    // background
    drawBackground(ctx,w,h);

    // ground
    ctx.fillStyle = '#1a2435';
    ctx.fillRect(0, SV.groundY, w, h-SV.groundY);

    // hazards
    SV.hazards.forEach(hz=>{
      if(hz.type === 'emoji'){
        ctx.fillStyle = '#ffec65';
        ctx.beginPath();
        ctx.arc(hz.x+hz.w/2, hz.y+hz.h/2, hz.w/2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(hz.x+8, hz.y+10, 4,4);
        ctx.fillRect(hz.x+hz.w-12, hz.y+10, 4,4);
        ctx.fillRect(hz.x+10, hz.y+hz.h-12, hz.w-20,3);
      }else if(hz.type === 'fire'){
        ctx.fillStyle='#ff5a3c';
        ctx.beginPath();
        ctx.moveTo(hz.x, hz.y+hz.h);
        ctx.lineTo(hz.x+hz.w/2, hz.y);
        ctx.lineTo(hz.x+hz.w, hz.y+hz.h);
        ctx.closePath();
        ctx.fill();
      }else if(hz.type === 'spike'){
        ctx.fillStyle='#cfd5e6';
        ctx.beginPath();
        ctx.moveTo(hz.x, hz.y+hz.h);
        ctx.lineTo(hz.x+hz.w/2, hz.y);
        ctx.lineTo(hz.x+hz.w, hz.y+hz.h);
        ctx.closePath();
        ctx.fill();
      }else{
        ctx.fillStyle='#c1cee0';
        ctx.fillRect(hz.x,hz.y,hz.w,hz.h);
      }
    });

    // powerups
    SV.powerups.forEach(p=>{
      if(p.kind === POWERUP_KIND.SHIELD){
        ctx.fillStyle='#6ff2ff';
      }else if(p.kind === POWERUP_KIND.JETPACK){
        ctx.fillStyle='#ffcc4a';
      }else{
        ctx.fillStyle='#ff6bb5';
      }
      ctx.beginPath();
      ctx.arc(p.x+p.size/2, p.y+p.size/2, p.size/2, 0, Math.PI*2);
      ctx.fill();
    });

    // player
    drawCharacterSprite(ctx, SV.player.x, SV.player.y, {
      shirt:SV.settings.shirt,
      pants:SV.settings.pants,
      skinTone:SV.settings.skinTone,
      hairStyle:SV.settings.hairStyle,
      item:SV.settings.item
    });

    // laser beam (if active)
    if(SV.laserMs>0 && SV.level!==10){
      const p = SV.player;
      const x0 = p.x + p.w;
      const x1 = w+10;
      let y0,y1;
      if(p.onGround){
        y0 = p.y+6;
        y1 = y0 + LASER_THICKNESS_GROUND;
      }else{
        y0 = p.y+2;
        y1 = y0 + LASER_THICKNESS_AIR;
      }
      ctx.fillStyle='rgba(255,120,220,0.85)';
      ctx.fillRect(x0, y0, x1-x0, y1-y0);
    }

    // boss1 overlay
    if(SV.level === 5 && SV.mode === 'story'){
      drawBoss1Ui(ctx,w,h);
    }
  }

  function drawBackground(ctx,w,h){
    const t = performance.now()*0.00005;
    // far gradient
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#060914');
    g.addColorStop(0.5, '#081021');
    g.addColorStop(1, '#05060b');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // parallax layers
    ctx.fillStyle='rgba(40,60,110,0.25)';
    for(let i=0;i<5;i++){
      const offset = ((t*40)+(i*60)) % (w+200);
      ctx.fillRect(-offset,120+i*24, 260,12);
      ctx.fillRect(-offset+340,140+i*24, 220,10);
    }
    ctx.fillStyle='rgba(80,120,200,0.28)';
    for(let i=0;i<4;i++){
      const offset = ((t*70)+(i*200)) % (w+260);
      ctx.fillRect(-offset,60+i*34, 260,6);
    }
  }

  function drawBoss1Ui(ctx,w,h){
    // fake HP bar
    const barW = 260;
    const barH = 12;
    const x = w/2 - barW/2;
    const y = 28;
    ctx.fillStyle='rgba(0,0,0,0.5)';
    ctx.fillRect(x,y,barW,barH);
    ctx.fillStyle='#ff7bc5';
    ctx.fillRect(x,y, barW*(1-SV.boss1HP), barH);
    ctx.strokeStyle='rgba(255,255,255,0.6)';
    ctx.strokeRect(x,y,barW,barH);
    ctx.fillStyle='#fff';
    ctx.font='12px monospace';
    ctx.fillText('Cell Phone Teen Troll', x, y-6);

    // quote
    if(SV.boss1Quote){
      ctx.fillStyle='#ffd6ff';
      ctx.font='11px monospace';
      ctx.fillText(SV.boss1Quote, w/2 - ctx.measureText(SV.boss1Quote).width/2, y+barH+18);
    }
  }

  /* ---------- export IIFE end ---------- */

})();
