(function () {
  "use strict";

  var STORAGE_KEY = "forge75-state-v1";
  var config = window.HARD75_CONFIG || {};
  var cloudEnabled = Boolean(config.supabaseUrl && config.supabasePublishableKey && window.supabase);
  var client = cloudEnabled ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
  var activeUser = null;
  var saveTimer = null;
  var noteTimer = null;
  var installPrompt = null;
  var toastTimer = null;

  var officialTasks = [
    { id: "workoutOne", name: "Workout I", detail: "45 minutes minimum" },
    { id: "workoutTwo", name: "Workout II", detail: "45 minutes outdoors" },
    { id: "diet", name: "Follow your diet", detail: "No cheat meals or alcohol" },
    { id: "water", name: "Water target", detail: "1 gallon / 3.8 litres" },
    { id: "read", name: "Read 10 pages", detail: "Non-fiction" },
    { id: "photo", name: "Progress photo", detail: "One photo today" }
  ];
  var plusTasks = [
    { id: "sleep", name: "Sleep 7+ hours", detail: "Recovery first" },
    { id: "steps", name: "10k steps", detail: "Keep moving" },
    { id: "mobility", name: "Mobility 10 min", detail: "Move well" },
    { id: "meditate", name: "Meditate 10 min", detail: "Clear the noise" },
    { id: "journal", name: "Journal 5 min", detail: "Make it real" },
    { id: "social", name: "No social before noon", detail: "Protect your focus" }
  ];

  var els = {
    auth: document.getElementById("auth-screen"),
    authCopy: document.getElementById("auth-copy"),
    emailForm: document.getElementById("email-form"),
    email: document.getElementById("email"),
    preview: document.getElementById("preview-button"),
    authNote: document.getElementById("auth-note"),
    configNote: document.getElementById("config-note"),
    app: document.getElementById("app-shell"),
    sync: document.getElementById("sync-status"),
    syncText: document.querySelector("#sync-status span"),
    startDate: document.getElementById("start-date"),
    focusToday: document.getElementById("focus-today"),
    dailyRing: document.getElementById("daily-ring"),
    dailyScore: document.getElementById("daily-score"),
    dailyDetail: document.getElementById("daily-detail"),
    missionScore: document.getElementById("mission-score"),
    streakScore: document.getElementById("streak-score"),
    plusScore: document.getElementById("plus-score"),
    todayDescription: document.getElementById("today-description"),
    selectedTitle: document.getElementById("selected-title"),
    selectedDate: document.getElementById("selected-date"),
    officialTasks: document.getElementById("official-tasks"),
    plusTasks: document.getElementById("plus-tasks"),
    note: document.getElementById("daily-note"),
    dayGrid: document.getElementById("day-grid"),
    signOut: document.getElementById("signout-button"),
    install: document.getElementById("install-button"),
    toast: document.getElementById("toast")
  };

  function pad(value) {
    return String(value).padStart(2, "0");
  }
  function dateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }
  function parseDate(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function addDays(key, amount) {
    var value = parseDate(key);
    value.setDate(value.getDate() + amount);
    return dateKey(value);
  }
  function diffDays(start, end) {
    return Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000);
  }
  function todayKey() {
    return dateKey(new Date());
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function defaultState() {
    return {
      version: 1,
      startDate: todayKey(),
      selectedDay: 1,
      records: {},
      updatedAt: new Date().toISOString()
    };
  }
  function normalizeState(candidate) {
    var base = defaultState();
    if (!candidate || typeof candidate !== "object") return base;
    if (typeof candidate.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate.startDate)) base.startDate = candidate.startDate;
    if (Number.isFinite(Number(candidate.selectedDay))) base.selectedDay = clamp(Math.round(Number(candidate.selectedDay)), 1, 75);
    if (candidate.records && typeof candidate.records === "object") base.records = candidate.records;
    if (typeof candidate.updatedAt === "string") base.updatedAt = candidate.updatedAt;
    return base;
  }
  function readLocal() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (error) {
      return defaultState();
    }
  }
  var state = readLocal();

  function selectedKey() {
    return addDays(state.startDate, state.selectedDay - 1);
  }
  function missionDayToday() {
    return diffDays(state.startDate, todayKey()) + 1;
  }
  function isFuture(dayNumber) {
    return addDays(state.startDate, dayNumber - 1) > todayKey();
  }
  function getRecord(key) {
    if (!state.records[key] || typeof state.records[key] !== "object") {
      state.records[key] = { official: {}, plus: {}, note: "" };
    }
    if (!state.records[key].official) state.records[key].official = {};
    if (!state.records[key].plus) state.records[key].plus = {};
    if (typeof state.records[key].note !== "string") state.records[key].note = "";
    return state.records[key];
  }
  function completedCount(source, tasks) {
    return tasks.reduce(function (count, task) { return count + (source && source[task.id] ? 1 : 0); }, 0);
  }
  function dayIsComplete(dayNumber) {
    var record = state.records[addDays(state.startDate, dayNumber - 1)];
    return completedCount(record && record.official, officialTasks) === officialTasks.length;
  }
  function eligibleDays() {
    return clamp(missionDayToday(), 0, 75);
  }
  function fullDays(limit) {
    var count = 0;
    for (var day = 1; day <= limit; day++) if (dayIsComplete(day)) count++;
    return count;
  }
  function currentStreak() {
    var day = clamp(missionDayToday(), 0, 75);
    var count = 0;
    while (day >= 1 && dayIsComplete(day)) {
      count++;
      day--;
    }
    return count;
  }
  function prettyDate(key) {
    return parseDate(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove("show"); }, 3600);
  }
  function setSyncStatus(mode, message) {
    els.sync.dataset.state = mode;
    els.syncText.textContent = message;
  }
  function persistLocal() {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { showToast("Storage is full or blocked on this device."); }
  }
  function queueCloudSave() {
    if (!client || !activeUser) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToCloud, 700);
  }
  async function saveToCloud() {
    if (!navigator.onLine) {
      setSyncStatus("offline", "Saved on this device");
      return;
    }
    setSyncStatus("syncing", "Syncing");
    var result = await client.from("hard75_profiles").upsert({
      user_id: activeUser.id,
      payload: state,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (result.error) {
      setSyncStatus("offline", "Saved on this device");
      showToast("Cloud sync paused. Your changes are safe on this device.");
      return;
    }
    setSyncStatus("synced", "Cloud protected");
  }
  function saveChange() {
    persistLocal();
    queueCloudSave();
  }
  async function loadCloud() {
    if (!client || !activeUser) return;
    setSyncStatus("syncing", "Loading");
    var response = await client.from("hard75_profiles").select("payload").eq("user_id", activeUser.id).maybeSingle();
    if (response.error) {
      setSyncStatus("offline", "Saved on this device");
      showToast("Could not reach cloud sync. You can still track offline.");
      return;
    }
    var cloudState = response.data && response.data.payload ? normalizeState(response.data.payload) : null;
    if (cloudState && cloudState.updatedAt > state.updatedAt) {
      state = cloudState;
      persistLocal();
    } else if (!cloudState || state.updatedAt > cloudState.updatedAt) {
      await saveToCloud();
    }
    setSyncStatus("synced", "Cloud protected");
    render();
  }

  function createTask(label, task, group, checked, future) {
    var id = group + "-" + task.id;
    label.className = (group === "official" ? "task-card" : "plus-task") + (checked ? " checked" : "") + (future ? " future" : "");
    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;
    input.disabled = future;
    input.setAttribute("aria-label", task.name);
    var content = document.createElement("span");
    var title = document.createElement("span");
    title.className = "task-label";
    title.textContent = task.name;
    var detail = document.createElement("span");
    detail.className = "task-detail";
    detail.textContent = task.detail;
    content.appendChild(title);
    content.appendChild(detail);
    label.appendChild(input);
    label.appendChild(content);
    input.addEventListener("change", function () {
      var record = getRecord(selectedKey());
      record[group][task.id] = input.checked;
      saveChange();
      render();
      showToast(task.name + (input.checked ? " complete." : " unchecked."));
    });
  }
  function renderTasks() {
    var key = selectedKey();
    var record = getRecord(key);
    var future = isFuture(state.selectedDay);
    els.officialTasks.innerHTML = "";
    officialTasks.forEach(function (task) {
      var label = document.createElement("label");
      createTask(label, task, "official", Boolean(record.official[task.id]), future);
      els.officialTasks.appendChild(label);
    });
    els.plusTasks.innerHTML = "";
    plusTasks.forEach(function (task) {
      var label = document.createElement("label");
      createTask(label, task, "plus", Boolean(record.plus[task.id]), future);
      els.plusTasks.appendChild(label);
    });
    els.note.value = record.note;
    els.note.disabled = future;
    els.note.placeholder = future ? "This day unlocks on its date." : "What made today easier, harder, or worth remembering?";
  }
  function renderScores() {
    var selected = getRecord(selectedKey());
    var coreCount = completedCount(selected.official, officialTasks);
    var corePercent = Math.round((coreCount / officialTasks.length) * 100);
    var plusPercent = Math.round((completedCount(selected.plus, plusTasks) / plusTasks.length) * 100);
    els.dailyRing.style.background = "conic-gradient(var(--lime) " + corePercent + "%, rgba(255, 255, 255, .09) " + corePercent + "%)";
    els.dailyRing.setAttribute("aria-label", "Daily core score " + corePercent + " percent");
    els.dailyScore.textContent = corePercent;
    els.dailyDetail.textContent = coreCount + " of " + officialTasks.length + " complete";
    var eligible = eligibleDays();
    var mission = eligible ? Math.round((fullDays(eligible) / eligible) * 100) : 0;
    els.missionScore.textContent = mission + "%";
    els.streakScore.textContent = currentStreak();
    els.plusScore.textContent = plusPercent + "%";
  }
  function renderTimeline() {
    els.dayGrid.innerHTML = "";
    var current = missionDayToday();
    for (var day = 1; day <= 75; day++) {
      var button = document.createElement("button");
      var key = addDays(state.startDate, day - 1);
      button.type = "button";
      button.className = "day-cell" + (dayIsComplete(day) ? " complete" : "") + (day === current ? " today" : "") + (day === state.selectedDay ? " selected" : "") + (isFuture(day) ? " future" : "");
      button.textContent = day;
      button.setAttribute("aria-label", "Day " + day + ", " + prettyDate(key) + (dayIsComplete(day) ? ", complete" : ""));
      button.addEventListener("click", (function (chosen) {
        return function () {
          state.selectedDay = chosen;
          persistLocal();
          render();
        };
      })(day));
      els.dayGrid.appendChild(button);
    }
  }
  function renderHeader() {
    var key = selectedKey();
    var current = missionDayToday();
    var descriptor = current < 1 ? "Your challenge begins " + prettyDate(state.startDate) + "." : current > 75 ? "Your 75 days are in the books. Review the work you put in." : "Day " + current + " of 75. Keep the promises you made to yourself.";
    els.todayDescription.textContent = descriptor;
    els.selectedTitle.textContent = "Day " + state.selectedDay;
    els.selectedDate.textContent = prettyDate(key);
    els.startDate.value = state.startDate;
  }
  function render() {
    renderHeader();
    renderScores();
    renderTasks();
    renderTimeline();
    renderBody();
  }
  function openApp() {
    els.auth.hidden = true;
    els.app.hidden = false;
    els.signOut.hidden = !activeUser;
    if (activeUser) setSyncStatus(navigator.onLine ? "synced" : "offline", navigator.onLine ? "Cloud protected" : "Saved on this device");
    else setSyncStatus("local", "Saved on this device");
    render();
  }
  function showAuth() {
    els.app.hidden = true;
    els.auth.hidden = false;
  }
  async function activateSession(session) {
    activeUser = session.user;
    openApp();
    await loadCloud();
  }
  async function sendMagicLink(event) {
    event.preventDefault();
    if (!client) return;
    var button = els.emailForm.querySelector("button");
    button.disabled = true;
    button.textContent = "Sending…";
    var result = await client.auth.signInWithOtp({
      email: els.email.value.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    button.disabled = false;
    button.textContent = "Send magic link";
    if (result.error) {
      showToast(result.error.message);
      return;
    }
    els.authCopy.textContent = "Check your inbox and open the private sign-in link on this device.";
    els.authNote.textContent = "After you open the email link, your challenge will load automatically.";
  }
  function useLocalPreview() {
    activeUser = null;
    openApp();
  }
  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    activeUser = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    state = defaultState();
    showAuth();
  }
  function handleStartDate() {
    if (!els.startDate.value) return;
    state.startDate = els.startDate.value;
    state.selectedDay = clamp(missionDayToday(), 1, 75);
    saveChange();
    render();
  }
  function handleFocusToday() {
    state.selectedDay = clamp(missionDayToday(), 1, 75);
    persistLocal();
    render();
  }
  function handleNote() {
    if (isFuture(state.selectedDay)) return;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(function () {
      getRecord(selectedKey()).note = els.note.value;
      saveChange();
      showToast("Daily note saved.");
    }, 500);
  }
  function registerInstall() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      installPrompt = event;
      els.install.hidden = false;
    });
    els.install.addEventListener("click", async function () {
      if (!installPrompt) return;
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      els.install.hidden = true;
    });
  }
  var photoUrl = null;
  function photoOp(mode, fn) {
    return new Promise(function (resolve, reject) {
      var open = indexedDB.open("forge75-photos", 1);
      open.onupgradeneeded = function () { open.result.createObjectStore("p"); };
      open.onerror = function () { reject(open.error); };
      open.onsuccess = function () {
        var tx = open.result.transaction("p", mode), request = fn(tx.objectStore("p"));
        tx.oncomplete = function () { resolve(request && request.result); };
        tx.onerror = function () { reject(tx.error); };
      };
    });
  }
  function showPhoto(key) {
    var frame = document.getElementById("photo-frame"), del = document.getElementById("photo-delete");
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
    frame.innerHTML = "<span>No photo for this day</span>";
    del.hidden = true;
    photoOp("readonly", function (store) { return store.get(key); }).then(function (blob) {
      if (!blob || key !== selectedKey()) return;
      photoUrl = URL.createObjectURL(blob);
      var img = new Image();
      img.src = photoUrl;
      img.alt = "Progress photo";
      frame.innerHTML = "";
      frame.appendChild(img);
      del.hidden = false;
    }).catch(function () {});
  }
  function addPhoto(event) {
    var file = event.target.files && event.target.files[0], key = selectedKey();
    event.target.value = "";
    if (!file) return;
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, 1000 / Math.max(img.width, img.height)), canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) {
        photoOp("readwrite", function (store) { return store.put(blob, key); })
          .then(function () { showPhoto(key); showToast("Photo saved on this device."); })
          .catch(function () { showToast("Could not save the photo."); });
      }, "image/jpeg", 0.82);
    };
    img.onerror = function () { URL.revokeObjectURL(url); showToast("That image could not be read."); };
    img.src = url;
  }
  function removePhoto() {
    var key = selectedKey();
    if (!window.confirm("Remove this photo?")) return;
    photoOp("readwrite", function (store) { return store.delete(key); }).then(function () { showPhoto(key); }).catch(function () {});
  }
  function drawChart() {
    var box = document.getElementById("weight-chart"), summary = document.getElementById("weight-summary");
    var keys = Object.keys(state.records).filter(function (k) { return state.records[k] && Number(state.records[k].weight) > 0; }).sort();
    if (!keys.length) { box.innerHTML = '<p class="chart-empty">Log your weight to see your graph.</p>'; summary.textContent = ""; return; }
    var vals = keys.map(function (k) { return Number(state.records[k].weight); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
    var pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
    var W = 600, H = 220, L = 42, R = 16, T = 14, B = 28;
    var t0 = parseDate(keys[0]).getTime(), t1 = parseDate(keys[keys.length - 1]).getTime();
    function X(k) { return keys.length === 1 || t1 === t0 ? (L + W - R) / 2 : L + (parseDate(k).getTime() - t0) / (t1 - t0) * (W - L - R); }
    function Y(v) { return T + (hi - v) / (hi - lo) * (H - T - B); }
    var grid = [lo, (lo + hi) / 2, hi].map(function (v) {
      return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="rgba(229,246,237,.1)"/><text x="' + (L - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end" fill="#8b9790" font-size="11">' + v.toFixed(1) + '</text>';
    }).join("");
    var points = keys.map(function (k, i) { return X(k).toFixed(1) + "," + Y(vals[i]).toFixed(1); });
    var dots = keys.map(function (k, i) { return '<circle cx="' + X(k).toFixed(1) + '" cy="' + Y(vals[i]).toFixed(1) + '" r="' + (i === keys.length - 1 ? 5 : 3.5) + '" fill="' + (i === keys.length - 1 ? "#b8ff4b" : "#5ee1d2") + '"/>'; }).join("");
    box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Weight over time">' + grid +
      '<polyline points="' + points.join(" ") + '" fill="none" stroke="#5ee1d2" stroke-width="2.5" stroke-linejoin="round"/>' + dots +
      '<text x="' + L + '" y="' + (H - 6) + '" fill="#8b9790" font-size="11">' + prettyDate(keys[0]) + '</text>' +
      (keys.length > 1 ? '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end" fill="#8b9790" font-size="11">' + prettyDate(keys[keys.length - 1]) + '</text>' : "") + "</svg>";
    var change = vals[vals.length - 1] - vals[0];
    summary.textContent = vals[vals.length - 1].toFixed(1) + " kg" + (keys.length > 1 ? " (" + (change > 0 ? "+" : "") + change.toFixed(1) + " since start)" : "");
  }
  function renderBody() {
    var key = selectedKey(), future = isFuture(state.selectedDay), input = document.getElementById("weight-input");
    var record = getRecord(key);
    input.value = record.weight || "";
    input.disabled = future;
    document.getElementById("photo-input").disabled = future;
    drawChart();
    showPhoto(key);
  }
  function handleWeight(event) {
    if (isFuture(state.selectedDay)) return;
    var record = getRecord(selectedKey()), text = event.target.value.trim(), value = parseFloat(text);
    if (!text) delete record.weight;
    else if (value >= 20 && value <= 400) record.weight = Math.round(value * 10) / 10;
    else { showToast("Enter a weight between 20 and 400 kg."); return; }
    state.updatedAt = new Date().toISOString();
    saveChange();
    drawChart();
  }
  function bindBody() {
    document.getElementById("weight-input").addEventListener("change", handleWeight);
    document.getElementById("photo-input").addEventListener("change", addPhoto);
    document.getElementById("photo-delete").addEventListener("click", removePhoto);
  }
  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "forge75-backup-" + todayKey() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    showToast("Backup downloaded.");
  }
  function importData(event) {
    var file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.records !== "object") throw new Error("bad file");
        if (!window.confirm("Replace your current progress with this backup?")) return;
        state = normalizeState(parsed);
        state.updatedAt = new Date().toISOString();
        saveChange();
        render();
        showToast("Backup restored.");
      } catch (error) {
        showToast("That file is not a valid Forge 75 backup.");
      }
    };
    reader.readAsText(file);
  }
  async function initialize() {
    bindBody();
    document.getElementById("export-button").addEventListener("click", exportData);
    document.getElementById("import-button").addEventListener("click", function () { document.getElementById("import-file").click(); });
    document.getElementById("import-file").addEventListener("change", importData);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(function () {});
    registerInstall();
    els.emailForm.addEventListener("submit", sendMagicLink);
    els.preview.addEventListener("click", useLocalPreview);
    els.signOut.addEventListener("click", signOut);
    els.startDate.addEventListener("change", handleStartDate);
    els.focusToday.addEventListener("click", handleFocusToday);
    els.note.addEventListener("input", handleNote);
    window.addEventListener("online", function () {
      if (activeUser) loadCloud();
    });
    window.addEventListener("focus", function () {
      if (activeUser && navigator.onLine) loadCloud();
    });

    if (!cloudEnabled) {
      activeUser = null;
      openApp();
      return;
    }
    var response = await client.auth.getSession();
    if (response.data.session) activateSession(response.data.session);
    else showAuth();
    client.auth.onAuthStateChange(function (_event, session) {
      if (session && !activeUser) activateSession(session);
      if (!session && activeUser) {
        activeUser = null;
        showAuth();
      }
    });
  }

  initialize();
})();
