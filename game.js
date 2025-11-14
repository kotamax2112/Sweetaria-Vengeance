/* =========================================================
   SWEETARIA: VENGEANCE — STABLE 3.1
   (DEV DROPDOWN + TIMER + JETPACK HUD)
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
    init() {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    },
    play(freq, type, vol = 0.1, dur = 0.3) {
      if (!SV.settings.sfx || !actx) return;
      try {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol, actx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
        o.connect(g);
        g.connect(actx.destination);
        o.start();
        o.stop(actx.currentTime + dur);
      } catch (e) {
        console.error('Audio Playback Error:', e);
      }
    },
    startMusic() {
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
    stopMusic() {
      if (musInt) clearInterval(musInt);
    }
  };

  // --- PIXEL ART (LORE) ---
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
    colors: {
      '0': null,
      '1': '#ffd5a3',
      '2': '#ffee7a',
      '3': '#000000',
      '4': '#ffffff',
      '5': '#ff3860',
      '6': '#000000',
      '7': '#999999',
      '8': '#aaddff',
      '9': '#cccccc'
    }
  };

  // --- GAME DATA ---
  const COLORS = {
    shirt: ['#ff5a5a', '#4ea8ff', '#37d67a', '#a06bff', '#ff8d3b', '#17c5b6'],
    pants: ['#2d3549', '#39445f', '#4e5b7a', '#273244', '#1f2738'],
    skin: ['#ffd5a3', '#e8b788', '#c78d62', '#a86b47', '#7f4d30', '#5e391f']
  };

  const ITEMS = ['none', 'sword', 'scepter', 'mallet', 'cleaver'];

  const HAIRS = {
    m: ['short', 'side', 'spiky'],
    f: ['bob', 'long', 'ponytail'],
    o: ['short', 'side', 'spiky', 'bob', 'long', 'ponytail', 'mohawk']
  };

  const SKINS = [
    { id: 'skin1', name: 'Cone Knight', req: 'beat_boss1', col: '#ff5a5a', rarity: 'rare' },
    { id: 'skin2', name: 'Blizzard', req: 'long_run', col: '#4e9cff', rarity: 'rare' },
    { id: 'skin3', name: 'Kindness', req: 'kind_only', col: '#ff7bc5', rarity: 'epic' },
    { id: 'skin4', name: 'Slayer', req: 'beat_boss2', col: '#3ba55d', rarity: 'epic' },
    { id: 'skin5', name: 'Socialite', req: 'share_game', col: '#ffd700', rarity: 'legendary' }
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

  // --- STORAGE ---
  const Store = {
    get(key, def) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : def;
      } catch {
        return def;
      }
    },
    set(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
    }
  };

  // --- GLOBAL STATE ---
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
    levelTime: 0,

    player: { x: 120, y: 296, w: 42, h: 64, vy: 0, onGround: true, jumpsUsed: 0 },
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
    jetpackTime: 0,
    tesla: 0,
    invuln: 0,

    boss1: { active: false, hp: 1, y: 200, anim: 0, quote: '', quoteTimer: 0, dodged: 0 },
    rpg: { active: false, hp: 100, max: 100 },
    bossIntro: { active: false, done: false, timer: 0, name: '' },

    devClicks: 0
  };

  // --- POPUPS ---
  function openPopup(id) {
    const el = qs('#' + id);
    if (el) el.classList.remove('hidden');
  }
  function closePopup(id) {
    const el = qs('#' + id);
    if (el) el.classList.add('hidden');
  }

  // --- DEV MENU HELPERS ---
  function initDevMenu() {
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
      opt.value = String(i);
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

  // --- INIT ---
  function init() {
    const cvs = qs('#game-canvas');
    if (!cvs) {
      console.error('FATAL: no canvas');
      return;
    }
    SV.ctx = cvs.getContext('2d');

    // Powerup HUD chip styling
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

    // Audio unlock
    const unlockAudio = () => {
      Sound.init();
      if (SV.settings.music) Sound.startMusic();
      document.removeEventListener('pointerdown', unlockAudio);
    };
    document.addEventListener('pointerdown', unlockAudio);

    // Title → Home
    const titleScreen = qs('#title-screen');
    if (titleScreen) {
      titleScreen.onclick = () => {
        titleScreen.classList.add('hidden');
        qs('#home-screen').classList.remove('hidden');
      };
    }

    // Main buttons
    qs('#play-btn').onclick = () => startRun(SV.progress.lastCheckpoint > 1 ? 'popup' : 1);
    qs('#endless-btn').onclick = () => {
      if (SV.progress.endlessUnlocked) startRun(99);
      else alert('You must beat Story Mode to unlock Endless Run!');
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

    // Start popup
    qs('#start-at-last').onclick = () => { closePopup('start-popup'); startRun(SV.progress.lastCheckpoint || 1); };
    qs('#start-beginning').onclick = () => { closePopup('start-popup'); startRun(1); };

    // Settings toggles
    const updateSettingsText = () => {
      ['#music-toggle', '#pause-music-btn'].forEach(id => {
        const el = qs(id);
        if (el) el.textContent = 'Music: ' + (SV.settings.music ? 'ON' : 'OFF');
      });
      ['#sfx-toggle', '#pause-sfx-btn'].forEach(id => {
        const el = qs(id);
        if (el) el.textContent = 'SFX: ' + (SV.settings.sfx ? 'ON' : 'OFF');
      });
      Store.set('sv_set', SV.settings);
    };

    const toggleMusic = () => {
      SV.settings.music = !SV.settings.music;
      if (SV.settings.music) Sound.startMusic();
      else Sound.stopMusic();
      updateSettingsText();
    };
    const toggleSfx = () => {
      SV.settings.sfx = !SV.settings.sfx;
      updateSettingsText();
    };

    qs('#music-toggle').onclick = toggleMusic;
    qs('#pause-music-btn').onclick = toggleMusic;
    qs('#sfx-toggle').onclick = toggleSfx;
    qs('#pause-sfx-btn').onclick = toggleSfx;

    qs('#reset-progress-btn').onclick = () => {
      if (confirm('Reset ALL data?')) {
        localStorage.clear();
        location.reload();
      }
    };

    // Pause menu
    qs('#pause-btn').onclick = () => {
      SV.paused = true;
      openPopup('pause-menu');
    };
    qs('#resume-btn').onclick = () => {
      closePopup('pause-menu');
      SV.paused = false;
      SV.lastTs = performance.now();
      loop();
    };
    qs('#quit-btn').onclick = () => location.reload();

    // Death popup
    qs('#death-restart-checkpoint').onclick = () => {
      closePopup('death-popup');
      startRun(SV.progress.lastCheckpoint || 1);
    };
    qs('#death-exit-main').onclick = () => location.reload();

    // Jump / controls
    const jump = (e) => {
      if (!SV.running || SV.paused) return;
      if (e.type === 'keydown' && e.code !== 'Space') return;
      e.preventDefault();
      const p = SV.player;
      if (p.jumpsUsed < 2) {
        p.vy = p.jumpsUsed === 0 ? -0.66 : -0.58;
        p.jumpsUsed++;
        p.onGround = false;
        Sound.play(300, 'square', 0.1);
      }
    };
    qs('#jump-btn').onpointerdown = jump;
    window.onkeydown = jump;
    qs('#game-canvas').onpointerdown = jump;

    // Dev trigger: 5 taps in corner → code → dev menu
    qs('#dev-trigger-zone').addEventListener('pointerdown', () => {
      SV.devClicks++;
      setTimeout(() => { SV.devClicks = 0; }, 2000);
      if (SV.devClicks >= 5) {
        if (prompt('Code?') === '2112') {
          openPopup('dev-menu');
          award('secret_dev');
          initDevMenu();
        }
        SV.devClicks = 0;
      }
    });

    // Existing dev level buttons
    qsa('#dev-menu .dev-btn').forEach(b => {
      b.onclick = () => {
        closePopup('dev-menu');
        SV.running = false;
        const lv = parseInt(b.dataset.level, 10) || 1;
        startRun(lv);
      };
    });

    // Dev power buttons
    qsa('#dev-menu button[data-power]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.power === 'shield') SV.shield = 3;
        if (b.dataset.power === 'tesla') SV.tesla = 5000;
        if (b.dataset.power === 'jetpack') {
          SV.jetpack = true;
          SV.jetpackTime = 8000;
        }
        closePopup('dev-menu');
      };
    });

    // Universal close
    qsa('.close-btn').forEach(b => {
      b.onclick = () => {
        const pop = b.closest('.popup');
        if (pop) pop.classList.add('hidden');
      };
    });

    updateSettingsText();
  }

  // --- GAME LOOP / CORE ---
  function startRun(lv) {
    if (lv === 'popup') {
      openPopup('start-popup');
      return;
    }

    ['home-screen', 'start-popup', 'death-popup', 'rpg-overlay'].forEach(id => {
      const el = qs('#' + id);
      if (el) el.classList.add('hidden');
    });
    qs('#game-screen').classList.remove('hidden');

    SV.level = typeof lv === 'number' ? lv : 1;
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
    SV.jetpackTime = 0;
    SV.tesla = 0;
    SV.boss1.active = false;
    SV.boss1.dodged = 0;
    SV.rpg.active = false;
    SV.rpg.hp = SV.rpg.max;
    SV.bossIntro.active = false;
    SV.bossIntro.done = false;
    SV.bossIntro.timer = 0;
    SV.bossIntro.name = '';

    const nameLabel = qs('#player-name-display');
    if (nameLabel) nameLabel.textContent = SV.settings.playerName || 'Hero';

    const lvlLabel = qs('#level-display');
    if (lvlLabel) lvlLabel.textContent = 'Lv ' + SV.level;

    const bar = qs('#level-progress-fill');
    if (bar) bar.style.width = '0%';

    SV.running = true;
    SV.paused = false;
    SV.lastTs = performance.now();

    loop();
  }

  function loop(ts) {
    if (!SV.running) return;
    if (SV.paused) {
      requestAnimationFrame(loop);
      return;
    }

    const dt = ts - SV.lastTs || 16;
    SV.lastTs = ts;

    try {
      update(dt);
    } catch (e) {
      console.error(e);
      SV.running = false;
    }
    try {
      draw();
    } catch (e) {
      console.error(e);
      SV.running = false;
    }

    requestAnimationFrame(loop);
  }

  function update(dt) {
    if (SV.rpg.active) return;

    // Level timer + progress bar (~60s per level)
    SV.levelTime += dt;
    const prog = clamp(SV.levelTime / 60000, 0, 1);
    const bar = qs('#level-progress-fill');
    if (bar) bar.style.width = (prog * 100) + '%';

    if (SV.levelTime >= 60000) {
      SV.level++;
      SV.levelTime = 0;
      const lvlLabel = qs('#level-display');
      if (lvlLabel) lvlLabel.textContent = 'Lv ' + SV.level;
    }

    // Boss intros & stages
    if (SV.level === 5 || SV.level === 10) {
      // Start intro if not done
      if (!SV.bossIntro.done && !SV.bossIntro.active) {
        SV.bossIntro.active = true;
        SV.bossIntro.timer = 0;
        SV.bossIntro.name = SV.level === 5 ? 'CELL PHONE TEEN TROLL' : 'BIG BOSS HEAD';
        const intro = qs('#boss-intro');
        if (intro) intro.classList.remove('hidden');
        const nameEl = qs('#boss-intro-name');
        if (nameEl) nameEl.textContent = SV.bossIntro.name;
      }

      // Animate intro card
      if (SV.bossIntro.active) {
        SV.bossIntro.timer += dt;
        if (SV.bossIntro.timer >= 2000) {
          SV.bossIntro.active = false;
          SV.bossIntro.done = true;
          const intro = qs('#boss-intro');
          if (intro) intro.classList.add('hidden');
          if (SV.level === 10 && !SV.rpg.active) {
            startRpgBoss();
            return;
          }
        }
        return;
      }

      // After intro, run boss logic
      if (SV.level === 5) {
        updateBoss1(dt);
        return;
      }
      if (SV.level === 10 && !SV.rpg.active) {
        startRpgBoss();
        return;
      }
    }

    // Score and best
    SV.score += dt * 0.01;
    qs('#score-display').textContent = Math.floor(SV.score);
    qs('#alltime-display').textContent = Math.floor(SV.progress.allTimeScore || 0);
    if (SV.score > (SV.progress.allTimeScore || 0)) {
      SV.progress.allTimeScore = SV.score;
      Store.set('sv_prog', SV.progress);
    }

    // Powerup HUD
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
    if (SV.tesla > 0) {
      const target = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if (target) {
        SV.hazards = SV.hazards.filter(h => h !== target);
        Sound.play(600, 'sawtooth', 0.1);
      }
    }

    const p = SV.player;

    // Jetpack flight: fly above ground hazards
    if (SV.jetpack) {
      p.vy = 0;
      p.y = 160 + Math.sin(Date.now() * 0.005) * 5;
      p.onGround = false;
      p.jumpsUsed = 0;
    } else {
      p.vy += SV.gravity * dt;
      p.y += p.vy * dt;
      if (p.y >= 296) {
        p.y = 296;
        p.vy = 0;
        p.onGround = true;
        p.jumpsUsed = 0;
      }
    }

    // Spawn hazards
    if (Math.random() < 0.015) {
      const type = Math.random() > 0.7 ? 'mine' : 'slime';
      SV.hazards.push({
        x: 850,
        y: type === 'mine' ? 230 : 296,
        w: 36,
        h: 36,
        type
      });
    }

    // Spawn powerups (ground + sky)
    if (Math.random() < 0.005) {
      const sky = Math.random() < 0.5;
      const y = sky ? randRange(140, 210) : 260;
      SV.powerups.push({
        x: 850,
        y,
        w: 40,
        h: 40,
        type: pick(['shield', 'tesla', 'jetpack'])
      });
    }

    // Scroll world
    SV.hazards.forEach(h => { h.x -= SV.scrollSpd * dt; });
    SV.powerups.forEach(pu => { pu.x -= SV.scrollSpd * dt; });

    // Hazard collisions
    SV.hazards.forEach((h, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        if (SV.shield > 0) {
          SV.shield--;
          SV.hazards.splice(i, 1);
        } else {
          SV.running = false;
          onPlayerDeath();
        }
      }
    });

    // Powerup pickups
    SV.powerups.forEach((pw, i) => {
      if (rectHit(p.x, p.y, p.w, p.h, pw.x, pw.y, 40, 40)) {
        SV.powerups.splice(i, 1);
        Sound.play(600, 'sine');
        if (pw.type === 'shield') SV.shield = 3;
        if (pw.type === 'tesla') SV.tesla = 5000;
        if (pw.type === 'jetpack') {
          SV.jetpack = true;
          SV.jetpackTime = 8000;
        }
      }
    });
  }

  function onPlayerDeath() {
    Sound.play(60, 'sawtooth', 0.5);
    award('die_lot');
    const banner = qs('#boss-banner');
    if (banner) banner.classList.add('hidden');
    const hud = qs('#boss-hud');
    if (hud) hud.classList.add('hidden');
    const intro = qs('#boss-intro');
    if (intro) intro.classList.add('hidden');
    openPopup('death-popup');
  }

  function rectHit(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(x2 > x1 + w1 || x2 + w2 < x1 || y2 > y1 + h1 || y2 + h2 < y1);
  }

  // --- DRAW ---
  function draw() {
    if (!SV.ctx) return;
    const ctx = SV.ctx;
    ctx.clearRect(0, 0, 800, 480);

    // Background
    const t = performance.now() * 0.00005;
    const g = ctx.createLinearGradient(0, 0, 0, 480);
    g.addColorStop(0, '#060914');
    g.addColorStop(0.5, '#081021');
    g.addColorStop(1, '#05060b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 800, 480);

    ctx.fillStyle = 'rgba(40,60,110,0.25)';
    for (let i = 0; i < 5; i++) {
      const offset = ((t * 40) + (i * 60)) % 1000;
      ctx.fillRect(-offset + 100, 120 + i * 24, 260, 12);
    }

    ctx.fillStyle = '#1a2435';
    ctx.fillRect(0, 360, 800, 120);

    // Hazards
    SV.hazards.forEach(h => {
      if (h.type === 'mine') {
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
          const a = i * (Math.PI / 4) + (Date.now() * 0.001);
          ctx.beginPath();
          ctx.moveTo(h.x + 18, h.y + 18);
          ctx.lineTo(
            h.x + 18 + Math.cos(a) * 25,
            h.y + 18 + Math.sin(a) * 25
          );
          ctx.stroke();
        }
      } else if (h.type === 'emoji') {
        ctx.fillStyle = '#ffd93b';
        ctx.beginPath();
        ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('💬', h.x + 18, h.y + 24);
      } else {
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(h.x + 18, h.y + 18, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(h.x + 8, h.y + 10, 6, 6);
        ctx.fillRect(h.x + 22, h.y + 10, 6, 6);
      }
    });

    // Powerups
    SV.powerups.forEach(p => {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#fff';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x + 20, p.y + 20, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#000';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      const cx = p.x + 20;
      const cy = p.y + 26;
      if (p.type === 'shield') ctx.fillText('🛡️', cx, cy);
      if (p.type === 'tesla') ctx.fillText('⚡', cx, cy);
      if (p.type === 'jetpack') ctx.fillText('🚀', cx, cy);
    });

    drawPlayerSprite(ctx, SV.player.x, SV.player.y);

    if (SV.level === 5 && SV.boss1 && SV.boss1.active) {
      drawBoss1(ctx);
    }

    // Tesla beam
    if (SV.tesla > 0 && SV.hazards.length > 0) {
      const tgt = SV.hazards.find(h => h.x > SV.player.x && h.x < SV.player.x + 400);
      if (tgt) {
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(SV.player.x + 20, SV.player.y + 30);
        ctx.lineTo(tgt.x + 18, tgt.y + 18);
        ctx.stroke();
      }
    }
  }

  function drawPlayerSprite(ctx, x, y) {
    const s = SV.settings;
    let shirt = s.shirt;
    if (s.skin) {
      const sk = SKINS.find(k => k.id === s.skin);
      if (sk) shirt = sk.col;
    }

    ctx.fillStyle = shirt;
    ctx.fillRect(x, y, 42, 64);

    ctx.fillStyle = s.skinTone;
    ctx.fillRect(x + 8, y - 16, 26, 16);

    ctx.fillStyle = s.pants;
    ctx.fillRect(x + 4, y + 36, 12, 28);
    ctx.fillRect(x + 26, y + 36, 12, 28);

    ctx.fillStyle = '#70421b';
    const wind = Math.sin(Date.now() * 0.005) * 2;
    if (s.hairStyle === 'long') {
      ctx.fillRect(x + 8, y - 20, 26, 10);
      ctx.fillRect(x + 4 + wind, y - 10, 6, 24);
    } else if (s.hairStyle === 'ponytail') {
      ctx.fillRect(x + 8, y - 20, 24, 8);
      ctx.fillRect(x + 26 + wind, y - 12, 6, 16);
    } else if (s.hairStyle === 'short') {
      ctx.fillRect(x + 8, y - 20, 26, 8);
    } else if (s.hairStyle === 'bob') {
      ctx.fillRect(x + 6, y - 20, 28, 12);
    } else if (s.hairStyle === 'side') {
      ctx.fillRect(x + 6, y - 20, 28, 10);
      ctx.fillRect(x + 30, y - 12, 4, 10);
    } else if (s.hairStyle === 'spiky') {
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + 10 + i * 5, y - 24, 4, 10);
      }
    } else if (s.hairStyle === 'mohawk') {
      ctx.fillRect(x + 18, y - 24, 6, 12);
    }

    ctx.fillStyle = '#999';
    if (s.item === 'sword') {
      ctx.fillRect(x + 45, y + 20, 4, 8);
      ctx.fillRect(x + 35, y + 26, 24, 4);
    } else if (s.item === 'scepter') {
      ctx.fillRect(x + 45, y + 20, 4, 30);
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(x + 47, y + 15, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.item === 'mallet') {
      ctx.fillRect(x + 45, y + 20, 4, 20);
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(x + 38, y, 20, 15);
    } else if (s.item === 'cleaver') {
      ctx.fillRect(x + 45, y + 20, 4, 15);
      ctx.fillRect(x + 38, y + 15, 20, 10);
    }
  }

  // --- WARDROBE ---
  function initWardrobe() {
    const preview = qs('#player-preview');
    if (!preview) return;
    const cvs = document.createElement('canvas');
    cvs.width = 300;
    cvs.height = 180;
    preview.innerHTML = '';
    preview.appendChild(cvs);
    const ctx = cvs.getContext('2d');

    const render = () => {
      ctx.clearRect(0, 0, 300, 180);
      drawPlayerSprite(ctx, 130, 80);
    };

    const nameInput = qs('#player-name-input');
    if (nameInput) {
      nameInput.value = SV.settings.playerName || 'Hero';
      nameInput.onchange = (e) => {
        SV.settings.playerName = e.target.value || 'Hero';
        Store.set('sv_set', SV.settings);
      };
    }

    qsa('.wardrobe-tab').forEach(tab => {
      tab.onclick = (e) => {
        qsa('.wardrobe-tab').forEach(x => x.classList.remove('active'));
        e.target.classList.add('active');
        qsa('.wardrobe-content').forEach(c => c.classList.remove('active'));
        const targetId = e.target.dataset.tab;
        const target = qs('#' + targetId);
        if (target) target.classList.add('active');
      };
    });

    const build = (arr, id, prop, isColor) => {
      const el = qs('#' + id);
      if (!el) return;
      el.innerHTML = '';
      arr.forEach(val => {
        const b = document.createElement('button');
        if (isColor) {
          b.className = 'color-swatch';
          b.style.background = val;
        } else {
          b.className = 'item-swatch';
          b.textContent = val;
        }
        if (SV.settings[prop] === val) b.classList.add('active');
        b.onclick = () => {
          SV.settings[prop] = val;
          if (prop === 'shirt') SV.settings.skin = null;
          Store.set('sv_set', SV.settings);
          render();
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
    build(COLORS.skin,  'skin-options', 'skinTone', true);
    build(ITEMS, 'item-options', 'item', false);
    refreshHair();

    qsa('.gender-btn').forEach(b => {
      b.classList.remove('active');
      if (SV.settings.gender === b.dataset.gender) b.classList.add('active');
      b.onclick = () => {
        SV.settings.gender = b.dataset.gender;
        Store.set('sv_set', SV.settings);
        refreshHair();
        render();
      };
    });

    const skinsGrid = qs('#skins-grid');
    if (skinsGrid) {
      skinsGrid.innerHTML = '';
      const have = SV.progress.ach || {};
      SKINS.forEach(s => {
        const div = document.createElement('div');
        const unlocked = !!have[s.req];
        div.className =
          'skin-card ' +
          (SV.settings.skin === s.id ? 'selected ' : '') +
          (unlocked ? s.rarity : 'locked');
        if (unlocked) {
          div.innerHTML = `<b>${s.name}</b>`;
          div.onclick = () => {
            SV.settings.skin = s.id;
            Store.set('sv_set', SV.settings);
            render();
          };
        } else {
          div.innerHTML = `<b style="font-size:1.5rem; margin-bottom:10px;">???</b><small>Locked</small>`;
        }
        skinsGrid.appendChild(div);
      });
    }

    const clearBtn = qs('#clear-skin-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        SV.settings.skin = null;
        Store.set('sv_set', SV.settings);
        render();
      };
    }

    render();
  }

  // --- LORE DRAWING ---
  function drawPixelArt(ctx, map, size) {
    map.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const col = ART.colors[ch];
        if (!col) return;
        ctx.fillStyle = col;
        ctx.fillRect(x * size, y * size, size, size);
      });
    });
  }

  function drawLore() {
    const c1 = qs('#lore-canvas-1');
    if (c1) {
      const ctx1 = c1.getContext('2d');
      ctx1.clearRect(0, 0, c1.width, c1.height);
      drawPixelArt(ctx1, ART.troll, 6);
    }
    const c2 = qs('#lore-canvas-2');
    if (c2) {
      const ctx2 = c2.getContext('2d');
      ctx2.clearRect(0, 0, c2.width, c2.height);
      drawPixelArt(ctx2, ART.head, 6);
    }
  }

  // --- ACHIEVEMENTS ---
  function buildAch() {
    const grid = qs('#achievements-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const have = SV.progress.ach || {};
    ACHIEVEMENTS.forEach(a => {
      const div = document.createElement('div');
      div.className = 'achievement-tile ' + (have[a.id] ? 'unlocked' : '');
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


  // --- BOSS 1: TEEN TROLL ---
  function updateBoss1(dt) {
    const b = SV.boss1;
    const p = SV.player;

    if (!b.active) {
      b.active = true;
      b.time = 0;
      b.nextAttack = 1200;
      b.dodged = 0;
      b.beamActive = false;
      b.beamPhase = 'idle';
      b.beamTimer = 0;
      b.beamResolved = false;
      b.beamY = SV.groundY - 24;
      b.quote = '';
      b.quoteTimer = 0;
      SV.hazards = [];

      const banner = qs('#boss-banner');
      if (banner) {
        banner.textContent = 'BOSS: CELL PHONE TEEN TROLL';
        banner.classList.remove('hidden');
      }
      const hud = qs('#boss-hud');
      if (hud) hud.classList.remove('hidden');
    }

    b.time += dt;
    if (b.quoteTimer && b.quoteTimer > 0) {
      b.quoteTimer = Math.max(0, b.quoteTimer - dt);
    }

    const SURVIVE_MS = 22000;
    const DODGES_TO_WIN = 12;

    const dodgeEl = qs('#boss1-dodge');
    if (dodgeEl) dodgeEl.textContent = `Dodges: ${b.dodged}/${DODGES_TO_WIN}`;
    const timeEl = qs('#boss1-time');
    if (timeEl) timeEl.textContent = `Time: ${Math.max(0, Math.ceil((SURVIVE_MS - b.time) / 1000))}s`;

    if (b.time >= SURVIVE_MS || b.dodged >= DODGES_TO_WIN) {
      boss1Win();
      return;
    }

    // Attack scheduling
    if (!b.beamActive) {
      b.nextAttack -= dt;
      if (b.nextAttack <= 0) {
        const useBeam = Math.random() < 0.5;
        b.quote = pick(BOSS1_QUOTES);
        b.quoteTimer = 1500;

        if (useBeam) {
          // Ratio Beam setup
          b.beamActive = true;
          b.beamPhase = 'telegraph';
          b.beamTimer = 0;
          b.beamResolved = false;
          Sound.play(180, 'sawtooth', 0.2, 0.15);
          b.nextAttack = 2600; // cooldown after beam finishes
        } else {
          // Emoji projectile
          spawnEmojiHazard();
          Sound.play(260, 'square', 0.15, 0.2);
          b.nextAttack = 1900;
        }
      }
    }

    // Beam lifecycle
    if (b.beamActive) {
      b.beamTimer += dt;
      if (b.beamPhase === 'telegraph') {
        if (b.beamTimer >= 600) {
          b.beamPhase = 'fire';
          b.beamTimer = 0;
          b.beamResolved = false;
        }
      } else if (b.beamPhase === 'fire') {
        if (!b.beamResolved) {
          if (p.onGround) {
            // Hit if still on ground when beam fires
            if (SV.shield > 0) {
              SV.shield--;
            } else {
              SV.running = false;
              onPlayerDeath();
              return;
            }
          } else {
            // Successful dodge
            b.dodged++;
          }
          b.beamResolved = true;
        }
        if (b.beamTimer >= 300) {
          b.beamActive = false;
          b.beamPhase = 'idle';
          b.beamTimer = 0;
          b.beamResolved = false;
        }
      }
    }

    // Update emoji hazards only during boss
    SV.hazards.forEach(h => {
      h.x -= SV.scrollSpd * dt;
      if (h.type === 'emoji') {
        h.vy += 0.0015 * dt;
        h.y += h.vy * dt;
      }
    });

    // Collisions + cleanup
    for (let i = SV.hazards.length - 1; i >= 0; i--) {
      const h = SV.hazards[i];
      if (rectHit(p.x, p.y, p.w, p.h, h.x, h.y, h.w, h.h)) {
        if (SV.shield > 0) {
          SV.shield--;
          SV.hazards.splice(i, 1);
        } else {
          SV.running = false;
          onPlayerDeath();
          return;
        }
      } else if (h.x < -100 || h.y > 500) {
        SV.hazards.splice(i, 1);
      }
    }
  }

  function spawnEmojiHazard() {
    SV.hazards.push({
      x: 820,
      y: 260,
      w: 36,
      h: 36,
      type: 'emoji',
      vy: -0.5
    });
  }

  function boss1Win() {
    SV.boss1.active = false;
    const banner = qs('#boss-banner');
    if (banner) banner.classList.add('hidden');
    const hud = qs('#boss-hud');
    if (hud) hud.classList.add('hidden');
    award('beat_boss1');
    SV.progress.lastCheckpoint = Math.max(SV.progress.lastCheckpoint || 0, 6);
    Store.set('sv_prog', SV.progress);
    alert('Teen Troll defeated! Checkpoint unlocked.');
    startRun(6);
  }

  function drawBoss1(ctx) {
    const b = SV.boss1;
    const baseX = 620;
    const baseY = 200 + Math.sin(Date.now() * 0.002) * 20;
    b.y = baseY;

    ctx.save();
    ctx.fillStyle = '#30395a';
    ctx.fillRect(baseX - 8, baseY - 8, 96, 80);

    ctx.fillStyle = '#88aaff';
    ctx.fillRect(baseX, baseY, 72, 56);

    ctx.fillStyle = '#000';
    ctx.fillRect(baseX + 10, baseY + 12, 10, 6);
    ctx.fillRect(baseX + 40, baseY + 12, 10, 6);

    ctx.fillStyle = '#fff';
    ctx.fillRect(baseX + 12, baseY + 13, 4, 2);
    ctx.fillRect(baseX + 42, baseY + 13, 4, 2);

    ctx.fillStyle = '#111';
    ctx.fillRect(baseX + 54, baseY + 26, 10, 18);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(baseX + 55, baseY + 27, 8, 12);

    if (b.quote && b.quoteTimer > 0) {
      ctx.fillStyle = 'rgba(10, 10, 25, 0.9)';
      ctx.fillRect(baseX - 110, baseY - 30, 100, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(b.quote, baseX - 106, baseY - 12);
    }

    if (b.beamActive) {
      const y = b.beamY;
      if (b.beamPhase === 'telegraph') {
        if (Math.floor(b.beamTimer / 100) % 2 === 0) {
          ctx.strokeStyle = '#c7a6ff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(40, y);
          ctx.lineTo(760, y);
          ctx.stroke();
        }
      } else if (b.beamPhase === 'fire') {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#a06bff';
        ctx.strokeStyle = '#a06bff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(760, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  }

  // --- RPG BOSS OVERLAY ---

  function startRpgBoss() {
    SV.running = false;
    SV.rpg.active = true;
    openPopup('rpg-overlay');
    SV.rpg.hp = SV.rpg.max;

    const insults = [
      "Your game looks mid.",
      "Skill issue, tbh.",
      "Copium speedrun.",
      "Imagine touching grass.",
      "Bro wrote Sweetaria in Notepad."
    ];
    const replies = [
      "Ok but you&rsquo;re still here playing.",
      "Wild talk from someone with 0 XP.",
      "Say &ldquo;skill issue&rdquo; again but slower.",
      "You ratioed yourself, champ.",
      "Keep coping, the HP bar disagrees."
    ];

    const logEl = qs('#rpg-log');
    const bar = qs('#boss-hp-bar');
    if (bar) bar.style.width = '100%';

    const buttons = qsa('.insult-btn');
    buttons.forEach((btn, idx) => {
      btn.textContent = 'CLAP BACK #' + (idx + 1);
      btn.onclick = () => {
        const insult = pick(insults);
        const reply = pick(replies);
        if (logEl) {
          const row = document.createElement('div');
          row.className = 'rpg-row';
          row.innerHTML = `<b>Boss:</b> ${insult}<br><b>You:</b> ${reply}`;
          logEl.prepend(row);
        }
        SV.rpg.hp = Math.max(0, SV.rpg.hp - 12);
        if (bar) bar.style.width = SV.rpg.hp + '%';

        Sound.play(240 + Math.random() * 120, 'square', 0.15, 0.1);

        if (SV.rpg.hp <= 0) {
          award('beat_boss2');
          SV.progress.endlessUnlocked = true;
          Store.set('sv_prog', SV.progress);
          setTimeout(() => {
            alert('You mentally destroyed the boss.
Endless mode unlocked!');
            location.reload();
          }, 250);
        }
      };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
