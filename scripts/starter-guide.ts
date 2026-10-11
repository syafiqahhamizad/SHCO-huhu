/**
 * Starter Guide: docs/SHCO-Starter-Guide.pdf (one topic per page), docs/starter-videos.md
 * (what to click and what to say for each short video) and docs/starter-voice/NN-<id>.m4a
 * (the voice-over, made with the Mac's own voice, to lay over a silent screen recording).
 *   npm run guide:starter
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { STARTER } from '../src/components/views/starterGuide';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rich = (s: string) => esc(s).replace(/\[\[([^\]]+)\]\]/g, '<span class="btn">$1</span>').replace(/\*([^*]+)\*/g, '<b>$1</b>');
const plain = (s: string) => s.replace(/\[\[([^\]]+)\]\]/g, '[$1]').replace(/\*([^*]+)\*/g, '$1');
const nn = (i: number) => String(i + 1).padStart(2, '0');
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const html = `<!doctype html><html><head><meta charset="utf-8"><title>SHCO Portal Starter Guide</title>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 20mm 18mm; @bottom-center { content: counter(page); font: 9pt Inter, sans-serif; color: #5B6478; } }
@page :first { @bottom-center { content: none; } }
body { font: 11pt/1.55 Inter, -apple-system, sans-serif; color: #1E2A40; margin: 0; }
h1, h2 { font-family: 'Source Serif 4', Georgia, serif; color: #16223A; margin: 0; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; padding: 28mm 4mm 8mm; border-top: 10px solid #16223A; }
.k { font-size: 10pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #8A6D3B; }
.cover h1 { font-size: 36pt; line-height: 1.1; margin-top: 8mm; }
.cover p { font-size: 12.5pt; color: #5B6478; max-width: 140mm; }
.toc { margin-top: 10mm; } .toc div { display: flex; gap: 4mm; padding: 1.6mm 0; border-bottom: 1px dotted #DDE3EB; } .toc .no { color: #8A6D3B; font-family: ui-monospace, Menlo, monospace; width: 9mm; } .toc .w { margin-left: auto; color: #5B6478; font-size: 9.5pt; }
.topic { page-break-before: always; }
.topic h2 { font-size: 22pt; margin: 2mm 0 1mm; }
.who { font-size: 9pt; font-weight: 700; color: #2F5680; background: #E7EEF6; border-radius: 20px; padding: 1mm 3mm; display: inline-block; }
ol { list-style: none; padding: 0; margin: 6mm 0 0; counter-reset: s; }
ol li { counter-increment: s; display: grid; grid-template-columns: 9mm 1fr; gap: 3mm; margin: 0 0 4mm; }
ol li::before { content: counter(s); display: grid; place-items: center; width: 7mm; height: 7mm; border-radius: 50%; border: 1.5px solid #8A6D3B; background: #FBF5EA; color: #8A6D3B; font: 10pt ui-monospace, Menlo, monospace; }
.btn { display: inline-block; background: #16223A; color: #fff; font-weight: 700; font-size: 9.5pt; border-radius: 3px; padding: 0 1.8mm; white-space: nowrap; }
.video { margin-top: 8mm; border-left: 3px solid #8A6D3B; background: #FBF5EA; padding: 3mm 4mm; font-size: 9.5pt; color: #5B6478; }
</style></head><body>
<div class="cover"><div><div class="k">Syafiqah Hamizad &amp; Co</div><h1>SHCO Portal<br>Starter Guide</h1><p>Your first day in the portal, in ${STARTER.length} short steps. For everything else, open <b>Staff Guide</b> in the portal.</p>
<div class="toc">${STARTER.map((t, i) => `<div><span class="no">${nn(i)}</span><span>${esc(t.title)}</span><span class="w">${esc(t.who)}</span></div>`).join('')}</div></div>
<div style="font-size:9.5pt;color:#5B6478;border-top:1px solid #DDE3EB;padding-top:4mm">${esc(today)} · each step also has a short video</div></div>
${STARTER.map((t, i) => `<section class="topic"><div class="k">Step ${nn(i)}</div><h2>${esc(t.title)}</h2><span class="who">${esc(t.who)}</span>
<ol>${t.do.map((d) => `<li><div>${rich(d)}</div></li>`).join('')}</ol>
<div class="video">Video ${nn(i)} · about ${esc(t.minutes)} min</div></section>`).join('')}
</body></html>`;

const dir = join(tmpdir(), 'shco-starter');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'starter.html'), html);
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find((p) => existsSync(p));
if (!chrome) throw new Error('Google Chrome not found');
const pdf = resolve('docs/SHCO-Starter-Guide.pdf');
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', '--print-to-pdf=' + pdf, 'file://' + join(dir, 'starter.html')], { stdio: 'ignore' });

const md = [`# SHCO Portal: starter videos (${STARTER.length})`, '',
  'Record each video separately. The voice-over file for each one is in `docs/starter-voice/`.', '',
  '## How to record (Mac)', '',
  '1. Use a test file and test client, not a real client’s file. Close other tabs; turn on Do Not Disturb.',
  '2. Open portal.shcolaw.com in Chrome, full screen, zoom 110% (Cmd +).',
  '3. Press **Cmd + Shift + 5** → **Record Selected Portion** → drag the box over the Chrome window → **Options**: Microphone *None* (if you use the voice-over file) or *MacBook Microphone* (if you read the script yourself) → **Record**.',
  '4. Play the voice-over in another window (or read the script) and click along with it, slowly. Pause one second after each click.',
  '5. Stop with the ■ in the menu bar. The video is saved to the Desktop.',
  '6. To put the voice-over on: open the video in **iMovie** → drag the voice-over .m4a under the video → trim to fit → **File › Share › File**.',
  '7. Upload to Google Drive (SHCO Portal › Training), **Share → Anyone at the firm with the link**, copy the link, and paste it on the matching topic in **Staff Guide** (admins see a video button on each topic).', '',
  ...STARTER.flatMap((t, i) => [`## ${nn(i)} · ${t.title} · about ${t.minutes} min`, '', `For: ${t.who}  `, `Voice-over: \`docs/starter-voice/${nn(i)}-${t.id}.m4a\``, '', '**On screen**', '', ...t.do.map((d, j) => `${j + 1}. ${plain(d)}`), '', '**Say**', '', '> ' + t.say, '']),
].join('\n');
writeFileSync(resolve('docs/starter-videos.md'), md);

const voiceDir = resolve('docs/starter-voice');
mkdirSync(voiceDir, { recursive: true });
if (existsSync('/usr/bin/say')) STARTER.forEach((t, i) => execFileSync('/usr/bin/say', ['-r', '165', '-o', join(voiceDir, `${nn(i)}-${t.id}.m4a`), '--data-format=aac', t.say]));
console.log('Wrote ' + pdf + ', docs/starter-videos.md and ' + STARTER.length + ' voice-overs in docs/starter-voice/');
