const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const missingSetup =
  !CONFIG.SUPABASE_URL ||
  CONFIG.SUPABASE_URL.includes("HIER_") ||
  !CONFIG.SUPABASE_ANON_KEY ||
  CONFIG.SUPABASE_ANON_KEY.includes("HIER_");

$("setupWarning").hidden = !missingSetup;

const db = missingSetup ? null : supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

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
  actualSpecials: {},
};

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1900);
}

async function query(table) {
  const { data, error } = await db.from(table).select("*");
  if (error) throw error;
  return data || [];
}

async function refreshData() {
  if (!db) return;

  const [players, teams, groups, matches, tips, groupTips, championTips, actualRows] = await Promise.all([
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
    query("actual_specials"),
  ]);

  cache.players = players;
  cache.teams = teams;
  cache.groups = groups;
  cache.matches = matches;
  cache.tips = tips;
  cache.groupTips = groupTips;
  cache.championTips = championTips;
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

async function login() {
  if (!db) {
    toast("Supabase ist noch nicht verbunden.");
    return;
  }

  await refreshData();

  const code = $("codeInput").value.trim().toUpperCase();

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

  $("loginView").classList.remove("active");
  $("mainView").classList.add("active");
  $("logoutBtn").hidden = false;
  $("currentUserName").textContent = currentUser.name;
  $$(".admin-only").forEach(el => el.style.display = isAdmin ? "" : "none");

  switchTab("dashboard");
  await renderAll();
}

function logout() {
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

function renderPlayerSummary() {
  if (isAdmin) {
    $("currentPoints").textContent = "Admin";
    $("playerSummary").innerHTML = `<p class="muted">Adminbereich: Ergebnisse, Gruppensieger und Weltmeister eintragen.</p>`;
    return;
  }

  const score = calcPlayer(currentUser);
  $("currentPoints").textContent = `${score.total} Punkte`;

  const champ = cache.championTips.find(t => t.player_id === currentUser.id)?.champion || "noch offen";
  const groupCount = cache.groupTips.filter(t => t.player_id === currentUser.id && t.team).length;
  const matchCount = cache.tips.filter(t => t.player_id === currentUser.id).length;

  $("playerSummary").innerHTML = `
    <div class="ranking-row"><div class="medal">🎯</div><div>Spieltipps</div><div class="points">${matchCount}/${cache.matches.length}</div></div>
    <div class="ranking-row"><div class="medal">🏆</div><div>Weltmeister</div><div class="points">${champ}</div></div>
    <div class="ranking-row"><div class="medal">📌</div><div>Gruppensieger</div><div class="points">${groupCount}/${cache.groups.length}</div></div>
  `;
}

function renderMatches() {
  $("matchesList").innerHTML = cache.matches.map(m => {
    const tip = cache.tips.find(t => t.player_id === currentUser?.id && t.match_id === m.id) || {};
    const locked = m.result_home !== null && m.result_away !== null;
    return `
      <article class="match-card">
        <div class="team">${m.home}</div>
        <div class="score-box">
          <input type="number" min="0" inputmode="numeric" data-tip-home="${m.id}" value="${tip.tip_home ?? ""}" ${isAdmin || locked ? "disabled" : ""}>
          <span class="vs">:</span>
          <input type="number" min="0" inputmode="numeric" data-tip-away="${m.id}" value="${tip.tip_away ?? ""}" ${isAdmin || locked ? "disabled" : ""}>
        </div>
        <div class="team away">${m.away}</div>
        <div class="match-meta">
          <span>Gruppe ${m.group_name} · ${m.match_date || ""} · ${m.match_time || ""}</span>
          <span>${locked ? `Ergebnis ${m.result_home}:${m.result_away}` : "offen"}</span>
        </div>
      </article>
    `;
  }).join("");

  $("saveMatchTips").style.display = isAdmin ? "none" : "";
}

async function saveMatchTips() {
  if (!currentUser || isAdmin) return;

  const payload = [];

  for (const m of cache.matches) {
    const locked = m.result_home !== null && m.result_away !== null;
    if (locked) continue;

    const home = document.querySelector(`[data-tip-home="${m.id}"]`).value;
    const away = document.querySelector(`[data-tip-away="${m.id}"]`).value;

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

  $("groupWinnerList").innerHTML = cache.groups.map(g => {
    const teams = cache.teams.filter(t => t.group_name === g.name);
    const tip = cache.groupTips.find(t => t.player_id === currentUser.id && t.group_name === g.name);
    return `
      <div class="special-row">
        <label>Gruppe ${g.name}</label>
        <select data-group-tip="${g.name}">
          <option value="">Bitte wählen</option>
          ${teams.map(t => `<option value="${t.name}" ${tip?.team === t.name ? "selected" : ""}>${t.name}</option>`).join("")}
        </select>
      </div>
    `;
  }).join("");
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

  const payload = $$("[data-group-tip]").filter(sel => sel.value).map(sel => ({
    player_id: currentUser.id,
    group_name: sel.dataset.groupTip,
    team: sel.value,
    updated_at: new Date().toISOString()
  }));

  if (payload.length) {
    const { error } = await db.from("group_winner_tips").upsert(payload, { onConflict: "player_id,group_name" });
    if (error) return toast(error.message);
  }

  toast("Gruppensieger gespeichert.");
  await renderAll();
}

function renderRanking(targetId, mini = false) {
  const rows = ranking();
  const medals = ["🥇", "🥈", "🥉"];
  $(targetId).innerHTML = rows.map((r, i) => `
    <div class="ranking-row">
      <div class="medal">${medals[i] || i + 1}</div>
      <div>
        <strong>${r.name}</strong>
        ${mini ? "" : `<div class="hint">Spiele ${r.matchPoints} · Gruppen ${r.groupPoints} · Weltmeister ${r.championPoints}</div>`}
      </div>
      <div class="points">${r.total}</div>
    </div>
  `).join("");
}

function renderAdmin() {
  $("adminResultsList").innerHTML = cache.matches.map(m => `
    <div class="admin-result-row">
      <strong>${m.home}</strong>
      <input type="number" min="0" inputmode="numeric" data-result-home="${m.id}" value="${m.result_home ?? ""}">
      <input type="number" min="0" inputmode="numeric" data-result-away="${m.id}" value="${m.result_away ?? ""}">
      <strong>${m.away}</strong>
    </div>
  `).join("");

  fillTeamSelect($("actualChampionSelect"), cache.actualSpecials.champion || "");

  const actualGroups = cache.actualSpecials.group_winners || {};
  $("actualGroupWinnerList").innerHTML = cache.groups.map(g => {
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
      return `<div class="hint">${m.home} - ${m.away}: <strong>${t ? `${t.tip_home}:${t.tip_away}` : "-"}</strong></div>`;
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
  renderPlayerSummary();
  renderMatches();
  renderSpecialTips();
  renderRanking("rankingList");
  renderRanking("miniRanking", true);
  if (isAdmin) renderAdmin();
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
