/**
 * api/daftar.js — Vercel Serverless Function (self-contained)
 * Semua kode dalam satu file: tidak ada require ke module luar proyek.
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

/* ─── Storage: /tmp di Vercel, ./data di lokal ─── */
const FILE_DATA = process.env.VERCEL
  ? '/tmp/pendaftaran.json'
  : path.join(__dirname, '..', 'data', 'pendaftaran.json');

/* ─── Helpers ─── */
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

function buatKodeTiket() {
  return 'WCC-2026-' + Math.random().toString(36).substring(2, 7).toUpperCase();
}

function getBaseUrl(req) {
  if (process.env.APP_URL)    return process.env.APP_URL;
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return 'http://' + (req.headers.host || 'localhost:3900');
}

function jsonRes(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/* ─── Ambil body: Vercel pre-parse → req.body sudah ada ─── */
function ambilBody(req) {
  if (req.body !== undefined) {
    const obj = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    return Promise.resolve(obj);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* ─── Template email HTML ─── */
function templateEmail({ nama, kodeTiket, jumlahTiket, totalHarga, urlEtiket }) {
  const total = 'Rp ' + totalHarga.toLocaleString('id-ID');
  const qrData = encodeURIComponent(
    'Workshop Claude Code 2026\nKode: ' + kodeTiket + '\nPeserta: ' + nama
  );
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&color=1e1b4b&data=' + qrData;

  return '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>E-Tiket ' + kodeTiket + '</title></head>'
    + '<body style="margin:0;padding:0;background:#f3f0ff;font-family:\'Segoe UI\',Arial,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ff;padding:32px 16px;"><tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;">'
    + '<tr><td style="background:linear-gradient(135deg,#0d0d1a,#1a0a3a);padding:32px 36px;">'
    + '<h1 style="margin:0;font-size:28px;font-weight:900;color:#fff;">Workshop Claude Code 2026</h1>'
    + '<p style="margin:8px 0 0;color:rgba(255,255,255,.6);">Sabtu, 19 Juli 2026 · Grand Indonesia, Jakarta Pusat</p>'
    + '</td></tr>'
    + '<tr><td style="padding:28px 36px;">'
    + '<p>Hei <strong>' + nama + '</strong>, pendaftaran kamu sudah dikonfirmasi!</p>'
    + '<table width="100%"><tr>'
    + '<td style="vertical-align:top;">'
    + '<p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;">Nama</p>'
    + '<p style="margin:0 0 16px;font-size:18px;font-weight:900;color:#1e1b4b;">' + nama + '</p>'
    + '<p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;">Jumlah Tiket</p>'
    + '<p style="margin:0 0 16px;font-size:18px;font-weight:900;color:#1e1b4b;">' + jumlahTiket + ' tiket</p>'
    + '<p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;">Total</p>'
    + '<p style="margin:0 0 16px;font-size:18px;font-weight:900;color:#1e1b4b;">' + total + '</p>'
    + '<p style="margin:0 0 4px;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase;">Kode Tiket</p>'
    + '<code style="background:#ede9fe;padding:6px 12px;border-radius:6px;font-size:15px;color:#7c3aed;">' + kodeTiket + '</code>'
    + '</td>'
    + '<td style="text-align:center;vertical-align:top;" width="200">'
    + '<img src="' + qrUrl + '" width="160" height="160" alt="QR Code" style="border:2px solid #e5e7eb;border-radius:10px;"/>'
    + '<p style="margin:8px 0 0;font-size:11px;color:#6b7280;">Scan di pintu masuk</p>'
    + '</td>'
    + '</tr></table>'
    + '<div style="text-align:center;margin-top:24px;">'
    + '<a href="' + urlEtiket + '" style="background:linear-gradient(135deg,#7c3aed,#ec4899,#f97316);color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:800;">Lihat E-Tiket →</a>'
    + '</div>'
    + '</td></tr>'
    + '<tr><td style="background:#fafafa;border-top:1px solid #e5e7eb;padding:16px 36px;font-size:12px;color:#6b7280;">'
    + '📍 Gedung Inovasi Lt.3, Grand Indonesia · 🕘 09.00–17.00 WIB'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

/* ─── Kirim email via Resend REST API ─── */
function kirimEmail({ to, nama, kodeTiket, jumlahTiket, totalHarga, urlEtiket }) {
  return new Promise(resolve => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      resolve({ dilewati: true, alasan: 'RESEND_API_KEY belum dikonfigurasi' });
      return;
    }

    const from     = process.env.EMAIL_FROM      || 'onboarding@resend.dev';
    const fromName = process.env.EMAIL_FROM_NAME || 'Workshop Claude Code 2026';
    const payload  = JSON.stringify({
      from:    fromName + ' <' + from + '>',
      to:      [to],
      subject: 'E-Tiket ' + kodeTiket + ' — Workshop Claude Code 2026',
      html:    templateEmail({ nama, kodeTiket, jumlahTiket, totalHarga, urlEtiket }),
    });

    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers:  {
        'Authorization':  'Bearer ' + apiKey,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try {
          const d = JSON.parse(body);
          resolve((res.statusCode === 200 || res.statusCode === 201)
            ? { sukses: true, id: d.id }
            : { sukses: false, status: res.statusCode, detail: d });
        } catch {
          resolve({ sukses: false, detail: body });
        }
      });
    });
    req.on('error', err => resolve({ sukses: false, detail: err.message }));
    req.write(payload);
    req.end();
  });
}

/* ─── Handler utama ─── */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') {
    jsonRes(res, 405, { sukses: false, pesan: 'Method tidak diizinkan' }); return;
  }

  let data;
  try { data = await ambilBody(req); }
  catch { jsonRes(res, 400, { sukses: false, pesan: 'Format data tidak valid' }); return; }

  const { nama, email, jumlahTiket } = data || {};

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

  console.log('[DAFTAR]', entri.waktuDaftar, '|', kodeTiket, '|', nama, '|', email, '|', qty, 'tiket');

  const params    = new URLSearchParams({
    kode: kodeTiket, nama: entri.nama,
    email: entri.email, tiket: qty, total: totalHarga,
  });
  const urlEtiket = getBaseUrl(req) + '/etiket.html?' + params;

  // await — Vercel mematikan function setelah response, jadi email HARUS selesai dulu
  const hasilEmail = await kirimEmail({ to: entri.email, nama: entri.nama, kodeTiket, jumlahTiket: qty, totalHarga, urlEtiket })
    .catch(err => { console.error('[EMAIL] Error:', err); return { sukses: false }; });

  if (hasilEmail.dilewati)    console.log('[EMAIL] Dilewati —', hasilEmail.alasan);
  else if (hasilEmail.sukses) console.log('[EMAIL] Terkirim ke', entri.email, '| id:', hasilEmail.id);
  else                        console.log('[EMAIL] Gagal —', JSON.stringify(hasilEmail.detail));

  jsonRes(res, 200, {
    sukses:       true,
    kodeTiket,
    pesan:        'Pendaftaran berhasil! Kode tiket kamu: ' + kodeTiket,
    emailDikirim: !!process.env.RESEND_API_KEY,
  });
};
