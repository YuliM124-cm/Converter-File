/**
 * Mengelola login/logout tim lewat Supabase Auth (email + password).
 *
 * Mengekspos:
 *   window.akuntanAuth.getAccessToken()  -> Promise<string|null>
 *   window.akuntanAuth.getUserEmail()    -> string|null (setelah sesi dimuat)
 *
 * Catatan: Supabase SDK menyimpan sesi login di browser (localStorage milik
 * domain Supabase Anda) — ini bagian normal dari cara kerja Supabase Auth,
 * bukan penyimpanan data transaksi keuangan.
 */
(function () {
  const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

  const loginScreen = document.getElementById('login-screen');
  const appRoot = document.getElementById('app-root');
  const loginForm = document.getElementById('login-form');
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  const loginStatus = document.getElementById('login-status');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const userEmailEl = document.getElementById('user-email');
  const logoutBtn = document.getElementById('logout-btn');

  let currentSession = null;

  function showApp(session) {
    currentSession = session;
    loginScreen.hidden = true;
    appRoot.hidden = false;
    if (userEmailEl) userEmailEl.textContent = session.user.email;
  }

  function showLogin() {
    currentSession = null;
    appRoot.hidden = true;
    loginScreen.hidden = false;
  }

  // Cek sesi yang sudah ada saat halaman dimuat (mis. setelah refresh)
  client.auth.getSession().then(({ data }) => {
    if (data.session) showApp(data.session);
    else showLogin();
  });

  // Pantau perubahan status login (login/logout/refresh token)
  client.auth.onAuthStateChange((_event, session) => {
    if (session) showApp(session);
    else showLogin();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginSubmitBtn.disabled = true;
    loginStatus.textContent = 'Memeriksa kredensial…';
    loginStatus.className = 'status status--info';

    const emailVal = loginEmail.value.trim();
    const passwordVal = loginPassword.value;

    // Timeout pengaman: kalau signInWithPassword macet > 8 detik, tampilkan pesan
    // diagnostik di layar alih-alih membiarkan layar diam tanpa keterangan.
    const withTimeout = (promise, ms) =>
      Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT_DIAGNOSTIK: proses macet lebih dari ' + ms + 'ms (kemungkinan terkunci secara internal oleh klien Supabase).')), ms)
        ),
      ]);

    try {
      const { data, error } = await withTimeout(
        client.auth.signInWithPassword({ email: emailVal, password: passwordVal }),
        8000
      );

      if (error) {
        loginStatus.textContent = 'DIAGNOSTIK — error dari signInWithPassword: ' + (error.message || JSON.stringify(error));
        loginStatus.className = 'status status--error';
        loginSubmitBtn.disabled = false;
        return;
      }

      if (!data || !data.session) {
        loginStatus.textContent = 'DIAGNOSTIK — sukses tapi data.session kosong: ' + JSON.stringify(data);
        loginStatus.className = 'status status--error';
        loginSubmitBtn.disabled = false;
        return;
      }

      loginStatus.textContent = '';
      loginPassword.value = '';
      showApp(data.session);
      loginSubmitBtn.disabled = false;
    } catch (err) {
      loginStatus.textContent = 'DIAGNOSTIK — exception tertangkap: ' + (err && err.message ? err.message : String(err));
      loginStatus.className = 'status status--error';
      loginSubmitBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    showLogin();
  });

  window.akuntanAuth = {
    async getAccessToken() {
      const { data } = await client.auth.getSession();
      return data.session ? data.session.access_token : null;
    },
    getUserEmail() {
      return currentSession ? currentSession.user.email : null;
    },
  };
})();
