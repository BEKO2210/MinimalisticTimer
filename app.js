/* ================================================================
   PRECISION TIMER — Application Core
   Professional timing system · PWA · Web Audio · Wake Lock
   ================================================================ */
(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────
  const TIMEZONES = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'New York' },
    { value: 'America/Chicago', label: 'Chicago' },
    { value: 'America/Denver', label: 'Denver' },
    { value: 'America/Los_Angeles', label: 'Los Angeles' },
    { value: 'America/Sao_Paulo', label: 'São Paulo' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Berlin', label: 'Berlin' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Moscow', label: 'Moscow' },
    { value: 'Asia/Dubai', label: 'Dubai' },
    { value: 'Asia/Kolkata', label: 'Mumbai' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Seoul', label: 'Seoul' },
    { value: 'Australia/Sydney', label: 'Sydney' },
    { value: 'Pacific/Auckland', label: 'Auckland' },
  ];

  const STORAGE_KEY = 'precision-timer-state';

  // ── DOM Helpers ────────────────────────────────────────────────
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // ── Format Helpers ─────────────────────────────────────────────
  function fmtMs(ms) {
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.floor(ms % 1000);
    return {
      h: String(h).padStart(2, '0'),
      m: String(m).padStart(2, '0'),
      s: String(s).padStart(2, '0'),
      ms: String(mil).padStart(3, '0'),
    };
  }

  function displayTime(ms) {
    const t = fmtMs(ms);
    return `${t.h}:${t.m}:${t.s}<span class="ms">.${t.ms}</span>`;
  }

  function lapTime(ms) {
    const t = fmtMs(ms);
    if (parseInt(t.h) > 0) return `${t.h}:${t.m}:${t.s}.${t.ms}`;
    return `${t.m}:${t.s}.${t.ms}`;
  }

  // ── Audio Engine ───────────────────────────────────────────────
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this._alarmInterval = null;
    }

    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    tick() {
      if (!this.enabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 1000;
      g.gain.setValueAtTime(0.05, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      o.connect(g).connect(this.ctx.destination);
      o.start(now);
      o.stop(now + 0.05);
    }

    beep(freq = 880, dur = 0.12) {
      if (!this.enabled) return;
      this.init();
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(now);
      o.stop(now + dur);
    }

    startAlarm() {
      if (!this.enabled) return;
      this.stopAlarm();
      this.init();
      const pattern = () => {
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        // High tone
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.type = 'square';
        o1.frequency.value = 880;
        g1.gain.setValueAtTime(0.2, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        o1.connect(g1).connect(this.ctx.destination);
        o1.start(now);
        o1.stop(now + 0.18);
        // Low tone
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.type = 'square';
        o2.frequency.value = 660;
        g2.gain.setValueAtTime(0.2, now + 0.28);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
        o2.connect(g2).connect(this.ctx.destination);
        o2.start(now + 0.28);
        o2.stop(now + 0.46);
      };
      pattern();
      this._alarmInterval = setInterval(pattern, 800);
      // Vibrate
      if ('vibrate' in navigator) {
        this._vibrateInterval = setInterval(() => {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }, 1200);
      }
    }

    stopAlarm() {
      clearInterval(this._alarmInterval);
      clearInterval(this._vibrateInterval);
      this._alarmInterval = null;
      this._vibrateInterval = null;
      if ('vibrate' in navigator) navigator.vibrate(0);
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }
  }

  // ── Wake Lock ──────────────────────────────────────────────────
  class WakeLockManager {
    constructor() {
      this.sentinel = null;
      this.active = false;
      this.supported = 'wakeLock' in navigator;
    }

    async acquire() {
      if (!this.supported) return false;
      try {
        this.sentinel = await navigator.wakeLock.request('screen');
        this.active = true;
        this.sentinel.addEventListener('release', () => {
          this.active = false;
        });
        return true;
      } catch {
        return false;
      }
    }

    async release() {
      if (this.sentinel) {
        await this.sentinel.release();
        this.sentinel = null;
      }
      this.active = false;
    }

    async toggle() {
      if (this.active) {
        await this.release();
      } else {
        await this.acquire();
      }
      return this.active;
    }
  }

  // ── Timer Engine ───────────────────────────────────────────────
  class TimerEngine {
    constructor() {
      this.state = 'idle'; // idle | running | paused | alarm
      this.targetTs = 0;
      this.remaining = 0;
      this.totalDuration = 0;
      this.rafId = null;
      this.timeoutId = null;
      this.onUpdate = null;
      this.onAlarm = null;
      this.onTick = null;
      this._lastTickSec = -1;
    }

    setDuration(h, m, s) {
      const ms = (h * 3600 + m * 60 + s) * 1000;
      if (ms <= 0) return false;
      this.remaining = ms;
      this.totalDuration = ms;
      this.state = 'idle';
      if (this.onUpdate) this.onUpdate(ms, 1);
      return true;
    }

    setTarget(h, m, s) {
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, s, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const ms = target - now;
      this.remaining = ms;
      this.totalDuration = ms;
      this.state = 'idle';
      if (this.onUpdate) this.onUpdate(ms, 1);
      return true;
    }

    start() {
      if (this.state === 'alarm') return;
      if (this.remaining <= 0) return;
      this.targetTs = Date.now() + this.remaining;
      this.state = 'running';
      this._lastTickSec = -1;
      // Backup timeout for background tabs
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        if (this.state === 'running') this._triggerAlarm();
      }, this.remaining + 100);
      this._loop();
    }

    pause() {
      if (this.state !== 'running') return;
      cancelAnimationFrame(this.rafId);
      clearTimeout(this.timeoutId);
      this.remaining = Math.max(0, this.targetTs - Date.now());
      this.state = 'paused';
      if (this.onUpdate) {
        const progress = this.totalDuration > 0
          ? this.remaining / this.totalDuration : 0;
        this.onUpdate(this.remaining, progress);
      }
    }

    reset() {
      cancelAnimationFrame(this.rafId);
      clearTimeout(this.timeoutId);
      this.state = 'idle';
      this.targetTs = 0;
      this.remaining = 0;
      this.totalDuration = 0;
      this._lastTickSec = -1;
      if (this.onUpdate) this.onUpdate(0, 0);
    }

    dismiss() {
      this.reset();
    }

    stop() {
      cancelAnimationFrame(this.rafId);
      clearTimeout(this.timeoutId);
    }

    _loop() {
      const remaining = this.targetTs - Date.now();
      if (remaining <= 0) {
        this._triggerAlarm();
        return;
      }
      // Tick sound on second boundaries
      const sec = Math.ceil(remaining / 1000);
      if (sec !== this._lastTickSec && sec <= 5 && sec > 0) {
        this._lastTickSec = sec;
        if (this.onTick) this.onTick(sec);
      }
      const progress = this.totalDuration > 0
        ? remaining / this.totalDuration : 0;
      if (this.onUpdate) this.onUpdate(remaining, progress);
      this.rafId = requestAnimationFrame(() => this._loop());
    }

    _triggerAlarm() {
      cancelAnimationFrame(this.rafId);
      clearTimeout(this.timeoutId);
      this.state = 'alarm';
      if (this.onUpdate) this.onUpdate(0, 0);
      if (this.onAlarm) this.onAlarm();
    }
  }

  // ── Stopwatch Engine ───────────────────────────────────────────
  class StopwatchEngine {
    constructor() {
      this.state = 'idle'; // idle | running | paused
      this.startTime = 0;
      this.accumulated = 0;
      this.laps = [];
      this.lastLapTotal = 0;
      this.rafId = null;
      this.onUpdate = null;
    }

    start() {
      if (this.state === 'running') return;
      this.startTime = performance.now();
      this.state = 'running';
      this._loop();
    }

    pause() {
      if (this.state !== 'running') return;
      cancelAnimationFrame(this.rafId);
      this.accumulated += performance.now() - this.startTime;
      this.state = 'paused';
      if (this.onUpdate) this.onUpdate(this.accumulated, this.laps);
    }

    reset() {
      cancelAnimationFrame(this.rafId);
      this.state = 'idle';
      this.startTime = 0;
      this.accumulated = 0;
      this.laps = [];
      this.lastLapTotal = 0;
      if (this.onUpdate) this.onUpdate(0, []);
    }

    lap() {
      if (this.state !== 'running') return;
      const total = this.accumulated + (performance.now() - this.startTime);
      const split = total - this.lastLapTotal;
      this.laps.unshift({
        num: this.laps.length + 1,
        split,
        total,
      });
      this.lastLapTotal = total;
    }

    stop() {
      cancelAnimationFrame(this.rafId);
    }

    getElapsed() {
      if (this.state === 'running') {
        return this.accumulated + (performance.now() - this.startTime);
      }
      return this.accumulated;
    }

    _loop() {
      const elapsed = this.accumulated + (performance.now() - this.startTime);
      if (this.onUpdate) this.onUpdate(elapsed, this.laps);
      this.rafId = requestAnimationFrame(() => this._loop());
    }
  }

  // ── Main Application ──────────────────────────────────────────
  class App {
    constructor() {
      this.mode = 'timer';
      this.timerMode = 'duration'; // duration | target
      this.audio = new AudioEngine();
      this.wake = new WakeLockManager();
      this.timer = new TimerEngine();
      this.stopwatch = new StopwatchEngine();
      this.clockRafId = null;
      this.savedTimezones = [];
      this._clockLastSec = -1;

      this._loadState();
      this._bindAll();
      this._initTimezoneSelect();
      this._renderWorldClocks();
      this._switchMode(this.mode);

      // Visibility change handler for background tab recovery
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          if (this.timer.state === 'running') {
            // Timer will self-correct via Date.now() on next rAF
          }
          if (this.mode === 'clock') this._startClock();
        }
      });
    }

    // ── State Persistence ──────────────────────────────────────
    _loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (state.mode) this.mode = state.mode;
        if (state.soundEnabled !== undefined) this.audio.enabled = state.soundEnabled;
        if (state.timezones) this.savedTimezones = state.timezones;
        if (state.timerMode) this.timerMode = state.timerMode;
        if (state.timerH !== undefined) {
          const hInput = $('#t-h');
          const mInput = $('#t-m');
          const sInput = $('#t-s');
          if (hInput) hInput.value = state.timerH;
          if (mInput) mInput.value = state.timerM;
          if (sInput) sInput.value = state.timerS;
        }
      } catch {
        // Ignore corrupt state
      }
    }

    _saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          mode: this.mode,
          soundEnabled: this.audio.enabled,
          timezones: this.savedTimezones,
          timerMode: this.timerMode,
          timerH: parseInt($('#t-h').value) || 0,
          timerM: parseInt($('#t-m').value) || 0,
          timerS: parseInt($('#t-s').value) || 0,
        }));
      } catch {
        // Storage full or unavailable
      }
    }

    // ── Binding ────────────────────────────────────────────────
    _bindAll() {
      // Mode tabs
      $$('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => this._switchMode(tab.dataset.mode));
      });

      // Timer sub-mode toggle
      $$('.sub-btn').forEach(btn => {
        btn.addEventListener('click', () => this._setTimerMode(btn.dataset.tmode));
      });

      // Duration adjust buttons
      $$('.adj').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = $(`#${btn.dataset.field}`);
          const dir = parseInt(btn.dataset.dir);
          const max = parseInt(input.max);
          const min = parseInt(input.min);
          let val = parseInt(input.value) || 0;
          val += dir;
          if (val > max) val = min;
          if (val < min) val = max;
          input.value = val;
          this._updateTimerPreview();
        });
      });

      // Duration inputs change
      ['t-h', 't-m', 't-s'].forEach(id => {
        const input = $(`#${id}`);
        input.addEventListener('input', () => this._updateTimerPreview());
        input.addEventListener('focus', () => input.select());
      });

      // Presets
      $$('.preset').forEach(btn => {
        btn.addEventListener('click', () => {
          const sec = parseInt(btn.dataset.sec);
          const h = Math.floor(sec / 3600);
          const m = Math.floor((sec % 3600) / 60);
          const s = sec % 60;
          $('#t-h').value = h;
          $('#t-m').value = m;
          $('#t-s').value = s;
          this._setTimerMode('duration');
          this._updateTimerPreview();
          // Visual feedback
          $$('.preset').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          setTimeout(() => btn.classList.remove('active'), 300);
        });
      });

      // Timer engine callbacks
      this.timer.onUpdate = (ms, progress) => {
        $('#timer-display').innerHTML = displayTime(ms);
        const fill = $('.progress-fill');
        if (fill) fill.style.width = `${(progress * 100).toFixed(1)}%`;
      };
      this.timer.onAlarm = () => this._onTimerAlarm();
      this.timer.onTick = (sec) => {
        if (sec <= 3) this.audio.beep(1200, 0.08);
        else this.audio.tick();
      };

      // Stopwatch engine callback
      this.stopwatch.onUpdate = (ms, laps) => {
        $('#sw-display').innerHTML = displayTime(ms);
        this._renderLaps(laps);
      };

      // Timer controls via event delegation
      $('#timer-ctrls').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        this.audio.init(); // Prepare audio on user interaction
        this._handleTimerAction(btn.dataset.action);
      });

      // Stopwatch controls
      $('#sw-ctrls').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        this.audio.init();
        this._handleSwAction(btn.dataset.action);
      });

      // Timezone select
      $('#tz-select').addEventListener('change', (e) => {
        const val = e.target.value;
        if (!val) return;
        if (!this.savedTimezones.includes(val)) {
          this.savedTimezones.push(val);
          this._renderWorldClocks();
          this._saveState();
        }
        e.target.value = '';
      });

      // Toolbar
      $('#btn-sound').addEventListener('click', () => {
        const on = this.audio.toggle();
        $('#btn-sound').classList.toggle('active', on);
        this._saveState();
      });

      $('#btn-wake').addEventListener('click', async () => {
        const on = await this.wake.toggle();
        $('#btn-wake').classList.toggle('active', on);
      });

      $('#btn-fs').addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
          $('#btn-fs').classList.add('active');
        } else {
          document.exitFullscreen();
          $('#btn-fs').classList.remove('active');
        }
      });

      document.addEventListener('fullscreenchange', () => {
        $('#btn-fs').classList.toggle('active', !!document.fullscreenElement);
      });

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => this._onKey(e));

      // Init sound button state
      $('#btn-sound').classList.toggle('active', this.audio.enabled);

      // Init timer sub-mode
      this._setTimerMode(this.timerMode);
      this._updateTimerPreview();
    }

    // ── Mode Switching ─────────────────────────────────────────
    _switchMode(mode) {
      this.mode = mode;

      // Stop clocks in previous mode
      cancelAnimationFrame(this.clockRafId);

      // Update tabs
      $$('.mode-tab').forEach(t => {
        const active = t.dataset.mode === mode;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', active);
      });

      // Update panels
      $$('.panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${mode}`);
      });

      // Start clock if needed
      if (mode === 'clock') {
        this._startClock();
      }

      this._saveState();
    }

    // ── Timer Mode ─────────────────────────────────────────────
    _setTimerMode(tmode) {
      this.timerMode = tmode;
      $$('.sub-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tmode === tmode);
      });
      $('#duration-input').classList.toggle('hidden', tmode !== 'duration');
      $('#target-input').classList.toggle('hidden', tmode !== 'target');
      $('#presets').classList.toggle('hidden', tmode !== 'duration');
      this._saveState();
    }

    _updateTimerPreview() {
      if (this.timer.state !== 'idle') return;
      const h = parseInt($('#t-h').value) || 0;
      const m = parseInt($('#t-m').value) || 0;
      const s = parseInt($('#t-s').value) || 0;
      const ms = (h * 3600 + m * 60 + s) * 1000;
      $('#timer-display').innerHTML = displayTime(ms);
    }

    _handleTimerAction(action) {
      switch (action) {
        case 'timer-start': {
          let ok = false;
          if (this.timerMode === 'duration') {
            const h = parseInt($('#t-h').value) || 0;
            const m = parseInt($('#t-m').value) || 0;
            const s = parseInt($('#t-s').value) || 0;
            ok = this.timer.setDuration(h, m, s);
          } else {
            const val = $('#target-time').value;
            if (!val) return;
            const [h, m, s = 0] = val.split(':').map(Number);
            ok = this.timer.setTarget(h, m, s);
          }
          if (!ok) return;
          this.timer.start();
          this.audio.beep(660, 0.08);
          this._setTimerUI('running');
          break;
        }
        case 'timer-pause':
          this.timer.pause();
          this.audio.beep(440, 0.08);
          this._setTimerUI('paused');
          break;
        case 'timer-resume':
          this.timer.start();
          this.audio.beep(660, 0.08);
          this._setTimerUI('running');
          break;
        case 'timer-reset':
          this.timer.reset();
          this.audio.stopAlarm();
          document.body.classList.remove('alarm-active');
          this._setTimerUI('idle');
          this._updateTimerPreview();
          break;
        case 'timer-dismiss':
          this.timer.dismiss();
          this.audio.stopAlarm();
          document.body.classList.remove('alarm-active');
          this._setTimerUI('idle');
          this._updateTimerPreview();
          break;
      }
    }

    _setTimerUI(state) {
      const ctrls = $('#timer-ctrls');
      const panel = $('#panel-timer');

      switch (state) {
        case 'idle':
          panel.classList.remove('timer-running');
          ctrls.innerHTML = `
            <button class="btn btn-primary" data-action="timer-start">START</button>`;
          break;
        case 'running':
          panel.classList.add('timer-running');
          ctrls.innerHTML = `
            <button class="btn btn-secondary" data-action="timer-pause">PAUSE</button>
            <button class="btn btn-danger" data-action="timer-reset">RESET</button>`;
          // Add progress bar if not exists
          if (!$('.progress-bar', panel)) {
            const bar = document.createElement('div');
            bar.className = 'progress-bar';
            bar.innerHTML = '<div class="progress-fill" style="width:100%"></div>';
            ctrls.before(bar);
          }
          break;
        case 'paused':
          ctrls.innerHTML = `
            <button class="btn btn-primary" data-action="timer-resume">RESUME</button>
            <button class="btn btn-danger" data-action="timer-reset">RESET</button>`;
          break;
        case 'alarm':
          ctrls.innerHTML = `
            <button class="btn btn-primary" data-action="timer-dismiss">DISMISS</button>`;
          // Remove progress bar
          const bar = $('.progress-bar', panel);
          if (bar) bar.remove();
          break;
      }
    }

    _onTimerAlarm() {
      document.body.classList.add('alarm-active');
      this.audio.startAlarm();
      this._setTimerUI('alarm');
      // Title flash
      let flash = false;
      this._titleInterval = setInterval(() => {
        document.title = flash ? '⏰ TIME UP' : 'PRECISION TIMER';
        flash = !flash;
      }, 500);
    }

    // ── Stopwatch ──────────────────────────────────────────────
    _handleSwAction(action) {
      switch (action) {
        case 'sw-start':
          this.stopwatch.start();
          this.audio.beep(660, 0.08);
          this._setSwUI('running');
          break;
        case 'sw-stop':
          this.stopwatch.pause();
          this.audio.beep(440, 0.08);
          this._setSwUI('paused');
          break;
        case 'sw-lap':
          this.stopwatch.lap();
          this.audio.beep(880, 0.06);
          break;
        case 'sw-resume':
          this.stopwatch.start();
          this.audio.beep(660, 0.08);
          this._setSwUI('running');
          break;
        case 'sw-reset':
          this.stopwatch.reset();
          this._setSwUI('idle');
          $('#lap-header').classList.add('hidden');
          break;
      }
    }

    _setSwUI(state) {
      const ctrls = $('#sw-ctrls');
      switch (state) {
        case 'idle':
          ctrls.innerHTML = `
            <button class="btn btn-primary" data-action="sw-start">START</button>`;
          break;
        case 'running':
          ctrls.innerHTML = `
            <button class="btn btn-secondary" data-action="sw-stop">STOP</button>
            <button class="btn btn-secondary" data-action="sw-lap">LAP</button>`;
          break;
        case 'paused':
          ctrls.innerHTML = `
            <button class="btn btn-primary" data-action="sw-resume">RESUME</button>
            <button class="btn btn-danger" data-action="sw-reset">RESET</button>`;
          break;
      }
    }

    _renderLaps(laps) {
      if (!laps.length) {
        $('#lap-header').classList.add('hidden');
        $('#lap-list').innerHTML = '';
        return;
      }

      $('#lap-header').classList.remove('hidden');

      // Find best/worst splits (only if 2+ laps)
      let bestIdx = -1, worstIdx = -1;
      if (laps.length >= 2) {
        let bestSplit = Infinity, worstSplit = -1;
        laps.forEach((l, i) => {
          if (l.split < bestSplit) { bestSplit = l.split; bestIdx = i; }
          if (l.split > worstSplit) { worstSplit = l.split; worstIdx = i; }
        });
      }

      // Only re-render if lap count changed (optimization)
      const existing = $$('.lap-row', $('#lap-list'));
      if (existing.length === laps.length) {
        // Update first row only (most recent)
        const first = existing[0];
        if (first) {
          const l = laps[0];
          first.querySelector('.lap-split').textContent = lapTime(l.split);
          first.querySelector('.lap-total').textContent = lapTime(l.total);
        }
        return;
      }

      let html = '';
      laps.forEach((l, i) => {
        let cls = 'lap-row';
        if (i === bestIdx) cls += ' lap-best';
        if (i === worstIdx) cls += ' lap-worst';
        html += `<div class="${cls}">
          <span class="lap-num">${String(l.num).padStart(2, '0')}</span>
          <span class="lap-split">${lapTime(l.split)}</span>
          <span class="lap-total">${lapTime(l.total)}</span>
        </div>`;
      });
      $('#lap-list').innerHTML = html;
    }

    // ── Clock ──────────────────────────────────────────────────
    _startClock() {
      cancelAnimationFrame(this.clockRafId);
      this._tickClock();
    }

    _tickClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ms = String(now.getMilliseconds()).padStart(3, '0');

      $('#clock-display').innerHTML =
        `${h}:${m}:${s}<span class="ms">.${ms}</span>`;

      // Date and UTC — update once per second
      const sec = now.getSeconds();
      if (sec !== this._clockLastSec) {
        this._clockLastSec = sec;

        // Date
        const dateStr = now.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        $('#clock-date').textContent = dateStr;

        // UTC
        const uh = String(now.getUTCHours()).padStart(2, '0');
        const um = String(now.getUTCMinutes()).padStart(2, '0');
        const us = String(now.getUTCSeconds()).padStart(2, '0');
        $('#clock-utc').textContent = `UTC ${uh}:${um}:${us}`;

        // World clocks
        this._updateWorldClocks(now);
      }

      if (this.mode === 'clock') {
        this.clockRafId = requestAnimationFrame(() => this._tickClock());
      }
    }

    _initTimezoneSelect() {
      const sel = $('#tz-select');
      TIMEZONES.forEach(tz => {
        const opt = document.createElement('option');
        opt.value = tz.value;
        opt.textContent = tz.label;
        sel.appendChild(opt);
      });
    }

    _renderWorldClocks() {
      const container = $('#world-clocks');
      container.innerHTML = '';
      this.savedTimezones.forEach(tz => {
        const row = document.createElement('div');
        row.className = 'wc-row';
        row.dataset.tz = tz;

        const label = TIMEZONES.find(t => t.value === tz);
        const labelText = label ? label.label : tz.split('/').pop().replace(/_/g, ' ');

        row.innerHTML = `
          <span class="wc-label">${labelText}</span>
          <span class="wc-time" data-tz="${tz}">--:--:--</span>
          <button class="wc-remove" data-tz="${tz}" aria-label="Remove ${labelText}">&times;</button>`;
        container.appendChild(row);
      });

      // Bind remove buttons
      $$('.wc-remove', container).forEach(btn => {
        btn.addEventListener('click', () => {
          this.savedTimezones = this.savedTimezones.filter(t => t !== btn.dataset.tz);
          this._renderWorldClocks();
          this._saveState();
        });
      });

      // Immediate update
      this._updateWorldClocks(new Date());

      // Update timezone select disabled state
      $$('#tz-select option').forEach(opt => {
        opt.disabled = this.savedTimezones.includes(opt.value);
      });
    }

    _updateWorldClocks(now) {
      $$('.wc-time').forEach(el => {
        try {
          const timeStr = now.toLocaleTimeString('en-GB', {
            timeZone: el.dataset.tz,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });
          el.textContent = timeStr;
        } catch {
          el.textContent = '??:??:??';
        }
      });
    }

    // ── Keyboard ───────────────────────────────────────────────
    _onKey(e) {
      // Don't capture when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          this._onSpacebar();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this._onReset();
          break;
        case 'l':
        case 'L':
          if (this.mode === 'stopwatch') {
            e.preventDefault();
            this.audio.init();
            this._handleSwAction('sw-lap');
          }
          break;
        case '1':
          this._switchMode('timer');
          break;
        case '2':
          this._switchMode('stopwatch');
          break;
        case '3':
          this._switchMode('clock');
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          $('#btn-fs').click();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          $('#btn-sound').click();
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          $('#btn-wake').click();
          break;
        case 'Escape':
          e.preventDefault();
          if (this.timer.state === 'alarm') {
            this._handleTimerAction('timer-dismiss');
          }
          break;
      }
    }

    _onSpacebar() {
      this.audio.init();
      if (this.mode === 'timer') {
        switch (this.timer.state) {
          case 'idle':
            this._handleTimerAction('timer-start');
            break;
          case 'running':
            this._handleTimerAction('timer-pause');
            break;
          case 'paused':
            this._handleTimerAction('timer-resume');
            break;
          case 'alarm':
            this._handleTimerAction('timer-dismiss');
            break;
        }
      } else if (this.mode === 'stopwatch') {
        switch (this.stopwatch.state) {
          case 'idle':
            this._handleSwAction('sw-start');
            break;
          case 'running':
            this._handleSwAction('sw-stop');
            break;
          case 'paused':
            this._handleSwAction('sw-resume');
            break;
        }
      }
    }

    _onReset() {
      this.audio.init();
      if (this.mode === 'timer') {
        if (this.timer.state === 'alarm') {
          this._handleTimerAction('timer-dismiss');
        } else {
          this._handleTimerAction('timer-reset');
        }
      } else if (this.mode === 'stopwatch') {
        if (this.stopwatch.state === 'paused') {
          this._handleSwAction('sw-reset');
        }
      }
    }
  }

  // ── PWA Install Prompt ──────────────────────────────────────────
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = $('#install-banner');
    if (banner) banner.classList.remove('hidden');
  });

  function setupInstallButton() {
    const btnInstall = $('#btn-install');
    const btnDismiss = $('#install-dismiss');
    const banner = $('#install-banner');
    if (!btnInstall || !banner) return;

    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      banner.classList.add('hidden');
      if (result.outcome === 'accepted') {
        // Installed successfully
      }
    });

    btnDismiss.addEventListener('click', () => {
      banner.classList.add('hidden');
      deferredPrompt = null;
    });
  }

  // Hide install banner if already in standalone mode
  window.addEventListener('appinstalled', () => {
    const banner = $('#install-banner');
    if (banner) banner.classList.add('hidden');
    deferredPrompt = null;
  });

  // ── Initialize ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    new App();
    setupInstallButton();
  });

  // ── Register Service Worker ────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // SW registration failed — app still works
      });
    });
  }
})();
