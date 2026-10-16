// File-format helpers for export: a one-page PDF around a JPEG, and PNG text metadata.
// Pure functions over Uint8Arrays, so they run in the browser and under Node tests alike.
const FileFormats = (function () {
  'use strict';
  const ascii = t => String(t).replace(/[^\x20-\x7e]/g, '');
  const enc = t => { const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i) & 255; return u; };
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const out = new Uint8Array(n); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  // Insert tEXt chunks just before IEND. Keys and values are reduced to printable ASCII.
  function addPngText(png, entries) {
    const iend = png.length - 12;
    const isIend = iend > 8 && png[iend + 4] === 0x49 && png[iend + 5] === 0x45 && png[iend + 6] === 0x4e && png[iend + 7] === 0x44;
    if (!isIend) return png;
    const chunks = Object.keys(entries).map(k => {
      const data = enc(ascii(k).slice(0, 79) + '\0' + ascii(entries[k]));
      const c = new Uint8Array(12 + data.length), dv = new DataView(c.buffer);
      dv.setUint32(0, data.length);
      c.set(enc('tEXt'), 4); c.set(data, 8);
      dv.setUint32(8 + data.length, crc32(c.subarray(4, 8 + data.length)));
      return c;
    });
    return concat([png.subarray(0, iend), ...chunks, png.subarray(iend)]);
  }

  function pdfDate(d) {
    const p = n => String(n).padStart(2, '0');
    return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
  }

  // One page holding the JPEG, centred inside the margins, with a one-line caption underneath.
  // o = { jpeg, width, height, page: [w, h] in points (portrait), margin, captionHeight,
  //       caption, title, creator, date }
  function buildPdf(o) {
    let [pw, ph] = o.page; if (o.width > o.height) [pw, ph] = [ph, pw];
    const margin = o.margin, capH = o.captionHeight;
    const aw = pw - 2 * margin, ah = ph - 2 * margin - capH;
    const sc = Math.min(aw / o.width, ah / o.height), dw = o.width * sc, dh = o.height * sc;
    const dx = (pw - dw) / 2, dy = margin + capH + (ah - dh) / 2;
    const f = n => n.toFixed(2);
    const str = t => '(' + ascii(t).replace(/[\\()]/g, '\\$&') + ')';
    const content = `q ${f(dw)} 0 0 ${f(dh)} ${f(dx)} ${f(dy)} cm /Im0 Do Q\n` +
      (o.caption ? `BT /F1 8 Tf 0.35 0.37 0.42 rg ${f(dx)} ${f(margin)} Td ${str(o.caption)} Tj ET\n` : '');
    const parts = [], offs = []; let len = 0;
    const push = u => { parts.push(u); len += u.length; };
    const obj = (n, body, stream) => {
      offs[n] = len;
      push(enc(`${n} 0 obj\n${body}\n`));
      if (stream) { push(enc('stream\n')); push(stream); push(enc('\nendstream\n')); }
      push(enc('endobj\n'));
    };
    push(enc('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Resources << /XObject << /Im0 4 0 R >> /Font << /F1 6 0 R >> >> /Contents 5 0 R >>`);
    obj(4, `<< /Type /XObject /Subtype /Image /Width ${o.width} /Height ${o.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.jpeg.length} >>`, o.jpeg);
    const cs = enc(content);
    obj(5, `<< /Length ${cs.length} >>`, cs);
    obj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(7, `<< /Title ${str(o.title || 'Untitled')} /Creator ${str(o.creator || '')} /Producer ${str(o.creator || '')} /CreationDate ${str(pdfDate(o.date || new Date()))} >>`);
    const xref = len;
    let x = 'xref\n0 8\n0000000000 65535 f \n';
    for (let n = 1; n <= 7; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
    x += `trailer\n<< /Size 8 /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(enc(x));
    return concat(parts);
  }

  return { crc32, addPngText, buildPdf };
})();
if (typeof module !== 'undefined') module.exports = FileFormats;
