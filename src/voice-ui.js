"use strict";
(() => {
  let stream, context, processor, source, chunks = [], samples = 0, stopTimer;
  let phase = "idle", generation = 0, plan = null, reviewedRevision;
  const status = (message) => { $("voice-status").textContent = message; };
  const statusName = (value) => t({ todo: "To-do", doing: "Doing", done: "Done" }[value]);
  function button() {
    $("voice-record").dataset.recording = String(phase === "recording");
    const key = phase === "recording" ? "Stop recording" : phase === "preparing" ? "Cancel download / loading" : phase === "transcribing" ? "Cancel recognition" : "Start recording";
    $("voice-record").dataset.t = key;
    $("voice-record").textContent = t(key);
  }
  async function release() {
    clearTimeout(stopTimer);
    if (processor) { processor.onaudioprocess = null; processor.disconnect(); }
    source?.disconnect();
    stream?.getTracks().forEach((track) => track.stop());
    const previous = context;
    processor = source = stream = context = null;
    if (previous && previous.state !== "closed") await previous.close();
  }
  function invalidate() {
    plan = null;
    $("voice-preview").textContent = "";
    $("voice-apply").hidden = true;
  }
  async function cancel() {
    generation++;
    await release();
    chunks = []; samples = 0;
    phase = "idle";
    button();
    await window.desktop.cancelVoice();
  }
  window.desktop.onVoiceProgress((progress) => {
    if (phase !== "preparing") return;
    status(progress.status === "progress"
      ? t("Downloading model") + ` · ${Math.round(progress.progress || 0)}%`
      : t("Loading local voice model…"));
  });
  $("voice-button").onclick = () => {
    $("voice-language").value = language();
    $("voice-action").value = "auto";
    status(""); invalidate();
    $("voice-dialog").showModal();
    button();
  };
  $("voice-dialog").addEventListener("close", () => { cancel().catch(() => {}); });
  $("voice-transcript").oninput = invalidate;
  async function stopRecording() {
    if (phase !== "recording") return;
    const current = generation;
    phase = "transcribing";
    button(); status(t("Recognizing on this computer…"));
    await release();
    const audio = new Float32Array(samples);
    let offset = 0;
    for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }
    chunks = []; samples = 0;
    try {
      // Avoid Whisper hallucinations on empty or near-silent recordings.
      const energy = Math.sqrt(audio.reduce((sum, x) => sum + x * x, 0) / Math.max(1, audio.length));
      if (audio.length < 1600 || energy < .001) throw new Error("No speech detected. Try again or type a command.");
      const transcript = await window.desktop.transcribeVoice(audio, $("voice-language").value);
      if (generation !== current) return;
      $("voice-transcript").value = transcript;
      status(t(transcript ? "Review the transcript before applying." : "No speech detected. Try again or type a command."));
      if (transcript) review();
    } catch (error) {
      if (generation === current) status(t("Voice unavailable") + ": " + errorText(error));
    } finally {
      if (generation === current) { phase = "idle"; button(); }
    }
  }
  $("voice-record").onclick = async () => {
    if (phase === "recording") return stopRecording();
    if (phase !== "idle") { await cancel(); status(t("Cancelled")); return; }
    const current = ++generation;
    phase = "preparing"; button(); invalidate();
    status(t("Loading local voice model…"));
    try {
      await window.desktop.prepareVoice();
      if (current !== generation) return;
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      if (current !== generation) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream = acquired;
      context = new AudioContext({ sampleRate: 16000 });
      await context.resume();
      if (context.sampleRate !== 16000) throw new Error("This microphone cannot record at 16 kHz. Type a command instead.");
      source = context.createMediaStreamSource(stream);
      processor = context.createScriptProcessor(4096, 1, 1);
      chunks = []; samples = 0;
      processor.onaudioprocess = (event) => {
        if (phase !== "recording") return;
        const channel = event.inputBuffer.getChannelData(0);
        const take = Math.min(channel.length, 16000 * 30 - samples);
        if (take > 0) { chunks.push(channel.slice(0, take)); samples += take; }
        if (samples >= 16000 * 30) stopRecording();
      };
      source.connect(processor);
      processor.connect(context.destination); // Output buffer stays silent; microphone is never monitored.
      phase = "recording"; button();
      status(t("Listening… Click Stop when finished (30 seconds max)."));
      stopTimer = setTimeout(stopRecording, 30000);
    } catch (error) {
      if (current !== generation) return;
      await release(); phase = "idle"; button();
      status(t("Voice unavailable") + ": " + errorText(error) + " " + t("You can still type a command below."));
    }
  };
  function review() {
    invalidate();
    plan = window.PebbleCommands.parse($("voice-transcript").value, state, new Date(), $("voice-action").value);
    reviewedRevision = state.revision;
    const preview = $("voice-preview");
    if (plan.kind === "error") { preview.textContent = t(plan.message); return; }
    if (plan.kind === "add") {
      preview.innerHTML = `<strong>${esc(t("Add to {status}", { status: statusName(plan.values.status) }))}</strong><p>${esc(plan.values.title)}<br>${esc(scheduleLabel(plan.values))}</p><label>${esc(t("Category"))}<select id="voice-category"></select></label><button type="button" id="voice-edit" class="text-button">${esc(t("Edit task"))}</button>`;
      fillSelect("voice-category", plan.values.categoryId);
      // New categories are managed in the normal task editor.
      preview.querySelector('option[value="__new"]').remove();
      $("voice-edit").onclick = () => {
        const values = { ...plan.values, categoryId: $("voice-category").value };
        $("voice-dialog").close(); openTask(values);
      };
      $("voice-apply").hidden = false;
    } else if (!plan.candidates.length) {
      preview.textContent = plan.already ? t("Matching tasks are already in {status}.", { status: statusName(plan.status) }) : t("No matching task found. No task will be added.");
    } else {
      const prompt = plan.status === "done" ? (plan.candidates.length > 1 ? "Choose the task you finished." : "Confirm the task you finished.") : (plan.candidates.length > 1 ? "Choose the task to update." : "Confirm the task to update.");
      preview.innerHTML = `<strong>${esc(t("Move to {status}", { status: statusName(plan.status) }))}</strong><p>${esc(t(prompt))}</p>` + plan.candidates.map((candidate) => {
        const task = state.tasks.find((item) => item.id === candidate.id);
        const category = state.categories.find((item) => item.id === task.categoryId);
        return `<label><input type="radio" name="voice-target" value="${esc(candidate.id)}" ${plan.candidates.length === 1 ? "checked" : ""}/><span>${esc(candidate.title)}<br><small>${esc([statusName(candidate.status), category ? categoryLabel(category) : t("Uncategorized"), scheduleLabel(task)].filter(Boolean).join(" · "))}</small></span></label>`;
      }).join("");
      $("voice-apply").hidden = false;
    }
  }
  $("voice-review").onclick = review;
  $("voice-action").onchange = () => { if ($("voice-transcript").value.trim()) review(); else invalidate(); };
  $("voice-apply").onclick = async () => {
    if (!plan || busy) return;
    if (reviewedRevision !== state.revision) { review(); status(t("The list changed. Review the latest tasks and try again.")); return; }
    const next = clone(state);
    if (plan.kind === "add") next.tasks.push(D.makeTask({ ...plan.values, categoryId: $("voice-category").value }));
    else if (["complete", "move"].includes(plan.kind)) {
      const id = document.querySelector('input[name="voice-target"]:checked')?.value;
      if (!id) return status(t(plan.status === "done" ? "Choose the task you finished." : "Choose the task to update."));
      const task = next.tasks.find((item) => item.id === id && item.status !== plan.status);
      if (!task) return review();
      task.status = plan.status; task.completedAt = plan.status === "done" ? new Date().toISOString() : null;
    } else return;
    const previousTab = activeTab;
    activeTab = plan.kind === "add" ? plan.values.status : plan.status;
    filter = "all";
    if (await commit(next, plan.kind === "add" ? "Task added" : { todo: "Moved to To-do", doing: "Moved to Doing", done: "Marked complete" }[plan.status], true)) {
      $("voice-transcript").value = ""; $("voice-dialog").close();
    } else { activeTab = previousTab; render(); }
  };
})();
