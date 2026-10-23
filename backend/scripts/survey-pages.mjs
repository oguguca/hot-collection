// Levantamento: examina as páginas de lista da Wiki e mede o que dá para importar.
// Só lê a Wiki. Não mexe no banco. O relatório completo vai para survey-report.txt
import fs from 'fs';
import {
  sleep,
  fetchWikitext,
  listCategoryPages,
  extractTables,
  parseTable,
  deriveLine,
  deriveYear,
} from './lib/wiki-parser.mjs';

const CATEGORIES = [
  'Lists of Hot Wheels by year',
  'Car Culture by Year',
  'Hot Wheels Premium Series/ Sets',
  'Premium Collector Sets',
];

const EXTRA_PAGES = [
  'Premium Collector Set',
  'Car Culture',
  'Car Culture 2-Packs',
  'Car Culture: Team Transport',
  'Racing Culture',
  '2027 Racing Culture',
  'Boulevard',
];
for (let year = 2013; year <= 2027; year++) EXTRA_PAGES.push(`${year} Pop Culture`);

const EXCLUDE = /\(by Series\)|new castings/i;

const titles = new Set(EXTRA_PAGES);
for (const category of CATEGORIES) {
  try {
    const members = await listCategoryPages(category);
    console.log(`Categoria "${category}": ${members.length} páginas`);
    members.filter((t) => !EXCLUDE.test(t)).forEach((t) => titles.add(t));
  } catch (error) {
    console.log(`Falha ao ler a categoria "${category}": ${error.message}`);
  }
}

console.log(`\nPáginas a examinar: ${titles.size}`);

const pageRows = [];
const layouts = new Map();
const unrecognized = new Map();
const identities = new Map(); // código -> (identidade do carrinho -> página)
let index = 0;

for (const title of [...titles].sort()) {
  index++;
  if (index % 20 === 0) console.log(`  ...${index}/${titles.size}`);

  try {
    const page = await fetchWikitext(title);
    if (!page.ok) {
      pageRows.push({ title, error: page.error });
      await sleep(400);
      continue;
    }

    const line = deriveLine(title);
    const tables = extractTables(page.wikitext).map(parseTable);
    const codes = new Set();
    let itemCount = 0;
    let recognizedTables = 0;
    let year = null;

    for (const table of tables) {
      if (!table.recognized) {
        const key = table.headers.join(' | ') || '(sem cabeçalho)';
        unrecognized.set(key, (unrecognized.get(key) ?? 0) + 1);
        continue;
      }
      recognizedTables++;
      layouts.set(table.layout, (layouts.get(table.layout) ?? 0) + 1);

      const tableYear = deriveYear(title, table.headings);
      year = year ?? tableYear;

      for (const item of table.items) {
        itemCount++;
        codes.add(item.toyNumber);
        const identity = `${line}|${tableYear ?? ''}|${item.name}|${item.bodyColor ?? ''}`;
        if (!identities.has(item.toyNumber)) identities.set(item.toyNumber, new Map());
        identities.get(item.toyNumber).set(identity, title);
      }
    }

    pageRows.push({
      title,
      line,
      year,
      tablesTotal: tables.length,
      recognizedTables,
      itemCount,
      distinctCodes: codes.size,
    });
  } catch (error) {
    pageRows.push({ title, error: error.message });
  }

  await sleep(400);
}

const ok = pageRows.filter((r) => !r.error);
const withItems = ok.filter((r) => r.itemCount > 0);
const empty = ok.filter((r) => r.itemCount === 0);
const failed = pageRows.filter((r) => r.error);
const totalItems = withItems.reduce((sum, r) => sum + r.itemCount, 0);
const totalIdentities = [...identities.values()].reduce((sum, m) => sum + m.size, 0);
const shared = [...identities.entries()].filter(([, m]) => m.size > 1);

const report = [];
report.push('=== RESUMO ===');
report.push(`Páginas examinadas: ${pageRows.length}`);
report.push(`Com carrinhos reconhecidos: ${withItems.length}`);
report.push(`Sem carrinhos reconhecidos: ${empty.length}`);
report.push(`Não encontradas/erro: ${failed.length}`);
report.push(`Linhas de carrinhos lidas: ${totalItems}`);
report.push(`Códigos (Toy #) distintos: ${identities.size}`);
report.push(`Carrinhos distintos (código+nome+cor+linha+ano): ${totalIdentities}`);
report.push(`Códigos usados por MAIS DE UM carrinho: ${shared.length}`);

report.push('\n=== LAYOUTS DE TABELA RECONHECIDOS ===');
for (const [layout, count] of [...layouts.entries()].sort((a, b) => b[1] - a[1])) {
  report.push(`${count} tabelas: ${layout}`);
}

report.push('\n=== CÓDIGOS COMPARTILHADOS (até 15 exemplos) ===');
for (const [code, map] of shared.slice(0, 15)) {
  report.push(`${code}: ${[...map.keys()].slice(0, 4).join('  //  ')}`);
}

report.push('\n=== TABELAS NÃO RECONHECIDAS (cabeçalhos mais comuns) ===');
for (const [headers, count] of [...unrecognized.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  report.push(`${count}x: ${headers.slice(0, 120)}`);
}

report.push('\n=== PÁGINAS COM CARRINHOS ===');
report.push('página | linha | ano | tabelas ok/total | carrinhos | códigos');
for (const r of withItems) {
  report.push(
    `${r.title} | ${r.line} | ${r.year ?? '-'} | ${r.recognizedTables}/${r.tablesTotal} | ${r.itemCount} | ${r.distinctCodes}`,
  );
}

report.push('\n=== PÁGINAS SEM CARRINHOS RECONHECIDOS ===');
for (const r of empty) report.push(`${r.title} (${r.tablesTotal} tabelas, nenhuma com Toy # e nome)`);

report.push('\n=== NÃO ENCONTRADAS / ERRO ===');
for (const r of failed) report.push(`${r.title}: ${r.error}`);

fs.writeFileSync('survey-report.txt', report.join('\n'), 'utf8');

console.log('\n' + report.slice(0, 9).join('\n'));
console.log('\nRelatório completo salvo em backend\\survey-report.txt');