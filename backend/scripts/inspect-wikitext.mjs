// Script temporário: mostra como as páginas da Wiki estão estruturadas,
// para construirmos o parser certo.
// Uso: node scripts/inspect-wikitext.mjs "2024 Pop Culture" "2023 Pop Culture"
import fs from 'fs';

const WIKI_API = 'https://hotwheels.fandom.com/api.php';
const pages = process.argv.slice(2);

if (pages.length === 0) {
  console.log('Uso: node scripts/inspect-wikitext.mjs "2024 Pop Culture"');
  process.exit(1);
}

for (const page of pages) {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&redirects=1&format=json`;
  const response = await fetch(url);
  const data = await response.json();

  console.log(`\n==================== ${page} ====================`);

  if (!data.parse) {
    console.log('Página não encontrada:', data.error?.info ?? 'erro desconhecido');
    continue;
  }

  const wikitext = data.parse.wikitext['*'];
  fs.writeFileSync(`wikitext-${page.replace(/[^A-Za-z0-9]+/g, '_')}.txt`, wikitext);

  const tables = (wikitext.match(/^\{\|/gm) ?? []).length;
  console.log(`Tamanho: ${wikitext.length} caracteres | Tabelas: ${tables}`);

  const headings = wikitext
    .split('\n')
    .filter((line) => /^=+[^=].*=+\s*$/.test(line))
    .slice(0, 30);
  console.log('Títulos de seção:');
  headings.forEach((h) => console.log('  ' + h));

  const firstTable = wikitext.indexOf('{|');
  console.log('\n--- Início da primeira tabela ---');
  console.log(wikitext.slice(firstTable, firstTable + 1500));
}