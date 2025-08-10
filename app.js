// Offline Lyrics Viewer (LRC support)
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  videoFile: $("#videoFile"),
  clearVideo: $("#clearVideo"),
  video: $("#video"),
  playPause: $("#playPause"),
  tickMs: $("#tickMs"),
  autoScroll: $("#autoScroll"),
  lyricsView: $("#lyricsView"),
  lyricsInput: $("#lyricsInput"),
  insertTimestamp: $("#insertTimestamp"),
  convertPlainToLrc: $("#convertPlainToLrc"),
  saveLyrics: $("#saveLyrics"),
  exportLyrics: $("#exportLyrics"),
  importFile: $("#importFile"),
  lrcMode: $("#lrcMode"),
  toggleView: $("#toggleView"),
  viewPanel: $("#viewPanel"),
  editPanel: $("#editPanel"),
  titleInput: $("#titleInput"),
  loadSaved: $("#loadSaved"),
  savedList: $("#savedList"),
  deleteSaved: $("#deleteSaved"),
};

let state = {
  timer: null,
  parsed: [], // {ms, text}
  activeIndex: -1,
  lastKey: null, // storage key
};

function msFromTag(tag) {
  // tag like "01:23.45" or "1:23.4"
  const m = /^(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?$/.exec(tag.trim());
  if (!m) return null;
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  const frac = m[3] ? parseInt(m[3], 10) : 0;
  // interpret as centiseconds or milliseconds depending on digits
  const ms = frac < 100 ? frac * 10 : frac;
  return (mm * 60 + ss) * 1000 + ms;
}

function parseLRC(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const m = line.match(/\[(\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?)\](.*)$/);
    if (m) {
      const ms = msFromTag(m[1]);
      if (ms != null) out.push({ ms, text: m[2].trim() });
    } else if (line.trim()) {
      // Plain line without tag -> keep as -1 so it can display unsynced
      out.push({ ms: -1, text: line.trim() });
    }
  }
  out.sort((a,b) => (a.ms === -1 ? 1 : b.ms === -1 ? -1 : a.ms - b.ms));
  return out;
}

function renderLyricsView(parsed) {
  els.lyricsView.innerHTML = "";
  parsed.forEach((row, idx) => {
    const div = document.createElement("div");
    div.className = "lyrics-line";
    div.dataset.index = idx;
    div.textContent = row.text || "";
    els.lyricsView.appendChild(div);
  });
}

function nearestIndexFor(timeMs, arr) {
  // binary search for last <= timeMs
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = arr[mid].ms;
    if (t !== -1 && t <= timeMs) { ans = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return ans;
}

function tick() {
  if (!els.video || !state.parsed.length) return;
  const ms = Math.floor(els.video.currentTime * 1000);
  const i = nearestIndexFor(ms, state.parsed);
  if (i !== state.activeIndex) {
    state.activeIndex = i;
    $$(".lyrics-line").forEach((el, idx) => {
      if (idx === i) el.classList.add("active");
      else el.classList.remove("active");
    });
    if (els.autoScroll.checked && i >= 0) {
      const el = $$(".lyrics-line")[i];
      el?.scrollIntoView({ block: "center" });
    }
  }
}

function startTicker() {
  stopTicker();
  const ms = Math.max(16, parseInt(els.tickMs.value || "100", 10));
  state.timer = setInterval(tick, ms);
}

function stopTicker() {
  if (state.timer) { clearInterval(state.timer); state.timer = null; }
}

function blobUrlFromFile(file) {
  return URL.createObjectURL(file);
}

function loadSavedList() {
  els.savedList.innerHTML = "";
  const keys = Object.keys(localStorage).filter(k => k.startsWith("lyrics:")).sort();
  for (const k of keys) {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = k.replace(/^lyrics:/, "");
    els.savedList.appendChild(opt);
  }
}

function saveLyrics() {
  const keyName = (els.titleInput.value || state.lastKey || "untitled").trim();
  const key = "lyrics:" + keyName;
  const payload = {
    lrcMode: !!els.lrcMode.checked,
    text: els.lyricsInput.value || "",
    updatedAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
  state.lastKey = key;
  loadSavedList();
  alert("保存しました: " + keyName);
}

function loadLyricsByKey(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const obj = JSON.parse(raw);
  els.lrcMode.checked = !!obj.lrcMode;
  els.lyricsInput.value = obj.text || "";
  state.parsed = obj.lrcMode ? parseLRC(obj.text || "") : (obj.text || "").split(/\r?\n/).map(t => ({ ms: -1, text: t }));
  renderLyricsView(state.parsed);
}

function exportLyrics() {
  const text = els.lyricsInput.value || "";
  const ext = els.lrcMode.checked ? "lrc" : "txt";
  const name = (els.titleInput.value || "lyrics") + "." + ext;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function importLyrics(file) {
  const reader = new FileReader();
  reader.onload = () => {
    els.lyricsInput.value = reader.result;
    if (/\.lrc$/i.test(file.name)) els.lrcMode.checked = true;
    // Parse and render
    state.parsed = els.lrcMode.checked ? parseLRC(els.lyricsInput.value) : (els.lyricsInput.value).split(/\r?\n/).map(t => ({ ms: -1, text: t }));
    renderLyricsView(state.parsed);
  };
  reader.readAsText(file, 'utf-8');
}

function insertTimestampAtCursor() {
  const v = els.video.currentTime || 0;
  const mm = Math.floor(v / 60);
  const ss = Math.floor(v % 60);
  const cs = Math.floor((v * 100) % 100);
  const tag = `[${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}] `;
  const ta = els.lyricsInput;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const val = ta.value;
  ta.value = val.slice(0, start) + tag + val.slice(end);
  const pos = start + tag.length;
  ta.setSelectionRange(pos, pos);
  ta.focus();
}

function convertPlainToLrc() {
  const text = els.lyricsInput.value || "";
  const lines = text.split(/\r?\n/).filter(s => s.trim().length > 0);
  if (!lines.length) return;
  const dur = els.video.duration || 0;
  const step = dur > 0 ? (dur * 1000) / lines.length : 2000; // fallback 2s
  const out = lines.map((ln, i) => {
    const ms = Math.floor(i * step);
    const mm = Math.floor(ms/60000);
    const ss = Math.floor((ms%60000)/1000);
    const cs = Math.floor((ms%1000)/10);
    const tag = `[${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}]`;
    return `${tag} ${ln}`;
  }).join("\n");
  els.lyricsInput.value = out;
  els.lrcMode.checked = true;
  state.parsed = parseLRC(out);
  renderLyricsView(state.parsed);
}

function togglePanels() {
  const showEdit = els.editPanel.hasAttribute("hidden");
  if (showEdit) {
    els.editPanel.removeAttribute("hidden");
    els.viewPanel.setAttribute("hidden","");
  } else {
    els.viewPanel.removeAttribute("hidden");
    els.editPanel.setAttribute("hidden","");
    // Re-parse for view
    state.parsed = els.lrcMode.checked ? parseLRC(els.lyricsInput.value || "") : (els.lyricsInput.value || "").split(/\r?\n/).map(t => ({ ms: -1, text: t }));
    renderLyricsView(state.parsed);
  }
}

function initSavedList() { loadSavedList(); }

// Event bindings
els.videoFile.addEventListener("change", () => {
  const f = els.videoFile.files?.[0];
  if (!f) return;
  const url = blobUrlFromFile(f);
  els.video.src = url;
  els.titleInput.value ||= f.name.replace(/\.[^.]+$/, "");
  // try auto-load lyrics by saved key
  const key = "lyrics:" + (els.titleInput.value || "untitled");
  state.lastKey = key;
  if (localStorage.getItem(key)) {
    loadLyricsByKey(key);
  } else {
    // reset view
    state.parsed = [];
    renderLyricsView(state.parsed);
  }
});

els.clearVideo.addEventListener("click", () => {
  els.video.pause();
  els.video.removeAttribute("src");
  els.video.load();
});

els.playPause.addEventListener("click", () => {
  if (els.video.paused) els.video.play(); else els.video.pause();
});

els.tickMs.addEventListener("change", startTicker);
els.autoScroll.addEventListener("change", () => {});

els.insertTimestamp.addEventListener("click", insertTimestampAtCursor);
els.convertPlainToLrc.addEventListener("click", convertPlainToLrc);
els.saveLyrics.addEventListener("click", saveLyrics);
els.exportLyrics.addEventListener("click", exportLyrics);
els.importFile.addEventListener("change", () => {
  const f = els.importFile.files?.[0];
  if (f) importLyrics(f);
});

els.toggleView.addEventListener("click", togglePanels);

els.loadSaved.addEventListener("click", () => {
  const key = "lyrics:" + (els.savedList.value || "").trim();
  if (!els.savedList.value) return;
  loadLyricsByKey("lyrics:" + els.savedList.value);
  // Reflect title
  els.titleInput.value = els.savedList.value;
});

els.deleteSaved.addEventListener("click", () => {
  if (!els.savedList.value) return;
  const key = "lyrics:" + els.savedList.value;
  if (confirm(`削除しますか: ${els.savedList.value}`)) {
    localStorage.removeItem(key);
    loadSavedList();
  }
});

// Initialize
initSavedList();
startTicker();
