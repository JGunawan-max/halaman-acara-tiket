/**
 * api/daftar.js — Vercel Serverless Function
 *
 * POST /api/daftar: validasi input, buat kode tiket unik,
 * simpan ke /tmp (Vercel ephemeral) atau ./data (lokal), kirim email via Resend.
 */

const fs   = require('fs');
const path = require('path');

const { kirimEmail } = require('../email');

/* ─── Path penyimpanan: /tmp di Vercel, ./data di lokal ─── */
const FILE_DATA = process.env.VERCEL
  ? '/tmp/pendaftaran.json'
  : path.join(__dirname, '..', 'data', 'pendaftaran.json');

/* ─── URL basis untuk link e-tiket dalam email ─── */
function getBaseUrl(req) {
  if (process.env.APP_URL)    return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://${req.headers.host || 'localhost:3900'}`;
}

/* ─── Helpers storage ─── */
function bacaData() {
  try { return JSON.parse(fs.readFileSync(FILE_DATA, 'utf8')); }
  catch { return []; }
}

function simpanData(entri) {
  const dir = path.dirname(FILE_DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const semua = bacaData();
  semua.push(entri);
  fs.writeFileSync(FILE_DATA, JSON.stringify(semua, null, 2), 'utf8');
}

/* ─── Buat kode tiket unik: WCC-2026-XXXXX ─── */
function buatKodeTiket() {
  return 'WCC-2026-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

/* ─── Kirim respons JSON (kompatibel Node.js http + Vercel) ─── */
function jsonRes(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* ─── Parse body: Vercel sudah pre-parse → req.body tersedia langsung ─── */
function parseBody(req) {
  // Vercel @vercel/node mengisi req.body otomatis untuk Content-Type: application/json
  if (req.body !== undefined) {
    return Promise.resolve(
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    );
  }
  // Fallback stream reading untuk server.js lokal
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* ─── Handler utama ─── */
module.exports = async function handler(req, res) {
  // Header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }
  if (req.method !== 'POST') {
    jsonRes(res, 405, { sukses: false, pesan: 'Method tidak diizinkan' }); return;
  }

  // Parse body
  let data;
  try {
    data = await parseBody(req);
  } catch {
    jsonRes(res, 400, { sukses: false, pesan: 'Format data tidak valid (bukan JSON)' }); return;
  }

  const { nama, email, jumlahTiket } = data || {};

  // Validasi server-side
  if (!nama || String(nama).trim().length < 3) {
    jsonRes(res, 400, { sukses: false, pesan: 'Nama minimal 3 karakter' }); return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    jsonRes(res, 400, { sukses: false, pesan: 'Format email tidak valid' }); return;
  }
  const qty = parseInt(jumlahTiket);
  if (!qty || qty < 1 || qty > 5) {
    jsonRes(res, 400, { sukses: false, pesan: 'Jumlah tiket harus 1–5' }); return;
  }

  // Buat dan simpan entri
  const kodeTiket  = buatKodeTiket();
  const totalHarga = qty * 50000;
  const entri = {
    kodeTiket,
    nama:        String(nama).trim(),
    email:       String(email).trim(),
    jumlahTiket: qty,
    totalHarga,
    waktuDaftar: new Date().toISOString(),
  };
  simpanData(entri);

  console.log(`[DAFTAR] ${entri.waktuDaftar} | ${kodeTiket} | ${nama} | ${email} | ${qty} tiket`);

  // URL e-tiket untuk link di email
  const params    = new URLSearchParams({
    kode: kodeTiket, nama: entri.nama,
    email: entri.email, tiket: qty, total: totalHarga,
  });
  const urlEtiket = `${getBaseUrl(req)}/etiket.html?${params}`;

  // Kirim email async (tidak menunda respons)
  kirimEmail({ to: entri.email, nama: entri.nama, kodeTiket, jumlahTiket: qty, totalHarga, urlEtiket })
    .then(hasil => {
      if (hasil.dilewati)  console.log(`[EMAIL] Dilewati — ${hasil.alasan}`);
      else if (hasil.sukses) console.log(`[EMAIL] Terkirim ke ${entri.email} | id: ${hasil.id}`);
      else                 console.log(`[EMAIL] Gagal — ${JSON.stringify(hasil.detail)}`);
    })
    .catch(err => console.error('[EMAIL] Error tidak terduga:', err));

  jsonRes(res, 200, {
    sukses:       true,
    kodeTiket,
    pesan:        `Pendaftaran berhasil! Kode tiket kamu: ${kodeTiket}`,
    emailDikirim: !!process.env.RESEND_API_KEY,
  });
};
