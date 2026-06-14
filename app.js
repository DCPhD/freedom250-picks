(() => {
  "use strict";

  const config = window.FREEDOM_CONFIG;
  const seedFights = window.FREEDOM_FIGHTS;
  const isConfigured =
    config.supabaseUrl &&
    config.supabasePublishableKey &&
    !config.supabaseUrl.includes("PASTE_") &&
    !config.supabasePublishableKey.includes("PASTE_");
  const demoMode = !isConfigured;
  const db = demoMode ? null : window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);

  const state = {
    session: null,
    event: null,
    participant: null,
    fights: [],
    picks: new Map(),
    participants: [],
    publicPicks: [],
    activeTab: "my-picks"
  };

  const els = {
    modeNotice: document.getElementById("modeNotice"),
    message: document.getElementById("message"),
    displayName: document.getElementById("displayName"),
    eventCode: document.getElementById("eventCode"),
    joinBtn: document.getElementById("joinBtn"),
    appContent: document.getElementById("appContent"),
    fights: document.getElementById("fights"),
    participantStatus: document.getElementById("participantStatus"),
    leaderboard: document.getElementById("leaderboard"),
    groupPicks: document.getElementById("groupPicks"),
    groupPicksContent: document.getElementById("groupPicksContent")
  };

  const resultOptions = fight => [
    ["fighter1", fight.fighter1],
    ["fighter2", fight.fighter2],
    ["draw", "Draw"],
    ["no_contest", "No Contest"]
  ];
  const methodOptions = [
    ["ko_tko", "KO/TKO"],
    ["submission", "Submission"],
    ["decision", "Decision"],
    ["other", "Other / rare"]
  ];
  const rareOptions = [
    ["", "Choose rare outcome"],
    ["disqualification", "Disqualification"],
    ["technical_decision", "Technical decision"],
    ["technical_draw", "Technical draw"],
    ["no_contest", "No contest"]
  ];
  const endingOptions = fight => {
    const rows = [["r1", "R1"], ["r2", "R2"], ["r3", "R3"]];
    if (fight.max_rounds === 5) rows.push(["r4", "R4"], ["r5", "R5"]);
    rows.push(["decision", "Goes to decision"]);
    return rows;
  };
  const leaderOptions = fight => [
    ["fighter1", fight.fighter1],
    ["fighter2", fight.fighter2],
    ["tie", "Tie"]
  ];

  function showMessage(text, type = "") {
    els.message.textContent = text;
    els.message.className = `notice show ${type}`.trim();
    window.clearTimeout(showMessage.timer);
    showMessage.timer = window.setTimeout(() => els.message.classList.remove("show"), 6000);
  }

  function normalizeName(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function initials(name) {
    return name.split(/\s+/).map(x => x[0]).join("").slice(0, 2).toUpperCase();
  }

  function labelValue(value, fight, category) {
    if (!value) return "—";
    if (value === "fighter1") return fight.fighter1;
    if (value === "fighter2") return fight.fighter2;
    const labels = {
      draw: "Draw", no_contest: "No Contest",
      ko_tko: "KO/TKO", submission: "Submission", decision: "Decision",
      disqualification: "Disqualification", technical_decision: "Technical decision",
      technical_draw: "Technical draw", r1: "R1", r2: "R2", r3: "R3",
      r4: "R4", r5: "R5", tie: "Tie", void: "Void"
    };
    return labels[value] || value;
  }

  function demoLoad() {
    const storedFights = JSON.parse(localStorage.getItem("freedom250_demo_fights") || "null");
    state.fights = storedFights || seedFights.map((f, i) => ({
      ...f, id: `demo-fight-${i+1}`, status: "open",
      actual_result: null, actual_method: null, actual_ending: null,
      actual_takedown_leader: null, actual_strike_leader: null
    }));
    if (!storedFights) localStorage.setItem("freedom250_demo_fights", JSON.stringify(state.fights));
    state.event = { id: "demo-event", code: config.eventCode, title: "Freedom 250 Picks" };
  }

  function demoSaveParticipant(name) {
    let userId = localStorage.getItem("freedom250_demo_user");
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem("freedom250_demo_user", userId);
    }
    const participants = JSON.parse(localStorage.getItem("freedom250_demo_participants") || "[]");
    let p = participants.find(x => x.user_id === userId);
    const duplicate = participants.find(x => x.display_name.toLowerCase() === name.toLowerCase() && x.user_id !== userId);
    if (duplicate) throw new Error("That display name is already being used.");
    if (p) p.display_name = name;
    else {
      p = { id: crypto.randomUUID(), event_id: "demo-event", user_id: userId, display_name: name };
      participants.push(p);
    }
    localStorage.setItem("freedom250_demo_participants", JSON.stringify(participants));
    state.participant = p;
    state.participants = participants;
    state.session = { user: { id: userId } };
    const allPicks = JSON.parse(localStorage.getItem("freedom250_demo_picks") || "[]");
    state.picks = new Map(allPicks.filter(x => x.user_id === userId).map(x => [x.fight_id, x]));
    state.publicPicks = allPicks.filter(pick => {
      const fight = state.fights.find(f => f.id === pick.fight_id);
      return fight && ["in_progress", "completed", "cancelled"].includes(fight.status);
    });
  }

  async function ensureSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      state.session = session;
      return;
    }
    const { data, error } = await db.auth.signInAnonymously();
    if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`);
    state.session = data.session;
  }

  async function joinLive(name, code) {
    await ensureSession();
    const { data: event, error: eventError } = await db
      .from("events").select("*").eq("code", code).eq("active", true).single();
    if (eventError || !event) throw new Error("Event code not found.");
    state.event = event;

    const { data: existing } = await db.from("participants")
      .select("*").eq("event_id", event.id).eq("user_id", state.session.user.id).maybeSingle();

    let participant;
    if (existing) {
      const { data, error } = await db.from("participants")
        .update({ display_name: name }).eq("id", existing.id).select().single();
      if (error) throw new Error(error.code === "23505" ? "That display name is already being used." : error.message);
      participant = data;
    } else {
      const { data, error } = await db.from("participants")
        .insert({ event_id: event.id, user_id: state.session.user.id, display_name: name })
        .select().single();
      if (error) throw new Error(error.code === "23505" ? "That display name is already being used." : error.message);
      participant = data;
    }
    state.participant = participant;
    localStorage.setItem("freedom250_display_name", name);
    await refreshLiveData();
  }

  async function refreshLiveData() {
    const [fightsRes, picksRes, participantsRes] = await Promise.all([
      db.from("fights").select("*").eq("event_id", state.event.id).order("display_order"),
      db.from("picks").select("*").eq("event_id", state.event.id),
      db.from("participants").select("*").eq("event_id", state.event.id)
    ]);
    if (fightsRes.error) throw fightsRes.error;
    if (picksRes.error) throw picksRes.error;
    if (participantsRes.error) throw participantsRes.error;
    state.fights = fightsRes.data;
    state.participants = participantsRes.data;
    const own = picksRes.data.filter(x => x.user_id === state.session.user.id);
    state.picks = new Map(own.map(x => [x.fight_id, x]));
    state.publicPicks = picksRes.data.filter(x => x.user_id !== state.session.user.id || true);
  }

  async function join() {
    const name = normalizeName(els.displayName.value);
    const code = els.eventCode.value.trim().toUpperCase();
    if (name.length < 2) return showMessage("Enter a display name with at least two characters.", "error");
    if (code !== config.eventCode) return showMessage("The event code is incorrect.", "error");
    els.joinBtn.disabled = true;
    els.joinBtn.textContent = "Entering…";
    try {
      if (demoMode) {
        demoLoad();
        demoSaveParticipant(name);
      } else {
        await joinLive(name, code);
      }
      els.appContent.classList.remove("hidden");
      els.participantStatus.textContent = `Playing as ${state.participant.display_name}`;
      renderAll();
    } catch (error) {
      showMessage(error.message || "Unable to enter the pool.", "error");
    } finally {
      els.joinBtn.disabled = false;
      els.joinBtn.textContent = "Enter Pool";
    }
  }

  function makeOptionButtons(options, selected, category, fight, disabled) {
    return options.map(([value, label]) => `
      <button type="button"
        class="option ${selected === value || (category === "method_pick" && value === "other" && selected && !["ko_tko","submission","decision"].includes(selected)) ? "selected" : ""}"
        data-fight="${fight.id}" data-category="${category}" data-value="${value}"
        ${disabled ? "disabled" : ""}>${escapeHtml(label)}</button>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[ch]));
  }

  function pickFor(fightId) {
    return state.picks.get(fightId) || {
      fight_id: fightId,
      result_pick: null, method_pick: null, ending_pick: null,
      takedown_pick: null, strike_pick: null
    };
  }

  function isComplete(pick) {
    return ["result_pick","method_pick","ending_pick","takedown_pick","strike_pick"].every(k => !!pick[k]);
  }

  function renderFights() {
    els.fights.innerHTML = state.fights.map(fight => {
      const pick = pickFor(fight.id);
      const locked = fight.status !== "open";
      const complete = isComplete(pick);
      const rareSelected = pick.method_pick && !["ko_tko","submission","decision"].includes(pick.method_pick);
      const completionText = fight.status === "cancelled"
        ? "Fight cancelled — no points awarded"
        : locked
          ? (complete ? "Picks locked" : "Fight locked with incomplete picks")
          : (complete ? "5 of 5 selected" : `${["result_pick","method_pick","ending_pick","takedown_pick","strike_pick"].filter(k => pick[k]).length} of 5 selected`);
      return `
        <article class="fight-card" data-fight-card="${fight.id}">
          <div class="fight-head">
            <div class="fight-number">${fight.display_order}</div>
            <div class="matchup">
              <div class="fighter-badge">${initials(fight.fighter1)}</div>
              <div class="matchup-text">
                <div class="fighter-line"><span class="fighter-name">${escapeHtml(fight.fighter1)}</span><span class="vs">VS</span><span class="fighter-name">${escapeHtml(fight.fighter2)}</span></div>
                <div class="weight">${escapeHtml(fight.weight_class)} · ${fight.max_rounds} rounds</div>
              </div>
            </div>
            <span class="status-badge status-${fight.status}">${fight.status.replace("_"," ")}</span>
          </div>
          <div class="pick-grid">
            <div class="pick-group">
              <div class="pick-label">Winner / result</div>
              <div class="option-list">${makeOptionButtons(resultOptions(fight), pick.result_pick, "result_pick", fight, locked)}</div>
            </div>
            <div class="pick-group">
              <div class="pick-label">Method</div>
              <div class="option-list">${makeOptionButtons(methodOptions, pick.method_pick, "method_pick", fight, locked)}</div>
              <select class="rare-select ${rareSelected ? "show" : ""}" data-rare="${fight.id}" ${locked ? "disabled" : ""}>
                ${rareOptions.map(([v,l]) => `<option value="${v}" ${pick.method_pick === v ? "selected" : ""}>${l}</option>`).join("")}
              </select>
            </div>
            <div class="pick-group">
              <div class="pick-label">Ending</div>
              <div class="option-list compact">${makeOptionButtons(endingOptions(fight), pick.ending_pick, "ending_pick", fight, locked)}</div>
            </div>
            <div class="pick-group">
              <div class="pick-label">More takedowns</div>
              <div class="option-list">${makeOptionButtons(leaderOptions(fight), pick.takedown_pick, "takedown_pick", fight, locked)}</div>
            </div>
            <div class="pick-group">
              <div class="pick-label">More significant strikes</div>
              <div class="option-list">${makeOptionButtons(leaderOptions(fight), pick.strike_pick, "strike_pick", fight, locked)}</div>
            </div>
          </div>
          <div class="fight-footer">
            <div class="completion ${complete ? "complete" : ""} ${locked ? "locked" : ""}">${completionText}</div>
            <button class="primary save-fight" data-save="${fight.id}" ${locked || !complete ? "disabled" : ""}>Save this fight</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function onOptionClick(event) {
    const button = event.target.closest(".option");
    if (!button) return;
    const fightId = button.dataset.fight;
    const category = button.dataset.category;
    const value = button.dataset.value;
    const pick = { ...pickFor(fightId) };

    if (category === "method_pick" && value === "other") {
      pick.method_pick = null;
      state.picks.set(fightId, pick);
      renderFights();
      const select = document.querySelector(`[data-rare="${CSS.escape(fightId)}"]`);
      if (select) {
        select.classList.add("show");
        select.focus();
      }
      return;
    }

    pick[category] = value;
    state.picks.set(fightId, pick);
    renderFights();
  }

  function onRareChange(event) {
    const select = event.target.closest("[data-rare]");
    if (!select) return;
    const fightId = select.dataset.rare;
    const pick = { ...pickFor(fightId), method_pick: select.value || null };
    state.picks.set(fightId, pick);
    renderFights();
  }

  async function saveFight(fightId) {
    const fight = state.fights.find(f => f.id === fightId);
    const pick = pickFor(fightId);
    if (!fight || fight.status !== "open") return showMessage("This fight is locked.", "error");
    if (!isComplete(pick)) return showMessage("Complete all five selections for this fight.", "error");

    const payload = {
      event_id: state.event.id,
      fight_id: fightId,
      participant_id: state.participant.id,
      user_id: state.session.user.id,
      result_pick: pick.result_pick,
      method_pick: pick.method_pick,
      ending_pick: pick.ending_pick,
      takedown_pick: pick.takedown_pick,
      strike_pick: pick.strike_pick,
      updated_at: new Date().toISOString()
    };

    try {
      if (demoMode) {
        const all = JSON.parse(localStorage.getItem("freedom250_demo_picks") || "[]");
        const idx = all.findIndex(x => x.fight_id === fightId && x.user_id === state.session.user.id);
        const saved = { ...payload, id: idx >= 0 ? all[idx].id : crypto.randomUUID() };
        if (idx >= 0) all[idx] = saved; else all.push(saved);
        localStorage.setItem("freedom250_demo_picks", JSON.stringify(all));
        state.picks.set(fightId, saved);
      } else {
        const { data, error } = await db.from("picks")
          .upsert(payload, { onConflict: "fight_id,user_id" }).select().single();
        if (error) throw error;
        state.picks.set(fightId, data);
      }
      showMessage(`${fight.fighter1} vs. ${fight.fighter2} saved.`, "success");
      renderFights();
    } catch (error) {
      showMessage(error.message || "Could not save picks.", "error");
    }
  }

  function scorePick(pick, fight) {
    if (!pick || fight.status === "cancelled") return { total: 0, fields: {} };
    const fields = {
      result: !!fight.actual_result && pick.result_pick === fight.actual_result,
      method: !!fight.actual_method && pick.method_pick === fight.actual_method,
      ending: !!fight.actual_ending && pick.ending_pick === fight.actual_ending,
      takedowns: !!fight.actual_takedown_leader && fight.actual_takedown_leader !== "void" && pick.takedown_pick === fight.actual_takedown_leader,
      strikes: !!fight.actual_strike_leader && fight.actual_strike_leader !== "void" && pick.strike_pick === fight.actual_strike_leader
    };
    return { total: Object.values(fields).filter(Boolean).length, fields };
  }

  function renderLeaderboard() {
    const visibleFightIds = new Set(state.fights.filter(f => ["in_progress","completed","cancelled"].includes(f.status)).map(f => f.id));
    const rows = state.participants.map(participant => {
      let total = 0;
      state.publicPicks.filter(p => p.participant_id === participant.id && visibleFightIds.has(p.fight_id)).forEach(p => {
        const fight = state.fights.find(f => f.id === p.fight_id);
        total += scorePick(p, fight).total;
      });
      return { name: participant.display_name, total };
    }).sort((a,b) => b.total - a.total || a.name.localeCompare(b.name));

    if (!rows.length) {
      els.leaderboard.innerHTML = `<div class="muted small">Scores appear after results are entered.</div>`;
      return;
    }
    let rank = 0, prior = null;
    els.leaderboard.innerHTML = rows.map((row, i) => {
      if (row.total !== prior) rank = i + 1;
      prior = row.total;
      return `<div class="leader-row"><span>${rank}. ${escapeHtml(row.name)}</span><strong>${row.total} pts</strong></div>`;
    }).join("");
  }

  function renderGroupPicks() {
    const visibleFights = state.fights.filter(f => ["in_progress","completed","cancelled"].includes(f.status));
    if (!visibleFights.length) {
      els.groupPicksContent.innerHTML = `<div class="empty-state">Group picks remain hidden until the organizer starts the first fight.</div>`;
      return;
    }
    els.groupPicksContent.innerHTML = visibleFights.map(fight => {
      const rows = state.publicPicks.filter(p => p.fight_id === fight.id).map(pick => {
        const participant = state.participants.find(p => p.id === pick.participant_id);
        const score = scorePick(pick, fight).total;
        return `<tr>
          <td>${escapeHtml(participant?.display_name || "Participant")}</td>
          <td>${escapeHtml(labelValue(pick.result_pick, fight))}</td>
          <td>${escapeHtml(labelValue(pick.method_pick, fight))}</td>
          <td>${escapeHtml(labelValue(pick.ending_pick, fight))}</td>
          <td>${escapeHtml(labelValue(pick.takedown_pick, fight))}</td>
          <td>${escapeHtml(labelValue(pick.strike_pick, fight))}</td>
          <td class="points-cell">${fight.actual_result ? score : "—"}</td>
        </tr>`;
      }).join("");
      return `
        <section class="sidebar-card" style="margin-bottom:14px">
          <h3>${escapeHtml(fight.fighter1)} vs. ${escapeHtml(fight.fighter2)}</h3>
          <div class="pick-table-wrap">
            <table class="pick-table">
              <thead><tr><th>Player</th><th>Result</th><th>Method</th><th>Ending</th><th>Takedowns</th><th>Sig. strikes</th><th>Pts</th></tr></thead>
              <tbody>${rows || `<tr><td colspan="7">No saved picks.</td></tr>`}</tbody>
            </table>
          </div>
        </section>`;
    }).join("");
  }

  function renderAll() {
    renderFights();
    renderLeaderboard();
    renderGroupPicks();
  }

  async function refresh() {
    if (!state.participant) return;
    try {
      if (demoMode) {
        demoLoad();
        demoSaveParticipant(state.participant.display_name);
      } else {
        await refreshLiveData();
      }
      renderAll();
    } catch (error) {
      showMessage(error.message || "Refresh failed.", "error");
    }
  }

  els.joinBtn.addEventListener("click", join);
  els.displayName.addEventListener("keydown", e => { if (e.key === "Enter") join(); });
  els.fights.addEventListener("click", e => {
    onOptionClick(e);
    const save = e.target.closest("[data-save]");
    if (save) saveFight(save.dataset.save);
  });
  els.fights.addEventListener("change", onRareChange);

  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", async () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === tab));
    state.activeTab = tab.dataset.tab;
    els.groupPicks.classList.toggle("show", state.activeTab === "group-picks");
    if (state.activeTab === "group-picks") await refresh();
  }));

  if (demoMode) {
    els.modeNotice.innerHTML = `<strong>Preview mode:</strong> the interface works now, but data is stored only in this browser. Add the Supabase URL and publishable key in <code>config.js</code> to enable shared group data.`;
    els.modeNotice.classList.add("show");
  }
  els.displayName.value = localStorage.getItem("freedom250_display_name") || "";
  els.eventCode.value = config.eventCode;
  setInterval(refresh, 30000);
})();
