// Corrige as etiquetas Treasure Hunt / Super Treasure Hunt a partir das páginas "AAAA Treasure Hunts Series"
// do cache local da Wiki. Cada página tem uma tabela de TH e outra de STH (título "Super Treasure Hunts" ou
// "Trea$ure Hunt$"); o importador antigo marcava as duas como "Treasure Hunt".
//
// Regras:
//  - TH: a etiqueta vai no registro do próprio carrinho (o TH é o lançamento da linha principal).
//  - STH com registro próprio (código com "S" em 2007-2008, ou linha/série de Treasure Hunts): etiqueta nele.
//  - STH que divide o código com o carrinho comum: ganha um registro de variante próprio (cor e fonte da
//    página de TH, variation "Super Treasure Hunt"); o carrinho comum não leva etiqueta de raridade.
//  - Registros da linha "Treasure Hunts" que repetem um carrinho da linha principal são fundidos nele.
//  - Etiquetas TH/STH que nenhuma página confirma são retiradas.
//  - Qualquer caso ambíguo fica numa lista para decisão manual e não é tocado.
//
//   node scripts/fix-treasure-hunts.mjs          -> SIMULAÇÃO: só lê, grava o plano e o backup em backups/
//   node scripts/fix-treasure-hunts.mjs --save   -> grava (numa única transação; desfaz tudo se algo não bater)
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import {
  extractTables,
  parseTable,
  splitVariation,
  sameCar,
  treasureHuntKind,
  applyWikiErrata,
} from './lib/wiki-parser.mjs';

const prisma = new PrismaClient();
const SAVE = process.argv.includes('--save');
const CACHE_DIR = '.wiki-cache';
const BACKUP_DIR = 'backups';
const SOURCE = 'Hot Wheels Wiki (Fandom)';
const TH = 'Treasure Hunt';
const STH = 'Super Treasure Hunt';
const TH_LINE = 'Treasure Hunts';

// 1. A verdade: carrinhos das páginas de Treasure Hunts, separados por tabela
// Vários títulos redirecionam para a mesma página, então o cache pode ter a página repetida
const thPages = new Map();
for (const file of fs.readdirSync(CACHE_DIR)) {
  const page = JSON.parse(fs.readFileSync(`${CACHE_DIR}/${file}`, 'utf8'));
  if (/^\d{4} Treasure Hunts Series$/.test(page.title)) thPages.set(page.title, page);
}
const truth = [];
for (const page of thPages.values()) {
  const year = parseInt(page.title, 10);
  const url = `https://hotwheels.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
  for (const table of extractTables(page.wikitext).map(parseTable)) {
    if (!table.recognized) continue;
    const kind = treasureHuntKind(table.headings);
    for (const raw of table.items) {
      const item = applyWikiErrata(raw, page.title);
      const { name, variation } = splitVariation(item.name);
      truth.push({ year, code: item.toyNumber, name, variation, bodyColor: item.bodyColor, series: item.series, kind, url });
    }
  }
}

console.log(SAVE ? 'MODO GRAVAÇÃO' : 'MODO SIMULAÇÃO (nada será gravado)');

const db = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const years = [...new Set(truth.map((t) => t.year))];
  const codes = [...new Set(truth.map((t) => t.code))];
  const rows = await tx.hotWheel.findMany({
    where: { OR: [{ code: { in: codes }, year: { in: years } }, { tags: { hasSome: [TH, STH] } }, { line: TH_LINE }] },
    include: { garageItems: true },
  });
  return { rows };
});

const byId = new Map(db.rows.map((r) => [r.id, r]));
const desired = new Map(); // id -> Set de etiquetas TH/STH que o registro deve ter
const merges = []; // { from, into }
const variants = []; // registros de STH a criar
const manual = [];
const seriesFixes = [];
const mergedAway = new Set();

const want = (id, tag) => {
  if (!desired.has(id)) desired.set(id, new Set());
  desired.get(id).add(tag);
};
// Registro que é o próprio TH/STH: veio da linha "Treasure Hunts" ou a lista principal o põe na série
// "Treasure Hunts"/"Super Treasure Hunts" (2007-2011). Uma anotação na série do carrinho comum
// (ex: "'''Super Treasure Hunt'''") não conta: só indica que existe uma versão STH dele.
const LISTING_SERIES = /^(super\s+)?treasure\s+hunts?$/i;
const isOwnThRecord = (r) => r.line === TH_LINE || LISTING_SERIES.test((r.series ?? '').trim());
const MARKER_SERIES = /^'''\s*super\s+treasure\s+hunt\s*'''$/i;

// Código que a própria página de TH usa para dois carrinhos diferentes no mesmo ano: ambíguo
const namesByCodeYear = new Map();
for (const t of truth) {
  const key = `${t.year}|${t.code}`;
  if (!namesByCodeYear.has(key)) namesByCodeYear.set(key, []);
  namesByCodeYear.get(key).push(t.name);
}
const ambiguousCode = (t) => {
  const names = namesByCodeYear.get(`${t.year}|${t.code}`);
  return names.some((n) => !sameCar(n, names[0]));
};

for (const t of truth) {
  if (ambiguousCode(t)) {
    manual.push({ motivo: 'a página de TH usa o mesmo código para carrinhos diferentes', ...pick(t),
      noBanco: db.rows.filter((r) => r.code === t.code && r.year === t.year).map(short) });
    continue;
  }
  const sameCode =db.rows.filter((r) => r.code === t.code && r.year === t.year && !mergedAway.has(r.id));
  // Variante STH já criada: o TH nunca é ela; o STH é ela (rodar o script de novo não muda nada)
  const candidates = sameCode.filter((r) => sameCar(r.name, t.name));
  const variant = candidates.find((r) => r.variation === STH);
  // Variações de cor têm registro próprio: vale o da mesma cor da página de TH, se existir
  const regular = candidates.filter((r) => r.variation !== STH);
  const colorKey = (v) => (v ?? '').trim().toLowerCase();
  const sameColor = regular.filter((r) => colorKey(r.variation) === colorKey(t.variation));
  const matched = t.kind === STH && variant ? [variant] : sameColor.length ? sameColor : regular;

  if (matched.length === 0) {
    manual.push({ motivo: sameCode.length ? 'mesmo código, nome de outro carrinho' : 'não está no banco', ...pick(t), noBanco: sameCode.map(short) });
    continue;
  }

  // Duplicata: um registro da linha "Treasure Hunts" + um da linha principal para o mesmo carrinho
  let rows = matched;
  if (matched.length === 2 && matched.filter((r) => r.line === TH_LINE).length === 1) {
    const from = matched.find((r) => r.line === TH_LINE);
    const into = matched.find((r) => r.line !== TH_LINE);
    merges.push({ from: from.id, into: into.id, reason: `${t.year} ${t.code} "${from.name}" -> "${into.name}"` });
    mergedAway.add(from.id);
    rows = [into];
  }
  if (rows.length !== 1) {
    manual.push({ motivo: 'mais de um registro possível', ...pick(t), noBanco: rows.map(short) });
    continue;
  }

  const record = rows[0];
  if (t.kind === TH) {
    want(record.id, TH);
    continue;
  }

  // STH: registro próprio ou variante do carrinho comum?
  const ownCode = /S$/.test(t.code) && !/S$/.test(t.name);
  // O mesmo registro também é o TH comum (a página lista o carrinho nas duas tabelas): o STH é outra versão
  const alsoTh = truth.some((o) => o.kind === TH && o.year === t.year && o.code === t.code && sameCar(o.name, t.name));
  if (record.variation === STH || ((ownCode || isOwnThRecord(record)) && !alsoTh)) {
    want(record.id, STH);
    continue;
  }
  const existingVariant = db.rows.find(
    (r) => r.code === t.code && r.year === t.year && r.id !== record.id && (r.variation === STH || r.tags.includes(STH)),
  );
  if (existingVariant) {
    want(existingVariant.id, STH);
    continue;
  }
  if (variants.some((v) => v._regular === record.id)) continue;
  // A série do carrinho comum era só a anotação de STH: usa a série que a página de TH informa
  if (MARKER_SERIES.test(record.series ?? '') && t.series) {
    seriesFixes.push({ id: record.id, code: record.code, year: record.year, before: record.series, after: t.series });
    record.series = t.series;
  }
  variants.push({
    code: record.code,
    toyNumber: record.toyNumber ?? record.code,
    name: record.name,
    manufacturer: record.manufacturer,
    year: record.year,
    line: record.line,
    series: record.series,
    collection: record.collection,
    collectionNumber: record.collectionNumber,
    collectionTotal: record.collectionTotal,
    seriesNumber: record.seriesNumber,
    bodyColor: t.bodyColor ?? null,
    variation: STH,
    tags: [STH],
    source: SOURCE,
    sourceUrl: t.url,
    _regular: record.id,
  });
}

function pick(t) {
  return { ano: t.year, codigo: t.code, nome: t.name, tipo: t.kind };
}
function short(r) {
  return `${r.line ?? '-'} | ${r.name} | etiquetas: ${r.tags.join(', ') || '-'}`;
}

// Registros cujas etiquetas TH/STH mudam (incluindo retirar etiquetas sem confirmação)
const manualIds = new Set();
for (const m of manual) {
  for (const r of db.rows.filter((r) => r.code === m.codigo && r.year === m.ano)) manualIds.add(r.id);
}
const tagChanges = [];
for (const r of db.rows) {
  if (mergedAway.has(r.id)) continue;
  const current = r.tags.filter((t) => t === TH || t === STH).sort();
  let target = [...(desired.get(r.id) ?? [])].sort();
  // Registro de caso manual: não retira nada, só acrescenta o que foi confirmado
  if (manualIds.has(r.id) && !desired.has(r.id)) continue;
  if (target.length === 2) target = [STH]; // não deve acontecer; STH prevalece se a Wiki listar nos dois
  if (JSON.stringify(current) === JSON.stringify(target)) continue;
  const others = r.tags.filter((t) => t !== TH && t !== STH);
  tagChanges.push({ id: r.id, code: r.code, year: r.year, name: r.name, line: r.line, before: r.tags, after: [...others, ...target] });
}

// Fusões: etiquetas do registro removido passam para o que fica; itens de garagem também
const mergePlan = merges.map((m) => {
  const from = byId.get(m.from);
  const into = byId.get(m.into);
  const intoUsers = new Set(into.garageItems.map((g) => g.userId));
  return {
    ...m,
    fromRecord: { ...from, garageItems: undefined },
    garageItems: from.garageItems,
    conflicts: from.garageItems.filter((g) => intoUsers.has(g.userId)).length,
  };
});

// 2. Relatório
const count = (list, fn) => list.filter(fn).length;
console.log(`\nPáginas de Treasure Hunts: ${truth.length} carrinhos (${count(truth, (t) => t.kind === TH)} TH, ${count(truth, (t) => t.kind === STH)} STH)`);
console.log(`Fusões de duplicatas (linha "${TH_LINE}" -> linha principal): ${mergePlan.length}`);
mergePlan.forEach((m) => console.log(`  ${m.reason} | itens de garagem: ${m.garageItems.length} | conflitos: ${m.conflicts}`));
console.log(`Variantes STH a criar (o carrinho comum deixa de ter etiqueta de raridade): ${variants.length}`);
console.log(`Registros com etiquetas alteradas: ${tagChanges.length}`);
console.log(`Séries que eram só a anotação de STH: ${seriesFixes.length}`);
seriesFixes.forEach((s) => console.log(`  ${s.year} ${s.code}: "${s.before}" -> "${s.after}"`));

const transitions = new Map();
for (const c of tagChanges) {
  const k = `${c.before.filter((t) => t === TH || t === STH).join('+') || '-'} -> ${c.after.filter((t) => t === TH || t === STH).join('+') || '-'}`;
  transitions.set(k, (transitions.get(k) ?? 0) + 1);
}
for (const [k, n] of [...transitions].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${k}`);

// Por que cada etiqueta TH sai: o carrinho comum de um STH (esperado) ou outro motivo (revisar)
const regularIds = new Set(variants.map((v) => v._regular));
const removedTh = tagChanges.filter((c) => c.before.includes(TH) && !c.after.includes(TH));
const removedOther = removedTh.filter((c) => !regularIds.has(c.id) && !c.after.includes(STH));
console.log(`\nEtiquetas TH retiradas: ${removedTh.length} | de carrinhos comuns que ganham variante STH: ${removedTh.filter((c) => regularIds.has(c.id)).length} | trocadas por STH: ${removedTh.filter((c) => c.after.includes(STH)).length} | outros motivos: ${removedOther.length}`);
removedOther.slice(0, 20).forEach((c) => console.log(`  outro motivo: ${c.year} ${c.code} ${c.line} "${c.name}" [${c.before.join(', ')}]`));
const dupVariants = variants.length - new Set(variants.map((v) => `${v.year}|${v.code}`)).size;
console.log(`Variantes repetidas (mesmo ano e código): ${dupVariants}`);

console.log('\nAmostra de variantes STH:');
variants.filter((_, i) => i % Math.max(1, Math.floor(variants.length / 6)) === 0).slice(0, 6)
  .forEach((v) => console.log(`  ${v.year} ${v.code} ${v.name} [${v.bodyColor ?? '-'}]`));

const finalCount = (tag) => {
  let n = variants.filter((v) => v.tags.includes(tag)).length;
  for (const r of db.rows) {
    if (mergedAway.has(r.id)) continue;
    const change = tagChanges.find((c) => c.id === r.id);
    if ((change ? change.after : r.tags).includes(tag)) n++;
  }
  return n;
};
const before = (tag) => db.rows.filter((r) => r.tags.includes(tag)).length;
console.log(`\nEtiqueta ${TH}: ${before(TH)} -> ${finalCount(TH)}`);
console.log(`Etiqueta ${STH}: ${before(STH)} -> ${finalCount(STH)}`);

console.log(`\n=== PARA DECISÃO MANUAL (${manual.length}) — não serão tocados ===`);
manual.forEach((m) => console.log(`  [${m.motivo}] ${m.ano} ${m.codigo} ${m.tipo} "${m.nome}"${m.noBanco.length ? `\n      no banco: ${m.noBanco.join(' || ')}` : ''}`));

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const planFile = `${BACKUP_DIR}/treasure-hunts-${SAVE ? 'save' : 'simulacao'}-${stamp}.json`;
fs.writeFileSync(planFile, JSON.stringify({ createdAt: new Date().toISOString(), mergePlan, variants, tagChanges, seriesFixes, manual }, null, 2), 'utf8');
console.log(`\nPlano e backup salvos em backend/${planFile}`);

if (!SAVE) {
  console.log('\nSimulação concluída. Rode com --save para gravar.');
  await prisma.$disconnect();
  process.exit(0);
}

if (mergePlan.some((m) => m.conflicts > 0)) {
  console.log('\nGravação BLOQUEADA: fusão com usuário que já tem o outro registro na garagem.');
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.$transaction(
  async (tx) => {
    for (const m of mergePlan) {
      const from = await tx.hotWheel.findUnique({ where: { id: m.from }, include: { garageItems: true } });
      if (!from || JSON.stringify(from.tags) !== JSON.stringify(m.fromRecord.tags) || from.garageItems.length !== m.garageItems.length) {
        throw new Error(`Fusão ${m.reason}: o registro mudou desde a simulação.`);
      }
      await tx.garageItem.updateMany({ where: { hotWheelId: m.from }, data: { hotWheelId: m.into } });
      await tx.hotWheel.delete({ where: { id: m.from } });
    }
    for (const c of tagChanges) {
      const current = await tx.hotWheel.findUnique({ where: { id: c.id }, select: { tags: true } });
      if (!current || JSON.stringify(current.tags) !== JSON.stringify(c.before)) {
        throw new Error(`${c.code} (${c.id}): as etiquetas mudaram desde a simulação.`);
      }
      await tx.hotWheel.update({ where: { id: c.id }, data: { tags: c.after } });
    }
    for (const s of seriesFixes) {
      const result = await tx.hotWheel.updateMany({ where: { id: s.id, series: s.before }, data: { series: s.after } });
      if (result.count !== 1) throw new Error(`${s.code} (${s.id}): a série mudou desde a simulação.`);
    }
    if (variants.length) {
      await tx.hotWheel.createMany({ data: variants.map(({ _regular, ...v }) => v) });
    }
    console.log(`\nFusões: ${mergePlan.length} | etiquetas alteradas: ${tagChanges.length} | variantes criadas: ${variants.length}`);
  },
  { timeout: 600000 },
);
await prisma.$disconnect();
