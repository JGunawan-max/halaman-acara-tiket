/**
 * email.js — Modul pengiriman e-tiket via Resend API
 *
 * Menggunakan modul https bawaan Node.js, tanpa npm install apapun.
 * Jika RESEND_API_KEY kosong → fungsi langsung return tanpa error
 * sehingga server tetap berjalan normal meski email belum dikonfigurasi.
 */

const https = require('https');

/* ─── Template HTML email ─────────────────────────────────── */
function templateEmail({ nama, kodeTiket, jumlahTiket, totalHarga, urlEtiket }) {
  const total = 'Rp ' + totalHarga.toLocaleString('id-ID');
  const qrData = encodeURIComponent(
    `Workshop Claude Code 2026\nKode: ${kodeTiket}\nPeserta: ${nama}`
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&color=1e1b4b&data=${qrData}`;

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>E-Tiket ${kodeTiket}</title>
</head>
<body style="margin:0;padding:0;background:#f3f0ff;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0ff;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(124,58,237,.15);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d0d1a,#1a0a3a);padding:32px 36px 28px;position:relative;">
            <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.08em;text-transform:uppercase;">Workshop Claude Code</p>
            <h1 style="margin:0 0 6px;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-.03em;line-height:1.1;">
              Workshop<br/>
              <span style="background:linear-gradient(135deg,#a78bfa,#f472b6,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Claude Code</span>
            </h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,.5);">Sabtu, 19 Juli 2026 &nbsp;·&nbsp; Grand Indonesia, Jakarta Pusat</p>
            <div style="display:inline-block;margin-top:14px;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#6ee7b7;font-size:11px;font-weight:700;padding:5px 12px;border-radius:999px;letter-spacing:.05em;">● TERKONFIRMASI</div>
          </td>
        </tr>

        <!-- Perforasi -->
        <tr>
          <td style="background:#f3f0ff;height:2px;background-image:repeating-linear-gradient(90deg,#d1d5db 0,#d1d5db 8px,transparent 8px,transparent 16px);"></td>
        </tr>

        <!-- Body: data + QR -->
        <tr>
          <td style="padding:28px 36px 24px;">
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hei <strong style="color:#1e1b4b;">${nama}</strong>, pendaftaran kamu sudah dikonfirmasi!</p>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <!-- Data peserta -->
                <td style="vertical-align:top;padding-right:24px;">

                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-bottom:16px;">
                        <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed;">Nama Peserta</p>
                        <p style="margin:0;font-size:18px;font-weight:900;color:#1e1b4b;">${nama}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:16px;">
                        <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed;">Jumlah Tiket</p>
                        <p style="margin:0;font-size:18px;font-weight:900;color:#1e1b4b;">${jumlahTiket} tiket</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom:16px;">
                        <p style="margin:0 0 3px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed;">Total Pembayaran</p>
                        <p style="margin:0;font-size:18px;font-weight:900;color:#1e1b4b;">${total}</p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7c3aed;">Kode Tiket</p>
                        <div style="display:inline-block;background:#ede9fe;padding:8px 16px;border-radius:8px;font-family:'Courier New',monospace;font-size:15px;font-weight:700;color:#7c3aed;letter-spacing:.04em;">${kodeTiket}</div>
                      </td>
                    </tr>
                  </table>

                </td>

                <!-- QR Code -->
                <td style="vertical-align:top;text-align:center;" width="200">
                  <div style="background:#fff;border:2px solid #e5e7eb;border-radius:14px;padding:10px;display:inline-block;">
                    <img src="${qrUrl}" width="160" height="160" alt="QR Code ${kodeTiket}" style="display:block;border-radius:6px;"/>
                  </div>
                  <p style="margin:8px 0 0;font-size:11px;font-weight:600;color:#6b7280;letter-spacing:.05em;text-transform:uppercase;">Scan di pintu masuk</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA button -->
        <tr>
          <td style="padding:0 36px 28px;text-align:center;">
            <a href="${urlEtiket}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899,#f97316);color:#ffffff;font-size:15px;font-weight:800;padding:14px 32px;border-radius:999px;text-decoration:none;box-shadow:0 6px 20px rgba(124,58,237,.35);">
              Lihat E-Tiket Lengkap →
            </a>
          </td>
        </tr>

        <!-- Info acara -->
        <tr>
          <td style="background:#fafafa;border-top:1.5px solid #e5e7eb;padding:20px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:#6b7280;line-height:1.6;">
                  📍 <strong>Gedung Inovasi Lt. 3</strong>, Grand Indonesia West Mall<br/>
                  Jl. M.H. Thamrin No.1, Jakarta Pusat<br/>
                  🕘 09.00 – 17.00 WIB &nbsp;·&nbsp; Pintu Masuk: Gate A Lt. 3
                </td>
                <td align="right" style="font-size:11px;color:#9ca3af;">
                  © 2026 Workshop Claude Code<br/>
                  info@workshopclaudecode.id
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
        Email ini dikirim otomatis. Tunjukkan e-tiket ini saat check-in.
      </p>
    </td></tr>
  </table>

</body>
</html>`;
}

/* ─── Kirim email via Resend REST API ─────────────────────── */
function kirimEmail({ to, nama, kodeTiket, jumlahTiket, totalHarga, urlEtiket }) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;

    // Jika kunci kosong → lewati tanpa error
    if (!apiKey) {
      resolve({ dilewati: true, alasan: 'RESEND_API_KEY belum dikonfigurasi' });
      return;
    }

    const from     = process.env.EMAIL_FROM      || 'onboarding@resend.dev';
    const fromName = process.env.EMAIL_FROM_NAME || 'Workshop Claude Code 2026';

    const payload = JSON.stringify({
      from:    `${fromName} <${from}>`,
      to:      [to],
      subject: `E-Tiket ${kodeTiket} — Workshop Claude Code 2026`,
      html:    templateEmail({ nama, kodeTiket, jumlahTiket, totalHarga, urlEtiket }),
    });

    const options = {
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers:  {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (res.statusCode === 200 || res.statusCode === 201) {
            resolve({ sukses: true, id: data.id });
          } else {
            resolve({ sukses: false, status: res.statusCode, detail: data });
          }
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

module.exports = { kirimEmail };
