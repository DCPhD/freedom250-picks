(() => {
  "use strict";
  const config = window.FREEDOM_CONFIG;
  const seedFights = window.FREEDOM_FIGHTS;
  const isConfigured =
    config.supabaseUrl && config.supabasePublishableKey &&
    !config.supabaseUrl.includes("PASTE_") &&
    !config.supabasePublishableKey.includes("PASTE_");
  const demoMode = !isConfigured;
  const db = demoMode ? null : window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);

  const state = { event: null, fights: [], participants: [], picks: [], editingId: null };
  const $ = id => document.getElementById(id);
  const els = {
    modeNotice: $("modeNotice"), message: $("message"), loginPanel: $("loginPanel"),
    adminContent: $("adminContent"), adminEmail: $("adminEmail"), loginBtn: $("loginBtn"),
    refreshBtn: $("refreshBtn"), addFightBtn: $("addFightBtn"), exportBtn: $("exportBtn"),
    signOutBtn: $("signOutBtn"), adminFights: $("adminFights"), fightModal: $("fightModal"),
    modalTitle: $("modalTitle"), modalF1: $("modalF1"), modalF2: $("modalF2"),
    modalWeight: $("modalWeight"), modalRounds: $("modalRounds"), modalOrder: $("modalOrder"),
    modalCancel: $("modalCancel"), modalSave: $("modalSave")
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
    }[ch]));
  }
  function showMessage(text, type="") {
    els.message.textContent = text;
    els.message.className = `notice show ${type}`.trim();
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(() => els.message.classList.remove("show"), 7000);
  }
  function demoInit() {
    const stored = JSON.parse(localStorage.getItem("freedom250_demo_fights") || "null");
    state.fights = stored || seedFights.map((f,i) => ({
      ...f, id:`demo-fight-${i+1}`, status:"open",
      actual_result:null, actual_method:null, actual_ending:null,
      actual_takedown_leader:null, actual_strike_leader:null
    }));
    localStorage.setItem("freedom250_demo_fights", JSON.stringify(state.fights));
    state.event = { id:"demo-event", code:config.eventCode };
    state.participants = JSON.parse(localStorage.getItem("freedom250_demo_participants") || "[]");
    state.picks = JSON.parse(localStorage.getItem("freedom250_demo_picks") || "[]");
  }

  async function sendMagicLink() {
    try {
      await db.auth.signOut();
      const redirectTo = new URL("admin.html", window.location.href).href;
      const { error } = await db.auth.signInWithOtp({
        email: config.adminEmail,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      showMessage("Sign-in link sent. Open the email on this device and return here.", "success");
    } catch (error) {
      showMessage(error.message || "Could not send sign-in link.", "error");
    }
  }

  async function verifyAdmin() {
    if (demoMode) {
      demoInit();
      els.loginPanel.classList.add("hidden");
      els.adminContent.classList.remove("hidden");
      render();
      return;
    }
    const { data: { session } } = await db.auth.getSession();
    if (!session || session.user.email?.toLowerCase() !== config.adminEmail.toLowerCase()) {
      els.loginPanel.classList.remove("hidden");
      els.adminContent.classList.add("hidden");
      return;
    }
    els.loginPanel.classList.add("hidden");
    els.adminContent.classList.remove("hidden");
    await refresh();
  }

  async function refresh() {
    try {
      if (demoMode) {
        demoInit();
      } else {
        const { data: event, error: eventError } = await db.from("events").select("*")
          .eq("code", config.eventCode).single();
        if (eventError) throw eventError;
        state.event = event;
        const [fights, participants, picks] = await Promise.all([
          db.from("fights").select("*").eq("event_id", event.id).order("display_order"),
          db.from("participants").select("*").eq("event_id", event.id),
          db.from("picks").select("*").eq("event_id", event.id)
        ]);
        if (fights.error) throw fights.error;
        if (participants.error) throw participants.error;
        if (picks.error) throw picks.error;
        state.fights = fights.data;
        state.participants = participants.data;
        state.picks = picks.data;
      }
      render();
    } catch (error) {
      showMessage(error.message || "Could not load admin data.", "error");
    }
  }

  const actualResultOptions = f => [
    ["", "Select result"], ["fighter1", f.fighter1], ["fighter2", f.fighter2],
    ["draw","Draw"], ["no_contest","No Contest"]
  ];
  const actualMethodOptions = [
    ["","Select method"], ["ko_tko","KO/TKO"], ["submission","Submission"],
    ["decision","Decision"], ["disqualification","Disqualification"],
    ["technical_decision","Technical decision"], ["technical_draw","Technical draw"],
    ["no_contest","No contest"]
  ];
  const actualEndingOptions = f => {
    const x = [["","Select ending"],["r1","Round 1"],["r2","Round 2"],["r3","Round 3"]];
    if (f.max_rounds === 5) x.push(["r4","Round 4"],["r5","Round 5"]);
    x.push(["decision","Goes to decision"]);
    return x;
  };
  const leaderOptions = f => [
    ["","Select leader"],["fighter1",f.fighter1],["fighter2",f.fighter2],["tie","Tie"],["void","Void / unavailable"]
  ];
  function optionHtml(options, selected) {
    return options.map(([v,l]) => `<option value="${v}" ${v===selected?"selected":""}>${escapeHtml(l)}</option>`).join("");
  }

  function render() {
    els.adminFights.innerHTML = state.fights.map(f => {
      const savedCount = new Set(state.picks.filter(p => p.fight_id === f.id).map(p => p.participant_id)).size;
      return `<article class="admin-fight" data-admin-fight="${f.id}">
        <div class="admin-fight-head">
          <div>
            <h3>${f.display_order}. ${escapeHtml(f.fighter1)} vs. ${escapeHtml(f.fighter2)}</h3>
            <div class="muted small">${escapeHtml(f.weight_class)} · ${f.max_rounds} rounds · ${savedCount} saved entries · Status: ${f.status.replace("_"," ")}</div>
          </div>
          <button class="ghost" data-edit="${f.id}">Edit details</button>
        </div>
        <div class="admin-grid">
          <div class="field"><label>Official result</label><select data-field="actual_result">${optionHtml(actualResultOptions(f), f.actual_result)}</select></div>
          <div class="field"><label>Official method</label><select data-field="actual_method">${optionHtml(actualMethodOptions, f.actual_method)}</select></div>
          <div class="field"><label>Official ending</label><select data-field="actual_ending">${optionHtml(actualEndingOptions(f), f.actual_ending)}</select></div>
          <div class="field"><label>More takedowns</label><select data-field="actual_takedown_leader">${optionHtml(leaderOptions(f), f.actual_takedown_leader)}</select></div>
          <div class="field"><label>More significant strikes</label><select data-field="actual_strike_leader">${optionHtml(leaderOptions(f), f.actual_strike_leader)}</select></div>
        </div>
        <div class="admin-actions">
          <button class="primary" data-start="${f.id}" ${f.status !== "open" ? "disabled":""}>Start fight & reveal picks</button>
          <button class="secondary" data-result="${f.id}" ${f.status === "cancelled" ? "disabled":""}>Save result & complete</button>
          <button class="ghost" data-reopen="${f.id}">Reopen fight</button>
          <button class="danger" data-cancel="${f.id}">Cancel fight</button>
        </div>
      </article>`;
    }).join("");
  }

  function collectResult(fightId) {
    const card = document.querySelector(`[data-admin-fight="${CSS.escape(fightId)}"]`);
    const payload = {};
    card.querySelectorAll("[data-field]").forEach(el => payload[el.dataset.field] = el.value || null);
    return payload;
  }

  async function updateFight(fightId, changes) {
    if (demoMode) {
      const idx = state.fights.findIndex(f => f.id === fightId);
      state.fights[idx] = { ...state.fights[idx], ...changes };
      localStorage.setItem("freedom250_demo_fights", JSON.stringify(state.fights));
    } else {
      const { error } = await db.from("fights").update(changes).eq("id", fightId);
      if (error) throw error;
    }
    await refresh();
  }

  async function handleAction(event) {
    const edit = event.target.closest("[data-edit]");
    if (edit) return openModal(edit.dataset.edit);

    const start = event.target.closest("[data-start]");
    if (start) {
      try {
        await updateFight(start.dataset.start, { status:"in_progress", started_at:new Date().toISOString() });
        showMessage("Fight started. Picks are locked and visible.", "success");
      } catch (e) { showMessage(e.message, "error"); }
      return;
    }

    const result = event.target.closest("[data-result]");
    if (result) {
      const values = collectResult(result.dataset.result);
      if (!Object.values(values).every(Boolean)) return showMessage("Complete all five official result fields. Use Void if an official statistic is unavailable.", "error");
      try {
        await updateFight(result.dataset.result, { ...values, status:"completed", completed_at:new Date().toISOString() });
        showMessage("Official result saved and leaderboard updated.", "success");
      } catch (e) { showMessage(e.message, "error"); }
      return;
    }

    const reopen = event.target.closest("[data-reopen]");
    if (reopen) {
      if (!confirm("Reopen this fight? Participants will be able to change picks again.")) return;
      try {
        await updateFight(reopen.dataset.reopen, {
          status:"open", started_at:null, completed_at:null,
          actual_result:null, actual_method:null, actual_ending:null,
          actual_takedown_leader:null, actual_strike_leader:null
        });
        showMessage("Fight reopened.", "success");
      } catch (e) { showMessage(e.message, "error"); }
      return;
    }

    const cancel = event.target.closest("[data-cancel]");
    if (cancel) {
      if (!confirm("Cancel this fight? It will award no points.")) return;
      try {
        await updateFight(cancel.dataset.cancel, { status:"cancelled" });
        showMessage("Fight cancelled.", "success");
      } catch (e) { showMessage(e.message, "error"); }
    }
  }

  function openModal(id=null) {
    state.editingId = id;
    const f = id ? state.fights.find(x => x.id === id) : null;
    els.modalTitle.textContent = f ? "Edit fight" : "Add fight";
    els.modalF1.value = f?.fighter1 || "";
    els.modalF2.value = f?.fighter2 || "";
    els.modalWeight.value = f?.weight_class || "";
    els.modalRounds.value = String(f?.max_rounds || 3);
    els.modalOrder.value = String(f?.display_order || state.fights.length + 1);
    els.fightModal.classList.add("show");
  }
  function closeModal() { els.fightModal.classList.remove("show"); }

  async function saveModal() {
    const payload = {
      fighter1: els.modalF1.value.trim(),
      fighter2: els.modalF2.value.trim(),
      weight_class: els.modalWeight.value.trim(),
      max_rounds: Number(els.modalRounds.value),
      display_order: Number(els.modalOrder.value)
    };
    if (!payload.fighter1 || !payload.fighter2 || !payload.weight_class || !payload.display_order) {
      return showMessage("Complete every fight detail.", "error");
    }
    try {
      if (state.editingId) {
        await updateFight(state.editingId, payload);
      } else if (demoMode) {
        state.fights.push({
          ...payload, id:crypto.randomUUID(), event_id:state.event.id, status:"open",
          actual_result:null, actual_method:null, actual_ending:null,
          actual_takedown_leader:null, actual_strike_leader:null
        });
        state.fights.sort((a,b)=>a.display_order-b.display_order);
        localStorage.setItem("freedom250_demo_fights", JSON.stringify(state.fights));
        render();
      } else {
        const { error } = await db.from("fights").insert({ ...payload, event_id:state.event.id, status:"open" });
        if (error) throw error;
        await refresh();
      }
      closeModal();
      showMessage("Fight card updated.", "success");
    } catch (e) { showMessage(e.message, "error"); }
  }

  function csvCell(v) {
    const s = String(v ?? "");
    return `"${s.replaceAll('"','""')}"`;
  }
  function exportCsv() {
    const header = ["Display Name","Fight","Result Pick","Method Pick","Ending Pick","Takedown Pick","Strike Pick","Fight Status"];
    const lines = [header.map(csvCell).join(",")];
    state.picks.forEach(p => {
      const participant = state.participants.find(x => x.id === p.participant_id);
      const fight = state.fights.find(x => x.id === p.fight_id);
      lines.push([
        participant?.display_name, `${fight?.fighter1} vs ${fight?.fighter2}`,
        p.result_pick, p.method_pick, p.ending_pick, p.takedown_pick, p.strike_pick, fight?.status
      ].map(csvCell).join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `freedom250-picks-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  els.adminEmail.value = config.adminEmail;
  els.loginBtn.addEventListener("click", () => demoMode ? verifyAdmin() : sendMagicLink());
  els.refreshBtn.addEventListener("click", refresh);
  els.addFightBtn.addEventListener("click", () => openModal());
  els.exportBtn.addEventListener("click", exportCsv);
  els.signOutBtn.addEventListener("click", async () => {
    if (!demoMode) await db.auth.signOut();
    location.reload();
  });
  els.adminFights.addEventListener("click", handleAction);
  els.modalCancel.addEventListener("click", closeModal);
  els.modalSave.addEventListener("click", saveModal);
  els.fightModal.addEventListener("click", e => { if (e.target === els.fightModal) closeModal(); });

  if (demoMode) {
    els.modeNotice.innerHTML = `<strong>Preview mode:</strong> admin actions affect only this browser. Complete Supabase setup to manage the shared live pool.`;
    els.modeNotice.classList.add("show");
    els.loginBtn.textContent = "Open preview admin";
  }
  verifyAdmin();
})();
