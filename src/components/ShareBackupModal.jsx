import React, { useState } from 'react';
import { X, FileDown, Download, Upload, ShieldAlert, CheckCircle, FileText } from 'lucide-react';
import { encryptText, generateRandomString } from '../services/crypto';

export default function ShareBackupModal({
  isOpen,
  onClose,
  entry,
  onExportBackup,
  onImportBackup
}) {
  const [sharePasscode, setSharePasscode] = useState('');
  const [exportingHtml, setExportingHtml] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });

  if (!isOpen) return null;

  const handleExportBackup = async () => {
    try {
      const data = await onExportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `vedwriter_backup_${new Date().toISOString().split('T')[0]}.json`);
    } catch (e) {
      console.error(e);
      alert('Failed to export backup.');
    }
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportStatus({ type: '', message: '' });
    setImportPreview(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (!json.journals || !json.entries || !json.settings) {
          throw new Error('Invalid structure');
        }
        setImportPreview({
          journals: json.journals.length,
          entries: json.entries.length
        });
      } catch {
        setImportStatus({ type: 'error', message: 'Invalid backup file. Ensure it\'s a VedWriter backup JSON.' });
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.journals || !json.entries || !json.settings) {
          throw new Error('Invalid backup file structure.');
        }
        await onImportBackup(json);
        setImportStatus({ type: 'success', message: 'Backup restored! Log in with the backup password.' });
        setImportFile(null);
        setImportPreview(null);
      } catch {
        setImportStatus({ type: 'error', message: 'Import failed. Check the file format.' });
      }
    };
    reader.readAsText(importFile);
  };

  const handlePrint = () => { window.print(); };

  // Export as Markdown
  const handleExportMarkdown = () => {
    if (!entry) return;
    const title = entry.title || 'Untitled';
    const body = entry.body || '';
    let md = `# ${title}\n\n`;
    const tagStr = (entry.tags || []).map(t => `#${t}`).join(' ');
    if (tagStr) md += `${tagStr}\n\n`;
    md += htmlToMarkdown(body);
    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, `${sanitizeFilename(title)}.md`);
  };

  // Export as plain text
  const handleExportTxt = () => {
    if (!entry) return;
    const title = entry.title || 'Untitled';
    const text = htmlToPlainText(entry.body || '');
    const out = `${title}\n${'='.repeat(title.length)}\n\n${text}\n\nTags: ${(entry.tags || []).join(', ')}`;
    const blob = new Blob([out], { type: 'text/plain' });
    downloadBlob(blob, `${sanitizeFilename(title)}.txt`);
  };

  // Self-decrypting HTML export
  const handleExportSelfDecryptingHtml = async () => {
    if (!sharePasscode) { alert('Enter a passcode first.'); return; }
    if (!entry) { alert('Select an entry first.'); return; }
    setExportingHtml(true);
    try {
      const salt = generateRandomString(16);
      const iterations = 600000;
      const encTitle = await encryptText(entry.title || 'Untitled Entry', sharePasscode, salt, iterations);
      const encBody = await encryptText(entry.body || '', sharePasscode, salt, iterations);
      const encTags = await encryptText(JSON.stringify(entry.tags || []), sharePasscode, salt, iterations);
      const html = generateSelfDecryptingHtml({ salt, encryptedTitle: encTitle, encryptedBody: encBody, encryptedTags: encTags,
        date: new Date(entry.dateCreated).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        iterations });
      const blob = new Blob([html], { type: 'text/html' });
      downloadBlob(blob, `vedwriter_shared_${entry.id.substring(0, 6)}.html`);
      setSharePasscode('');
      alert('Secure entry downloaded!');
    } catch (e) {
      console.error(e);
      alert('Failed to generate encrypted HTML.');
    } finally { setExportingHtml(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Export & Backup</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {entry && (
            <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>This Page</h4>

              {/* Markdown + TXT row */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleExportMarkdown} style={{ flex: 1 }}>
                  <FileText size={14} /> Markdown
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleExportTxt} style={{ flex: 1 }}>
                  <FileDown size={14} /> Plain .txt
                </button>
              </div>

              {/* Encrypted HTML */}
              <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '12px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Self-decrypting HTML — share securely with a passcode.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="password" className="input" placeholder="Set passcode" value={sharePasscode}
                    onChange={e => setSharePasscode(e.target.value)} style={{ flex: 1, marginBottom: 0, fontSize: '14px', padding: '10px 12px' }} />
                  <button className="btn btn-primary" onClick={handleExportSelfDecryptingHtml} disabled={exportingHtml}>
                    {exportingHtml ? 'Encrypting...' : 'Export'}
                  </button>
                </div>
              </div>

              <button className="btn btn-secondary" onClick={handlePrint} style={{ width: '100%' }}>
                <FileDown size={16} /> Print / Save as PDF
              </button>
            </div>
          )}

          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Full Database Backup</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={handleExportBackup} style={{ width: '100%' }}>
                <Download size={16} /> Export Encrypted Backup
              </button>

              <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Importing overwrites all current journals.
                </p>
                <input type="file" accept=".json" onChange={handleImportFileChange}
                  style={{ fontSize: '13px', marginBottom: '12px', width: '100%' }} />

                {importPreview && (
                  <div style={{
                    padding: '12px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)',
                    borderRadius: '8px', fontSize: '13px', marginBottom: '12px', color: 'var(--text-primary)'
                  }}>
                    <CheckCircle size={14} style={{ color: '#34d399', verticalAlign: 'middle', marginRight: '6px' }} />
                    <strong>{importPreview.journals}</strong> journals, <strong>{importPreview.entries}</strong> entries — ready to restore.
                  </div>
                )}

                {importFile && (
                  <button className="btn btn-danger" onClick={handleImportSubmit} style={{ width: '100%' }}>
                    <Upload size={14} /> Restore Backup
                  </button>
                )}
                {importStatus.message && (
                  <div style={{ marginTop: '12px', fontSize: '13px', color: importStatus.type === 'success' ? '#34d399' : '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {importStatus.type === 'success' ? <CheckCircle size={14} /> : <ShieldAlert size={14} />}
                    <span>{importStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Utilities
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '_').substring(0, 60);
}

function htmlToPlainText(html) {
  const el = document.createElement('div');
  el.innerHTML = html || '';
  return el.textContent || el.innerText || '';
}

function htmlToMarkdown(html) {
  if (!html) return '';
  let md = '';
  const el = document.createElement('div');
  el.innerHTML = html;
  for (const node of el.childNodes) {
    md += nodeToMarkdown(node);
  }
  return md;
}

function nodeToMarkdown(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(n => nodeToMarkdown(n)).join('');

  switch (tag) {
    case 'h1': return `# ${inner}\n\n`;
    case 'h2': return `## ${inner}\n\n`;
    case 'h3': return `### ${inner}\n\n`;
    case 'h4': return `#### ${inner}\n\n`;
    case 'p': return `${inner}\n\n`;
    case 'br': return '\n';
    case 'strong': case 'b': return `**${inner}**`;
    case 'em': case 'i': return `*${inner}*`;
    case 'u': return `__${inner}__`;
    case 'blockquote': return inner.split('\n').filter(l=>l).map(l=>`> ${l}`).join('\n') + '\n\n';
    case 'ul': return inner;
    case 'ol': return inner;
    case 'li': return `- ${inner}\n`;
    case 'div': return `${inner}\n`;
    case 'span': return inner;
    case 'a': return `[${inner}](${node.getAttribute('href') || '#'})`;
    case 'img': return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})`;
    default: return inner;
  }
}

function generateSelfDecryptingHtml({ salt, encryptedTitle, encryptedBody, encryptedTags, date, iterations = 600000 }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>VedWriter | Shared Entry</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Lora&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#0f0f12;--card:#18181b;--acc:#d4d4d8;--t1:#f4f4f5;--t2:#a1a1aa;--b:#27272a}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:var(--bg);color:var(--t1);font-family:'Inter',sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:24px}
    .card{background:var(--card);border:1px solid var(--b);border-radius:16px;padding:40px;width:100%;max-width:420px;text-align:center;box-shadow:0 12px 32px rgba(0,0,0,.35)}
    .icon{width:56px;height:56px;border-radius:50%;background:rgba(212,212,216,.1);border:1px solid rgba(212,212,216,.2);display:flex;justify-content:center;align-items:center;margin:0 auto 20px;color:var(--acc)}
    h2{font-size:22px;margin-bottom:8px}p{color:var(--t2);font-size:14px;margin-bottom:24px}
    input{width:100%;padding:12px 14px;background:rgba(0,0,0,.25);border:1px solid var(--b);border-radius:8px;color:#fff;font-size:15px;margin-bottom:16px;outline:none}input:focus{border-color:var(--acc)}
    button{background:var(--acc);color:var(--bg);border:none;width:100%;padding:12px;border-radius:8px;font-weight:600;font-size:15px;cursor:pointer}
    #paper{display:none;width:100%;max-width:800px;background:#faf9f5;color:#1a1a1a;font-family:'Lora',serif;line-height:1.8;padding:48px 64px;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.4)}
    #paper h1{font-size:30px;margin-bottom:8px}#paper .meta{font-size:13px;color:#6b6b6b;margin-bottom:24px;font-family:'Inter',sans-serif}
    #paper .body{font-size:16px;min-height:300px;white-space:pre-wrap}.tags{margin-top:24px;padding-top:16px;border-top:1px dashed rgba(0,0,0,.1);font-family:'Inter',sans-serif}
    .tag{background:rgba(0,0,0,.05);font-size:12px;padding:4px 10px;border-radius:999px;margin-right:6px}.err{color:#ef4444;font-size:13px;margin-top:8px;display:none}
    @keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}.shake{animation:shake .4s}
  </style></head>
<body>
<div class="card" id="card"><div class="icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>
<h2>Private Entry</h2><p>This entry is encrypted. Enter the passcode.</p>
<input type="password" id="pwd" placeholder="Passcode"><button onclick="unlock()">Decrypt</button><div class="err" id="err">Incorrect passcode.</div></div>
<div id="paper"><h1 id="t"></h1><div class="meta"><span id="d"></span></div><div class="body" id="b"></div><div class="tags" id="tags"></div></div>
<script>
const d={salt:${JSON.stringify(salt)},title:${JSON.stringify(encryptedTitle)},body:${JSON.stringify(encryptedBody)},tags:${JSON.stringify(encryptedTags)},date:${JSON.stringify(date)}};
function b64(u){const b=window.atob(u),l=b.length,o=new Uint8Array(l);for(let i=0;i<l;i++)o[i]=b.charCodeAt(i);return o.buffer}
async function dk(p,s){const e=new TextEncoder();const k=await crypto.subtle.importKey('raw',e.encode(p),{name:'PBKDF2'},false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:e.encode(s),iterations:${iterations},hash:'SHA-256'},k,{name:'AES-GCM',length:256},false,['decrypt'])}
async function dec(j,p,s){const{ct,iv}=JSON.parse(j);const k=await dk(p,s);const b=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b64(iv))},k,b64(ct));return new TextDecoder().decode(b)}
function sanitize(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const badTags = doc.querySelectorAll('script, iframe, object, embed, link, style, meta, head');
  badTags.forEach(x => x.remove());
  const all = doc.querySelectorAll('*');
  all.forEach(el => {
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes[i].name.toLowerCase();
      if (attr.startsWith('on')) el.removeAttribute(el.attributes[i].name);
    }
    if (el.tagName.toLowerCase() === 'a' && el.hasAttribute('href')) {
      const href = el.getAttribute('href').trim().toLowerCase();
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        el.removeAttribute('href');
      }
    }
  });
  return doc.body.innerHTML;
}
async function unlock(){const p=document.getElementById('pwd').value;const er=document.getElementById('err');const c=document.getElementById('card');er.style.display='none';c.classList.remove('shake');
try{const t=await dec(d.title,p,d.salt);const b=await dec(d.body,p,d.salt);const tr=JSON.parse(await dec(d.tags,p,d.salt));document.getElementById('t').textContent=t;document.getElementById('b').innerHTML=sanitize(b);
document.getElementById('d').textContent=d.date;const tc=document.getElementById('tags');tc.innerHTML='';(tr||[]).forEach(x=>{const s=document.createElement('span');s.className='tag';s.textContent='#'+x;tc.appendChild(s)});
c.style.display='none';document.getElementById('paper').style.display='block'}catch(e){er.style.display='block';setTimeout(()=>c.classList.add('shake'),50)}}
document.getElementById('pwd').addEventListener('keypress',e=>{if(e.key==='Enter')unlock()});
</script></body></html>`;
}
