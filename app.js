/* Learnlist — video playlists as courses, with automatic progress tracking,
 * timestamped notes, and everything synced to the user's own Google Drive.
 *
 * Set your OAuth client ID below, or leave it empty and paste it in the app on first run.
 */
(() => {
  'use strict';

  // Set in config.js (loaded before this file) so users are never asked for it.
  const GOOGLE_CLIENT_ID = (window.LEARNLIST_CONFIG && window.LEARNLIST_CONFIG.clientId || '').trim();

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' ');
  const DATA_FILE_NAME = 'playlist-notes-data.json';
  const AUTO_COMPLETE_PCT = 90; // a lesson counts as completed once this much has been watched

  const LS = {
    client: 'pn_client_id', user: 'pn_user', cache: 'pn_cache', dirty: 'pn_dirty',
    signedIn: 'pn_signed_in', theme: 'pn_theme', autoplay: 'pn_autoplay',
  };

  /* ================================================================== */
  /* Utilities                                                          */
  /* ================================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    if (value !== undefined) el.value = value;
    return el;
  }

  const ICONS = {
    check: '<polyline points="20 6 9 17 4 12"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    more: '<circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/><circle cx="5" cy="12" r="1.2"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    down: '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    circleCheck: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><polyline points="22 4 12 14 9 11"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
  };

  function icon(name, size = 18) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(16).slice(2));
  const pad = n => String(n).padStart(2, '0');

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
  }

  function fmtDuration(sec) {
    sec = Math.round(sec);
    if (sec < 60) return `${sec}s`;
    const hh = Math.floor(sec / 3600), mm = Math.round((sec % 3600) / 60);
    if (hh) return mm ? `${hh}h ${mm}m` : `${hh}h`;
    return `${mm}m`;
  }

  /** "12:30", "1:02:03" or plain seconds → seconds; otherwise null. */
  function parseClock(str) {
    const t = String(str || '').trim();
    if (!t) return null;
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    const m = t.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return (+m[1] || 0) * 3600 + (+m[2]) * 60 + (+m[3]);
  }

  function relTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function hashStr(s) {
    let x = 0;
    for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return x;
  }

  function coverGradient(name) {
    const hue = hashStr(name || 'x') % 360;
    return `linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${(hue + 50) % 360} 72% 42%))`;
  }

  /** Run fn after ms, but never later than an already-scheduled run. */
  function schedule(slot, ms, fn) {
    const due = Date.now() + ms;
    if (slot.timer && slot.due <= due) return;
    clearTimeout(slot.timer);
    slot.due = due;
    slot.timer = setTimeout(() => { slot.timer = null; slot.due = 0; fn(); }, ms);
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
  }

  function toast(message, kind) {
    const el = h('div', { class: 'toast' + (kind ? ' ' + kind : '') }, message);
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ---------- menu ---------- */
  let openMenuEl = null;
  function closeMenu() {
    if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
    document.removeEventListener('pointerdown', onMenuOutside, true);
    window.removeEventListener('scroll', closeMenu, true);
    window.removeEventListener('resize', closeMenu);
  }
  function onMenuOutside(e) { if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu(); }

  function openMenu(anchor, items, header) {
    closeMenu();
    const menu = h('div', { class: 'menu', role: 'menu' },
      header ? h('div', { class: 'menu-head' }, h('b', {}, header.title), h('span', {}, header.subtitle)) : null,
      items.map(it => h('button', {
        class: 'menu-item' + (it.danger ? ' danger' : ''), role: 'menuitem', type: 'button',
        onclick: () => { closeMenu(); it.onClick(); },
      }, it.icon ? icon(it.icon, 16) : null, it.label)));
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    const w = menu.offsetWidth || 200;
    menu.style.top = Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8) + 'px';
    menu.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
    openMenuEl = menu;
    setTimeout(() => {
      document.addEventListener('pointerdown', onMenuOutside, true);
      window.addEventListener('scroll', closeMenu, true);
      window.addEventListener('resize', closeMenu);
    }, 0);
  }

  /* ---------- modal ---------- */
  function openModal({ title, content, submitLabel = 'Save', cancelLabel = 'Cancel', onSubmit, onClose, danger = false, extraLeft = null }) {
    const backdrop = h('div', { class: 'backdrop' });
    const form = h('form', { class: 'modal-form' });
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (onClose) onClose();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (onSubmit) { const r = await onSubmit(); if (r === false) return; }
      close();
    });
    form.append(
      content,
      h('div', { class: 'modal-foot' },
        extraLeft ? h('div', { class: 'left' }, extraLeft) : null,
        h('button', { class: 'btn', type: 'button', onclick: close }, cancelLabel),
        h('button', { class: 'btn ' + (danger ? 'danger solid' : 'primary'), type: 'submit' }, submitLabel)));
    const dialog = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h3', {}, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('x'))),
      form);
    backdrop.append(dialog);
    backdrop.addEventListener('pointerdown', e => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    setTimeout(() => { const f = form.querySelector('input, textarea'); if (f) f.focus(); }, 30);
    return { close };
  }

  function askConfirm({ title, text, confirmLabel = 'Confirm', danger = true }) {
    return new Promise(resolve => {
      let result = false;
      openModal({
        title, content: h('p', { class: 'modal-text' }, text), submitLabel: confirmLabel, danger,
        onSubmit: () => { result = true; },
        onClose: () => resolve(result),
      });
    });
  }

  const field = (label, control, hint) => h('div', { class: 'field' },
    h('label', {}, label), control, hint ? h('div', { class: 'hint' }, hint) : null);

  /* ================================================================== */
  /* Data model                                                         */
  /* ================================================================== */
  function emptyState() {
    return { version: 2, updatedAt: new Date(0).toISOString(), playlists: [], activity: {} };
  }

  function normVideo(v) {
    return {
      id: v.id || uid(),
      url: v.url || '',
      title: v.title || 'Untitled video',
      titleAuto: !!v.titleAuto,
      addedAt: v.addedAt || Date.now(),
      dur: Number(v.dur) || 0,       // length in seconds (0 = unknown)
      pos: Number(v.pos) || 0,       // resume position in seconds
      pct: Math.max(0, Math.min(100, Number(v.pct) || 0)), // furthest progress, 0-100
      done: !!v.done,
      doneAt: v.doneAt || null,
      lastAt: v.lastAt || 0,
      summary: typeof v.summary === 'string' ? v.summary : (typeof v.note === 'string' ? v.note : ''),
      notes: Array.isArray(v.notes) ? v.notes.map(n => ({
        id: n.id || uid(), t: typeof n.t === 'number' ? n.t : null, text: String(n.text || ''), createdAt: n.createdAt || Date.now(),
      })) : [],
    };
  }

  function normalize(data) {
    const d = data && typeof data === 'object' ? data : {};
    return {
      version: 2,
      updatedAt: d.updatedAt || new Date(0).toISOString(),
      activity: d.activity && typeof d.activity === 'object' ? d.activity : {},
      playlists: (Array.isArray(d.playlists) ? d.playlists : []).map(p => ({
        id: p.id || uid(),
        name: p.name || 'Untitled course',
        description: p.description || '',
        createdAt: p.createdAt || Date.now(),
        videos: (Array.isArray(p.videos) ? p.videos : []).map(normVideo),
      })),
    };
  }

  let state = emptyState();
  const course = id => state.playlists.find(p => p.id === id) || null;

  function courseProgress(c) {
    const total = c.videos.length;
    const done = c.videos.filter(v => v.done).length;
    let sum = 0;
    for (const v of c.videos) sum += v.done ? 100 : (v.pct || 0);
    return { total, done, pct: total ? Math.round(sum / total) : 0 };
  }

  function courseDuration(c) {
    let sum = 0, unknown = 0;
    for (const v of c.videos) { if (v.dur) sum += v.dur; else unknown++; }
    return { sum, unknown };
  }

  function bumpActivity(s, cDone) {
    const k = todayKey();
    const a = state.activity[k] || (state.activity[k] = { s: 0, c: 0 });
    a.s += s || 0;
    a.c += cDone || 0;
  }

  function computeStats() {
    let lessons = 0, done = 0, courses = state.playlists.length;
    for (const c of state.playlists) { lessons += c.videos.length; done += c.videos.filter(v => v.done).length; }
    const today = state.activity[todayKey()];
    // streak: consecutive days (ending today, or yesterday) with any activity
    let streak = 0;
    const d = new Date();
    const key = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
    const active = x => { const a = state.activity[key(x)]; return a && (a.s > 0 || a.c > 0); };
    if (!active(d)) d.setDate(d.getDate() - 1);
    while (active(d)) { streak++; d.setDate(d.getDate() - 1); }
    return { courses, lessons, done, todaySec: today ? today.s : 0, streak };
  }

  function pickResume(c) {
    const inProgress = c.videos.filter(v => !v.done && v.pct > 0).sort((a, b) => b.lastAt - a.lastAt)[0];
    return inProgress || c.videos.find(v => !v.done) || c.videos[0] || null;
  }

  /* ================================================================== */
  /* Video URL parsing                                                  */
  /* ================================================================== */
  function parseTimestamp(value) {
    if (!value) return 0;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!m) return 0;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }

  /**
   * Returns { kind, provider, embed, id?, start?, src? } or null.
   * kind: 'youtube' | 'vimeo' | 'file' (all three report progress) or 'iframe' (manual progress).
   */
  function parseVideo(raw) {
    let u;
    try { u = new URL(String(raw).trim()); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;

    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    const path = u.pathname;

    if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      let id = null;
      if (host === 'youtu.be') id = path.slice(1).split('/')[0];
      else if (path === '/watch') id = u.searchParams.get('v');
      else {
        const m = path.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
        if (m) id = m[1];
      }
      if (id) {
        const start = parseTimestamp(u.searchParams.get('t') || u.searchParams.get('start'));
        return { kind: 'youtube', provider: 'YouTube', id, start, embed: `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? '&start=' + start : ''}` };
      }
      const list = u.searchParams.get('list');
      if (list) return { kind: 'iframe', provider: 'YouTube playlist', embed: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(list)}` };
    }

    if (host.endsWith('vimeo.com')) {
      const m = path.match(/\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/i);
      if (m) {
        const hash = m[2] || u.searchParams.get('h');
        return { kind: 'vimeo', provider: 'Vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}${hash ? '?h=' + hash : ''}` };
      }
    }

    if (host.endsWith('dailymotion.com') || host === 'dai.ly') {
      const m = host === 'dai.ly' ? path.match(/^\/(\w+)/) : path.match(/\/video\/(\w+)/);
      if (m) return { kind: 'iframe', provider: 'Dailymotion', embed: `https://www.dailymotion.com/embed/video/${m[1]}` };
    }

    if (host.endsWith('loom.com')) {
      const m = path.match(/\/(?:share|embed)\/(\w+)/);
      if (m) return { kind: 'iframe', provider: 'Loom', embed: `https://www.loom.com/embed/${m[1]}` };
    }

    if (host === 'drive.google.com') {
      const m = path.match(/\/file\/d\/([\w-]+)/);
      if (m) return { kind: 'iframe', provider: 'Google Drive', embed: `https://drive.google.com/file/d/${m[1]}/preview` };
    }

    if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(path)) {
      return { kind: 'file', provider: 'Video file', src: u.href, embed: u.href };
    }

    return { kind: 'iframe', provider: 'Web page', embed: u.href, generic: true };
  }

  function defaultTitle(parsed, url) {
    try {
      if (parsed && parsed.kind === 'file') return decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'Video';
      return (parsed ? parsed.provider : new URL(url).hostname) + ' video';
    } catch (e) { return 'Video'; }
  }

  function thumbUrl(v) {
    const p = parseVideo(v.url);
    if (p && p.kind === 'youtube') return `https://i.ytimg.com/vi/${p.id}/mqdefault.jpg`;
    return null;
  }

  async function fetchTitle(url) {
    try {
      const res = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(url));
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.title ? String(data.title) : null;
    } catch (e) { return null; }
  }

  function newVideo(url, parsed) {
    return normVideo({ id: uid(), url, title: defaultTitle(parsed, url), titleAuto: true, addedAt: Date.now() });
  }

  /* ================================================================== */
  /* Persistence: local cache + Google Drive                            */
  /* ================================================================== */
  let clientId = GOOGLE_CLIENT_ID || localStorage.getItem(LS.client) || '';
  let user = null;
  try { user = JSON.parse(localStorage.getItem(LS.user) || 'null'); } catch (e) { user = null; }
  let signedIn = false;

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry = 0;
  let tokenInflight = null;
  let needsReconnect = false;
  let driveFileId = null;
  const refreshSlot = {};

  let dirty = localStorage.getItem(LS.dirty) === '1';
  let version = 0;
  let saving = false;
  const persistSlot = {};
  const saveSlot = {};

  class AuthError extends Error {}

  function persistLocal() {
    if (!signedIn) return;
    try {
      localStorage.setItem(LS.cache, JSON.stringify(state));
      localStorage.setItem(LS.dirty, dirty ? '1' : '0');
    } catch (e) { /* storage full or blocked */ }
  }

  function setStatus(name) {
    const el = $('#save-status');
    if (!el) return;
    if (needsReconnect && name !== 'saving') name = 'reconnect';
    el.dataset.state = name;
    el.querySelector('span').textContent = {
      saved: 'Synced', saving: 'Syncing…', unsaved: 'Saving…', error: 'Sync failed · retry', reconnect: 'Reconnect Drive',
    }[name];
  }

  function touch(fast = true) {
    version++;
    dirty = true;
    state.updatedAt = new Date().toISOString();
    schedule(persistSlot, fast ? 300 : 4000, persistLocal);
    schedule(saveSlot, fast ? 1500 : 20000, save);
    if (fast) setStatus('unsaved');
  }

  /** Push pending progress to disk/Drive soon (used on pause, lesson switch, tab hide). */
  function flushSoon() {
    if (!dirty) return;
    persistLocal();
    schedule(saveSlot, 800, save);
  }

  /* ---------- Google auth ---------- */
  function whenGoogleReady(timeout = 15000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const check = () => {
        if (window.google && google.accounts && google.accounts.oauth2) return resolve();
        if (Date.now() - t0 > timeout) return reject(new Error('Google sign-in library failed to load. Check your connection.'));
        setTimeout(check, 100);
      };
      check();
    });
  }

  async function ensureTokenClient() {
    if (tokenClient) return;
    await whenGoogleReady();
    tokenClient = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: SCOPES, callback: () => {} });
  }

  function setToken(resp) {
    accessToken = resp.access_token;
    const secs = Number(resp.expires_in) || 3600;
    tokenExpiry = Date.now() + (secs - 120) * 1000;
    needsReconnect = false;
    $('#banner').hidden = true;
    // renew quietly a few minutes before the token expires
    clearTimeout(refreshSlot.timer);
    refreshSlot.timer = setTimeout(silentRefresh, Math.max(60, secs - 300) * 1000);
  }

  async function requestToken(prompt) {
    await ensureTokenClient();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Sign-in timed out')), prompt === 'none' ? 15000 : 180000);
      tokenClient.callback = resp => {
        clearTimeout(timer);
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        setToken(resp);
        resolve(accessToken);
      };
      tokenClient.error_callback = err => {
        clearTimeout(timer);
        reject(new Error((err && (err.type || err.message)) || 'Sign-in was cancelled'));
      };
      const opts = { prompt };
      if (user && user.email) { opts.hint = user.email; opts.login_hint = user.email; }
      tokenClient.requestAccessToken(opts);
    });
  }

  function getToken() {
    if (accessToken && Date.now() < tokenExpiry) return Promise.resolve(accessToken);
    if (!tokenInflight) tokenInflight = requestToken('none').finally(() => { tokenInflight = null; });
    return tokenInflight;
  }

  function markNeedsReconnect() {
    needsReconnect = true;
    $('#banner').hidden = false;
    setStatus('reconnect');
  }

  async function silentRefresh() {
    if (!signedIn) return;
    try {
      if (!tokenInflight) tokenInflight = requestToken('none').finally(() => { tokenInflight = null; });
      await tokenInflight;
      if (dirty) schedule(saveSlot, 500, save);
    } catch (e) {
      if (accessToken && Date.now() < tokenExpiry) {
        // The current token still works; try again right as it runs out.
        clearTimeout(refreshSlot.timer);
        refreshSlot.timer = setTimeout(silentRefresh, Math.max(5000, tokenExpiry - Date.now() + 1000));
      } else {
        markNeedsReconnect();
      }
    }
  }

  async function connect(prompt) {
    try {
      await requestToken(prompt);
      await fetchProfile();
      await syncFromDrive();
      return true;
    } catch (e) {
      console.warn('connect failed', e);
      if (prompt === 'none') markNeedsReconnect();
      return false;
    }
  }

  async function driveFetch(url, options = {}, retried = false) {
    let token;
    try { token = await getToken(); } catch (e) { throw new AuthError(e.message); }
    const res = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: 'Bearer ' + token } });
    if (res.status === 401) {
      accessToken = null;
      if (!retried) return driveFetch(url, options, true);
      throw new AuthError('Unauthorized');
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Drive error ${res.status}: ${text.slice(0, 200)}`);
    }
    return res;
  }

  async function fetchProfile() {
    try {
      const res = await driveFetch('https://www.googleapis.com/oauth2/v3/userinfo');
      const p = await res.json();
      user = { name: p.name || '', given: p.given_name || '', email: p.email || '', picture: p.picture || '' };
      localStorage.setItem(LS.user, JSON.stringify(user));
      renderUser();
    } catch (e) { /* profile is optional */ }
  }

  async function findDataFile() {
    const q = `name='${DATA_FILE_NAME}' and trashed=false`;
    const url = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
      q, fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '1', spaces: 'drive',
    });
    const res = await driveFetch(url);
    const data = await res.json();
    return data.files && data.files[0] ? data.files[0].id : null;
  }

  async function writeToDrive() {
    // keep the activity log bounded
    const keys = Object.keys(state.activity).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete state.activity[k];
    const content = JSON.stringify(state);
    if (driveFileId) {
      await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: content,
      });
      return;
    }
    const boundary = 'pn' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name: DATA_FILE_NAME, mimeType: 'application/json' });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
    const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    driveFileId = (await res.json()).id;
  }

  async function save() {
    if (saving) { schedule(saveSlot, 700, save); return; }
    if (!dirty || !signedIn) return;
    const tokenValid = accessToken && Date.now() < tokenExpiry;
    if (needsReconnect && !tokenValid) { setStatus('reconnect'); return; }
    saving = true;
    const startVersion = version;
    setStatus('saving');
    try {
      if (!driveFileId) driveFileId = await findDataFile();
      await writeToDrive();
      if (version === startVersion) { dirty = false; persistLocal(); setStatus('saved'); }
      else { schedule(saveSlot, 500, save); }
    } catch (e) {
      console.error(e);
      if (e instanceof AuthError) markNeedsReconnect();
      else { setStatus('error'); schedule(saveSlot, 30000, save); }
    } finally {
      saving = false;
    }
  }

  async function syncFromDrive() {
    setStatus('saving');
    try {
      driveFileId = driveFileId || await findDataFile();
      if (!driveFileId) {
        if (dirty || state.playlists.length) { dirty = true; await save(); } else setStatus('saved');
        return;
      }
      const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`);
      const remote = normalize(await res.json().catch(() => ({})));
      const localTs = Date.parse(state.updatedAt) || 0;
      const remoteTs = Date.parse(remote.updatedAt) || 0;
      if (dirty && localTs > remoteTs) {
        await save();               // this device has newer changes — push them
      } else {
        if (remoteTs !== localTs || !signedInRendered) {
          state = remote;
          dirty = false;
          persistLocal();
          renderCurrent();
        }
        setStatus('saved');
      }
    } catch (e) {
      console.error(e);
      if (e instanceof AuthError) markNeedsReconnect(); else setStatus('error');
      throw e;
    }
  }

  /* ================================================================== */
  /* Video players (progress tracking)                                  */
  /* ================================================================== */
  const scriptCache = {};
  function loadScript(src, ready) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        if (ready()) return resolve();
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { delete scriptCache[src]; reject(new Error('Could not load ' + src)); };
        document.head.append(s);
      });
    }
    return scriptCache[src];
  }

  let ytPromise = null;
  function loadYouTubeAPI() {
    if (!ytPromise) {
      ytPromise = new Promise((resolve, reject) => {
        if (window.YT && YT.Player) return resolve();
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.onerror = () => { ytPromise = null; reject(new Error('YouTube API failed to load')); };
        document.head.append(s);
      });
    }
    return ytPromise;
  }

  const IFRAME_ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

  function plainIframe(parsed) {
    const attrs = {
      src: parsed.embed, title: 'Video player', loading: 'lazy', allow: IFRAME_ALLOW, allowfullscreen: true,
      referrerpolicy: 'strict-origin-when-cross-origin',
    };
    if (parsed.generic) attrs.sandbox = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms';
    return h('iframe', attrs);
  }

  function youTubeController(container, parsed, cb, opts) {
    const holder = h('div');
    container.append(holder);
    const ctrl = {
      tracked: true, destroyed: false, player: null, timer: null, ready: false,
      time() { try { return this.player.getCurrentTime(); } catch (e) { return null; } },
      seek(s) { try { this.player.seekTo(s, true); this.player.playVideo(); } catch (e) { /* ignore */ } },
      destroy() { this.destroyed = true; clearInterval(this.timer); try { this.player && this.player.destroy(); } catch (e) { /* ignore */ } },
    };
    const tick = () => {
      try {
        const p = ctrl.player.getCurrentTime(), d = ctrl.player.getDuration();
        if (isFinite(p)) cb.onTick(p, d, 1);
      } catch (e) { /* player not ready */ }
    };
    withTimeout(loadYouTubeAPI(), 10000).then(() => {
      if (ctrl.destroyed) return;
      ctrl.player = new YT.Player(holder, {
        host: 'https://www.youtube-nocookie.com',
        videoId: parsed.id,
        width: '100%', height: '100%',
        playerVars: {
          autoplay: opts.autoplay ? 1 : 0, rel: 0, playsinline: 1, modestbranding: 1,
          start: Math.floor(opts.resume || 0), origin: location.origin,
        },
        events: {
          onReady: e => {
            ctrl.ready = true;
            cb.onTracking();
            let title = null;
            try { title = e.target.getVideoData().title; } catch (err) { /* ignore */ }
            cb.onMeta({ duration: e.target.getDuration(), title });
          },
          onStateChange: e => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) { cb.onPlay(); clearInterval(ctrl.timer); ctrl.timer = setInterval(tick, 1000); }
            else if (e.data === S.PAUSED) { clearInterval(ctrl.timer); tick(); cb.onPause(); }
            else if (e.data === S.ENDED) { clearInterval(ctrl.timer); cb.onEnded(); }
          },
          onError: e => {
            const blocked = e.data === 101 || e.data === 150 || e.data === 153;
            cb.onUnavailable(blocked
              ? 'The owner of this video doesn’t allow it to be played here.'
              : 'This video can’t be played (it may be private or removed).');
          },
        },
      });
    }).catch(() => { if (!ctrl.destroyed) cb.onUnavailable(null); });
    return ctrl;
  }

  function vimeoController(container, parsed, cb, opts) {
    const iframe = h('iframe', { src: parsed.embed + (parsed.embed.includes('?') ? '&' : '?') + 'dnt=1', title: 'Vimeo player', allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true });
    container.append(iframe);
    const ctrl = {
      tracked: true, destroyed: false, p: null, t: 0,
      time() { return this.t; },
      seek(s) { if (this.p) this.p.setCurrentTime(s).then(() => this.p.play()).catch(() => {}); },
      destroy() { this.destroyed = true; try { this.p && this.p.destroy(); } catch (e) { /* ignore */ } },
    };
    withTimeout(loadScript('https://player.vimeo.com/api/player.js', () => !!window.Vimeo), 10000).then(() => {
      if (ctrl.destroyed) return;
      const p = new Vimeo.Player(iframe);
      ctrl.p = p;
      p.ready().then(() => {
        cb.onTracking();
        p.getDuration().then(d => cb.onMeta({ duration: d })).catch(() => {});
        p.getVideoTitle().then(t => cb.onMeta({ title: t })).catch(() => {});
        if (opts.resume > 5) p.setCurrentTime(opts.resume).catch(() => {});
        if (opts.autoplay) p.play().catch(() => {});
      }).catch(() => cb.onUnavailable(null));
      p.on('play', () => cb.onPlay());
      p.on('pause', () => cb.onPause());
      p.on('ended', () => cb.onEnded());
      let last = 0;
      p.on('timeupdate', d => {
        ctrl.t = d.seconds;
        const now = Date.now();
        if (now - last >= 1000) { last = now; cb.onTick(d.seconds, d.duration, 1); }
      });
    }).catch(() => { if (!ctrl.destroyed) cb.onUnavailable(null); });
    return ctrl;
  }

  function fileController(container, parsed, cb, opts) {
    const video = h('video', { src: parsed.src, controls: true, preload: 'metadata', playsinline: true });
    container.append(video);
    const ctrl = {
      tracked: true, destroyed: false,
      time() { return video.currentTime; },
      seek(s) { video.currentTime = s; video.play().catch(() => {}); },
      destroy() { this.destroyed = true; try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) { /* ignore */ } },
    };
    let last = 0;
    video.addEventListener('loadedmetadata', () => {
      cb.onTracking();
      cb.onMeta({ duration: video.duration });
      if (opts.resume > 5 && opts.resume < video.duration - 3) video.currentTime = opts.resume;
      if (opts.autoplay) video.play().catch(() => {});
    });
    video.addEventListener('play', () => cb.onPlay());
    video.addEventListener('pause', () => { cb.onTick(video.currentTime, video.duration, 0); cb.onPause(); });
    video.addEventListener('ended', () => cb.onEnded());
    video.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - last >= 1000 && !video.paused) { last = now; cb.onTick(video.currentTime, video.duration, 1); }
    });
    video.addEventListener('error', () => cb.onUnavailable('This video file couldn’t be loaded.'));
    return ctrl;
  }

  /* ================================================================== */
  /* Routing & view state                                               */
  /* ================================================================== */
  let signedInRendered = false;
  const suppressAuto = new Set();   // lessons the user un-completed this session
  let pendingAutoplay = false;
  let mountSeq = 0;

  const view = { kind: null, cid: null, vid: null, ctrl: null, ui: {}, tab: 'notes', trackState: 'manual' };

  function parseRoute() {
    const m = location.hash.match(/^#\/c\/([^/]+)(?:\/([^/]+))?/);
    return m ? { name: 'course', cid: m[1], vid: m[2] || null } : { name: 'home' };
  }

  function go(hash) {
    if (location.hash === hash) route(); else location.hash = hash;
  }

  function route() {
    if (!signedInRendered) return;
    closeMenu();
    const r = parseRoute();
    if (r.name === 'course') {
      const c = course(r.cid);
      if (!c) { history.replaceState(null, '', '#/'); renderHome(); return; }
      const target = (r.vid && c.videos.find(v => v.id === r.vid)) || pickResume(c);
      if (view.kind === 'course' && view.cid === c.id) {
        if (target && target.id !== view.vid) showLesson(c, target);
      } else {
        renderCourse(c, target);
      }
    } else {
      renderHome();
    }
  }

  function renderCurrent() {
    teardownPlayer();
    view.kind = null;
    if (signedInRendered) route();
  }

  function teardownPlayer() {
    mountSeq++;
    if (view.ctrl) { try { view.ctrl.destroy(); } catch (e) { /* ignore */ } view.ctrl = null; }
    flushSoon();
  }

  window.addEventListener('hashchange', route);

  /* ================================================================== */
  /* Home view                                                          */
  /* ================================================================== */
  function greeting() {
    const hr = new Date().getHours();
    return hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  }

  function coverEl(c) {
    const cover = h('div', { class: 'cover', style: `background:${coverGradient(c.name)}` });
    const first = c.videos.map(thumbUrl).find(Boolean);
    const initial = h('div', { class: 'initial' }, (c.name || '?').trim().charAt(0).toUpperCase());
    cover.append(initial);
    if (first) {
      const img = h('img', { src: first, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => img.remove());
      img.addEventListener('load', () => initial.remove());
      cover.append(img);
    }
    return cover;
  }

  function renderHome() {
    teardownPlayer();
    view.kind = 'home'; view.cid = null; view.vid = null; view.ui = {};
    document.title = 'Learnlist — your video courses';
    const root = $('#view');
    const stats = computeStats();
    const firstName = (user && (user.given || (user.name || '').split(' ')[0])) || '';

    const statCard = (cls, ic, num, cap) => h('div', { class: 'stat ' + cls },
      h('div', { class: 'ic' }, icon(ic, 20)),
      h('div', {}, h('div', { class: 'num' }, num), h('div', { class: 'cap' }, cap)));

    const parts = [
      h('div', { class: 'hello' },
        h('h1', {}, `${greeting()}${firstName ? ', ' + firstName : ''} 👋`),
        h('p', {}, state.playlists.length ? 'Pick up where you left off.' : 'Create your first course to get started.')),
      h('div', { class: 'stats' },
        statCard('', 'book', stats.courses, stats.courses === 1 ? 'Course' : 'Courses'),
        statCard('ok', 'circleCheck', `${stats.done}/${stats.lessons}`, 'Lessons completed'),
        statCard('', 'clock', stats.todaySec ? fmtDuration(stats.todaySec) : '0m', 'Learned today'),
        statCard('warn', 'flame', stats.streak, 'Day streak')),
    ];

    // continue learning
    let best = null;
    for (const c of state.playlists) for (const v of c.videos) {
      if (!v.done && v.pct > 0 && (!best || v.lastAt > best.v.lastAt)) best = { c, v };
    }
    if (!best) {
      for (const c of state.playlists) { const v = c.videos.find(x => !x.done); if (v) { best = { c, v }; break; } }
    }
    if (best) {
      const { c, v } = best;
      const thumb = h('div', { class: 'thumb', style: `background:${coverGradient(c.name)}` });
      const img = thumbUrl(v);
      if (img) { const el = h('img', { src: img, alt: '', referrerpolicy: 'no-referrer' }); el.addEventListener('error', () => el.remove()); thumb.append(el); }
      thumb.append(h('div', { class: 'play' }, h('i', {}, icon('play', 20))));
      parts.push(
        h('div', { class: 'section-head' }, h('h2', {}, v.pct > 0 ? 'Continue learning' : 'Up next')),
        h('div', { class: 'continue' },
          h('a', { href: `#/c/${c.id}/${v.id}`, 'aria-label': 'Resume lesson' }, thumb),
          h('div', { class: 'info' },
            h('div', { class: 'eyebrow' }, c.name),
            h('h3', {}, v.title),
            h('div', { class: 'sub' }, v.pos > 5 ? `Resume at ${fmtTime(v.pos)}` : 'Not started yet'),
            h('div', { class: 'progress thin' }, h('span', { style: `width:${Math.round(v.pct)}%` })),
            h('div', {}, h('a', { class: 'btn primary', href: `#/c/${c.id}/${v.id}` }, icon('play', 14), v.pct > 0 ? 'Resume' : 'Start lesson')))));
    }

    parts.push(h('div', { class: 'section-head' },
      h('h2', {}, 'My courses'),
      state.playlists.length ? h('button', { class: 'btn small', onclick: openNewCourse }, icon('plus', 16), 'New course') : null));

    if (!state.playlists.length) {
      parts.push(h('div', { class: 'empty-state' },
        h('div', { class: 'big' }, icon('video', 30)),
        h('h3', {}, 'No courses yet'),
        h('p', {}, 'A course is just a playlist of videos. Paste your links and Learnlist tracks progress and keeps your notes.'),
        h('button', { class: 'btn primary lg', onclick: openNewCourse }, icon('plus', 18), 'Create your first course')));
    } else {
      const sorted = [...state.playlists].sort((a, b) => {
        const la = Math.max(0, ...a.videos.map(v => v.lastAt || 0)), lb = Math.max(0, ...b.videos.map(v => v.lastAt || 0));
        return lb - la || b.createdAt - a.createdAt;
      });
      parts.push(h('div', { class: 'courses' },
        sorted.map(courseCard),
        h('button', { class: 'new-card', onclick: openNewCourse }, h('div', { class: 'plus' }, icon('plus', 22)), 'New course')));
    }
    root.replaceChildren(...parts);
    window.scrollTo(0, 0);
  }

  function courseCard(c) {
    const p = courseProgress(c);
    const d = courseDuration(c);
    const cover = coverEl(c);
    if (p.total && p.done === p.total) cover.append(h('div', { class: 'tag ok' }, '✓ Completed'));
    else if (p.pct > 0) cover.append(h('div', { class: 'tag' }, `${p.pct}%`));
    return h('a', { class: 'course-card', href: `#/c/${c.id}` },
      cover,
      h('div', { class: 'card-body' },
        h('h3', {}, c.name),
        h('div', { class: 'card-meta' },
          h('span', {}, `${p.total} lesson${p.total === 1 ? '' : 's'}`),
          d.sum ? h('span', {}, fmtDuration(d.sum) + (d.unknown ? '+' : '')) : null),
        h('div', { class: 'progress thin' + (p.total && p.done === p.total ? ' ok' : '') }, h('span', { style: `width:${p.pct}%` })),
        h('div', { class: 'card-meta' }, h('span', {}, `${p.done} of ${p.total} completed`), h('span', {}, p.pct + '%'))));
  }

  /* ---------- create / edit course ---------- */
  function openNewCourse() {
    const name = h('input', { type: 'text', placeholder: 'e.g. Learn React in 30 days', maxlength: '90', required: true });
    const desc = h('input', { type: 'text', placeholder: 'What is this course about? (optional)', maxlength: '200' });
    const urls = h('textarea', { rows: '5', placeholder: 'https://www.youtube.com/watch?v=…\nhttps://vimeo.com/…\n(one link per line — you can add more later)' });
    openModal({
      title: 'New course',
      submitLabel: 'Create course',
      content: h('div', { class: 'stack', style: 'gap:14px' },
        field('Course name', name), field('Description', desc), field('Video links', urls, 'YouTube, Vimeo, Loom, Google Drive or direct .mp4 links.')),
      onSubmit: () => {
        const nm = name.value.trim();
        if (!nm) { name.focus(); return false; }
        const c = { id: uid(), name: nm, description: desc.value.trim(), createdAt: Date.now(), videos: [] };
        state.playlists.push(c);
        const res = addVideos(c, urls.value);
        touch();
        if (res.invalid) toast(`${res.invalid} link${res.invalid > 1 ? 's' : ''} skipped (not valid URLs)`);
        go(`#/c/${c.id}`);
      },
    });
  }

  function openEditCourse(c) {
    const name = h('input', { type: 'text', value: c.name, maxlength: '90', required: true });
    const desc = h('input', { type: 'text', value: c.description, maxlength: '200', placeholder: 'Optional' });
    let modal = null;
    modal = openModal({
      title: 'Edit course',
      content: h('div', { class: 'stack', style: 'gap:14px' }, field('Course name', name), field('Description', desc)),
      extraLeft: h('button', {
        class: 'btn danger', type: 'button',
        onclick: async () => {
          const ok = await askConfirm({ title: 'Delete course?', text: `“${c.name}” and all its progress and notes will be permanently deleted.`, confirmLabel: 'Delete course' });
          if (!ok) return;
          modal.close();
          teardownPlayer();
          state.playlists = state.playlists.filter(p => p.id !== c.id);
          touch();
          toast('Course deleted');
          go('#/');
        },
      }, icon('trash', 15), 'Delete'),
      onSubmit: () => {
        const nm = name.value.trim();
        if (!nm) { name.focus(); return false; }
        c.name = nm; c.description = desc.value.trim();
        touch();
        // update in place so a playing video isn't interrupted
        if (view.ui.h1) view.ui.h1.textContent = c.name;
        if (view.ui.desc) { view.ui.desc.textContent = c.description; view.ui.desc.hidden = !c.description; }
        document.title = `${c.name} · Learnlist`;
      },
    });
  }

  function openAddVideos(c) {
    const urls = h('textarea', { rows: '6', placeholder: 'Paste one link per line…', required: true });
    openModal({
      title: 'Add videos',
      submitLabel: 'Add to course',
      content: field('Video links', urls, 'Progress is tracked automatically for YouTube, Vimeo and direct video files; other sites use manual progress.'),
      onSubmit: () => {
        const res = addVideos(c, urls.value);
        if (!res.added && !res.dup && !res.invalid) return false;
        touch();
        const bits = [];
        if (res.added) bits.push(`${res.added} added`);
        if (res.dup) bits.push(`${res.dup} already in course`);
        if (res.invalid) bits.push(`${res.invalid} invalid`);
        toast(bits.join(' · '), res.added ? 'ok' : '');
        if (res.added) {
          if (!view.vid || !c.videos.some(v => v.id === view.vid)) renderCourse(c, pickResume(c));
          else { renderLessonList(c); updateCourseHeader(); refreshNavButtons(c); }
        }
      },
    });
  }

  let titleQueue = Promise.resolve();
  function lookupTitle(v) {
    titleQueue = titleQueue.then(async () => {
      const t = await fetchTitle(v.url);
      if (t && v.titleAuto) {
        v.titleAuto = false; v.title = t;
        touch();
        refreshRow(v);
        if (view.vid === v.id && view.ui.lesson) view.ui.lesson.title.textContent = t;
      }
    }).catch(() => {});
  }

  function addVideos(c, text) {
    const tokens = String(text || '').split(/\s+/).filter(Boolean);
    let added = 0, invalid = 0, dup = 0;
    for (const t of tokens) {
      const parsed = parseVideo(t);
      if (!parsed) { invalid++; continue; }
      if (c.videos.some(v => v.url === t)) { dup++; continue; }
      const v = newVideo(t, parsed);
      c.videos.push(v);
      added++;
      lookupTitle(v);
    }
    if (added) touch();
    return { added, invalid, dup };
  }

  /* ================================================================== */
  /* Course view                                                        */
  /* ================================================================== */
  function renderCourse(c, target) {
    teardownPlayer();
    view.kind = 'course'; view.cid = c.id; view.vid = null;
    const ui = view.ui = { rows: {}, lesson: null };
    document.title = `${c.name} · Learnlist`;

    ui.h1 = h('h1', {}, c.name);
    ui.desc = h('p', { class: 'desc', hidden: !c.description }, c.description);
    ui.sideBar = h('span');
    ui.sideText = h('span');
    ui.sideSub = h('span');
    ui.list = h('div', { class: 'lessons' });
    ui.stage = h('section', { class: 'stage' });

    const head = h('div', {},
      h('a', { class: 'crumb', href: '#/' }, icon('back', 16), 'All courses'),
      h('div', { class: 'course-head' },
        h('div', {}, ui.h1, ui.desc),
        h('div', { class: 'head-actions' },
          h('button', { class: 'btn', onclick: () => openEditCourse(c) }, icon('edit', 16), 'Edit'),
          h('button', { class: 'btn primary', onclick: () => openAddVideos(c) }, icon('plus', 16), 'Add videos'))));

    const side = h('aside', { class: 'side' },
      h('div', { class: 'side-head' },
        h('h3', {}, 'Course content'),
        h('div', { class: 'progress' }, ui.sideBar),
        h('div', { class: 'row' }, ui.sideText, ui.sideSub)),
      ui.list,
      h('div', { class: 'side-foot' }, h('button', { class: 'btn', onclick: () => openAddVideos(c) }, icon('plus', 16), 'Add videos')));

    $('#view').replaceChildren(head, h('div', { class: 'layout' }, ui.stage, side));
    window.scrollTo(0, 0);

    renderLessonList(c);
    updateCourseHeader();
    if (target) {
      view.vid = target.id;
      history.replaceState(null, '', `#/c/${c.id}/${target.id}`);
      showLesson(c, target);
    } else {
      renderEmptyStage(c);
    }
  }

  function renderEmptyStage(c) {
    view.ui.lesson = null;
    view.ui.stage.replaceChildren(h('div', { class: 'empty-state' },
      h('div', { class: 'big' }, icon('video', 30)),
      h('h3', {}, 'No lessons yet'),
      h('p', {}, 'Add video links to turn this into a course.'),
      h('button', { class: 'btn primary', onclick: () => openAddVideos(c) }, icon('plus', 16), 'Add videos')));
  }

  function updateCourseHeader() {
    const c = course(view.cid);
    const ui = view.ui;
    if (!c || !ui.sideBar) return;
    const p = courseProgress(c);
    const d = courseDuration(c);
    ui.sideBar.style.width = p.pct + '%';
    ui.sideBar.parentElement.classList.toggle('ok', p.total > 0 && p.done === p.total);
    ui.sideText.textContent = `${p.done} of ${p.total} completed`;
    ui.sideSub.textContent = p.pct + '%' + (d.sum ? ' · ' + fmtDuration(d.sum) + (d.unknown ? '+' : '') : '');
  }

  function renderLessonList(c) {
    view.ui.rows = {};
    view.ui.list.replaceChildren(...c.videos.map((v, i) => lessonRow(c, v, i)));
  }

  function lessonRow(c, v, i) {
    const check = h('button', {
      class: 'check', type: 'button', title: 'Toggle completed', 'aria-label': 'Toggle completed',
      onclick: e => { e.stopPropagation(); toggleDone(v); },
    }, icon('check', 14));
    const title = h('div', { class: 'l-title' });
    const meta = h('div', { class: 'l-meta' });
    const bar = h('div', { class: 'progress thin' }, h('span'));
    const more = h('button', {
      class: 'icon-btn small', type: 'button', 'aria-label': 'Lesson options',
      onclick: e => {
        e.stopPropagation();
        openMenu(more, [
          { label: 'Move up', icon: 'up', onClick: () => moveVideo(c, v, -1) },
          { label: 'Move down', icon: 'down', onClick: () => moveVideo(c, v, 1) },
          { label: 'Open original', icon: 'external', onClick: () => window.open(v.url, '_blank', 'noopener') },
          { label: 'Remove', icon: 'trash', danger: true, onClick: () => removeVideo(c, v) },
        ]);
      },
    }, icon('more', 16));
    const row = h('div', {
      class: 'lesson', role: 'button', tabindex: '0',
      onclick: () => goLesson(c, v),
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goLesson(c, v); } },
    }, check, h('div', { class: 'l-main' }, title, meta, bar), more);
    view.ui.rows[v.id] = { row, check, title, meta, bar };
    refreshRow(v);
    return row;
  }

  function refreshRow(v) {
    const r = view.ui.rows && view.ui.rows[v.id];
    if (!r) return;
    const parsed = parseVideo(v.url);
    r.row.classList.toggle('done', v.done);
    r.row.classList.toggle('active', v.id === view.vid);
    r.check.classList.toggle('on', v.done);
    r.title.textContent = v.title;
    const idx = (course(view.cid) || { videos: [] }).videos.indexOf(v) + 1;
    r.meta.textContent = [idx ? `Lesson ${idx}` : null, parsed ? parsed.provider : null, v.dur ? fmtTime(v.dur) : null].filter(Boolean).join(' · ');
    const showBar = !v.done && v.pct > 0;
    r.bar.hidden = !showBar;
    r.bar.firstChild.style.width = Math.round(v.pct) + '%';
  }

  function goLesson(c, v) {
    pendingAutoplay = false;
    go(`#/c/${c.id}/${v.id}`);
    if (window.innerWidth < 1060) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function moveVideo(c, v, delta) {
    const i = c.videos.indexOf(v), j = i + delta;
    if (j < 0 || j >= c.videos.length) return;
    [c.videos[i], c.videos[j]] = [c.videos[j], c.videos[i]];
    touch();
    renderLessonList(c);
    refreshNavButtons(c);
  }

  async function removeVideo(c, v) {
    const ok = await askConfirm({ title: 'Remove lesson?', text: `“${v.title}” and its notes will be removed from this course.`, confirmLabel: 'Remove' });
    if (!ok) return;
    const i = c.videos.indexOf(v);
    c.videos = c.videos.filter(x => x.id !== v.id);
    touch();
    if (view.vid === v.id) {
      const next = c.videos[Math.min(i, c.videos.length - 1)];
      if (next) renderCourse(c, next);
      else { teardownPlayer(); view.vid = null; renderLessonList(c); updateCourseHeader(); renderEmptyStage(c); history.replaceState(null, '', `#/c/${c.id}`); }
    } else {
      renderLessonList(c); updateCourseHeader(); refreshNavButtons(c);
    }
  }

  /* ---------- completion ---------- */
  function setDone(v, done, auto) {
    if (v.done === done) return;
    v.done = done;
    v.doneAt = done ? Date.now() : null;
    if (done) {
      v.pct = 100;
      bumpActivity(0, 1);
      suppressAuto.delete(v.id);
      const c = course(view.cid);
      const p = c ? courseProgress(c) : null;
      if (p && p.total && p.done + 0 === p.total) toast('🎉 Course completed!', 'ok');
      else toast(auto ? 'Lesson completed ✓' : 'Marked as completed ✓', 'ok');
    } else {
      suppressAuto.add(v.id);
      v.pct = v.dur && v.pos ? Math.min(99, (v.pos / v.dur) * 100) : 0;
    }
    touch();
    updateLessonUI(v);
  }

  function toggleDone(v) { setDone(v, !v.done, false); }

  /* ---------- lesson stage ---------- */
  function showLesson(c, v) {
    teardownPlayer();
    view.vid = v.id;
    history.replaceState(null, '', `#/c/${c.id}/${v.id}`);
    for (const x of c.videos) refreshRow(x);
    renderStage(c, v);
    const row = view.ui.rows[v.id];
    if (row && row.row.scrollIntoView) row.row.scrollIntoView({ block: 'nearest' });
  }

  function refreshNavButtons(c) {
    const L = view.ui.lesson;
    if (!L) return;
    const v = c.videos.find(x => x.id === view.vid);
    if (!v) return;
    const i = c.videos.indexOf(v);
    L.eyebrow.textContent = `Lesson ${i + 1} of ${c.videos.length}`;
    L.prev.disabled = i === 0;
    L.next.disabled = i === c.videos.length - 1;
    for (const x of c.videos) refreshRow(x);
  }

  function renderStage(c, v) {
    const parsed = parseVideo(v.url);
    const i = c.videos.indexOf(v);
    const autoplay = pendingAutoplay;
    pendingAutoplay = false;

    const player = h('div', { class: 'player' });
    const hint = h('div', { class: 'player-hint', hidden: true });

    const L = view.ui.lesson = {};
    L.eyebrow = h('div', { class: 'eyebrow' }, `Lesson ${i + 1} of ${c.videos.length}`);
    L.title = h('h2', { class: 'lesson-title' }, v.title);
    L.prev = h('button', { class: 'btn', type: 'button', onclick: () => goLesson(c, c.videos[i - 1]), disabled: i === 0 }, icon('left', 16), 'Previous');
    L.next = h('button', { class: 'btn', type: 'button', onclick: () => goLesson(c, c.videos[i + 1]), disabled: i === c.videos.length - 1 }, 'Next', icon('right', 16));
    L.doneBtn = h('button', { class: 'btn', type: 'button', onclick: () => toggleDone(v) });
    L.stripBar = h('div', { class: 'progress' }, h('span'));
    L.stripText = h('span');
    L.badge = h('span', { class: 'badge manual' }, 'Manual progress');

    const autoInput = h('input', { type: 'checkbox' });
    autoInput.checked = localStorage.getItem(LS.autoplay) !== '0';
    autoInput.addEventListener('change', () => localStorage.setItem(LS.autoplay, autoInput.checked ? '1' : '0'));
    const autoSwitch = h('label', { class: 'switch' }, autoInput, h('span', { class: 'track' }), 'Autoplay next');

    const lessonBar = h('div', { class: 'lesson-bar' },
      h('div', {}, L.eyebrow, L.title),
      h('div', { class: 'lesson-actions' }, autoSwitch, L.prev, L.doneBtn, L.next));

    const strip = h('div', { class: 'strip' }, L.stripBar, h('div', { class: 'strip-row' }, L.stripText, L.badge));

    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const body = h('div', { class: 'tab-body' });
    const tabDefs = [['notes', 'Notes'], ['progress', 'Progress'], ['details', 'Details']];
    const showTab = key => {
      view.tab = key;
      for (const b of tabs.children) b.classList.toggle('active', b.dataset.key === key);
      L.progress = null;
      body.replaceChildren(key === 'notes' ? notesTab(c, v) : key === 'progress' ? progressTab(c, v) : detailsTab(c, v));
      updateLessonUI(v);
    };
    for (const [key, label] of tabDefs) {
      tabs.append(h('button', { class: 'tab', type: 'button', role: 'tab', 'data-key': key, onclick: () => showTab(key) }, label));
    }

    view.ui.stage.replaceChildren(
      h('div', { class: 'player-wrap' }, player, hint),
      lessonBar, strip, tabs, body);

    L.player = player;
    L.hint = hint;
    showTab(view.tab || 'notes');
    mountPlayer(v, parsed, player, hint, autoplay);
  }

  function setTrackState(state) {
    view.trackState = state;
    const L = view.ui.lesson;
    if (!L) return;
    L.badge.className = 'badge ' + state;
    L.badge.textContent = state === 'tracked' ? 'Auto-tracking progress' : state === 'connecting' ? 'Connecting to player…' : 'Manual progress';
    applyProgressTabState();
  }

  function mountPlayer(v, parsed, player, hint, autoplay) {
    const seq = ++mountSeq;
    const resume = !v.done && v.pos > 5 ? v.pos : (parsed && parsed.start) || 0;
    const opts = { resume, autoplay };

    if (!parsed) {
      player.append(h('div', { class: 'player-msg' }, h('p', {}, 'This link can’t be read as a video URL.')));
      setTrackState('manual');
      return;
    }

    const cb = makeCallbacks(v, parsed, player, hint, seq);
    let ctrl = null;
    if (parsed.kind === 'youtube') ctrl = youTubeController(player, parsed, cb, opts);
    else if (parsed.kind === 'vimeo') ctrl = vimeoController(player, parsed, cb, opts);
    else if (parsed.kind === 'file') ctrl = fileController(player, parsed, cb, opts);

    if (ctrl) {
      view.ctrl = ctrl;
      setTrackState('connecting');
      setTimeout(() => { if (seq === mountSeq && view.trackState === 'connecting') setTrackState('manual'); }, 12000);
    } else {
      player.append(plainIframe(parsed));
      view.ctrl = null;
      setTrackState('manual');
      hint.hidden = false;
      const parts = [`${parsed.provider} players don’t share playback progress, so use the Progress tab or “Mark complete”. `];
      if (parsed.generic) {
        parts.push('If the video stays blank, the site blocks embedding — ',
          h('a', { href: v.url, target: '_blank', rel: 'noopener noreferrer' }, 'open it in a new tab.'));
      }
      hint.replaceChildren(...parts);
    }
  }

  function makeCallbacks(v, parsed, player, hint, seq) {
    const live = () => seq === mountSeq;
    return {
      onTracking() { if (live()) setTrackState('tracked'); },
      onMeta({ duration, title }) {
        if (!live()) return;
        if (duration && isFinite(duration) && Math.abs(duration - v.dur) > 1) { v.dur = Math.round(duration); touch(false); updateLessonUI(v); }
        if (title && v.titleAuto) {
          v.title = title; v.titleAuto = false; touch(false);
          if (view.ui.lesson) view.ui.lesson.title.textContent = title;
          refreshRow(v);
        }
      },
      onTick(pos, dur, delta) {
        if (!live()) return;
        if (dur && isFinite(dur)) v.dur = Math.round(dur);
        v.pos = pos;
        v.lastAt = Date.now();
        if (!v.done && v.dur) v.pct = Math.max(v.pct, Math.min(100, (pos / v.dur) * 100));
        if (delta) bumpActivity(delta, 0);
        if (!v.done && v.pct >= AUTO_COMPLETE_PCT && !suppressAuto.has(v.id)) setDone(v, true, true);
        updateLessonUI(v);
        touch(false);
      },
      onPlay() { /* reserved */ },
      onPause() { if (live()) flushSoon(); },
      onEnded() {
        if (!live()) return;
        v.pos = 0; v.lastAt = Date.now();
        suppressAuto.delete(v.id);
        if (!v.done) setDone(v, true, true); else { v.pct = 100; }
        updateLessonUI(v);
        touch();
        const c = course(view.cid);
        if (c && localStorage.getItem(LS.autoplay) !== '0') {
          const next = c.videos[c.videos.indexOf(v) + 1];
          if (next) { pendingAutoplay = true; go(`#/c/${c.id}/${next.id}`); }
        }
      },
      onUnavailable(message) {
        if (!live()) return;
        player.replaceChildren();
        if (message) {
          player.append(h('div', { class: 'player-msg' },
            h('p', {}, message),
            h('a', { class: 'btn', href: v.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 16), 'Open original')));
        } else {
          player.append(plainIframe(parsed));
        }
        view.ctrl = null;
        setTrackState('manual');
        hint.hidden = false;
        hint.textContent = 'Automatic tracking isn’t available for this video — use the Progress tab or “Mark complete”.';
      },
    };
  }

  /* ---------- live UI refresh (no re-mount) ---------- */
  function updateLessonUI(v) {
    refreshRow(v);
    updateCourseHeader();
    const L = view.ui.lesson;
    if (!L || view.vid !== v.id) return;
    const pct = v.done ? 100 : Math.round(v.pct * 10) / 10;
    L.stripBar.firstChild.style.width = pct + '%';
    L.stripBar.classList.toggle('ok', v.done);
    L.stripText.textContent = (v.dur ? `${fmtTime(v.pos)} / ${fmtTime(v.dur)} · ` : '') + `${Math.round(pct)}% watched` + (v.done ? ' · Completed' : '');
    L.doneBtn.className = 'btn ' + (v.done ? 'success' : 'primary');
    L.doneBtn.replaceChildren(icon('check', 16), v.done ? 'Completed' : 'Mark complete');
    if (L.progress) {
      L.progress.ring.style.setProperty('--p', Math.round(pct));
      L.progress.ring.classList.toggle('ok', v.done);
      L.progress.ringText.textContent = Math.round(pct) + '%';
      L.progress.summary.textContent = v.done ? `Completed${v.doneAt ? ' on ' + relTime(v.doneAt) : ''}` : (v.dur ? `${fmtTime(v.pos)} of ${fmtTime(v.dur)} watched` : 'Length not known yet');
      L.progress.slider.value = Math.round(v.done ? 100 : v.pct);
      L.progress.sliderVal.textContent = Math.round(v.done ? 100 : v.pct) + '%';
      L.progress.doneBtn.className = 'btn ' + (v.done ? 'success' : 'primary');
      L.progress.doneBtn.replaceChildren(icon('check', 16), v.done ? 'Completed — click to undo' : 'Mark as complete');
    }
  }

  function applyProgressTabState() {
    const L = view.ui.lesson;
    if (!L || !L.progress) return;
    const manual = view.trackState === 'manual';
    L.progress.slider.disabled = !manual;
    L.progress.manualBox.hidden = !manual;
    L.progress.hint.textContent = manual
      ? 'This player can’t report playback, so set your progress yourself. It’s marked complete at ' + AUTO_COMPLETE_PCT + '%.'
      : view.trackState === 'connecting'
        ? 'Connecting to the player…'
        : 'Progress is tracked automatically while you watch. Your position is saved so you can resume later.';
  }

  /* ---------- tabs ---------- */
  function progressTab(c, v) {
    const L = view.ui.lesson;
    const ringText = h('span');
    const ring = h('div', { class: 'ring' }, ringText);
    const summary = h('div', { class: 'sub' });
    const doneBtn = h('button', { class: 'btn', type: 'button', onclick: () => toggleDone(v) });
    const sliderVal = h('b');
    const slider = h('input', { type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Progress' });
    slider.addEventListener('input', () => {
      const val = Number(slider.value);
      v.pct = val;
      if (v.dur) v.pos = (v.dur * val) / 100;
      v.lastAt = Date.now();
      if (val >= AUTO_COMPLETE_PCT && !v.done) setDone(v, true, false);
      else if (val < AUTO_COMPLETE_PCT && v.done) { v.done = false; v.doneAt = null; suppressAuto.add(v.id); }
      touch();
      updateLessonUI(v);
    });
    const hint = h('div', { class: 'hint' });
    const durInput = h('input', { type: 'number', min: '0', step: '1', placeholder: 'e.g. 45', value: v.dur ? Math.round(v.dur / 60) : '' });
    durInput.addEventListener('input', () => {
      v.dur = Math.max(0, Number(durInput.value) || 0) * 60;
      if (v.dur && v.pct) v.pos = (v.dur * v.pct) / 100;
      touch(); updateLessonUI(v);
    });
    const manualBox = h('div', { class: 'field' }, h('label', {}, 'Video length (minutes) — optional'), durInput,
      h('div', { class: 'hint' }, 'Used for course totals and your “time learned” stats.'));

    L.progress = { ring, ringText, summary, doneBtn, slider, sliderVal, hint, manualBox };
    const el = h('div', { class: 'panel-card' },
      h('div', { class: 'big-progress' }, ring, h('div', {}, h('h4', {}, 'Lesson progress'), summary)),
      h('div', { class: 'field' },
        h('div', { class: 'row-between' }, h('label', {}, 'Set progress'), sliderVal), slider, hint),
      manualBox,
      h('div', {}, doneBtn));
    // applied after insertion by showTab → updateLessonUI; state flags here:
    setTimeout(applyProgressTabState, 0);
    return el;
  }

  function detailsTab(c, v) {
    const title = h('input', { type: 'text', value: v.title, maxlength: '160' });
    title.addEventListener('input', () => {
      v.title = title.value; v.titleAuto = false;
      if (view.ui.lesson) view.ui.lesson.title.textContent = v.title || 'Untitled video';
      refreshRow(v); touch();
    });
    const url = h('input', { type: 'text', value: v.url, readonly: true });
    const parsed = parseVideo(v.url);
    return h('div', { class: 'panel-card' },
      field('Lesson title', title),
      field('Video URL', url, parsed ? `Source: ${parsed.provider}` : 'Unrecognised link'),
      h('div', { class: 'row-between' },
        h('a', { class: 'btn', href: v.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', 16), 'Open original'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => removeVideo(c, v) }, icon('trash', 16), 'Remove lesson')));
  }

  function notesTab(c, v) {
    const summary = h('textarea', { rows: '3', placeholder: 'Key takeaways for this lesson…', value: v.summary });
    summary.addEventListener('input', () => { v.summary = summary.value; touch(); });

    let stamp = null;
    const text = h('textarea', { rows: '3', placeholder: 'Write a note… (Ctrl/⌘ + Enter to add)' });
    const stampBtn = h('button', { class: 'chip', type: 'button', title: 'Capture the current video time' });
    const clearStamp = h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Remove timestamp', onclick: () => { stamp = null; renderStamp(); } }, icon('x', 14));
    const manualTime = h('input', { class: 'time-input', type: 'text', placeholder: 'mm:ss', 'aria-label': 'Timestamp (optional)' });
    const canStamp = () => view.ctrl && view.trackState === 'tracked';

    function renderStamp() {
      const tracked = canStamp();
      stampBtn.hidden = !tracked;
      clearStamp.hidden = !tracked || stamp == null;
      manualTime.hidden = tracked;
      stampBtn.replaceChildren(icon('clock', 13), stamp == null ? 'Add timestamp' : '@ ' + fmtTime(stamp));
    }
    const capture = () => {
      if (!canStamp()) return;
      const t = view.ctrl.time();
      if (t != null && isFinite(t)) { stamp = Math.floor(t); renderStamp(); }
    };
    stampBtn.addEventListener('click', capture);
    text.addEventListener('focus', () => { if (stamp == null && !text.value) capture(); });

    const list = h('div', { class: 'notes-list' });

    function addNote() {
      const val = text.value.trim();
      if (!val) { text.focus(); return; }
      let t = stamp;
      if (!canStamp()) { const parsed = parseClock(manualTime.value); t = parsed != null ? parsed : null; }
      v.notes.push({ id: uid(), t, text: val, createdAt: Date.now() });
      touch();
      text.value = ''; manualTime.value = ''; stamp = null;
      renderStamp(); renderList();
    }
    text.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(); } });

    function renderList() {
      const sorted = [...v.notes].sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity) || a.createdAt - b.createdAt);
      if (!sorted.length) { list.replaceChildren(h('div', { class: 'empty-note' }, 'No notes yet. Notes you add while watching jump back to that moment.')); return; }
      list.replaceChildren(...sorted.map(noteItem));
    }

    function noteItem(n) {
      const wrap = h('div', { class: 'note' });
      const seekable = n.t != null && view.ctrl && view.trackState === 'tracked';
      const ts = n.t != null
        ? h('button', {
          class: 'chip' + (seekable ? '' : ' disabled'), type: 'button', title: seekable ? 'Jump to this moment' : 'Timestamp',
          onclick: () => { if (view.ctrl && view.trackState === 'tracked') view.ctrl.seek(n.t); },
        }, icon('play', 11), fmtTime(n.t))
        : h('span', {});
      const body = h('div', {}, h('div', { class: 'text' }, n.text), h('div', { class: 'when' }, relTime(n.createdAt)));
      const actions = h('div', { class: 'note-actions' },
        h('button', { class: 'icon-btn small', type: 'button', 'aria-label': 'Edit note', onclick: () => edit() }, icon('edit', 15)),
        h('button', {
          class: 'icon-btn small', type: 'button', 'aria-label': 'Delete note',
          onclick: () => { v.notes = v.notes.filter(x => x.id !== n.id); touch(); renderList(); },
        }, icon('trash', 15)));
      wrap.append(ts, body, actions);

      function edit() {
        const ta = h('textarea', { rows: '3', value: n.text });
        const row = h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', onclick: renderList }, 'Cancel'),
          h('button', { class: 'btn small primary', type: 'button', onclick: () => { const val = ta.value.trim(); if (val) { n.text = val; touch(); } renderList(); } }, 'Save'));
        wrap.replaceChildren(h('div', { class: 'note-edit' }, ta, row));
        ta.focus();
      }
      return wrap;
    }

    renderStamp();
    renderList();
    // the tracking state can change after the tab is created
    const obs = setInterval(() => { if (!document.body.contains(list)) clearInterval(obs); else renderStamp(); }, 1500);

    return h('div', { class: 'tab-body' },
      h('div', { class: 'panel-card' },
        h('h4', {}, 'Key takeaways'), summary),
      h('div', { class: 'panel-card composer' },
        h('h4', {}, 'Notes'),
        text,
        h('div', { class: 'composer-row' }, stampBtn, clearStamp, manualTime, h('div', { class: 'grow' }),
          h('button', { class: 'btn primary small', type: 'button', onclick: addNote }, icon('plus', 15), 'Add note')),
        list));
  }

  /* ================================================================== */
  /* Shell: theme, user menu, auth screens                              */
  /* ================================================================== */
  function effectiveTheme() {
    const t = document.documentElement.dataset.theme;
    return t || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme() {
    const t = localStorage.getItem(LS.theme);
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const btn = $('#theme-btn');
    if (btn) btn.replaceChildren(icon(effectiveTheme() === 'dark' ? 'sun' : 'moon', 18));
  }

  function renderUser() {
    const img = $('#user-pic'), ini = $('#user-initial');
    const name = (user && (user.name || user.email)) || '';
    ini.textContent = name ? name.charAt(0).toUpperCase() : '•';
    if (user && user.picture) { img.src = user.picture; img.hidden = false; ini.hidden = true; }
    else { img.hidden = true; ini.hidden = false; }
  }

  function showScreen(name) {
    $('#setup').hidden = name !== 'setup';
    $('#login').hidden = name !== 'login';
    $('#app').hidden = name !== 'app';
  }

  function showApp() {
    showScreen('app');
    signedInRendered = true;
    renderUser();
    applyTheme();
    route();
  }

  async function signIn() {
    const errorEl = $('#login-error');
    const btn = $('#signin-btn');
    const label = btn.querySelector('span');
    errorEl.hidden = true;
    btn.disabled = true;
    label.textContent = 'Signing in…';
    try {
      await requestToken('');
      signedIn = true;
      localStorage.setItem(LS.signedIn, '1');
      state = emptyState();
      dirty = false;
      await fetchProfile();
      signedInRendered = false;
      showScreen('app');
      renderUser();
      applyTheme();
      $('#view').replaceChildren(h('div', { class: 'loading' }, h('div', { class: 'spinner' }), 'Loading your courses…'));
      await syncFromDrive();
      signedInRendered = true;
      route();
    } catch (err) {
      console.error(err);
      signedIn = false;
      localStorage.removeItem(LS.signedIn);
      showScreen('login');
      errorEl.textContent = 'Sign-in failed: ' + err.message;
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      label.textContent = 'Sign in with Google';
    }
  }

  function signOut() {
    if (dirty && !confirm('Some changes haven’t reached Google Drive yet. Sign out anyway?')) return;
    clearTimeout(refreshSlot.timer);
    teardownPlayer();
    if (accessToken && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch (e) { /* ignore */ }
    }
    accessToken = null; tokenExpiry = 0; driveFileId = null; needsReconnect = false;
    state = emptyState(); dirty = false; signedIn = false; signedInRendered = false; user = null;
    for (const k of [LS.cache, LS.dirty, LS.user, LS.signedIn]) localStorage.removeItem(k);
    $('#banner').hidden = true;
    history.replaceState(null, '', location.pathname);
    showScreen('login');
  }

  function bindEvents() {
    $('#setup-form').addEventListener('submit', e => {
      e.preventDefault();
      clientId = $('#client-id').value.trim();
      localStorage.setItem(LS.client, clientId);
      tokenClient = null;
      showScreen('login');
      ensureTokenClient().catch(() => {});
    });
    $('#change-client').addEventListener('click', e => { e.preventDefault(); $('#client-id').value = clientId; showScreen('setup'); });
    $('#signin-btn').addEventListener('click', signIn);
    $('#reconnect-btn').addEventListener('click', async () => {
      const ok = await connect('');
      toast(ok ? 'Reconnected to Google Drive' : 'Couldn’t reconnect — try again', ok ? 'ok' : '');
    });
    $('#save-status').addEventListener('click', async () => {
      const s = $('#save-status').dataset.state;
      if (s === 'reconnect') { const ok = await connect(''); toast(ok ? 'Reconnected' : 'Couldn’t reconnect'); }
      else if (s === 'error') { dirty = true; save(); }
    });
    $('#theme-btn').addEventListener('click', () => {
      localStorage.setItem(LS.theme, effectiveTheme() === 'dark' ? 'light' : 'dark');
      applyTheme();
    });
    $('#user-btn').addEventListener('click', () => {
      openMenu($('#user-btn'), [{ label: 'Sign out', icon: 'logout', onClick: signOut }],
        user ? { title: user.name || 'Signed in', subtitle: user.email || '' } : null);
    });

    // Keep data safe and sessions fresh
    document.addEventListener('visibilitychange', () => {
      if (!signedIn) return;
      if (document.hidden) { persistLocal(); if (dirty) save(); }
      else if (!accessToken || Date.now() >= tokenExpiry) {
        if (!tokenInflight) silentRefresh();
      }
    });
    window.addEventListener('pagehide', persistLocal);
    window.addEventListener('online', () => { if (dirty) save(); });
  }

  /* ================================================================== */
  /* Boot                                                               */
  /* ================================================================== */
  function boot() {
    applyTheme();
    bindEvents();
    if (GOOGLE_CLIENT_ID) $('#change-client').hidden = true;
    if (!clientId) { showScreen('setup'); return; }

    const cached = localStorage.getItem(LS.cache);
    if (localStorage.getItem(LS.signedIn) === '1' && cached) {
      // Returning user: open instantly from the on-device copy, then reconnect to Drive quietly.
      try { state = normalize(JSON.parse(cached)); } catch (e) { state = emptyState(); }
      signedIn = true;
      showApp();
      setStatus(dirty ? 'unsaved' : 'saved');
      connect('none');
    } else {
      showScreen('login');
      ensureTokenClient().catch(() => {});
    }
  }

  boot();
})();
