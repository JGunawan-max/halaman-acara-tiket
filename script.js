/*
  script.js  —  Logika interaktif Workshop Claude Code 2026
  Bagian:
    1. Konfigurasi
    2. Referensi elemen DOM
    3. Navbar (efek scroll)
    4. Kontrol jumlah tiket & total harga
    5. Validasi form
    6. Submit form
    7. Modal (buka / tutup)
    8. Animasi muncul saat scroll (Intersection Observer)
    9. Inisialisasi
*/

/* ─── 1. KONFIGURASI ──────────────────────────────────────── */
const HARGA_PER_TIKET = 50000;
const MAKS_TIKET      = 5;

/* ─── 2. REFERENSI ELEMEN DOM ─────────────────────────────── */
const nav         = document.getElementById('nav');
const form        = document.getElementById('registrationForm');
const inputNama   = document.getElementById('nama');
const inputEmail  = document.getElementById('email');
const inputTiket  = document.getElementById('tiket');
const btnMinus    = document.getElementById('btnMinus');
const btnPlus     = document.getElementById('btnPlus');
const elTotal     = document.getElementById('totalHarga');
const elQtyLabel  = document.getElementById('totalQtyLabel');
const modalBg     = document.getElementById('modalBg');
const elModalMsg  = document.getElementById('modalMsg');
const elModalDetail = document.getElementById('modalDetail');
const btnModalX   = document.getElementById('modalX');
const btnModalOk  = document.getElementById('modalOk');

/* ─── 3. NAVBAR ───────────────────────────────────────────── */
// Tambah class "scrolled" agar navbar punya background saat di-scroll
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ─── 4. JUMLAH TIKET & TOTAL HARGA ──────────────────────── */
function jumlahTiket() {
  return parseInt(inputTiket.value) || 1;
}

function formatRupiah(angka) {
  return 'Rp ' + angka.toLocaleString('id-ID');
}

function perbaruiTotal() {
  const qty = jumlahTiket();
  elTotal.textContent    = formatRupiah(qty * HARGA_PER_TIKET);
  elQtyLabel.textContent = `${qty} tiket × ${formatRupiah(HARGA_PER_TIKET)}`;
  // Nonaktifkan tombol di batas minimum dan maksimum
  btnMinus.disabled = qty <= 1;
  btnPlus.disabled  = qty >= MAKS_TIKET;
}

// Satu fungsi untuk naik (+1) dan turun (-1), menggantikan dua handler yang hampir identis
function ubahTiket(delta) {
  const baru = jumlahTiket() + delta;
  if (baru < 1 || baru > MAKS_TIKET) return;
  inputTiket.value = baru;
  perbaruiTotal();
  animasiAngka();
}
btnMinus.addEventListener('click', () => ubahTiket(-1));
btnPlus.addEventListener('click',  () => ubahTiket(+1));

// Efek "memantul" pada angka tiket saat berubah
function animasiAngka() {
  inputTiket.style.transform = 'scale(1.25)';
  inputTiket.style.color     = '#7c3aed';
  setTimeout(() => {
    inputTiket.style.transform = '';
    inputTiket.style.color     = '';
  }, 180);
}

/* ─── 5. VALIDASI FORM ────────────────────────────────────── */
// Aturan validasi per field: setiap aturan punya fungsi cek (ok) dan pesan error (msg)
const aturanValidasi = {
  nama: [
    { ok: v => v.length > 0,  msg: 'Nama wajib diisi.' },
    { ok: v => v.length >= 3, msg: 'Nama minimal 3 karakter.' },
  ],
  email: [
    { ok: v => v.length > 0,                              msg: 'Email wajib diisi.' },
    { ok: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),     msg: 'Format email tidak valid.' },
  ],
};

// Validasi satu field; kembalikan true jika lolos, false jika gagal
function validasi(input, idPesan, kunci) {
  const nilai = input.value.trim();
  const elPesan = document.getElementById(idPesan);

  for (const aturan of aturanValidasi[kunci]) {
    if (!aturan.ok(nilai)) {
      elPesan.textContent = aturan.msg;
      input.classList.add('invalid');
      return false;
    }
  }

  elPesan.textContent = '';
  input.classList.remove('invalid');
  return true;
}

// Pasang blur + input listener sekaligus — menggantikan 4 listener terpisah yang identis
function pasangValidasi(input, errId, kunci) {
  input.addEventListener('blur', () => validasi(input, errId, kunci));
  input.addEventListener('input', () => {
    if (input.classList.contains('invalid')) validasi(input, errId, kunci);
  });
}
pasangValidasi(inputNama,  'err-nama',  'nama');
pasangValidasi(inputEmail, 'err-email', 'email');

/* ─── 6. SUBMIT FORM ──────────────────────────────────────── */
form.addEventListener('submit', async e => {
  e.preventDefault();

  const namaOk  = validasi(inputNama,  'err-nama',  'nama');
  const emailOk = validasi(inputEmail, 'err-email', 'email');

  if (!namaOk || !emailOk) {
    (!namaOk ? inputNama : inputEmail).focus();
    return;
  }

  // Nonaktifkan tombol selama request berlangsung
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled = true;
  btnSubmit.querySelector('.btn-text').textContent = 'Memproses…';

  try {
    const respons = await fetch('/api/daftar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama:         inputNama.value.trim(),
        email:        inputEmail.value.trim(),
        jumlahTiket:  jumlahTiket(),
      }),
    });

    const data = await respons.json();

    if (!respons.ok || !data.sukses) {
      // Tampilkan pesan error dari server di bawah form
      tampilkanErrorServer(data.pesan || 'Terjadi kesalahan. Coba lagi.');
      return;
    }

    // Sukses — arahkan ke halaman e-tiket dengan data di URL
    const params = new URLSearchParams({
      kode:  data.kodeTiket,
      nama:  inputNama.value.trim(),
      email: inputEmail.value.trim(),
      tiket: jumlahTiket(),
      total: jumlahTiket() * HARGA_PER_TIKET,
    });
    window.location.href = `/etiket.html?${params}`;

  } catch {
    // Jaringan mati atau server tidak berjalan
    tampilkanErrorServer('Tidak dapat terhubung ke server. Pastikan server sedang berjalan.');
  } finally {
    // Pulihkan tombol apapun hasilnya
    btnSubmit.disabled = false;
    btnSubmit.querySelector('.btn-text').innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
      </svg>
      Beli Tiket Sekarang`;
  }
});

function tampilkanErrorServer(pesan) {
  // Gunakan elemen error yang sudah ada, atau buat sementara di bawah tombol
  let elErr = document.getElementById('err-server');
  if (!elErr) {
    elErr = document.createElement('p');
    elErr.id = 'err-server';
    elErr.style.cssText = 'color:#ef4444;font-size:.85rem;text-align:center;margin-top:10px;';
    document.getElementById('btnSubmit').insertAdjacentElement('afterend', elErr);
  }
  elErr.textContent = '⚠ ' + pesan;
  setTimeout(() => { elErr.textContent = ''; }, 6000);
}

/* ─── 7. MODAL ────────────────────────────────────────────── */
function tampilkanModal({ nama, email, qty, total, kodeTiket }) {
  elModalMsg.textContent = `Terima kasih, ${nama}! Pendaftaran kamu sudah diterima.`;

  elModalDetail.innerHTML = `
    <strong>Ringkasan Pesanan</strong><br>
    Nama &nbsp;&nbsp;: ${nama}<br>
    Email &nbsp;: ${email}<br>
    Tiket &nbsp;: ${qty} tiket<br>
    Total &nbsp;: <span class="highlight">${total}</span><br>
    ${kodeTiket ? `Kode &nbsp;&nbsp;: <span class="highlight">${kodeTiket}</span><br>` : ''}
    <br><span class="note">Konfirmasi &amp; instruksi pembayaran dikirim ke email kamu dalam 5 menit.</span>
  `;

  modalBg.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function tutupModal() {
  modalBg.classList.remove('active');
  document.body.style.overflow = '';

  // Reset form ke kondisi awal
  form.reset();
  inputTiket.value = 1;
  perbaruiTotal();
  [inputNama, inputEmail].forEach(el => el.classList.remove('invalid'));
  document.querySelectorAll('.field-err').forEach(el => el.textContent = '');
}

// Tiga cara menutup modal: tombol ✕, tombol OK, klik di luar, atau tekan Escape
btnModalX.addEventListener('click', tutupModal);
btnModalOk.addEventListener('click', tutupModal);
modalBg.addEventListener('click', e => { if (e.target === modalBg) tutupModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupModal(); });

/* ─── 8. ANIMASI MUNCUL SAAT SCROLL ──────────────────────── */
// Elemen dimulai transparan dan sedikit di bawah posisinya,
// lalu muncul saat masuk ke viewport (staggered per-index)
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity   = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target); // cukup animasi sekali
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.card, .tl-item, .include-list li').forEach((el, i) => {
  el.style.opacity    = '0';
  el.style.transform  = 'translateY(28px)';
  el.style.transition = `opacity .5s ease ${i * 80}ms, transform .5s ease ${i * 80}ms`;
  observer.observe(el);
});

/* ─── 9. INISIALISASI ─────────────────────────────────────── */
// Hitung total awal saat halaman pertama kali dimuat
perbaruiTotal();
