/**
 * api/daftar.js — Vercel Serverless Function
 *
 * Menangani POST /api/daftar: validasi data, buat kode tiket,
 * simpan ke /tmp (Vercel) atau data/ (lokal), kirim email via Resend.
 *
 * Catatan storage: /tmp di Vercel bersifat ephemeral (terhapus saat cold start
 * dan tidak dibagi antar instance). Untuk produksi skala besar, ganti dengan
 * database eksternal seperti Vercel KV atau Supabase.
 */

const fs   = require('fs');
const path = require('path');

const { kirimEmail } = require('../email');

/* ─── Tentukan path penyimpanan ─── */
// Di Vercel: /tmp bisa ditulis; di lokal: ./data/pendaftaran.json
const FILE_DATA = process.env.VERCEL
  ? '/tmp/pendaftaran.json'
  : path.join(__dirname, '..', 'data', 'pendaftaran.json');

/* ─── URL basis untuk link e-tiket di email ─── */
// VERCEL_URL diset otomatis oleh Vercel. APP_URL bisa diset manual di Vercel dashboard
// untuk custom domain. Fallback ke localhost untuk development.
function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req.headers.host || 'localhost:3900';
  return `http://${host}`;
}

/* ─── Helpers storage ─── */
function bacaData() {
  try {
    return JSON.parse(fs.readFileSync(FILE_DATA, 'utf8'));
  } catch {
    return [];
  }
}

function simpanData(entri) {
  // Pastikan direktori /tmp ada (selalu ada di Vercel, tapi jaga-jaga)
  const dir = path.dirname(FILE_DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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
function jsonRes(res, status, data) {
  res.status(status).json(data);
}

/* ─── Baca body request sebagai teks (Vercel tidak auto-parse) ─── */
function bacaBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/* ─── Handler utama ─── */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    jsonRes(res, 405, { sukses: false, pesan: 'Method tidak diizinkan' });
    return;
  }

  // Baca dan parse body
  let data;
  try {
    const raw = await bacaBody(req);
    data = JSON.parse(raw);
  } catch {
    jsonRes(res, 400, { sukses: false, pesan: 'Format data tidak valid (bukan JSON)' });
    return;
  }

  const { nama, email, jumlahTiket } = data;

  // Validasi server-side
  if (!nama || nama.trim().length < 3) {
    jsonRes(res, 400, { sukses: false, pesan: 'Nama minimal 3 karakter' });
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    jsonRes(res, 400, { sukses: false, pesan: 'Format email tidak valid' });
    return;
  }
  const qty = parseInt(jumlahTiket);
  if (!qty || qty < 1 || qty > 5) {
    jsonRes(res, 400, { sukses: false, pesan: 'Jumlah tiket harus 1–5' });
    return;
  }

  // Buat dan simpan entri
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

  // Bangun URL e-tiket untuk link di email
  const params   = new URLSearchParams({
    kode: kodeTiket, nama: entri.nama,
    email: entri.email, tiket: qty, total: totalHarga,
  });
  const baseUrl  = getBaseUrl(req);
  const urlEtiket = `${baseUrl}/etiket.html?${params}`;

  // Kirim email (async — tidak menunda respons API)
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

  jsonRes(res, 200, {
    sukses:       true,
    kodeTiket,
    pesan:        `Pendaftaran berhasil! Kode tiket kamu: ${kodeTiket}`,
    emailDikirim: !!process.env.RESEND_API_KEY,
  });
};
