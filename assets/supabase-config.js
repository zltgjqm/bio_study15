// Biology Second Brain — Supabase client config
// anon key는 브라우저에 노출되는 public key입니다. service_role key는 절대 여기에 넣지 마세요.
(function () {
  const SUPABASE_URL = "https://lrtfgjbtmmyhplqvytwo.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxydGZnamJ0bW15aHBscXZ5dHdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyODYwMTQsImV4cCI6MjA5ODg2MjAxNH0.CRpl6d_swkff6nqAmioGdssnXs3Y3FW6MEr79xKHSQo";

  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase JS library가 로드되지 않았습니다. CDN script 순서를 확인하세요.");
    return;
  }

  window.BiologySupabase = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    client: window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
  };
})();
