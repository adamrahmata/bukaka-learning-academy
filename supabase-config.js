const SUPABASE_URL = "https://jirqwpxzxelvvtisociv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_u1zxVdawLgmZuc2lM1J1Lw_5M3fvnwM";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

window.supabaseLive = {
  async request(path, data) {
    if (path === "/api/session/create") {
      const token = String(Math.floor(100000 + Math.random() * 900000));
      const { data: session, error } = await supabaseClient.from("live_sessions").insert({
        token, title: data.title, criterion_id: data.criterionId, host_name: data.host
      }).select().single();
      if (error) throw error;
      return this.session(session);
    }
    if (path === "/api/session/join") {
      const { data: session, error } = await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("token", data.token).single();
      if (error || !session) throw new Error("Token tidak ditemukan atau sesi sudah berakhir.");
      const { data: participant, error: participantError } = await supabaseClient.from("live_participants").upsert({
        session_id: session.id, name: data.name
      }, { onConflict: "session_id,name" }).select().single();
      if (participantError) throw participantError;
      return { session: this.session(session), participant: this.participant(participant) };
    }
    const { data: session, error } = await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("token", data.token).single();
    if (error || !session) throw new Error("Sesi tidak ditemukan.");
    if (path === "/api/session/start") {
      const result = await supabaseClient.from("live_sessions").update({ status: "live", started_at: new Date().toISOString() }).eq("id", session.id);
      if (result.error) throw result.error;
    }
    if (path === "/api/session/answer") {
      const result = await supabaseClient.from("live_participants").update({ answered: true, correct: data.correct, score: data.points }).eq("id", data.participantId);
      if (result.error) throw result.error;
    }
    return this.session((await supabaseClient.from("live_sessions").select("*,live_participants(*)").eq("id", session.id).single()).data);
  },
  participant(row) { return { id: row.id, name: row.name, score: row.score || 0, answered: row.answered || false }; },
  session(row) { return { token: row.token, title: row.title, criterionId: row.criterion_id, host: row.host_name, status: row.status, startedAt: row.started_at, joinUrl: `${location.origin}${location.pathname}?join=${row.token}`, participants: (row.live_participants || []).map(this.participant) }; }
};
