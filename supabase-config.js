const SUPABASE_URL = "https://jirqwpxzxelvvtisociv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_u1zxVdawLgmZuc2lM1J1Lw_5M3fvnwM";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

window.supabaseLive = {
  async request(path, data) {
    if (path === "/api/session/create") {
      const token = String(Math.floor(100000 + Math.random() * 900000));
      const { data: session, error } = await supabaseClient.from("live_sessions").insert({
        token, title: data.title, criterion_id: data.criterionId, host_name: data.host, current_question: 0
      }).select().single();
      if (error) throw error;
      return this.session(session);
    }
    if (path === "/api/session/join") {
      const { data: session, error } = await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("token", data.token).single();
      if (error || !session) throw new Error("Token tidak ditemukan atau sesi sudah berakhir.");
      const { data: participant, error: participantError } = await supabaseClient.from("live_participants").upsert({
        session_id: session.id, name: data.name, avatar: data.avatar || "🦺"
      }, { onConflict: "session_id,name" }).select().single();
      if (participantError) throw participantError;
      return { session: this.session(session), participant: this.participant(participant) };
    }
    const { data: session, error } = await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("token", data.token).single();
    if (error || !session) throw new Error("Sesi tidak ditemukan.");
    if (path === "/api/session/status") return this.session(session);
    if (path === "/api/session/start") {
      const result = await supabaseClient.from("live_sessions").update({ status: "live", started_at: new Date().toISOString(), current_question: 0 }).eq("id", session.id).select().single();
      if (result.error) throw result.error;
      return this.session({ ...result.data, live_participants: session.live_participants || [] });
    }
    if (path === "/api/session/next") {
      const result = await supabaseClient.from("live_sessions").update({ current_question: Number(session.current_question || 0) + 1 }).eq("id", session.id).select().single();
      if (result.error) throw result.error;
      await supabaseClient.from("live_participants").update({ answered: false }).eq("session_id", session.id);
      const refreshed = await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("id", session.id).single();
      if (refreshed.error || !refreshed.data) throw refreshed.error || new Error("Soal berikutnya gagal dimuat.");
      return this.session(refreshed.data);
    }
    if (path === "/api/session/answer") {
      const participant = session.live_participants.find(item => item.id === data.participantId);
      if (!participant) throw new Error("Peserta tidak ditemukan.");
      if (Number(participant.answered_question) === Number(data.questionIndex)) return this.session(session);
      const result = await supabaseClient.from("live_participants").update({ answered: true, answered_question: data.questionIndex, correct: data.correct, score: Number(participant.score || 0) + Number(data.points || 0) }).eq("id", data.participantId);
      if (result.error) throw result.error;
    }
    const refreshed = await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("id", session.id).single();
    if (refreshed.error || !refreshed.data) throw refreshed.error || new Error("Sesi tidak dapat diperbarui.");
    return this.session(refreshed.data);
  },
  participant(row) { return { id: row.id, name: row.name, avatar: row.avatar || "🦺", score: row.score || 0, answered: row.answered || false, answeredQuestion: row.answered_question ?? -1 }; },
  session(row) { return { token: row.token, title: row.title, criterionId: row.criterion_id, host: row.host_name, status: row.status, currentQuestion: row.current_question || 0, startedAt: row.started_at, joinUrl: `${location.origin}${location.pathname}?join=${row.token}`, participants: (row.live_participants || []).map(this.participant) }; }
};
