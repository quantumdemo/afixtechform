// api/submit.js — Vercel Serverless Function
// Handles: Google Sheets logging + Welcome email + Admin notification via Resend

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const data = req.body;

  // ── Validate required fields server-side ──
  const required = ['fullName', 'whatsapp', 'email', 'location', 'device', 'level', 'days', 'time', 'source'];
  for (const key of required) {
    const val = data[key];
    if (!val || (Array.isArray(val) && val.length === 0)) {
      return res.status(400).json({ error: `Missing required field: ${key}` });
    }
  }

  const daysStr = Array.isArray(data.days) ? data.days.join(', ') : data.days;
  const submittedAt = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });

  const errors = [];

  // ── 1. Google Sheets ──
  try {
    const sheetRes = await fetch(process.env.GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName:    data.fullName,
        whatsapp:    data.whatsapp,
        email:       data.email,
        location:    data.location,
        device:      data.device,
        level:       data.level,
        goals:       data.goals || '',
        days:        daysStr,
        time:        data.time,
        source:      data.source,
        submittedAt: submittedAt,
      }),
    });
    if (!sheetRes.ok) throw new Error('Sheet responded with ' + sheetRes.status);
  } catch (err) {
    console.error('Google Sheets error:', err);
    errors.push('sheets');
  }

  // ── 2 & 3. Emails via Resend ──
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const ADMIN_EMAIL    = process.env.ADMIN_EMAIL;
  const FROM_EMAIL     = process.env.FROM_EMAIL; // e.g. "AfixTech <no-reply@yourdomain.com>"

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping emails');
  } else {
    // Welcome email to user
    try {
      const welcomeRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to:   [data.email],
          subject: 'Welcome to AfixTech Excel Classes 🎉',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
              <h2 style="font-size:22px;margin-bottom:8px">You're in, ${data.fullName.split(' ')[0]}! 🎉</h2>
              <p style="color:#444;line-height:1.6">Thank you for enrolling in the <strong>Advanced Excel Scholar</strong> programme with AfixTech.</p>
              <p style="color:#444;line-height:1.6">Our team will contact you on <strong>${data.whatsapp}</strong> via WhatsApp within <strong>24 hours</strong> to confirm your class time.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="font-size:13px;color:#777">Questions? WhatsApp us directly: <a href="https://wa.me/2348140020576" style="color:#16a34a">08140020576</a></p>
              <p style="font-size:13px;color:#777">— The AfixTech Team</p>
            </div>
          `,
        }),
      });
      if (!welcomeRes.ok) throw new Error(await welcomeRes.text());
    } catch (err) {
      console.error('Welcome email error:', err);
      errors.push('welcome-email');
    }

    // Admin notification
    if (ADMIN_EMAIL) {
      try {
        const adminRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to:   [ADMIN_EMAIL],
            subject: `New Excel Enrollment: ${data.fullName}`,
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
                <h2 style="font-size:20px">New Enrollment Received</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600;width:40%">Name</td><td style="padding:8px;border-bottom:1px solid #eee">${data.fullName}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">WhatsApp</td><td style="padding:8px;border-bottom:1px solid #eee">${data.whatsapp}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Email</td><td style="padding:8px;border-bottom:1px solid #eee">${data.email}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Location</td><td style="padding:8px;border-bottom:1px solid #eee">${data.location}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Device</td><td style="padding:8px;border-bottom:1px solid #eee">${data.device}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Excel Level</td><td style="padding:8px;border-bottom:1px solid #eee">${data.level}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Available Days</td><td style="padding:8px;border-bottom:1px solid #eee">${daysStr}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Preferred Time</td><td style="padding:8px;border-bottom:1px solid #eee">${data.time}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Heard via</td><td style="padding:8px;border-bottom:1px solid #eee">${data.source}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Goals</td><td style="padding:8px;border-bottom:1px solid #eee">${data.goals || '—'}</td></tr>
                  <tr><td style="padding:8px;background:#f5f5f5;font-weight:600">Submitted</td><td style="padding:8px">${submittedAt}</td></tr>
                </table>
              </div>
            `,
          }),
        });
        if (!adminRes.ok) throw new Error(await adminRes.text());
      } catch (err) {
        console.error('Admin email error:', err);
        errors.push('admin-email');
      }
    }
  }

  // Return success even if emails failed (data is in Sheets)
  return res.status(200).json({
    success: true,
    warnings: errors.length ? errors : undefined,
  });
}
