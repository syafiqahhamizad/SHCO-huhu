/**
 * Prints the Staff Guide (src/components/views/guideContent.ts) to docs/SHCO-Staff-Guide.pdf.
 *   npm run guide:pdf
 * Uses Google Chrome (headless) to turn the generated HTML into an A4 PDF.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROLES, SECTIONS, type Section, type Step } from '../src/components/views/guideContent';

const PARTS: [string, string, string[]][] = [
  ['A', 'Everyone', ['signin', 'screen', 'day', 'alerts', 'leave', 'claims', 'calendar', 'help']],
  ['B', 'Running files', ['clients', 'conflict', 'file', 'tabs', 'assign', 'tasks', 'court', 'service', 'weekly', 'letters', 'time', 'close', 'leads']],
  ['C', 'Billing and money', ['finhome', 'billing', 'trust', 'approvals', 'prepare']],
  ['D', 'Admin', ['users', 'perms', 'settings', 'google', 'logs']],
  ['E', 'Clients', ['portal']],
];

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s: string) => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<span class="btn">$1</span>').replace(/\*([^*]+)\*/g, '<b>$1</b>');
const who = (s: Section) =>
  s.roles === 'all' ? 'Everyone' : s.roles === 'admin' ? 'Admins only' : s.roles === 'billing' ? 'People with billing access'
    : s.roles.map((r) => ROLES.find(([k]) => k === r)?.[1] || r).join(' · ');
const stepHtml = (st: Step, i: number) => {
  const t = typeof st === 'string' ? st : st.t;
  const sub = typeof st === 'string' ? undefined : st.sub;
  return `<li><span class="n">${i + 1}</span><div>${rich(t)}${sub ? `<ul>${sub.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>` : ''}</div></li>`;
};

let n = 0;
const byId = new Map(SECTIONS.map((s) => [s.id, s]));
const used = new Set(PARTS.flatMap((p) => p[2]));
const leftovers = SECTIONS.filter((s) => !used.has(s.id)).map((s) => s.id);
if (leftovers.length) PARTS.push(['F', 'More', leftovers]);
const numbered: { part: string; s: Section; no: number }[] = [];
for (const [p, , ids] of PARTS) for (const id of ids) { const s = byId.get(id); if (s) numbered.push({ part: p, s, no: ++n }); }

const topic = ({ s, no }: { s: Section; no: number }) => `
<section class="topic">
  <div class="th"><span class="no">${String(no).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><span class="tag">${esc(who(s))}</span></div>
  ${s.what ? `<p class="lead"><b>What it is:</b> ${rich(s.what)}</p>` : ''}
  ${s.who ? `<p class="lead"><b>Who:</b> ${rich(s.who)}</p>` : ''}
  ${s.intro ? `<p>${rich(s.intro)}</p>` : ''}
  ${s.before ? `<div class="box"><div class="h">Before you start</div><ul>${s.before.map((x) => `<li>${rich(x)}</li>`).join('')}</ul></div>` : ''}
  ${s.steps ? `<div class="h">Step by step</div><ol class="steps">${s.steps.map(stepHtml).join('')}</ol>` : ''}
  ${s.cases ? `<div class="h">Other situations</div><table>${s.cases.map(([a, b]) => `<tr><th>${rich(a)}</th><td>${rich(b)}</td></tr>`).join('')}</table>` : ''}
  ${s.stuck ? `<div class="h">If you see this</div><table class="stuck">${s.stuck.map(([a, b]) => `<tr><th>${rich(a)}</th><td>${rich(b)}</td></tr>`).join('')}</table>` : ''}
  ${s.mistakes ? `<div class="h">Common mistakes</div><ul>${s.mistakes.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>` : ''}
  ${s.tip ? `<p class="tip">${rich(s.tip)}</p>` : ''}
</section>`;

const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
const html = `<!doctype html><html><head><meta charset="utf-8"><title>SHCO Portal Staff Guide</title>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 18mm 16mm 18mm 16mm; @bottom-center { content: counter(page); font: 9pt Inter, sans-serif; color: #5B6478; } @bottom-left { content: "SHCO Portal · Staff Guide"; font: 8pt Inter, sans-serif; color: #94A3B8; } }
@page :first { @bottom-center { content: none; } @bottom-left { content: none; } }
* { box-sizing: border-box; }
body { font: 10pt/1.5 Inter, -apple-system, sans-serif; color: #1E2A40; margin: 0; }
h1, h2, h3 { font-family: 'Source Serif 4', Georgia, serif; color: #16223A; margin: 0; }
.cover { height: 255mm; display: flex; flex-direction: column; justify-content: space-between; padding: 30mm 6mm 10mm; border-top: 10px solid #16223A; }
.cover .k { font-size: 10pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #8A6D3B; }
.cover h1 { font-size: 34pt; line-height: 1.1; margin-top: 8mm; }
.cover p { font-size: 12pt; color: #5B6478; max-width: 140mm; }
.cover .meta { font-size: 9.5pt; color: #5B6478; border-top: 1px solid #DDE3EB; padding-top: 4mm; }
.page { page-break-before: always; }
.toc h2, .how h2 { font-size: 18pt; margin-bottom: 4mm; }
.toc .part { margin-top: 5mm; font-weight: 700; color: #8A6D3B; text-transform: uppercase; letter-spacing: .1em; font-size: 8.5pt; }
.toc .row { display: flex; gap: 4mm; padding: 1.4mm 0; border-bottom: 1px dotted #DDE3EB; }
.toc .row .no { font-family: ui-monospace, Menlo, monospace; color: #8A6D3B; width: 8mm; }
.toc .row .t { flex: 1; } .toc .row .w { color: #5B6478; font-size: 8.5pt; }
.how table { width: 100%; border-collapse: collapse; margin-top: 3mm; } .how td, .how th { border: 1px solid #DDE3EB; padding: 2mm 3mm; text-align: left; vertical-align: top; }
.parthead { page-break-before: always; padding: 8mm 0 4mm; border-bottom: 3px solid #16223A; margin-bottom: 4mm; }
.parthead .k { font-size: 9pt; font-weight: 700; letter-spacing: .14em; color: #8A6D3B; text-transform: uppercase; }
.parthead h2 { font-size: 22pt; }
.topic { padding: 4mm 0 5mm; border-bottom: 1px solid #DDE3EB; }
.topic + .topic { margin-top: 2mm; }
.th { display: flex; align-items: baseline; gap: 3mm; margin-bottom: 2mm; break-after: avoid; }
.th .no { font-family: ui-monospace, Menlo, monospace; font-size: 10pt; color: #8A6D3B; }
.th h3 { font-size: 14.5pt; flex: 1; }
.tag { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #2F5680; background: #E7EEF6; border-radius: 20px; padding: 1mm 2.5mm; white-space: nowrap; }
p { margin: 1.5mm 0; } .lead { max-width: 170mm; }
.h { margin: 3.5mm 0 1.5mm; font-size: 8pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #5B6478; break-after: avoid; }
.box { background: #F6F8FA; border: 1px solid #DDE3EB; border-radius: 6px; padding: 1mm 4mm 2mm; margin: 2.5mm 0; break-inside: avoid; }
ul { margin: 1mm 0; padding-left: 5mm; } li { margin: .6mm 0; }
ol.steps { list-style: none; padding: 0; margin: 0; }
ol.steps > li { display: grid; grid-template-columns: 7mm 1fr; gap: 2.5mm; margin: 2mm 0; break-inside: avoid; }
ol.steps .n { display: inline-grid; place-items: center; width: 5.5mm; height: 5.5mm; border-radius: 50%; border: 1px solid #8A6D3B; background: #FBF5EA; color: #8A6D3B; font: 8pt ui-monospace, Menlo, monospace; }
ol.steps ul { color: #4A5468; font-size: 9.3pt; }
.btn { display: inline-block; background: #16223A; color: #fff; font-weight: 700; font-size: 8.5pt; border-radius: 3px; padding: 0 1.5mm; white-space: nowrap; }
table { width: 100%; border-collapse: collapse; } table th, table td { border-top: 1px solid #EEF1F5; padding: 1.6mm 2mm; text-align: left; vertical-align: top; }
table th { width: 52mm; font-weight: 600; color: #16223A; } table tr { break-inside: avoid; }
table.stuck th { color: #8E2A20; }
.tip { border-left: 3px solid #8A6D3B; background: #FBF5EA; padding: 2mm 3mm; border-radius: 0 4px 4px 0; break-inside: avoid; }
</style></head><body>
<div class="cover">
  <div><div class="k">Syafiqah Hamizad &amp; Co · Advocates &amp; Solicitors</div><h1>SHCO Portal<br>Staff Guide</h1>
  <p>How to use the firm’s portal, step by step: from signing in to files, court dates, claims, billing and settings.</p></div>
  <div class="meta">Draft for review · ${esc(today)} · ${numbered.length} topics · The portal shows each person only the topics for their own role.</div>
</div>
<div class="page how"><h2>How to read this guide</h2>
<p>Each topic follows the same order: <b>what it is</b>, <b>who</b> does it, <b>before you start</b>, <b>step by step</b>, <b>other situations</b>, <b>if you see this</b> (messages on screen and what to do) and <b>common mistakes</b>. Button names are shown like <span class="btn">this</span> and match the screen exactly.</p>
<table><tr><th>Tag on a topic</th><th>Who sees it in the portal</th></tr>
<tr><td>Everyone</td><td>Every staff member.</td></tr>
${ROLES.map(([, label, sub]) => `<tr><td>${esc(label)}</td><td>${esc(sub)}</td></tr>`).join('')}
<tr><td>People with billing access</td><td>Only people the Super Admin allows in Users &amp; Roles › Billing &amp; money.</td></tr>
<tr><td>Admins only</td><td>Admins and the Super Admin.</td></tr></table>
<div class="toc" style="margin-top:8mm"><h2>Contents</h2>
${PARTS.map(([p, name]) => `<div class="part">Part ${p} · ${esc(name)}</div>${numbered.filter((x) => x.part === p).map((x) => `<div class="row"><span class="no">${String(x.no).padStart(2, '0')}</span><span class="t">${esc(x.s.title)}</span><span class="w">${esc(who(x.s))}</span></div>`).join('')}`).join('')}
</div></div>
${PARTS.map(([p, name]) => `<div class="parthead"><div class="k">Part ${p}</div><h2>${esc(name)}</h2></div>${numbered.filter((x) => x.part === p).map(topic).join('')}`).join('')}
</body></html>`;

const dir = join(tmpdir(), 'shco-guide');
mkdirSync(dir, { recursive: true });
const htmlPath = join(dir, 'guide.html');
writeFileSync(htmlPath, html);
const out = resolve('docs/SHCO-Staff-Guide.pdf');
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => existsSync(p));
if (!chrome) throw new Error('Google Chrome not found');
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', '--print-to-pdf=' + out, 'file://' + htmlPath], { stdio: 'ignore' });
console.log('Wrote ' + out + ' (' + numbered.length + ' topics)');
