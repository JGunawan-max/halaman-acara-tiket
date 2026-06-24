/**
 * server.js — Backend sederhana Workshop Claude Code
 *
 * Menjalankan dua tugas:
 *   1. Melayani file statis (HTML, CSS, JS) dari folder ini
 *   2. Menerima POST /api/daftar, menyimpan data ke data/pendaftaran.json,
 *      mengembalikan kode tiket unik, dan mengirim e-tiket via email (Resend)
 *
 * Jalankan: node server.js  (kunci email dibaca otomatis dari .env)
 * Buka    : http://localhost:3900
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const { kirimEmail } = require('./email');

const PORT      = 3900;
const FILE_DATA = path.join(__dirname, 'data', 'pendaftaran.json');
const BASE_URL  = `http://localhost:${PORT}`;

/* ─── Muat .env tanpa library eksternal ─── */
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split('\n')
    .forEach(baris => {
      const [kunci, ...sisa] = baris.split('=');
      if (kunci && !kunci.trim().startsWith('#') && sisa.length) {
        process.env[kunci.trim()] = sisa.join('=').trim();
      }
    });
} catch { /* .env tidak ada — lanjut tanpa email */ }

/* ─── MIME types untuk file statis ─── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'text/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

/* ─── Pastikan folder & file data tersedia ─── */
function inisialisasiStorage() {
  const dir = path.dirname(FILE_DATA);
  if (!fs.existsSync(dir))  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE_DATA)) fs.writeFileSync(FILE_DATA, '[]', 'utf8');
}

/* ─── Baca semua pendaftaran ─── */
function bacaData() {
  try {
    return JSON.parse(fs.readFileSync(FILE_DATA, 'utf8'));
  } catch {
    return [];
  }
}

/* ─── Simpan satu pendaftaran baru ─── */
function simpanData(entri) {
  const semua = bacaData();
  semua.push(entri);
  fs.writeFileSync(FILE_DATA, JSON.stringify(semua, null, 2), 'utf8');
}

/* ─── Buat kode tiket unik: WCC-2026-XXXXX ─── */
function buatKodeTiket() {
  const acak = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `WCC-2026-${acak}`;
}

/* ─── Kirim respons JSON ─── */
function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/* ─── Layani file statis ─── */
function layaniBerkas(req, res) {
  // Pisahkan pathname dari query string (?kode=...) sebelum cari file
  const { pathname } = new URL(req.url, 'http://localhost');
  const urlPath  = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, urlPath);

  // Cegah path traversal (../../ dst.)
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 – File tidak ditemukan');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ─── Handle POST /api/daftar ─── */
function handleDaftar(req, res) {
  // Hanya terima POST
  if (req.method !== 'POST') {
    jsonResponse(res, 405, { sukses: false, pesan: 'Method tidak diizinkan' });
    return;
  }

  // Kumpulkan body request
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      jsonResponse(res, 400, { sukses: false, pesan: 'Format data tidak valid (bukan JSON)' });
      return;
    }

    const { nama, email, jumlahTiket } = data;

    /* Validasi server-side (lapis kedua setelah validasi di browser) */
    if (!nama || nama.trim().length < 3) {
      jsonResponse(res, 400, { sukses: false, pesan: 'Nama minimal 3 karakter' });
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      jsonResponse(res, 400, { sukses: false, pesan: 'Format email tidak valid' });
      return;
    }
    const qty = parseInt(jumlahTiket);
    if (!qty || qty < 1 || qty > 5) {
      jsonResponse(res, 400, { sukses: false, pesan: 'Jumlah tiket harus 1–5' });
      return;
    }

    /* Simpan ke file */
    const kodeTiket  = buatKodeTiket();
    const totalHarga = qty * 50000;
    const entri = {
      kodeTiket,
      nama:        nama.trim(),
      email:       email.trim(),
      jumlahTiket: qty,
      totalHarga,
      waktuDaftar: new Date().toISOString(),
    };
    simpanData(entri);

    console.log(`[DAFTAR] ${entri.waktuDaftar} | ${kodeTiket} | ${nama} | ${email} | ${qty} tiket`);

    /* Kirim e-tiket ke email pendaftar (async — tidak menunda respons) */
    const params = new URLSearchParams({
      kode: kodeTiket, nama: entri.nama,
      email: entri.email, tiket: qty, total: totalHarga,
    });
    const urlEtiket = `${BASE_URL}/etiket.html?${params}`;

    kirimEmail({ to: entri.email, nama: entri.nama, kodeTiket, jumlahTiket: qty, totalHarga, urlEtiket })
      .then(hasil => {
        if (hasil.dilewati) {
          console.log(`[EMAIL] Dilewati — ${hasil.alasan}`);
        } else if (hasil.sukses) {
          console.log(`[EMAIL] Terkirim ke ${entri.email} | id: ${hasil.id}`);
        } else {
          console.log(`[EMAIL] Gagal — ${JSON.stringify(hasil.detail)}`);
        }
      });

    jsonResponse(res, 200, {
      sukses:       true,
      kodeTiket,
      pesan:        `Pendaftaran berhasil! Kode tiket kamu: ${kodeTiket}`,
      emailDikirim: !!process.env.RESEND_API_KEY,
    });
  });
}

/* ─── SERVER UTAMA ─── */
inisialisasiStorage();

const server = http.createServer((req, res) => {
  // Izinkan semua origin (untuk kemudahan testing lokal)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  if (req.url === '/api/daftar') {
    handleDaftar(req, res);
  } else {
    layaniBerkas(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Data tersimpan di: ${FILE_DATA}`);
});
