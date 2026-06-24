/**
 * tests/form.test.js — Tes otomatis form pendaftaran Workshop Claude Code
 *
 * Cara jalankan: inject via browser console atau preview eval.
 * Tidak butuh library eksternal — runner mini sudah built-in di bawah.
 */

(function runSuite() {

  /* ════════════════════════════════════════
     MINI TEST RUNNER
  ════════════════════════════════════════ */
  const hasil = [];

  function test(nama, fn) {
    try {
      fn();
      hasil.push({ status: 'LULUS', nama });
    } catch (e) {
      hasil.push({ status: 'GAGAL', nama, alasan: e.message });
    }
  }

  function assert(kondisi, pesan) {
    if (!kondisi) throw new Error(pesan || 'Assertion gagal');
  }

  function assertSama(aktual, harapan, pesan) {
    if (aktual !== harapan)
      throw new Error(pesan || `Harapan: "${harapan}", aktual: "${aktual}"`);
  }

  /* ════════════════════════════════════════
     HELPER
  ════════════════════════════════════════ */
  function el(id) { return document.getElementById(id); }

  function resetForm() {
    el('nama').value  = '';
    el('email').value = '';
    ['nama', 'email'].forEach(id => el(id).classList.remove('invalid'));
    document.querySelectorAll('.field-err').forEach(e => e.textContent = '');
    // Tutup modal jika terbuka
    const bg = el('modalBg');
    if (bg.classList.contains('active')) {
      bg.classList.remove('active');
      document.body.style.overflow = '';
    }
    // Reset qty ke 1 lewat fungsi JS bawaan halaman
    el('tiket').value = 1;
    if (typeof perbaruiTotal === 'function') perbaruiTotal();
  }

  function blur(elInput) {
    elInput.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function submit() {
    el('registrationForm').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
  }

  function modalTerbuka() {
    return el('modalBg').classList.contains('active');
  }

  /* ════════════════════════════════════════
     SKENARIO 1 — FIELD KOSONG
  ════════════════════════════════════════ */

  test('1a. Nama kosong → error muncul, modal tidak terbuka', () => {
    resetForm();
    el('email').value = 'budi@test.com';
    // nama dibiarkan kosong
    submit();

    assert(
      el('err-nama').textContent.trim().length > 0,
      'Pesan error nama harus muncul saat nama kosong'
    );
    assert(!modalTerbuka(), 'Modal tidak boleh muncul saat nama kosong');
  });

  test('1b. Email kosong → error muncul, modal tidak terbuka', () => {
    resetForm();
    el('nama').value = 'Budi Santoso';
    // email dibiarkan kosong
    submit();

    assert(
      el('err-email').textContent.trim().length > 0,
      'Pesan error email harus muncul saat email kosong'
    );
    assert(!modalTerbuka(), 'Modal tidak boleh muncul saat email kosong');
  });

  test('1c. Nama & Email sama-sama kosong → dua error muncul sekaligus', () => {
    resetForm();
    submit();

    assert(el('err-nama').textContent.trim().length > 0,  'Error nama harus muncul');
    assert(el('err-email').textContent.trim().length > 0, 'Error email harus muncul');
    assert(!modalTerbuka(), 'Modal tidak boleh muncul');
  });

  /* ════════════════════════════════════════
     SKENARIO 2 — PERHITUNGAN TOTAL HARGA
  ════════════════════════════════════════ */

  test('2. Tiket = 2 → total Rp 100.000, label qty menampilkan "2"', () => {
    resetForm();
    el('btnPlus').click(); // 1 → 2

    const qty       = parseInt(el('tiket').value);
    const totalTeks = el('totalHarga').textContent.trim();
    const labelTeks = el('totalQtyLabel').textContent.trim();

    assertSama(qty, 2, `Jumlah tiket harus 2, dapat: ${qty}`);
    assert(
      totalTeks.includes('100.000') || totalTeks.includes('100000'),
      `Total harus Rp 100.000, dapat: "${totalTeks}"`
    );
    assert(labelTeks.includes('2'), `Label harus ada angka "2", dapat: "${labelTeks}"`);
  });

  /* ════════════════════════════════════════
     SKENARIO 3 — FORMAT EMAIL SALAH
  ════════════════════════════════════════ */

  test('3a. Email "abc" → pesan error format tampil, field ditandai invalid', () => {
    resetForm();
    const inp = el('email');
    inp.value = 'abc';
    blur(inp);

    const err   = el('err-email').textContent.trim();
    const lower = err.toLowerCase();

    assert(err.length > 0, 'Harus ada pesan error untuk "abc"');
    assert(
      lower.includes('format') || lower.includes('valid') || lower.includes('email'),
      `Pesan error harus deskriptif, dapat: "${err}"`
    );
    assert(inp.classList.contains('invalid'), 'Field email harus mendapat class "invalid"');
  });

  test('3b. Email "user@" → pesan error format tampil', () => {
    resetForm();
    const inp = el('email');
    inp.value = 'user@';
    blur(inp);

    assert(
      el('err-email').textContent.trim().length > 0,
      'Harus ada pesan error untuk "user@"'
    );
    assert(inp.classList.contains('invalid'), 'Field harus ditandai invalid');
  });

  test('3c. Email valid "test@mail.com" → tidak ada error', () => {
    resetForm();
    const inp = el('email');
    inp.value = 'test@mail.com';
    blur(inp);

    assertSama(
      el('err-email').textContent.trim(), '',
      'Email valid tidak boleh menghasilkan error'
    );
    assert(!inp.classList.contains('invalid'), 'Field email valid tidak boleh "invalid"');
  });

  /* ════════════════════════════════════════
     SKENARIO 4 — SEMUA DATA BENAR
  ════════════════════════════════════════ */

  test('4. Semua data benar → modal konfirmasi muncul dengan ringkasan lengkap', () => {
    resetForm();
    el('nama').value  = 'Siti Rahayu';
    el('email').value = 'siti@example.com';
    el('tiket').value = 1;
    if (typeof perbaruiTotal === 'function') perbaruiTotal();
    submit();

    assert(modalTerbuka(), 'Modal konfirmasi harus muncul setelah data diisi lengkap');

    const pesanTeks  = el('modalMsg').textContent;
    const detailHTML = el('modalDetail').innerHTML;

    assert(
      pesanTeks.includes('Siti Rahayu'),
      `Nama harus tampil di modal, dapat: "${pesanTeks}"`
    );
    assert(
      detailHTML.includes('siti@example.com'),
      'Email harus tampil di ringkasan modal'
    );
    assert(
      detailHTML.includes('50.000') || detailHTML.includes('50000'),
      'Total harga harus tampil di ringkasan modal'
    );
  });

  /* ════════════════════════════════════════
     LAPORAN HASIL
  ════════════════════════════════════════ */
  const lulus = hasil.filter(h => h.status === 'LULUS').length;
  const gagal = hasil.filter(h => h.status === 'GAGAL').length;

  return { total: hasil.length, lulus, gagal, hasil };

})();
