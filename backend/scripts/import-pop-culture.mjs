// Importa a linha Pop Culture da Hot Wheels Wiki (Fandom, CC BY-SA).
// Uso:
//   node scripts/import-pop-culture.mjs 2024          -> só mostra o que seria importado
//   node scripts/import-pop-culture.mjs 2024 --save   -> grava no banco
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WIKI_API = 'https://hotwheels.fandom.com/api.php';
const YEAR = parseInt(process.argv[2], 10);
const SAVE = process.argv.includes('--save');
const PAGE = `${YEAR} Pop Culture`;
const SOURCE = 'Hot Wheels Wiki (Fandom)';
const SOURCE_URL = `https://hotwheels.fandom.com/wiki/${encodeURIComponent(PAGE.replace(/ /g, '_'))}`;

if (!YEAR) {
  console.log('Uso: node scripts/import-pop-culture.mjs 2024 [--save]');
  process.exit(1);
}

// Remove a marcação da wiki, mantendo apóstrofos simples (ex: '78 Ford)
function cleanWikiText(text) {
  return text
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Tira atributos de célula, ex: rowspan="2"|HKC23 -> HKC23
function stripCellAttributes(cell) {
  return cell.replace(
    /^(?:\s*[a-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s|]+)\s*)+\|(?!\|)/i,
    '',
  );
}

// Separa as tabelas da página, guardando o título da seção de cada uma
function extractTables(wikitext) {
  const tables = [];
  let heading = '';
  let current = null;

  for (const rawLine of wikitext.split('\n')) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^=+\s*(.*?)\s*=+$/);

    if (!current && headingMatch) {
      heading = cleanWikiText(headingMatch[1]);
      continue;
    }
    if (line.startsWith('{|')) {
      current = { heading, lines: [] };
      continue;
    }
    if (line.startsWith('|}')) {
      if (current) tables.push(current);
      current = null;
      continue;
    }
    if (current) current.lines.push(line);
  }
  return tables;
}

function parseTable({ heading, lines }) {
  const headerLabels = [];
  const rows = [];
  let row = null;

  for (const line of lines) {
    if (line.startsWith('|-')) {
      if (row) rows.push(row);
      row = [];
      continue;
    }
    if (line.startsWith('|+')) continue;

    if (line.startsWith('!')) {
      for (const part of line.slice(1).split('!!')) {
        const label = part.includes('|') ? part.slice(part.lastIndexOf('|') + 1) : part;
        headerLabels.push(cleanWikiText(label).toLowerCase());
      }
      continue;
    }

    if (line.startsWith('|')) {
      if (!row) row = [];
      for (const cell of line.slice(1).split('||')) {
        row.push(stripCellAttributes(cell.trim()));
      }
      continue;
    }

    // linha de continuação da célula anterior
    if (row && row.length > 0 && line.trim() !== '') {
      row[row.length - 1] += ' ' + line.trim();
    }
  }
  if (row) rows.push(row);

  const col = (re) => headerLabels.findIndex((label) => re.test(label));
  const idx = {
    toy: col(/toy\s*#?/),
    name: col(/casting|^name$/),
    theme: col(/theme/),
    color: col(/body\s*colou?r|^colou?r$/),
    seriesNumber: col(/series\s*#/),
    notes: col(/notes?/),
  };

  // Tabela sem Toy # e nome não é uma lista de carrinhos
  if (idx.toy < 0 || idx.name < 0) return { heading, items: [], skipped: 0 };

  const items = [];
  let skipped = 0;

  for (const cells of rows) {
    if (cells.length === 0) continue;
    const get = (i) => (i >= 0 && i < cells.length ? cleanWikiText(cells[i]) : '');

    const toyNumber = get(idx.toy).toUpperCase().replace(/\s+/g, '');
    const name = get(idx.name);

    if (!/^[A-Z0-9]{4,8}$/.test(toyNumber) || !name) {
      skipped++;
      continue;
    }

    items.push({
      code: toyNumber,
      toyNumber,
      name,
      line: 'Pop Culture',
      theme: get(idx.theme) || null,
      bodyColor: get(idx.color) || null,
      series: heading || null,
      seriesNumber: get(idx.seriesNumber) || null,
      collection: `${YEAR} Pop Culture`,
      year: YEAR,
      description: get(idx.notes) || null,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
    });
  }

  return { heading, items, skipped };
}

async function fetchItems() {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext&redirects=1&format=json`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.parse) {
    console.log(`Página "${PAGE}" não encontrada (${data.error?.info ?? 'erro'}).`);
    return [];
  }

  const parsed = extractTables(data.parse.wikitext['*']).map(parseTable);

  const byCode = new Map();
  let duplicates = 0;
  let skipped = 0;

  for (const table of parsed) {
    skipped += table.skipped;
    if (table.items.length > 0) {
      console.log(`  Seção "${table.heading}": ${table.items.length} carrinhos`);
    }
    for (const item of table.items) {
      if (byCode.has(item.code)) duplicates++;
      else byCode.set(item.code, item);
    }
  }

  console.log(`  Linhas ignoradas: ${skipped} | Códigos repetidos na página: ${duplicates}`);
  return [...byCode.values()];
}

async function saveItems(items) {
  const existing = await prisma.hotWheel.findMany({
    where: { code: { in: items.map((i) => i.code) } },
    select: { code: true, name: true },
  });
  const existingMap = new Map(existing.map((e) => [e.code, e.name]));

  const toCreate = items.filter((i) => !existingMap.has(i.code));
  const conflicts = items.filter(
    (i) => existingMap.has(i.code) && existingMap.get(i.code).toLowerCase() !== i.name.toLowerCase(),
  );

  if (toCreate.length > 0) {
    await prisma.hotWheel.createMany({ data: toCreate, skipDuplicates: true });
  }

  console.log('\n--- Resumo ---');
  console.log(`Criados: ${toCreate.length}`);
  console.log(`Já existiam: ${existing.length}`);
  if (conflicts.length > 0) {
    console.log(`Mesmo código com nome diferente (${conflicts.length}):`);
    conflicts.slice(0, 10).forEach((c) =>
      console.log(`  ${c.code}: no banco "${existingMap.get(c.code)}" | na wiki "${c.name}"`),
    );
  }
}

async function main() {
  console.log(`Buscando: ${PAGE}`);
  const items = await fetchItems();
  console.log(`\nTotal extraído: ${items.length}`);

  if (items.length === 0) return;

  console.log('\n--- Primeiros 5 exemplos ---');
  console.log(JSON.stringify(items.slice(0, 5), null, 2));

  if (!SAVE) {
    console.log('\nModo teste: nada foi gravado. Rode com --save para gravar.');
    return;
  }

  await saveItems(items);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());