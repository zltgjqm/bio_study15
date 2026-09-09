// Biology Second Brain — login + role gate
(function () {
  function client() {
    if (!window.BiologySupabase || !window.BiologySupabase.client) {
      throw new Error("Supabase client가 준비되지 않았습니다.");
    }
    return window.BiologySupabase.client;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  }

  function roleLabel(role) {
    return ({ owner: "Owner", member: "Member", viewer: "Viewer", pending: "Pending", blocked: "Blocked" }[role] || role || "Unknown");
  }

  function isApprovedRole(role) {
    return ["owner", "member", "viewer"].includes(role);
  }

  function renderShell({ title, subtitle, body, basePath = "" }) {
    document.body.innerHTML = `
      <main class="auth-page">
        <section class="auth-card">
          <div class="brand auth-brand"><span class="mark"></span><span>Biology Second Brain</span></div>
          <p class="hero-eyebrow">Supabase Auth · Role Gate</p>
          <h1>${title}</h1>
          <p class="detail-sub">${subtitle}</p>
          ${body}
          <div class="auth-help">
            <a href="${basePath}index.html">Home</a>
            <span>·</span>
            <span>Owner가 승인한 계정만 사용할 수 있어요.</span>
          </div>
        </section>
      </main>`;
  }

  function renderLogin(basePath = "") {
    renderShell({
      basePath,
      title: "로그인이 필요해요",
      subtitle: "허용된 사용자만 논문 Library에 접근할 수 있습니다. 처음 가입한 계정은 Owner 승인 전까지 pending 상태입니다.",
      body: `
        <form id="auth-form" class="auth-form">
          <label>Email</label>
          <input id="auth-email" type="email" placeholder="you@example.com" autocomplete="email" required />
          <label>Password</label>
          <input id="auth-password" type="password" placeholder="password" autocomplete="current-password" required />
          <div class="action-row auth-actions">
            <button class="btn" type="submit">Login</button>
            <button class="btn secondary" type="button" id="auth-signup">Sign up / 승인 요청</button>
          </div>
          <button class="btn secondary wide" type="button" id="auth-magic">이메일 Magic Link 받기</button>
          <p id="auth-status" class="status"></p>
        </form>`
    });

    const form = document.getElementById("auth-form");
    const emailEl = document.getElementById("auth-email");
    const passwordEl = document.getElementById("auth-password");
    const statusEl = document.getElementById("auth-status");
    const setStatus = (msg) => { statusEl.textContent = msg; };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setStatus("로그인 중...");
      const { error } = await client().auth.signInWithPassword({ email: emailEl.value.trim(), password: passwordEl.value });
      if (error) { setStatus("로그인 실패: " + error.message); return; }
      location.reload();
    });

    document.getElementById("auth-signup").addEventListener("click", async () => {
      setStatus("가입 요청 중...");
      const { error } = await client().auth.signUp({ email: emailEl.value.trim(), password: passwordEl.value });
      if (error) { setStatus("가입 실패: " + error.message); return; }
      setStatus("가입 요청 완료. 이메일 확인이 필요할 수 있고, Owner 승인 전까지 pending 상태입니다.");
    });

    document.getElementById("auth-magic").addEventListener("click", async () => {
      const email = emailEl.value.trim();
      if (!email) { setStatus("이메일을 먼저 입력해주세요."); return; }
      setStatus("Magic Link 발송 중...");
      const { error } = await client().auth.signInWithOtp({ email });
      if (error) { setStatus("발송 실패: " + error.message); return; }
      setStatus("메일함에서 Magic Link를 확인해주세요.");
    });
  }

  function renderPending(profile, basePath = "") {
    const role = profile?.role || "pending";
    const isBlocked = role === "blocked";
    renderShell({
      basePath,
      title: isBlocked ? "접근 권한이 없습니다" : "관리자 승인 대기 중입니다",
      subtitle: isBlocked ? "이 계정은 차단되어 Biology Second Brain을 사용할 수 없습니다." : "로그인은 되었지만 아직 Owner가 계정을 승인하지 않았어요.",
      body: `
        <div class="side-box auth-status-box">
          <h3>Current account</h3>
          <div class="row"><span>Email</span><span>${escapeHtml(profile?.email || "-")}</span></div>
          <div class="row"><span>Role</span><span class="role-badge ${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</span></div>
        </div>
        <div class="action-row auth-actions">
          <button class="btn secondary" id="auth-logout">Logout</button>
        </div>`
    });
    document.getElementById("auth-logout").addEventListener("click", async () => {
      await client().auth.signOut();
      location.reload();
    });
  }

  function renderSetupError(message, basePath = "") {
    renderShell({
      basePath,
      title: "Supabase 설정을 확인해주세요",
      subtitle: "로그인은 되었지만 profile 정보를 읽지 못했습니다. setup.sql을 실행했는지 확인해주세요.",
      body: `<div class="side-box"><h3>Error</h3><p class="detail-sub">${escapeHtml(message)}</p></div><button class="btn secondary" id="auth-logout">Logout</button>`
    });
    document.getElementById("auth-logout").addEventListener("click", async () => {
      await client().auth.signOut();
      location.reload();
    });
  }

  async function getProfile(userId) {
    const { data, error } = await client().from("profiles").select("id,email,role,created_at,updated_at").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  function applyRoleVisibility(auth) {
    document.querySelectorAll("[data-owner-only]").forEach((el) => { el.style.display = auth.isOwner ? "" : "none"; });
    document.querySelectorAll("[data-member-plus]").forEach((el) => { el.style.display = (auth.isOwner || auth.isMember) ? "" : "none"; });
    document.querySelectorAll("[data-viewer-hide]").forEach((el) => { el.style.display = auth.isViewer ? "none" : ""; });
  }

  function mountUserBar(auth) {
    const nav = document.querySelector(".top-links");
    if (!nav || document.getElementById("auth-userbar")) return;
    const wrap = document.createElement("span");
    wrap.id = "auth-userbar";
    wrap.className = "userbar";
    wrap.innerHTML = `
      <span class="role-badge ${escapeHtml(auth.profile.role)}">${escapeHtml(roleLabel(auth.profile.role))}</span>
      <span class="user-email">${escapeHtml(auth.user.email || "")}</span>
      <button class="link-button" type="button" id="auth-logout-inline">Logout</button>`;
    nav.appendChild(wrap);
    document.getElementById("auth-logout-inline").addEventListener("click", async () => {
      await client().auth.signOut();
      location.href = auth.basePath + "index.html";
    });
  }

  async function requireAuth(options = {}) {
    const basePath = options.basePath || "";
    const supabase = client();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      renderSetupError(sessionError.message, basePath);
      return null;
    }
    const session = sessionData?.session;
    if (!session?.user) {
      renderLogin(basePath);
      return null;
    }

    let profile;
    try {
      profile = await getProfile(session.user.id);
    } catch (error) {
      renderSetupError(error.message, basePath);
      return null;
    }

    if (!profile) {
      renderSetupError("profiles row가 없습니다. setup.sql의 handle_new_user trigger를 확인하거나 다시 로그인해주세요.", basePath);
      return null;
    }

    if (!isApprovedRole(profile.role)) {
      renderPending(profile, basePath);
      return null;
    }

    const auth = {
      basePath,
      supabase,
      session,
      user: session.user,
      profile,
      role: profile.role,
      isOwner: profile.role === "owner",
      isMember: profile.role === "member",
      isViewer: profile.role === "viewer",
      canAddPaper: ["owner", "member"].includes(profile.role),
      canAddKnowledge: profile.role === "owner",
      canManageUsers: profile.role === "owner",
    };
    mountUserBar(auth);
    applyRoleVisibility(auth);
    return auth;
  }

  function canEditPaper(auth, paper) {
    if (!auth || !paper) return false;
    if (auth.isOwner) return true;
    return auth.isMember && String(paper.ownerId) === String(auth.user.id);
  }
  function canDeletePaper(auth) { return !!auth?.isOwner; }
  function canEditKnowledge(auth) { return !!auth?.isOwner; }

  window.AuthGate = { requireAuth, getProfile, roleLabel, canEditPaper, canDeletePaper, canEditKnowledge, escapeHtml };
})();
