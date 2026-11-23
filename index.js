#!/usr/bin/env node
'use strict';

/**
 * Discord Media Saver (selfbot)
 * Fluxo: token -> login -> ID do servidor -> varredura -> download com %.
 *
 * AVISO: selfbots violam os Termos de Serviço do Discord. Use por sua conta
 * e risco (de preferência com uma conta secundária).
 *
 * Segurança:
 *  - Token digitado com entrada oculta; nunca é salvo em disco nem exibido.
 *  - Só baixa de cdn.discordapp.com / media.discordapp.net (HTTPS).
 *  - Nomes de arquivo sanitizados + proteção contra path traversal.
 *  - Limite de tamanho por arquivo, só imagens/vídeos.
 *  - Escrita atômica (.part -> arquivo final) e retomada automática.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { once } = require('events');
const readline = require('readline');
const { Client } = require('discord.js-selfbot-v13');

// ───────────────────────── configuração ─────────────────────────
const OUT_DIR = path.resolve(process.env.OUT_DIR || 'downloads');
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 500);
const ALLOWED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
const MEDIA_EXT = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic',
  '.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v',
]);

// ───────────────────────── visual ─────────────────────────
const tty = process.stdout.isTTY;
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
};
const paint = (color, s) => (tty ? `${color}${s}${C.reset}` : s);
const ok = (s) => console.log(`${paint(C.green, '✔')} ${s}`);
const info = (s) => console.log(`${paint(C.cyan, 'ℹ')} ${s}`);
const warn = (s) => console.log(`${paint(C.yellow, '⚠')} ${s}`);
const fail = (s) => console.log(`${paint(C.red, '✖')} ${s}`);

function banner() {
  const art = [
    '╔══════════════════════════════════════════════╗',
    '║        DISCORD  MEDIA  SAVER   •  v1.0       ║',
    '║     fotos & vídeos de um servidor inteiro    ║',
    '╚══════════════════════════════════════════════╝',
  ];
  console.log('\n' + art.map((l) => paint(C.magenta, l)).join('\n') + '\n');
  warn(paint(C.yellow, 'Selfbot viola os ToS do Discord — risco de banimento da conta.'));
  console.log('');
}

function spinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let msg = text;
  const t = setInterval(() => {
    if (tty) process.stdout.write(`\r\x1b[2K${paint(C.cyan, frames[i++ % frames.length])} ${msg}`);
  }, 80);
  return {
    set(m) { msg = m; },
    stop(final) {
      clearInterval(t);
      if (tty) process.stdout.write('\r\x1b[2K');
      if (final) console.log(final);
    },
  };
}

// ───────────────────────── utilidades ─────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);

function fmtBytes(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)}${u[i]}`;
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function bar(pct, width) {
  const filled = Math.round((pct / 100) * width);
  return paint(C.green, '█'.repeat(filled)) + paint(C.gray, '░'.repeat(width - filled));
}

function truncate(s, n) {
  return s.length <= n ? s.padEnd(n) : s.slice(0, n - 1) + '…';
}

function safeName(text, limit = 80) {
  const ext = path.extname(text).toLowerCase().replace(/[^.\w]/g, '');
  const base = path.basename(text, path.extname(text))
    .replace(/[^\p{L}\p{N}._\- ]/gu, '_')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, limit);
  return (base || 'arquivo') + ext;
}

function safePath(...parts) {
  const p = path.resolve(OUT_DIR, ...parts);
  if (!p.startsWith(OUT_DIR + path.sep)) throw new Error(`Caminho inseguro bloqueado: ${p}`);
  return p;
}

function isMedia(att) {
  const ext = path.extname(att.name || '').toLowerCase();
  const type = (att.contentType || '').toLowerCase();
  return MEDIA_EXT.has(ext) || type.startsWith('image/') || type.startsWith('video/');
}

// ───────────────────────── entrada do usuário ─────────────────────────
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}

// Entrada oculta (mostra * no lugar do que é digitado/colado)
function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = '';
    if (!stdin.isTTY) {
      // sem terminal interativo: lê linha normal
      const rl = readline.createInterface({ input: stdin });
      rl.once('line', (l) => { rl.close(); resolve(l.trim()); });
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') { // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        } else if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(value.trim());
        } else if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
        } else if (ch >= ' ') {
          value += ch;
          process.stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}

// ───────────────────────── login ─────────────────────────
async function login() {
  const client = new Client({ checkUpdate: false });
  let token = process.env.DISCORD_TOKEN || '';
  if (!token) token = await askHidden(`${paint(C.cyan, '?')} Cole o token da conta ${paint(C.gray, '(não aparece na tela)')}: `);
  token = token.replace(/^["']|["']$/g, '');
  if (!token) { fail('Token vazio.'); process.exit(1); }

  const spin = spinner('Conectando ao Discord...');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tempo esgotado ao conectar (30s).')), 30000);
      client.once('ready', () => { clearTimeout(timer); resolve(); });
      client.login(token).catch((e) => { clearTimeout(timer); reject(e); });
    });
  } catch (e) {
    spin.stop(`${paint(C.red, '✖')} Falha no login: ${/TOKEN_INVALID|invalid/i.test(e.message) ? 'token inválido.' : e.message}`);
    process.exit(1);
  } finally {
    token = null; // não mantém o token em memória do nosso código
  }
  spin.stop(`${paint(C.green, '✔')} Logado com sucesso como ${paint(C.bold, client.user.tag)} ${paint(C.gray, `(${client.user.id})`)}`);
  return client;
}

async function pickGuild(client) {
  const guilds = [...client.guilds.cache.values()];
  console.log(`\n${paint(C.bold, 'Seus servidores:')}`);
  for (const g of guilds) {
    console.log(`  ${paint(C.gray, g.id)}  ${g.name} ${paint(C.gray, `(${g.memberCount ?? '?'} membros)`)}`);
  }
  console.log('');
  for (;;) {
    const id = await ask(`${paint(C.cyan, '?')} ID do servidor: `);
    if (!/^\d{17,20}$/.test(id)) { fail('ID inválido (são 17–20 números).'); continue; }
    const guild = client.guilds.cache.get(id);
    if (!guild) { fail('A conta não está nesse servidor.'); continue; }
    ok(`Servidor selecionado: ${paint(C.bold, guild.name)}`);
    return guild;
  }
}

// ───────────────────────── varredura ─────────────────────────
async function collectChannels(guild, spin) {
  const map = new Map();
  const add = (ch) => { if (ch && !map.has(ch.id)) map.set(ch.id, ch); };

  for (const ch of guild.channels.cache.values()) add(ch);

  // threads arquivadas/ativas e posts de fóruns
  const parents = [...guild.channels.cache.values()].filter((c) => c.threads && typeof c.threads.fetchArchived === 'function');
  let n = 0;
  for (const parent of parents) {
    spin.set(`Procurando threads... (${++n}/${parents.length})`);
    for (const archived of [false, true]) {
      try {
        let offset = 0;
        for (;;) {
          const r = archived
            ? await parent.threads.fetchArchived({ limit: 25, offset })
            : await parent.threads.fetchActive(true, { limit: 25, offset });
          r.threads.forEach(add);
          if (!r.hasMore || r.threads.size === 0) break;
          offset += 25;
          await sleep(rand(300, 700));
        }
      } catch { /* sem acesso a esse canal */ }
    }
  }
  return [...map.values()].filter((c) => c.messages && typeof c.messages.fetch === 'function');
}

async function scanChannel(ch, files, seen, stats) {
  let before;
  for (;;) {
    let msgs;
    try {
      msgs = await ch.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    } catch {
      stats.denied++;
      return;
    }
    if (!msgs.size) break;
    stats.messages += msgs.size;
    for (const m of msgs.values()) {
      for (const a of m.attachments.values()) {
        if (seen.has(a.id) || !isMedia(a)) continue;
        seen.add(a.id);
        if (a.size > MAX_FILE_MB * 1024 * 1024) { stats.tooBig++; continue; }
        // Tudo numa pasta só: o nome do arquivo carrega canal + id + nome original,
        // então não há necessidade de subpastas e não há colisão de nomes.
        files.push({
          id: a.id, url: a.url, size: a.size || 0,
          name: `${safeName(ch.name || 'canal', 40)}_${a.id}_${safeName(a.name || 'arquivo')}`,
        });
      }
    }
    stats.found = files.length;
    stats.onTick?.();
    before = msgs.last().id;
    if (msgs.size < 100) break;
    await sleep(rand(400, 900)); // pausa para não sobrecarregar a API
  }
}

// ───────────────────────── download ─────────────────────────
let aborted = false;

async function downloadFile(f, onBytes) {
  const u = new URL(f.url);
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) throw new Error(`host não permitido: ${u.hostname}`);

  await fsp.mkdir(path.dirname(f.dest), { recursive: true });
  const tmp = f.dest + '.part';
  let lastErr;

  for (let attempt = 1; attempt <= 3 && !aborted; attempt++) {
    let written = 0;
    let out;
    try {
      const res = await fetch(f.url, { signal: AbortSignal.timeout(600000) });
      if (res.status === 429) {
        await sleep((Number(res.headers.get('retry-after')) || 5) * 1000);
        throw new Error('rate limit (429)');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!ALLOWED_HOSTS.has(new URL(res.url).hostname)) throw new Error('redirecionamento bloqueado');

      out = fs.createWriteStream(tmp);
      const limit = MAX_FILE_MB * 1024 * 1024;
      for await (const chunk of res.body) {
        if (aborted) throw new Error('cancelado');
        written += chunk.length;
        if (written > limit) throw new Error('excedeu limite de tamanho');
        if (!out.write(chunk)) await once(out, 'drain');
        onBytes(chunk.length, written);
      }
      await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
      await fsp.rename(tmp, f.dest);
      return;
    } catch (e) {
      lastErr = e;
      onBytes(-written, 0); // desfaz o progresso da tentativa falha
      out?.destroy();
      await fsp.unlink(tmp).catch(() => {});
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }
  throw lastErr || new Error('falhou');
}

async function runDownloads(files) {
  const totalBytes = files.reduce((s, f) => s + f.size, 0) || 1;
  const startedAt = Date.now();
  let doneBytes = 0;
  let doneFiles = 0;
  let curName = '';
  let curDone = 0;
  let curSize = 1;
  let lastRender = 0;
  let rendered = false;
  const failed = [];

  const render = (force = false) => {
    if (!tty) return;
    const now = Date.now();
    if (!force && now - lastRender < 100) return;
    lastRender = now;

    const cols = process.stdout.columns || 80;
    const filePct = Math.min(100, (curDone / curSize) * 100);
    const totalPct = Math.min(100, (doneBytes / totalBytes) * 100);
    const elapsed = (now - startedAt) / 1000;
    const speed = doneBytes / Math.max(elapsed, 0.5);
    const eta = (totalBytes - doneBytes) / Math.max(speed, 1);
    const barW = Math.max(8, Math.min(30, cols - 66));

    const l1 = ` ${paint(C.gray, 'Arquivo')} ${truncate(curName, Math.max(10, cols - barW - 22))} ${bar(filePct, 12)} ${filePct.toFixed(0).padStart(3)}%`;
    const l2 = ` ${paint(C.bold, 'Total  ')} ${bar(totalPct, barW)} ${paint(C.bold, totalPct.toFixed(1).padStart(5) + '%')} ` +
      `${paint(C.gray, `${doneFiles}/${files.length}`)} ${fmtBytes(doneBytes)}/${fmtBytes(totalBytes)} ` +
      `${paint(C.cyan, fmtBytes(speed) + '/s')} ETA ${fmtTime(eta)}`;

    if (rendered) process.stdout.write('\x1b[2A');
    process.stdout.write(`\r\x1b[2K${l1}\n\r\x1b[2K${l2}\n`);
    rendered = true;
  };

  for (const f of files) {
    if (aborted) break;
    curName = f.name;
    curSize = f.size || 1;
    curDone = 0;
    render(true);
    try {
      await downloadFile(f, (delta, fileWritten) => {
        doneBytes += delta;
        curDone = delta < 0 ? 0 : fileWritten;
        render();
      });
      doneBytes += Math.max(0, f.size - curDone); // acerta diferença de tamanho declarado
      doneFiles++;
    } catch (e) {
      failed.push({ name: f.name, reason: e.message });
      doneBytes += Math.max(0, f.size); // mantém % total coerente
      doneFiles++;
    }
    render(true);
    await sleep(rand(150, 500));
  }
  if (!tty) console.log(`${doneFiles}/${files.length} arquivos processados`);
  return { failed, elapsed: (Date.now() - startedAt) / 1000, bytes: totalBytes };
}

// ───────────────────────── principal ─────────────────────────
async function main() {
  banner();
  const client = await login();

  process.on('SIGINT', () => {
    if (aborted) process.exit(130);
    aborted = true;
    console.log(`\n${paint(C.yellow, '⚠')} Cancelando... (Ctrl+C de novo para forçar). Rode de novo depois para retomar.`);
  });

  const guild = await pickGuild(client);
  const guildDir = `${safeName(guild.name, 60)}_${guild.id}`;

  // 1) canais
  const spin = spinner('Listando canais...');
  const channels = await collectChannels(guild, spin);
  spin.stop(`${paint(C.green, '✔')} ${channels.length} canais/threads encontrados`);

  // 2) varredura de mensagens
  const files = [];
  const seen = new Set();
  const stats = { messages: 0, found: 0, denied: 0, tooBig: 0 };
  const scanSpin = spinner('Lendo o chat...');
  let idx = 0;
  stats.onTick = () => {};
  for (const ch of channels) {
    if (aborted) break;
    idx++;
    stats.onTick = () => scanSpin.set(
      `Lendo o chat ${paint(C.gray, `[${idx}/${channels.length}]`)} #${ch.name}  ` +
      `${paint(C.gray, `${stats.messages} mensagens`)}  ${paint(C.green, `${stats.found} mídias`)}`
    );
    stats.onTick();
    await scanChannel(ch, files, seen, stats);
  }
  scanSpin.stop(`${paint(C.green, '✔')} Varredura concluída: ${stats.messages} mensagens, ${paint(C.bold, String(files.length))} fotos/vídeos`);
  if (stats.denied) warn(`${stats.denied} canais sem permissão de leitura foram pulados`);
  if (stats.tooBig) warn(`${stats.tooBig} arquivos acima de ${MAX_FILE_MB}MB foram ignorados`);

  // 3) retomada: pula o que já foi baixado
  const pending = [];
  let already = 0;
  for (const f of files) {
    f.dest = safePath(guildDir, f.name); // tudo numa pasta só: downloads/<servidor>/
    try {
      const st = await fsp.stat(f.dest);
      if (!f.size || st.size === f.size) { already++; continue; }
    } catch { /* não existe */ }
    pending.push(f);
  }
  if (already) info(`${already} arquivos já estavam salvos (pulados)`);

  if (!pending.length) {
    ok('Nada novo para baixar.');
    client.destroy();
    return;
  }

  const totalSize = pending.reduce((s, f) => s + f.size, 0);
  console.log(`\n${paint(C.bold, 'Baixando')} ${pending.length} arquivos (${fmtBytes(totalSize)}) → ${paint(C.gray, path.join(OUT_DIR, guildDir))}\n`);

  // 4) download com progresso
  const res = await runDownloads(pending);

  // 5) resumo
  const okCount = pending.length - res.failed.length;
  console.log('');
  console.log(paint(C.magenta, '══════════════════ RESUMO ══════════════════'));
  ok(`${okCount} arquivos baixados  ${paint(C.gray, `(${fmtBytes(res.bytes)} em ${fmtTime(res.elapsed)})`)}`);
  if (res.failed.length) {
    fail(`${res.failed.length} falharam (rode novamente para tentar de novo):`);
    res.failed.slice(0, 10).forEach((x) => console.log(`   ${paint(C.gray, '-')} ${x.name}: ${x.reason}`));
    if (res.failed.length > 10) console.log(`   ${paint(C.gray, `... e mais ${res.failed.length - 10}`)}`);
  }
  info(`Pasta: ${path.join(OUT_DIR, guildDir)}`);
  client.destroy();
}

main().then(() => process.exit(0)).catch((e) => {
  fail(`Erro inesperado: ${e.message}`);
  process.exit(1);
});
