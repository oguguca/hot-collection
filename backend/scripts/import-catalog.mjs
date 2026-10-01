// Script de importação do catálogo, a partir da Hot Wheels Wiki (Fandom, CC BY-SA)
// Agora grava de verdade no banco, evitando duplicados pelo código.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WIKI_API = 'https://hotwheels.fandom.com/api.php';
const YEAR = process.argv[2] ? parseInt(process.argv[2], 10) : 2024;
const PAGE = `List of ${YEAR} Hot Wheels`;
const SOURCE = 'Hot Wheels Wiki (Fandom)';
const SOURCE_URL = `https://hotwheels.fandom.com/wiki/${encodeURIComponent(PAGE.replace(/ /g, '_'))}`;

function stripWikiLink(text) {
  const match = text.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!match) return text.trim();
  return (match[2] ?? match[1]).replace(/<[^>]+>/g, '').trim();
}

function extractSeriesName(cell) {
  let text = cell.replace(/^bgcolor="[^"]*"\|/, '');
  const firstLinkMatch = text.match(/\[\[[^\]]+\]\]/);
  if (!firstLinkMatch) return text.trim();
  return stripWikiLink(firstLinkMatch[0]);
}

function extractModelInfo(cell) {
  const variationMatch = cell.match(/\(([^)]*Color[^)]*)\)/i);
  const name = stripWikiLink(cell);
  return {
    name,
    variation: variationMatch ? variationMatch[1].trim() : null,
  };
}

async function fetchAndParse() {
  console.log(`Buscando dados de: ${PAGE}`);
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext&format=json`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.parse) {
    console.error('Página não encontrada ou erro na API:', data.error?.info);
    return [];
  }

  const wikitext = data.parse.wikitext['*'];
  const tableMatch = wikitext.match(/\{\|[\s\S]*?\n\|\}/);
  if (!tableMatch) {
    console.error('Não encontrei nenhuma tabela nessa página.');
    return [];
  }

  const table = tableMatch[0];
  const rows = table.split(/\n\|-\n/).slice(1);
  const results = [];

  for (const row of rows) {
    const cells = row
      .split(/\n\|/)
      .map((c) => c.replace(/^\|/, '').trim())
      .filter((c) => c.length > 0 && !c.startsWith('!'));

    if (cells.length < 5) continue;

    const [toyNumberRaw, colNumberRaw, modelCell, seriesCell, seriesNumberRaw] = cells;
    const toyNumber = toyNumberRaw.trim().toUpperCase();
    if (!/^[A-Z0-9]+$/.test(toyNumber)) continue;

    const { name, variation } = extractModelInfo(modelCell);
    const series = extractSeriesName(seriesCell);

    results.push({
      code: toyNumber,
      toyNumber,
      name,
      variation,
      series,
      seriesNumber: seriesNumberRaw.trim(),
      collectionNumber: `${colNumberRaw.trim()}/250`,
      year: YEAR,
      collection: `${YEAR} Mainline`,
      source: SOURCE,
      sourceUrl: SOURCE_URL,
    });
  }

  return results;
}

async function importToDatabase(items) {
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const existing = await prisma.hotWheel.findUnique({
        where: { code: item.code },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.hotWheel.create({ data: item });
      created++;
    } catch (err) {
      console.error(`Erro ao importar ${item.code}:`, err.message);
      errors++;
    }
  }

  return { created, skipped, errors };
}

async function main() {
  const items = await fetchAndParse();
  console.log(`\n${items.length} modelos extraídos da wiki.`);

  if (items.length === 0) {
    return;
  }

  console.log('Gravando no banco de dados...\n');
  const { created, skipped, errors } = await importToDatabase(items);

  console.log('--- Resumo da importação ---');
  console.log(`Criados:  ${created}`);
  console.log(`Ignorados (já existiam): ${skipped}`);
  console.log(`Erros:    ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());