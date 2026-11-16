import tls from 'node:tls';
import crypto from 'node:crypto';

const DEFAULT_BACKEND_URL = 'https://sistema-ula-backend.onrender.com';
const DEFAULT_SMTP_HOST = 'smtp.gmail.com';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_SMTP_USER = 'soporte.sipref.software@gmail.com';
const DEFAULT_SMTP_PASS = 'from lcxt muzd wugb';

function extractEmail(value) {
  const s = String(value || '').trim();
  const match = s.match(/<([^>]+)>/);
  return (match ? match[1] : s).trim();
}

function splitEmails(value) {
  return String(value || '')
    .replace(/;/g, ',')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function encodeHeaderUtf8(text) {
  return `=?UTF-8?B?${Buffer.from(String(text), 'utf8').toString('base64')}?=`;
}

function wrapBase64(data) {
  const b64 = Buffer.isBuffer(data)
    ? data.toString('base64')
    : Buffer.from(String(data), 'utf8').toString('base64');
  const lines = b64.match(/.{1,76}/g);
  return lines ? lines.join('\r\n') : '';
}

function getLocalDateParts() {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Merida',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    displayDateTime: `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`,
  };
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return req.body.trim() ? JSON.parse(req.body) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const text = req.body.toString('utf8').trim();
      return text ? JSON.parse(text) : {};
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

export function sendSmtpTls({ host, port = 465, user, pass, fromEmail, recipients, rawMime }) {
  return new Promise((resolve, reject) => {
    const cleanRecipients = recipients.map(extractEmail).filter(Boolean);
    if (cleanRecipients.length === 0) {
      reject(new Error('No se especificaron destinatarios válidos.'));
      return;
    }

    const sock = tls.connect({ host, port, servername: host });
    sock.setTimeout(15000);

    let buffer = '';
    let settled = false;
    const waiters = [];
    const responsesQueue = [];
    let currentMultiLine = [];

    const fail = (err) => {
      if (settled) return;
      settled = true;
      try {
        sock.destroy();
      } catch {}
      while (waiters.length > 0) {
        waiters.shift().reject(err);
      }
      reject(err);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        sock.end();
      } catch {}
      resolve();
    };

    const pushResponse = (resp) => {
      if (waiters.length > 0) {
        waiters.shift().resolve(resp);
      } else {
        responsesQueue.push(resp);
      }
    };

    const nextResponse = () => {
      if (responsesQueue.length > 0) {
        return Promise.resolve(responsesQueue.shift());
      }
      return new Promise((res, rej) => {
        waiters.push({ resolve: res, reject: rej });
      });
    };

    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!line) continue;
        currentMultiLine.push(line);
        if ((line.length >= 4 && line[3] === ' ') || (line.length === 3 && /^\d{3}$/.test(line))) {
          const code = parseInt(line.slice(0, 3), 10);
          const text = currentMultiLine.join('\n');
          currentMultiLine = [];
          pushResponse({ code, text });
        }
      }
    });

    sock.on('timeout', () => fail(new Error(`Timeout SMTP al conectar con ${host}:${port}`)));
    sock.on('error', (err) => fail(err));
    sock.on('close', () => {
      if (!settled) {
        fail(new Error('Conexión SMTP cerrada inesperadamente.'));
      }
    });

    const expectCode = async (expectedCodes, stepName) => {
      const resp = await nextResponse();
      const allowed = Array.isArray(expectedCodes) ? expectedCodes : [expectedCodes];
      if (!allowed.includes(resp.code)) {
        throw new Error(`Error SMTP en ${stepName} (${resp.code}): ${resp.text}`);
      }
      return resp;
    };

    const run = async () => {
      await expectCode(220, 'greeting');

      sock.write('EHLO sipref-ula.vercel.app\r\n');
      await expectCode(250, 'EHLO');

      sock.write('AUTH LOGIN\r\n');
      await expectCode(334, 'AUTH LOGIN');

      sock.write(`${Buffer.from(user, 'utf8').toString('base64')}\r\n`);
      await expectCode(334, 'AUTH USER');

      sock.write(`${Buffer.from(pass, 'utf8').toString('base64')}\r\n`);
      await expectCode(235, 'AUTH PASS');

      sock.write(`MAIL FROM:<${extractEmail(fromEmail)}>\r\n`);
      await expectCode(250, 'MAIL FROM');

      for (const rcpt of cleanRecipients) {
        sock.write(`RCPT TO:<${rcpt}>\r\n`);
        await expectCode([250, 251], `RCPT TO ${rcpt}`);
      }

      sock.write('DATA\r\n');
      await expectCode(354, 'DATA');

      const mimeStr = Buffer.isBuffer(rawMime) ? rawMime.toString('utf8') : String(rawMime);
      const normalized = mimeStr.replace(/\r?\n/g, '\r\n');
      const stuffed = normalized
        .split('\r\n')
        .map((line) => (line.startsWith('.') ? `.${line}` : line))
        .join('\r\n');
      const dataPayload = stuffed.endsWith('\r\n') ? `${stuffed}.\r\n` : `${stuffed}\r\n.\r\n`;

      sock.write(dataPayload, 'utf8');
      await expectCode(250, 'DATA END');

      sock.write('QUIT\r\n');
      try {
        await expectCode(221, 'QUIT');
      } catch {
        // Ignorar si el servidor cierra inmediatamente después de QUIT
      }
      finish();
    };

    sock.once('secureConnect', () => {
      run().catch(fail);
    });
  });
}

function buildMultipartMime({
  fromName,
  fromEmail,
  destinos,
  ccList,
  asunto,
  bodyHtml,
  attachments,
}) {
  const boundary = `----=_SIPREF_${crypto.randomBytes(12).toString('hex')}`;
  const headers = [
    `From: "${fromName}" <${fromEmail}>`,
    `To: ${destinos.join(', ')}`,
  ];

  if (ccList.length > 0) {
    headers.push(`Cc: ${ccList.join(', ')}`);
  }

  headers.push(
    `Subject: ${encodeHeaderUtf8(asunto)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@universidadlatino.edu.mx>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(bodyHtml)
  );

  for (const att of attachments) {
    headers.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '',
      wrapBase64(att.buffer)
    );
  }

  headers.push(`--${boundary}--`, '');
  return headers.join('\r\n');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Error al consultar backend (${res.status}): ${errText || url}`);
  }
  return res.json();
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Error al descargar archivo del backend (${res.status}): ${errText || url}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Método no permitido. Usa POST.' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.status(400).json({ detail: `JSON inválido en la solicitud: ${err.message}` });
    return;
  }

  const smtpHost = (process.env.SMTP_HOST || DEFAULT_SMTP_HOST).trim();
  const smtpPort = Number(process.env.SMTP_TLS_PORT || DEFAULT_SMTP_PORT);
  const smtpUser = (process.env.SMTP_USER || DEFAULT_SMTP_USER).trim();
  const smtpPass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || DEFAULT_SMTP_PASS).trim();

  try {
    // Modo 1: Relay directo con MIME en Base64
    if (body.raw_mime_b64 && Array.isArray(body.recipients) && body.recipients.length > 0) {
      const rawMime = Buffer.from(body.raw_mime_b64, 'base64');
      await sendSmtpTls({
        host: smtpHost,
        port: smtpPort,
        user: smtpUser,
        pass: smtpPass,
        fromEmail: body.from_email || smtpUser,
        recipients: body.recipients,
        rawMime,
      });

      res.status(200).json({
        message: 'Correo enviado exitosamente vía SMTP relay en Vercel.',
        destinatarios: body.recipients.length,
      });
      return;
    }

    // Modo 2: Endpoint directo /api/incidencias/exportar-email en Vercel
    const destinos = splitEmails(body.destinatarios);
    if (destinos.length === 0) {
      res.status(400).json({ detail: 'Debe especificar al menos un correo destinatario.' });
      return;
    }

    const ccList = splitEmails(body.cc);
    const ccoList = splitEmails(body.cco);
    const allRecipients = [...destinos, ...ccList, ...ccoList];

    const backendBase = (process.env.BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');
    const baseParams = new URLSearchParams();
    if (body.fecha_inicio) baseParams.set('fecha_inicio', body.fecha_inicio);
    if (body.fecha_fin) baseParams.set('fecha_fin', body.fecha_fin);
    if (body.docente) baseParams.set('docente', body.docente);
    if (body.licenciatura) baseParams.set('licenciatura', body.licenciatura);
    if (body.tipo_incidencia) baseParams.set('tipo_incidencia', body.tipo_incidencia);
    if (body.busqueda) baseParams.set('busqueda', body.busqueda);

    const exportParams = new URLSearchParams(baseParams);
    const usuarioNombre = body.usuario_nombre || 'Prefectura';
    exportParams.set('usuario_nombre', usuarioNombre);

    const adjuntarPdf = body.adjuntar_pdf !== false;
    const adjuntarExcel = body.adjuntar_excel !== false;

    const [data, pdfBytes, xlsxBytes] = await Promise.all([
      fetchJson(`${backendBase}/api/incidencias?${baseParams.toString()}`),
      adjuntarPdf ? fetchBuffer(`${backendBase}/api/incidencias/exportar-pdf?${exportParams.toString()}`) : Promise.resolve(null),
      adjuntarExcel ? fetchBuffer(`${backendBase}/api/incidencias/exportar-excel?${exportParams.toString()}`) : Promise.resolve(null),
    ]);

    const incidencias = Array.isArray(data?.incidencias) ? data.incidencias : [];
    const resumen = data?.resumen || {};
    const { isoDate, displayDateTime } = getLocalDateParts();

    let periodoStr = 'Corte General';
    if (body.fecha_inicio && body.fecha_fin) {
      periodoStr = `del ${body.fecha_inicio} al ${body.fecha_fin}`;
    } else if (body.fecha_inicio) {
      periodoStr = `desde ${body.fecha_inicio}`;
    } else if (body.fecha_fin) {
      periodoStr = `hasta ${body.fecha_fin}`;
    }

    const filenamePdf = `Relacion_Incidencias_Docentes_${isoDate}.pdf`;
    const filenameXlsx = `Relacion_Incidencias_Docentes_${isoDate}.xlsx`;

    const archivosAdjuntosHtml = [];
    const attachments = [];

    if (pdfBytes) {
      archivosAdjuntosHtml.push(`<li>📄 <strong>PDF Oficial:</strong> ${filenamePdf}</li>`);
      attachments.push({
        filename: filenamePdf,
        contentType: 'application/pdf',
        buffer: pdfBytes,
      });
    }

    if (xlsxBytes) {
      archivosAdjuntosHtml.push(`<li>📊 <strong>Excel (.xlsx):</strong> ${filenameXlsx}</li>`);
      attachments.push({
        filename: filenameXlsx,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: xlsxBytes,
      });
    }

    const asunto = body.asunto || `Relación de Incidencias Docentes — Universidad Latino (${periodoStr})`;
    const listaAdjuntosStr = archivosAdjuntosHtml.length > 0
      ? archivosAdjuntosHtml.join('')
      : '<li>Ningún archivo adjunto</li>';

    const bodyHtml = `
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; background-color: #f4f6fb; padding: 20px;">
        <div style="max-width: 650px; margin: 0 auto; background: #ffffff; padding: 28px; border-radius: 12px; border: 1px solid #e0e6ed; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="border-bottom: 2px solid #1c355e; padding-bottom: 14px; margin-bottom: 18px;">
                <h2 style="color: #1c355e; margin: 0; font-size: 20px;">
                    UNIVERSIDAD LATINO — SIPREF
                </h2>
                <p style="color: #d97706; font-weight: bold; margin: 4px 0 0 0; font-size: 13px;">
                    Relación de Incidencias Docentes (${periodoStr})
                </p>
            </div>
            
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                ${body.mensaje || 'Se adjunta el reporte oficial de incidencias docentes generado desde el sistema institucional.'}
            </p>

            <table style="width: 100%; border-collapse: collapse; margin: 18px 0; font-size: 13px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr style="background: #1c355e; color: #ffffff;">
                    <th colspan="2" style="padding: 8px 12px; text-align: left; font-size: 12px; text-transform: uppercase;">Resumen del Período</th>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Total de Incidencias:</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${incidencias.length} registros</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Faltas acumuladas:</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #b91c1c;">${resumen.total_faltas ?? 0} (${resumen.total_horas_falta ?? 0} hrs)</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Retardos / Salidas ant.:</td>
                    <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #b45309;">${resumen.total_retardos ?? 0} retardos | ${resumen.total_salidas_anticipadas ?? 0} salidas</td>
                </tr>
                <tr>
                    <td style="padding: 8px 12px; color: #64748b;">Docentes involucrados:</td>
                    <td style="padding: 8px 12px; font-weight: bold; color: #1c355e;">${resumen.docentes_afectados ?? 0} profesores</td>
                </tr>
            </table>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
                <p style="margin: 0; color: #166534; font-size: 13px; font-weight: bold;">
                    📎 Archivo(s) adjunto(s) en este correo:
                </p>
                <ul style="margin: 6px 0 0 0; padding-left: 20px; color: #15803d; font-size: 12px; line-height: 1.6;">
                    ${listaAdjuntosStr}
                </ul>
                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 11px;">
                    Los archivos solicitados se encuentran directamente adjuntos en este mensaje para su descarga directa.
                </p>
            </div>

            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">
                Reporte emitido por <strong>${usuarioNombre}</strong> el ${displayDateTime}.<br/>
                Sistema de Control y Gestión Escolar — Universidad Latino.
            </p>
        </div>
    </body>
    </html>
    `;

    const rawMime = buildMultipartMime({
      fromName: 'SIPREF Incidencias',
      fromEmail: smtpUser,
      destinos,
      ccList,
      asunto,
      bodyHtml,
      attachments,
    });

    await sendSmtpTls({
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      pass: smtpPass,
      fromEmail: smtpUser,
      recipients: allRecipients,
      rawMime,
    });

    res.status(200).json({
      message: `Reporte de incidencias enviado exitosamente a ${destinos.length} destinatario(s)`,
      destinatarios: destinos.length,
    });
  } catch (err) {
    console.error('Error en /api/send-email:', err);
    res.status(500).json({
      detail: `No se pudo enviar el correo con adjuntos: ${err.message}`,
    });
  }
}
