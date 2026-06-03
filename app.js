const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const missingSetup =
  !CONFIG.SUPABASE_URL ||
  CONFIG.SUPABASE_URL.includes("HIER_") ||
  !CONFIG.SUPABASE_ANON_KEY ||
  CONFIG.SUPABASE_ANON_KEY.includes("HIER_");

$("setupWarning").hidden = !missingSetup;

const db = missingSetup ? null : supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const SESSION_KEY = "zt_wm_masters_session_code";
let countdownTimer = null;


let currentUser = null;
let isAdmin = false;
let cache = {
  players: [],
  teams: [],
  groups: [],
  matches: [],
  tips: [],
  groupTips: [],
  championTips: [],
  groupLocks: [],
  infotafel: null,
  actualSpecials: {},
};

const FLAG_CODES = {
  "Deutschland": "de",
  "Frankreich": "fr",
  "Spanien": "es",
  "Portugal": "pt",
  "England": "gb-eng",
  "Schottland": "gb-sct",
  "Wales": "gb-wls",
  "Niederlande": "nl",
  "Belgien": "be",
  "Schweiz": "ch",
  "Österreich": "at",
  "Kroatien": "hr",
  "Bosnien und Herzegowina": "ba",
  "Tschechien": "cz",
  "Schweden": "se",
  "Norwegen": "no",
  "Türkei": "tr",
  "Polen": "pl",
  "Ukraine": "ua",
  "Ungarn": "hu",
  "Rumänien": "ro",
  "Serbien": "rs",

  "USA": "us",
  "Kanada": "ca",
  "Mexiko": "mx",
  "Panama": "pa",
  "Costa Rica": "cr",
  "Haiti": "ht",
  "Curaçao": "cw",
  "Curacao": "cw",
  "Jamaika": "jm",

  "Brasilien": "br",
  "Argentinien": "ar",
  "Uruguay": "uy",
  "Kolumbien": "co",
  "Ecuador": "ec",
  "Paraguay": "py",
  "Chile": "cl",
  "Peru": "pe",
  "Bolivien": "bo",
  "Venezuela": "ve",

  "Marokko": "ma",
  "Ägypten": "eg",
  "Tunesien": "tn",
  "Algerien": "dz",
  "Senegal": "sn",
  "Elfenbeinküste": "ci",
  "Ghana": "gh",
  "Kap Verde": "cv",
  "Südafrika": "za",
  "DR Kongo": "cd",

  "Saudi-Arabien": "sa",
  "Katar": "qa",
  "Iran": "ir",
  "Irak": "iq",
  "Jordanien": "jo",
  "Usbekistan": "uz",
  "Japan": "jp",
  "Südkorea": "kr",
  "Australien": "au",
  "Neuseeland": "nz"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function flag(team) {
  const code = FLAG_CODES[team];

  if (!code) {
    return `<span class="flag-fallback" style="display:inline-flex;width:28px;height:20px;align-items:center;justify-content:center;border-radius:3px;background:#e8edf3;color:#556272;font-size:11px;font-weight:900;margin-right:8px;vertical-align:middle;">WM</span>`;
  }

  return `<img class="flag-icon" src="https://flagcdn.com/28x21/${code}.png" srcset="https://flagcdn.com/56x42/${code}.png 2x" alt="${escapeHtml(team)}" loading="lazy" style="width:28px;height:21px;object-fit:cover;border-radius:3px;margin-right:8px;vertical-align:-5px;box-shadow:0 1px 4px rgba(0,0,0,.18);">`;
}

function teamLabel(team) {
  return `${flag(team)}<span>${escapeHtml(team)}</span>`;
}


function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1900);
}

function isMatchLocked(match) {
  if (match.result_home !== null && match.result_away !== null) return true;
  if (!match.kickoff_at) return false;

  const kickoff = new Date(match.kickoff_at);
  if (Number.isNaN(kickoff.getTime())) return false;

  return Date.now() >= kickoff.getTime();
}


function ensureRulesTab() {
  const tabs = document.querySelector(".tabs");
  if (tabs && !document.querySelector('[data-tab="rules"]')) {
    const button = document.createElement("button");
    button.className = "tab";
    button.dataset.tab = "rules";
    button.textContent = "Regeln";
    tabs.insertBefore(button, tabs.querySelector('[data-tab="ranking"]'));
    button.addEventListener("click", () => switchTab("rules"));
  }

  const main = document.querySelector("#mainView main");
  if (main && !$("rules")) {
    const section = document.createElement("section");
    section.id = "rules";
    section.className = "tab-view";
    section.innerHTML = `
      <article class="card">
        <div class="section-title">
          <div>
            <p class="overline">Tippspiel</p>
            <h2>Regeln & Punkte</h2>
          </div>
          <span class="tag">Zimmermann Tiefbau</span>
        </div>

        <div class="rules-grid">
          <div class="ranking-row">
            <div class="medal">🎯</div>
            <div>
              <strong>Exaktes Ergebnis</strong>
              <div class="hint">Beispiel: Tipp 2:1, Ergebnis 2:1</div>
            </div>
            <div class="points">${CONFIG.points.exact}</div>
          </div>

          <div class="ranking-row">
            <div class="medal">➖</div>
            <div>
              <strong>Richtige Tordifferenz</strong>
              <div class="hint">Beispiel: Tipp 2:0, Ergebnis 3:1</div>
            </div>
            <div class="points">${CONFIG.points.diff}</div>
          </div>

          <div class="ranking-row">
            <div class="medal">✅</div>
            <div>
              <strong>Richtige Tendenz</strong>
              <div class="hint">Sieg, Unentschieden oder Niederlage richtig</div>
            </div>
            <div class="points">${CONFIG.points.trend}</div>
          </div>

          <div class="ranking-row">
            <div class="medal">📌</div>
            <div>
              <strong>Richtiger Gruppensieger</strong>
              <div class="hint">Nach dem Speichern gesperrt</div>
            </div>
            <div class="points">${CONFIG.points.groupWinner}</div>
          </div>

          <div class="ranking-row">
            <div class="medal">🏆</div>
            <div>
              <strong>Richtiger Weltmeister</strong>
              <div class="hint">Nach dem Speichern gesperrt</div>
            </div>
            <div class="points">${CONFIG.points.champion}</div>
          </div>
        </div>
      </article>

      <article class="card">
        <p class="overline">Einsatz</p>
        <h2>Einsätze</h2>
        <div class="ranking-row">
          <div class="medal">💶</div>
          <div>
            <strong>Gruppenspiel</strong>
            <div class="hint">Pro Person und pro Gruppenspiel</div>
          </div>
          <div class="points">1 €</div>
        </div>
        <div class="ranking-row">
  <div class="medal">📌</div>
  <div>
    <strong>Gruppensieger-Tipp</strong>
    <div class="hint">Einmaliger Einsatz pro Person pro Tipp</div>
  </div>
  <div class="points">3 €</div>
</div>
        <div class="ranking-row">
          <div class="medal">🏆</div>
          <div>
            <strong>Weltmeister-Tipp</strong>
            <div class="hint">Einmaliger Einsatz pro Person</div>
          </div>
          <div class="points">20 €</div>
        </div>
        <p class="hint">Die konkrete Auszahlung regelt ihr intern. Die App berechnet nur Punkte und Rangliste.</p>
      </article>

      <article class="card">
        <p class="overline">Sperren</p>
        <h2>Tippfristen</h2>
        <p class="muted">Spieltipps werden automatisch ab Anpfiff gesperrt. Der Weltmeister-Tipp und die Gruppensieger-Tipps sind nach dem Speichern nicht mehr änderbar.</p>
      </article>
    `;
    main.appendChild(section);
  }
}

function lockLabel(match) {
  if (match.result_home !== null && match.result_away !== null) {
    return `Ergebnis ${match.result_home}:${match.result_away}`;
  }

  if (isMatchLocked(match)) {
    return "Anpfiff erreicht · gesperrt";
  }

  if (match.kickoff_at) {
    const kickoff = new Date(match.kickoff_at);
    if (!Number.isNaN(kickoff.getTime())) {
      return `tippbar bis ${kickoff.toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })}`;
    }
  }

  return "offen";
}

async function query(table) {
  const { data, error } = await db.from(table).select("*");
  if (error) throw error;
  return data || [];
}

async function refreshData() {
  if (!db) return;

  const [players, teams, groups, matches, tips, groupTips, championTips, groupLocks, infotafelRows, actualRows] = await Promise.all([
    query("players"),
    query("teams"),
    query("groups"),
    db.from("matches").select("*").order("sort_order", { ascending: true }).then(r => {
      if (r.error) throw r.error;
      return r.data || [];
    }),
    query("match_tips"),
    query("group_winner_tips"),
    query("champion_tips"),
    query("group_tip_locks"),
    query("infotafel"),
    query("actual_specials"),
  ]);

  cache.players = players;
  cache.teams = teams;
  cache.groups = groups;
  cache.matches = matches;
  cache.tips = tips;
  cache.groupTips = groupTips;
  cache.championTips = championTips;
  cache.groupLocks = groupLocks;
  cache.infotafel = infotafelRows.find(row => row.id === 1) || null;
  cache.actualSpecials = {};
  actualRows.forEach(row => cache.actualSpecials[row.key] = row.value);
}

function playerByCode(code) {
  return cache.players.find(p => p.code.toUpperCase() === code.toUpperCase());
}

function calcMatchPoints(tip, match) {
  if (!tip) return 0;
  if (match.result_home === null || match.result_away === null) return 0;

  const th = Number(tip.tip_home);
  const ta = Number(tip.tip_away);
  const rh = Number(match.result_home);
  const ra = Number(match.result_away);

  if ([th, ta, rh, ra].some(Number.isNaN)) return 0;
  if (th === rh && ta === ra) return CONFIG.points.exact;

  const td = th - ta;
  const rd = rh - ra;

  if (td === rd) return CONFIG.points.diff;
  if (Math.sign(td) === Math.sign(rd)) return CONFIG.points.trend;
  return 0;
}

function calcPlayer(player) {
  let matchPoints = 0;

  for (const m of cache.matches) {
    const tip = cache.tips.find(t => t.player_id === player.id && t.match_id === m.id);
    matchPoints += calcMatchPoints(tip, m);
  }

  const actualGroups = cache.actualSpecials.group_winners || {};
  let groupPoints = 0;
  for (const groupName of Object.keys(actualGroups)) {
    const tip = cache.groupTips.find(t => t.player_id === player.id && t.group_name === groupName);
    if (tip && tip.team === actualGroups[groupName]) groupPoints += CONFIG.points.groupWinner;
  }

  let championPoints = 0;
  const actualChampion = cache.actualSpecials.champion || "";
  const champTip = cache.championTips.find(t => t.player_id === player.id);
  if (actualChampion && champTip?.champion === actualChampion) championPoints = CONFIG.points.champion;

  return {
    matchPoints,
    groupPoints,
    championPoints,
    total: matchPoints + groupPoints + championPoints
  };
}

function ranking() {
  return cache.players
    .map(p => ({ ...p, ...calcPlayer(p) }))
    .sort((a, b) => b.total - a.total);
}

async function login(codeOverride = null) {
  if (!db) {
    toast("Supabase ist noch nicht verbunden.");
    return;
  }

  await refreshData();

  const code = (codeOverride || $("codeInput").value).trim().toUpperCase();

  if (code === CONFIG.adminCode) {
    currentUser = { id: "admin", code: CONFIG.adminCode, name: "Admin" };
    isAdmin = true;
  } else {
    const p = playerByCode(code);
    if (!p) {
      toast("Code nicht gefunden.");
      return;
    }
    currentUser = p;
    isAdmin = false;
  }

  localStorage.setItem(SESSION_KEY, code);

  $("loginView").classList.remove("active");
  $("mainView").classList.add("active");
  $("logoutBtn").hidden = false;
  $("currentUserName").textContent = currentUser.name;
  $$(".admin-only").forEach(el => el.style.display = isAdmin ? "" : "none");
  ensureRulesTab();
  ensurePayoutTab();
  ensureDashboardNextLockBox();
  ensureInfotafelBox();

  switchTab("dashboard");
  await renderAll();
  startCountdownTimer();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  isAdmin = false;
  $("loginView").classList.add("active");
  $("mainView").classList.remove("active");
  $("logoutBtn").hidden = true;
}

function switchTab(tab) {
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $$(".tab-view").forEach(v => v.classList.toggle("active", v.id === tab));
  renderAll();
}


function hasValidTip(player, match) {
  return cache.tips.some(
    tip =>
      tip.player_id === player.id &&
      tip.match_id === match.id &&
      tip.tip_home !== null &&
      tip.tip_away !== null &&
      tip.tip_home !== "" &&
      tip.tip_away !== ""
  );
}

function openTipsCount(player) {
  return cache.matches.filter(match => !isMatchLocked(match) && !hasValidTip(player, match)).length;
}

function perfectTipsCount(player) {
  return cache.matches.filter(match => {
    const tip = cache.tips.find(t => t.player_id === player.id && t.match_id === match.id);
    return tip && calcMatchPoints(tip, match) === CONFIG.points.exact;
  }).length;
}

function nextLockMatch() {
  const now = Date.now();

  return cache.matches
    .filter(match => {
      if (isMatchLocked(match)) return false;
      if (!match.kickoff_at) return false;
      const kickoff = new Date(match.kickoff_at).getTime();
      return !Number.isNaN(kickoff) && kickoff > now;
    })
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0] || null;
}

function timeUntilLabel(dateValue) {
  const target = new Date(dateValue).getTime();
  const diff = target - Date.now();

  if (Number.isNaN(target) || diff <= 0) return "jetzt";

  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes - days * 60 * 24) / 60);
  const mins = minutes % 60;

  if (days > 0) return `${days}T ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function dashboardInsightHtml() {
  const openRows = cache.players
    .map(player => ({
      player,
      open: openTipsCount(player)
    }))
    .sort((a, b) => b.open - a.open)
    .map(row => `
      <div class="ranking-row">
        <div class="medal">📝</div>
        <div>
          <strong>${escapeHtml(row.player.name)}</strong>
          <div class="hint">${row.open === 0 ? "alles getippt" : "noch offen"}</div>
        </div>
        <div class="points">${row.open}</div>
      </div>
    `).join("");

  const perfectRows = cache.players
    .map(player => ({
      player,
      perfect: perfectTipsCount(player)
    }))
    .sort((a, b) => b.perfect - a.perfect)
    .map((row, index) => `
      <div class="ranking-row">
        <div class="medal">${["🎯", "🥈", "🥉"][index] || "🎯"}</div>
        <div>
          <strong>${escapeHtml(row.player.name)}</strong>
          <div class="hint">exakte Ergebnis-Treffer</div>
        </div>
        <div class="points">${row.perfect}</div>
      </div>
    `).join("");

  return `
    <div style="margin-top:18px;">
      <p class="overline">Offene Tipps</p>
      ${openRows}
    </div>

    <div style="margin-top:18px;">
      <p class="overline">Perfekte Tipps</p>
      ${perfectRows}
    </div>
  `;
}

function ensureDashboardNextLockBox() {
  const dashboard = $("dashboard");
  if (!dashboard || $("dashboardNextLockBox")) return;

  const box = document.createElement("article");
  box.id = "dashboardNextLockBox";
  box.className = "card";
  box.style.marginBottom = "16px";
  box.innerHTML = `
    <p class="overline">Nächste Sperre</p>
    <div id="dashboardNextLockContent"></div>
  `;

  dashboard.insertBefore(box, dashboard.firstElementChild);
}

function renderDashboardNextLock() {
  const target = $("dashboardNextLockContent");
  if (!target) return;

  const next = nextLockMatch();

  if (!next) {
    target.innerHTML = `
      <div class="ranking-row" style="margin-top:10px;margin-bottom:0;">
        <div class="medal">✅</div>
        <div>
          <strong>Keine offene Sperre</strong>
          <div class="hint">Alle terminierten Spiele sind gesperrt oder ohne Anpfiffzeit.</div>
        </div>
        <div class="points">—</div>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="ranking-row" style="margin-top:10px;margin-bottom:0;">
      <div class="medal">⏱️</div>
      <div>
        <strong>${teamLabel(next.home)} - ${teamLabel(next.away)}</strong>
        <div class="hint">${next.match_date || ""} · ${next.match_time || ""}</div>
      </div>
      <div class="points">${timeUntilLabel(next.kickoff_at)}</div>
    </div>
  `;
}


function sanitizeInfotafelHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");

  const allowedTags = new Set([
    "P", "BR", "STRONG", "B", "EM", "I", "U",
    "UL", "OL", "LI", "A", "H2", "H3", "BLOCKQUOTE"
  ]);

  template.content.querySelectorAll("*").forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    Array.from(node.attributes).forEach(attr => {
      if (node.tagName === "A" && attr.name === "href") {
        const href = node.getAttribute("href") || "";
        if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("mailto:")) {
          node.removeAttribute("href");
        } else {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      } else {
        node.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}

function infotafelHtml() {
  const html = sanitizeInfotafelHtml(cache.infotafel?.content || "<p>Noch keine Hinweise.</p>");
  const updated = cache.infotafel?.updated_at
    ? new Date(cache.infotafel.updated_at).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "";

  return `
    <article class="card" id="infotafelCard">
      <div class="section-title">
        <div>
          <p class="overline">Info</p>
          <h2>Infotafel</h2>
        </div>
        ${isAdmin ? `<button class="primary compact" id="editInfotafelBtn" type="button" style="margin-top:0;width:auto;">Infotafel bearbeiten</button>` : ""}
      </div>

      <div class="infotafel-content">${html}</div>
      ${updated ? `<p class="hint" style="margin-top:12px;">Aktualisiert: ${updated}</p>` : ""}
    </article>
  `;
}

function ensureInfotafelBox() {
  const dashboard = $("dashboard");
  if (!dashboard || $("infotafelWrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "infotafelWrap";
  wrap.innerHTML = infotafelHtml();

  const nextLockBox = $("dashboardNextLockBox");
  if (nextLockBox && nextLockBox.parentNode === dashboard) {
    dashboard.insertBefore(wrap, nextLockBox.nextSibling);
  } else {
    dashboard.insertBefore(wrap, dashboard.firstElementChild);
  }
}

function renderInfotafelBox() {
  const wrap = $("infotafelWrap");
  if (!wrap) return;

  wrap.innerHTML = infotafelHtml();

  const button = $("editInfotafelBtn");
  if (button) {
    button.onclick = openInfotafelEditor;
  }
}

function editorCommand(command, value = null) {
  document.execCommand(command, false, value);
  const editor = $("infotafelEditor");
  if (editor) editor.focus();
}

function setBlock(tag) {
  document.execCommand("formatBlock", false, tag);
  const editor = $("infotafelEditor");
  if (editor) editor.focus();
}

function addEditorLink() {
  const url = prompt("Link einfügen:");
  if (!url) return;
  const safeUrl = url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")
    ? url
    : `https://${url}`;
  editorCommand("createLink", safeUrl);
}

function editorButton(label, action, extra = "") {
  return `<button class="ghost small infotafel-tool" type="button" data-action="${action}" ${extra} style="color:#0c1726;border-color:#d9e0e8;">${label}</button>`;
}

function openInfotafelEditor() {
  if (!isAdmin) return;

  const oldModal = $("infotafelModal");
  if (oldModal) oldModal.remove();

  const current = sanitizeInfotafelHtml(cache.infotafel?.content || "<p></p>");

  const modal = document.createElement("div");
  modal.id = "infotafelModal";
  modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px;";
  modal.innerHTML = `
    <div style="width:min(860px,100%);max-height:90vh;overflow:auto;background:#f8fafc;color:#0c1726;border-radius:24px;padding:20px;box-shadow:0 24px 80px rgba(0,0,0,.45);">
      <div class="section-title">
        <div>
          <p class="overline">Admin</p>
          <h2>Infotafel bearbeiten</h2>
        </div>
        <button class="ghost small" id="closeInfotafelEditor" type="button" style="color:#0c1726;border-color:#d9e0e8;">Schließen</button>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
        ${editorButton("<b>Fett</b>", "bold")}
        ${editorButton("<i>Kursiv</i>", "italic")}
        ${editorButton("<u>Unterstr.</u>", "underline")}
        ${editorButton("H2", "h2")}
        ${editorButton("H3", "h3")}
        ${editorButton("Absatz", "p")}
        ${editorButton("Liste", "ul")}
        ${editorButton("Nummeriert", "ol")}
        ${editorButton("Link", "link")}
      </div>

      <div id="infotafelEditor" contenteditable="true" style="min-height:260px;background:white;border:1px solid #d9e0e8;border-radius:18px;padding:16px;line-height:1.55;outline:none;">${current}</div>

      <button class="primary" id="saveInfotafelBtn" type="button" style="margin-top:14px;">Infotafel speichern</button>
    </div>
  `;

  document.body.appendChild(modal);

  $("closeInfotafelEditor").addEventListener("click", () => modal.remove());
  $("saveInfotafelBtn").addEventListener("click", saveInfotafel);

  modal.querySelectorAll(".infotafel-tool").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (action === "bold") editorCommand("bold");
      if (action === "italic") editorCommand("italic");
      if (action === "underline") editorCommand("underline");
      if (action === "h2") setBlock("h2");
      if (action === "h3") setBlock("h3");
      if (action === "p") setBlock("p");
      if (action === "ul") editorCommand("insertUnorderedList");
      if (action === "ol") editorCommand("insertOrderedList");
      if (action === "link") addEditorLink();
    });
  });

  const editor = $("infotafelEditor");
  if (editor) editor.focus();
}

async function saveInfotafel() {
  if (!isAdmin) return;

  const editor = $("infotafelEditor");
  const modal = $("infotafelModal");
  const content = sanitizeInfotafelHtml(editor?.innerHTML || "");

  const { error } = await db.from("infotafel").upsert({
    id: 1,
    content,
    updated_at: new Date().toISOString()
  });

  if (error) {
    toast(error.message);
    return;
  }

  if (modal) modal.remove();
  toast("Infotafel gespeichert.");
  await renderAll();
}

function renderPlayerSummary() {
  if (isAdmin) {
    $("currentPoints").textContent = "Admin";
    $("playerSummary").innerHTML = `
      <p class="muted">Adminbereich: Ergebnisse, Gruppensieger und Weltmeister eintragen.</p>
      ${dashboardInsightHtml()}
    `;
    return;
  }

  const score = calcPlayer(currentUser);
  $("currentPoints").textContent = `${score.total} Punkte`;

  const champ = cache.championTips.find(t => t.player_id === currentUser.id)?.champion || "noch offen";
  const groupCount = cache.groupTips.filter(t => t.player_id === currentUser.id && t.team).length;
  const matchCount = cache.tips.filter(t => t.player_id === currentUser.id).length;

  $("playerSummary").innerHTML = `
    <div class="ranking-row"><div class="medal">🎯</div><div>Spieltipps</div><div class="points">${matchCount}/${cache.matches.length}</div></div>
    <div class="ranking-row"><div class="medal">🏆</div><div>Weltmeister</div><div class="points">${escapeHtml(champ)}</div></div>
    <div class="ranking-row"><div class="medal">📌</div><div>Gruppensieger</div><div class="points">${groupCount}/${cache.groups.filter(g => /^[A-L]$/.test(g.name)).length}</div></div>
    ${dashboardInsightHtml()}
  `;
}


function playerInitial(player) {
  return (player.name || "?").trim().charAt(0).toUpperCase();
}

function tipperBadges(matchId) {
  const initials = cache.players
    .filter(player =>
      cache.tips.some(
        tip =>
          tip.player_id === player.id &&
          tip.match_id === matchId &&
          tip.tip_home !== null &&
          tip.tip_away !== null
      )
    )
    .map(player => playerInitial(player));

  return initials.length ? initials.join(" · ") : "niemand";
}

function visibleTips(match) {
  if (!isMatchLocked(match)) {
    return `<div class="hint" style="grid-column:1/-1;margin-top:6px;">Getippt: ${tipperBadges(match.id)}</div>`;
  }

  const rows = cache.players.map(player => {
    const tip = cache.tips.find(t => t.player_id === player.id && t.match_id === match.id);
    const value = tip ? `${tip.tip_home}:${tip.tip_away}` : "—";
    return `<span class="tip-reveal-pill"><strong>${escapeHtml(player.name)}</strong> ${value}</span>`;
  }).join("");

  return `
    <div class="tip-reveal" style="grid-column:1/-1;margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;">
      ${rows}
    </div>
  `;
}

function renderMatches() {
  $("matchesList").innerHTML = cache.matches.map(m => {
    const tip = cache.tips.find(t => t.player_id === currentUser?.id && t.match_id === m.id) || {};
    const locked = isMatchLocked(m);
    return `
      <article class="match-card">
        <div class="team">${teamLabel(m.home)}</div>
        <div class="score-box">
          <input type="number" min="0" inputmode="numeric" data-tip-home="${m.id}" value="${tip.tip_home ?? ""}" ${isAdmin || locked ? "disabled" : ""}>
          <span class="vs">:</span>
          <input type="number" min="0" inputmode="numeric" data-tip-away="${m.id}" value="${tip.tip_away ?? ""}" ${isAdmin || locked ? "disabled" : ""}>
        </div>
        <div class="team away">${teamLabel(m.away)}</div>
        <div class="match-meta">
          <span>Gruppe ${m.group_name} · ${m.match_date || ""} · ${m.match_time || ""}</span>
          <span>${lockLabel(m)}</span>
        </div>
        ${visibleTips(m)}
      </article>
    `;
  }).join("");

  $("saveMatchTips").style.display = isAdmin ? "none" : "";
}

async function saveMatchTips() {
  if (!currentUser || isAdmin) return;

  await refreshData();

  const payload = [];

  for (const m of cache.matches) {
    const locked = isMatchLocked(m);
    if (locked) continue;

    const homeInput = document.querySelector(`[data-tip-home="${m.id}"]`);
    const awayInput = document.querySelector(`[data-tip-away="${m.id}"]`);

    if (!homeInput || !awayInput) continue;

    const home = homeInput.value;
    const away = awayInput.value;

    if (home !== "" && away !== "") {
      payload.push({
        player_id: currentUser.id,
        match_id: m.id,
        tip_home: Number(home),
        tip_away: Number(away),
        updated_at: new Date().toISOString()
      });
    }
  }

  if (payload.length) {
    const { error } = await db.from("match_tips").upsert(payload, { onConflict: "player_id,match_id" });
    if (error) return toast(error.message);
  }

  toast("Spieltipps gespeichert.");
  await renderAll();
}

function fillTeamSelect(select, selected = "") {
  select.innerHTML = `<option value="">Bitte wählen</option>` + cache.teams
    .map(t => `<option value="${t.name}" ${t.name === selected ? "selected" : ""}>${t.name}</option>`)
    .join("");
}

function renderSpecialTips() {
  const champTip = cache.championTips.find(t => t.player_id === currentUser?.id);
  fillTeamSelect($("championSelect"), champTip?.champion || "");
  const hasChampion = !isAdmin && !!champTip;

  $("championSelect").disabled = isAdmin || hasChampion;
  $("saveChampionTip").disabled = isAdmin || hasChampion;
  $("saveChampionTip").style.opacity = hasChampion ? ".45" : "1";
  $("championLockTag").textContent = hasChampion ? "gesperrt" : "offen";

  if (isAdmin) {
    $("groupWinnerList").innerHTML = `<p class="muted">Als Admin trägst du die offiziellen Gruppensieger im Adminbereich ein.</p>`;
    return;
  }

  const groupLocked = cache.groupLocks.some(lock => lock.player_id === currentUser.id);

  $("groupWinnerList").innerHTML = `
    ${groupLocked ? `<p class="hint"><strong>Gruppensieger-Tipps sind gespeichert und gesperrt.</strong></p>` : `<p class="hint">Nach dem Speichern sind die Gruppensieger-Tipps gesperrt.</p>`}
    ${cache.groups
      .filter(g => /^[A-L]$/.test(g.name))
      .map(g => {
        const teams = cache.teams.filter(t => t.group_name === g.name);
        const tip = cache.groupTips.find(t => t.player_id === currentUser.id && t.group_name === g.name);
        return `
          <div class="special-row">
            <label>Gruppe ${g.name}</label>
            <select data-group-tip="${g.name}" ${groupLocked ? "disabled" : ""}>
              <option value="">Bitte wählen</option>
              ${teams.map(t => `<option value="${t.name}" ${tip?.team === t.name ? "selected" : ""}>${t.name}</option>`).join("")}
            </select>
          </div>
        `;
      }).join("")}
  `;

  $("saveGroupTips").disabled = groupLocked;
  $("saveGroupTips").style.opacity = groupLocked ? ".45" : "1";
}

async function saveChampionTip() {
  if (isAdmin) return;

  const existing = cache.championTips.find(t => t.player_id === currentUser.id);
  if (existing) return toast("Weltmeister-Tipp ist bereits gesperrt.");

  const champion = $("championSelect").value;
  if (!champion) return toast("Bitte Weltmeister auswählen.");

  const { error } = await db.from("champion_tips").insert({ player_id: currentUser.id, champion });
  if (error) return toast(error.message);

  toast("Weltmeister gespeichert und gesperrt.");
  await renderAll();
}

async function saveGroupTips() {
  if (isAdmin) return;

  await refreshData();

  const alreadyLocked = cache.groupLocks.some(lock => lock.player_id === currentUser.id);
  if (alreadyLocked) {
    toast("Gruppensieger-Tipps sind bereits gesperrt.");
    await renderAll();
    return;
  }

  const selects = $$("[data-group-tip]");
  const payload = selects.filter(sel => sel.value).map(sel => ({
    player_id: currentUser.id,
    group_name: sel.dataset.groupTip,
    team: sel.value,
    updated_at: new Date().toISOString()
  }));

  if (payload.length !== selects.length) {
    toast("Bitte alle Gruppensieger auswählen.");
    return;
  }

  const { error } = await db.from("group_winner_tips").upsert(payload, { onConflict: "player_id,group_name" });
  if (error) return toast(error.message);

  const lockResult = await db.from("group_tip_locks").insert({
    player_id: currentUser.id
  });
  if (lockResult.error) return toast(lockResult.error.message);

  toast("Gruppensieger gespeichert und gesperrt.");
  await renderAll();
}


function euro(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(value || 0);
}

function isGroupStageMatch(match) {
  return /^[A-L]$/.test(match.group_name || "");
}

function matchPotValue(match) {
  if (!isGroupStageMatch(match)) return 0;
  return cache.players.length * 1;
}

function matchTipScoreForPlayer(match, player) {
  const tip = cache.tips.find(t => t.player_id === player.id && t.match_id === match.id);
  return calcMatchPoints(tip, match);
}

function matchPotWinners(match) {
  if (match.result_home === null || match.result_away === null) return [];

  const pot = matchPotValue(match);
  if (!pot) return [];

  const scored = cache.players.map(player => ({
    player,
    score: matchTipScoreForPlayer(match, player)
  }));

  const bestScore = Math.max(...scored.map(row => row.score));
  if (bestScore <= 0) return [];

  const winners = scored.filter(row => row.score === bestScore);
  const amount = pot / winners.length;

  return winners.map(row => ({
    player: row.player,
    score: row.score,
    amount
  }));
}

function playerMatchPayout(player) {
  return cache.matches.reduce((sum, match) => {
    const win = matchPotWinners(match).find(row => row.player.id === player.id);
    return sum + (win?.amount || 0);
  }, 0);
}

function groupPotValue() {
  return cache.players.length * 3;
}

function groupPotWinners(groupName) {
  const actualGroups = cache.actualSpecials.group_winners || {};
  const actualWinner = actualGroups[groupName];
  if (!actualWinner) return [];

  const pot = groupPotValue();
  const winners = cache.players
    .filter(player =>
      cache.groupTips.some(
        tip =>
          tip.player_id === player.id &&
          tip.group_name === groupName &&
          tip.team === actualWinner
      )
    );

  if (!winners.length) return [];

  const amount = pot / winners.length;

  return winners.map(player => ({
    player,
    team: actualWinner,
    amount
  }));
}

function playerGroupPayout(player) {
  return cache.groups
    .filter(group => /^[A-L]$/.test(group.name))
    .reduce((sum, group) => {
      const win = groupPotWinners(group.name).find(row => row.player.id === player.id);
      return sum + (win?.amount || 0);
    }, 0);
}

function playerTotalPayout(player) {
  return playerMatchPayout(player) + playerGroupPayout(player);
}

function ensurePayoutTab() {
  const tabs = document.querySelector(".tabs");
  if (tabs && !document.querySelector('[data-tab="payout"]')) {
    const button = document.createElement("button");
    button.className = "tab";
    button.dataset.tab = "payout";
    button.textContent = "Auszahlung";
    tabs.insertBefore(button, tabs.querySelector('[data-tab="ranking"]'));
    button.addEventListener("click", () => switchTab("payout"));
  }

  const main = document.querySelector("#mainView main");
  if (main && !$("payout")) {
    const section = document.createElement("section");
    section.id = "payout";
    section.className = "tab-view";
    section.innerHTML = `
      <article class="card">
        <div class="section-title">
          <div>
            <p class="overline">Pott</p>
            <h2>Auszahlungen</h2>
          </div>
          <span class="tag">ohne Weltmeister</span>
        </div>
        <div id="payoutSummary"></div>
      </article>

      <article class="card">
        <p class="overline">Spiele</p>
        <h2>Match-Pötte</h2>
        <p class="hint">Nur Gruppenspiele: 1 € pro Spieler pro Spiel. Der beste Tipp gewinnt den Match-Pott, Gleichstand wird geteilt.</p>
        <div id="matchPayoutList"></div>
      </article>

      <article class="card">
        <p class="overline">Gruppen</p>
        <h2>Gruppensieger-Pötte</h2>
        <p class="hint">3 € pro Spieler pro Gruppe. Richtige Gruppensieger-Tipps teilen sich den Gruppenpott.</p>
        <div id="groupPayoutList"></div>
      </article>
    `;
    main.appendChild(section);
  }
}

function renderPayouts() {
  if (!$("payoutSummary")) return;

  const rows = cache.players
    .map(player => ({
      player,
      points: calcPlayer(player).total,
      match: playerMatchPayout(player),
      group: playerGroupPayout(player),
      total: playerTotalPayout(player)
    }))
    .sort((a, b) => b.total - a.total);

  $("payoutSummary").innerHTML = rows.map((row, index) => `
    <div class="ranking-row">
      <div class="medal">${["🥇", "🥈", "🥉"][index] || index + 1}</div>
      <div>
        <strong>${escapeHtml(row.player.name)}</strong>
        <div class="hint">Spiele ${euro(row.match)} · Gruppensieger ${euro(row.group)} · ${row.points} Punkte</div>
      </div>
      <div class="points">${euro(row.total)}</div>
    </div>
  `).join("");

  const finishedGroupMatches = cache.matches.filter(m =>
    isGroupStageMatch(m) &&
    m.result_home !== null &&
    m.result_away !== null
  );

  if (!finishedGroupMatches.length) {
    $("matchPayoutList").innerHTML = `<p class="hint">Noch keine Gruppenspiel-Ergebnisse eingetragen.</p>`;
  } else {
    $("matchPayoutList").innerHTML = finishedGroupMatches.map(match => {
      const winners = matchPotWinners(match);
      const winnerText = winners.length
        ? winners.map(w => `${escapeHtml(w.player.name)} ${euro(w.amount)}`).join(" · ")
        : "Kein Gewinner";

      return `
        <div class="tip-card">
          <strong>${teamLabel(match.home)} ${match.result_home}:${match.result_away} ${teamLabel(match.away)}</strong>
          <div class="hint">Pott: ${euro(matchPotValue(match))}</div>
          <div class="points">${winnerText}</div>
        </div>
      `;
    }).join("");
  }

  const actualGroups = cache.actualSpecials.group_winners || {};
  const groupRows = cache.groups.filter(g => /^[A-L]$/.test(g.name));

  $("groupPayoutList").innerHTML = groupRows.map(group => {
    const actualWinner = actualGroups[group.name];
    if (!actualWinner) {
      return `
        <div class="tip-card">
          <strong>Gruppe ${group.name}</strong>
          <div class="hint">Offizieller Gruppensieger noch nicht eingetragen.</div>
        </div>
      `;
    }

    const winners = groupPotWinners(group.name);
    const winnerText = winners.length
      ? winners.map(w => `${escapeHtml(w.player.name)} ${euro(w.amount)}`).join(" · ")
      : "Kein Gewinner";

    return `
      <div class="tip-card">
        <strong>Gruppe ${group.name}: ${escapeHtml(actualWinner)}</strong>
        <div class="hint">Pott: ${euro(groupPotValue())}</div>
        <div class="points">${winnerText}</div>
      </div>
    `;
  }).join("");
}

function renderRanking(targetId, mini = false) {
  const rows = ranking();
  const medals = ["🥇", "🥈", "🥉"];
  $(targetId).innerHTML = rows.map((r, i) => `
    <div class="ranking-row">
      <div class="medal">${medals[i] || i + 1}</div>
      <div>
        <strong>${escapeHtml(r.name)}</strong>
        ${mini ? "" : `<div class="hint">Spiele ${r.matchPoints} · Gruppen ${r.groupPoints} · Weltmeister ${r.championPoints} · Auszahlung ${euro(playerTotalPayout(r))}</div>`}
      </div>
      <div class="points">${r.total}</div>
    </div>
  `).join("");
}

function renderAdmin() {
  $("adminResultsList").innerHTML = cache.matches.map(m => `
    <div class="admin-result-row">
      <strong>${teamLabel(m.home)}</strong>
      <input type="number" min="0" inputmode="numeric" data-result-home="${m.id}" value="${m.result_home ?? ""}">
      <input type="number" min="0" inputmode="numeric" data-result-away="${m.id}" value="${m.result_away ?? ""}">
      <strong>${teamLabel(m.away)}</strong>
    </div>
  `).join("");

  fillTeamSelect($("actualChampionSelect"), cache.actualSpecials.champion || "");

  const actualGroups = cache.actualSpecials.group_winners || {};
  $("actualGroupWinnerList").innerHTML = cache.groups.filter(g => /^[A-L]$/.test(g.name)).map(g => {
    const teams = cache.teams.filter(t => t.group_name === g.name);
    return `
      <div class="special-row">
        <label>Gruppe ${g.name}</label>
        <select data-actual-group="${g.name}">
          <option value="">Bitte wählen</option>
          ${teams.map(t => `<option value="${t.name}" ${actualGroups[g.name] === t.name ? "selected" : ""}>${t.name}</option>`).join("")}
        </select>
      </div>
    `;
  }).join("");

  renderAllTipsAdmin();
}

async function saveResults() {
  const updates = cache.matches.map(m => {
    const home = document.querySelector(`[data-result-home="${m.id}"]`).value;
    const away = document.querySelector(`[data-result-away="${m.id}"]`).value;
    return {
      id: m.id,
      group_name: m.group_name,
      sort_order: m.sort_order,
      match_date: m.match_date,
      match_time: m.match_time,
      kickoff_at: m.kickoff_at,
      home: m.home,
      away: m.away,
      result_home: home === "" ? null : Number(home),
      result_away: away === "" ? null : Number(away)
    };
  });

  const { error } = await db.from("matches").upsert(updates);
  if (error) return toast(error.message);

  toast("Ergebnisse gespeichert.");
  await renderAll();
}

async function saveActualSpecials() {
  const groupWinners = {};
  $$("[data-actual-group]").forEach(sel => {
    if (sel.value) groupWinners[sel.dataset.actualGroup] = sel.value;
  });

  const rows = [
    { key: "champion", value: $("actualChampionSelect").value || "" },
    { key: "group_winners", value: groupWinners }
  ];

  const { error } = await db.from("actual_specials").upsert(rows);
  if (error) return toast(error.message);

  toast("Spezial-Auswertung gespeichert.");
  await renderAll();
}

function renderAllTipsAdmin() {
  $("allTipsAdmin").innerHTML = cache.players.map(p => {
    const champ = cache.championTips.find(t => t.player_id === p.id)?.champion || "-";
    const groups = cache.groupTips.filter(t => t.player_id === p.id).map(t => `${t.group_name}: ${t.team}`).join(" · ") || "-";
    const matchTips = cache.matches.map(m => {
      const t = cache.tips.find(x => x.player_id === p.id && x.match_id === m.id);
      return `<div class="hint">${flag(m.home)} ${escapeHtml(m.home)} - ${flag(m.away)} ${escapeHtml(m.away)}: <strong>${t ? `${t.tip_home}:${t.tip_away}` : "-"}</strong></div>`;
    }).join("");

    return `
      <div class="tip-card">
        <h3>${p.name}</h3>
        <p><strong>Weltmeister:</strong> ${champ}</p>
        <p><strong>Gruppensieger:</strong> ${groups}</p>
        <details><summary>Spieltipps anzeigen</summary>${matchTips}</details>
      </div>
    `;
  }).join("");
}

async function renderAll() {
  if (!currentUser || !db) return;
  await refreshData();
  ensureDashboardNextLockBox();
  ensureInfotafelBox();
  renderPlayerSummary();
  renderDashboardNextLock();
  renderInfotafelBox();
  renderMatches();
  renderSpecialTips();
  renderRanking("rankingList");
  renderRanking("miniRanking", true);
  renderPayouts();
  if (isAdmin) renderAdmin();
}


function startCountdownTimer() {
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    if (currentUser && $("dashboardNextLockContent")) {
      renderDashboardNextLock();
    }
  }, 15000);
}

async function restoreSession() {
  const savedCode = localStorage.getItem(SESSION_KEY);
  if (!savedCode || missingSetup) return;

  try {
    await login(savedCode);
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    console.warn("Session konnte nicht wiederhergestellt werden:", error);
  }
}

$("loginBtn").addEventListener("click", login);
$("codeInput").addEventListener("keydown", e => { if (e.key === "Enter") login(); });
$("logoutBtn").addEventListener("click", logout);
$("saveMatchTips").addEventListener("click", saveMatchTips);
$("saveChampionTip").addEventListener("click", saveChampionTip);
$("saveGroupTips").addEventListener("click", saveGroupTips);
$("saveResults").addEventListener("click", saveResults);
$("saveActualSpecials").addEventListener("click", saveActualSpecials);

$$(".tab").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
$$("[data-go]").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.go)));

restoreSession();
