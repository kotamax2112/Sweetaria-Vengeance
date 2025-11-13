/* =========================================================
   SWEETARIA: VENGEANCE
   Alpha Build 1.2.1 JS
   - Fixes: Wardrobe tabs, shirt selection, credits wiring.
   - Updates: Expanded achievements, enhanced lore art.
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

  const LV_SECONDS = 60;
  const LV5_PROJECTILES_TARGET = 40;
  const LV5_PROJECTILE_INTERVAL = 900;

  const LASER_BASE_MS = 6500;
  const LASER_THICKNESS_GROUND = 16;
  const LASER_THICKNESS_AIR = 22;
  const LASER_IFRAME_MS = 1000;

  const SHIELD_INV_MS = 20000;
  const JETPACK_MS = 8000;
  const JETPACK_LAND_IFRAME_MS = 1500;

  const ENDLESS_DIFFICULTY_STEP_MS = 30000;

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

  /* UPDATED ACHIEVEMENTS LIST */
  const ACHIEVEMENTS = [
    { id:'beat_boss1',  title:'Emoji Dodger',     desc:'Defeat Cell Phone Teen Troll (Lv5)' },
    { id:'beat_boss2',  title:'Final Blow',       desc:'Defeat Big Boss Head (Lv10)' },
    { id:'kind_only',   title:'Kindness Wins',    desc:'Defeat Boss 2 using ONLY Kindness' },
    { id:'100_jumps',   title:'Hops Master',      desc:'Perform 100 jumps total' },
    { id:'long_run',    title:'Endurer',          desc:'Survive 10 minutes in one run' },
    { id:'die_lot',     title:'Glutton',          desc:'Die 10 times total' },
    { id:'shield_max',  title:'Invincible',       desc:'Collect 3 shields at once' },
    { id:'sky_high',    title:'Astronaut',        desc:'Use the Jetpack for 30s total' },
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

    mode:'title',
    level:1,
    levelTime:0,
    runTime:0,
    score:0,

    player:{
      x:120, y:0, w:42, h:64, vy:0, onGround:false, jumpsUsed:0
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
    boss1HP:1, 
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

    devTapTimes:[],
    shareHoldTimer:null
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
      settings:qs('#settings-popup'),
      credits:qs('#credits-popup'),
      death:qs('#death-popup'),
      confirm:qs('#confirm-return')
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

  /* UPDATED SETTINGS BINDING (Fixes Credits) */
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
        store.del('sv_progress');
        store.del('sv_total_ms');
        window.location.reload();
      });
    }

    // CREDITS WIRING
    const creditsBtn = qs('#open-credits-btn');
    if(creditsBtn && SV.popups.credits){
      creditsBtn.addEventListener('click', ()=>{
        playSfx(SFX.click);
        closePopup(SV.popups.settings);
        openPopup(SV.popups.credits);
      });
    }

    const closeCredits = qs('#close-credits');
    if(closeCredits){
      closeCredits.addEventListener('click', ()=>{
        playSfx(SFX.click);
        closePopup(SV.popups.credits);
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

    const handleJumpDown = (e)=>{ e.preventDefault(); doJump(); };
    const handleJumpUp = (e)=>{ e.preventDefault(); };

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
    qsa('.close-btn').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        // generic closer if not handled elsewhere
        const popup = btn.closest('.popup');
        if(popup) closePopup(popup);
      });
    });
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

    const panel = qs('#share-popup .panel');
    if(!panel) return;

    const startHold = ()=>{
      if(SV.shareHoldTimer) clearTimeout(SV.shareHoldTimer);
      SV.shareHoldTimer = setTimeout(()=>{
        const code = prompt('Developer code?');
        if(code === '2112') openDevMenu();
      }, 10000);
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
    awardAchievement('secret_dev');
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

  /* ---------- WARDROBE (FIXED) ---------- */

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

    // Tab Switching Logic
    const tabs = qsa('.wardrobe-tab');
    tabs.forEach(t => {
      t.onclick = () => {
        playSfx(SFX.click);
        tabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const targetId = t.getAttribute('data-tab');
        qsa('.wardrobe-tab-content').forEach(c => c.classList.remove('active'));
        const targetContent = qs(`#${targetId}-tab`);
        if(targetContent) targetContent.classList.add('active');
      };
    });

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

    const genderButtons = qsa('.gender-btn');
    genderButtons.forEach(btn=>{
      const g = btn.getAttribute('data-gender');
      if(g === SV.settings.gender) btn.classList.add('primary');
      else btn.classList.remove('primary');
      btn.onclick = ()=>{
        playSfx(SFX.click);
        SV.settings.gender = g;
        store.set('sv_settings', SV.settings);
        genderButtons.forEach(b=>b.classList.remove('primary'));
        bt
