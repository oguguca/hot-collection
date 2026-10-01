// Script temporário, só para inspecionar o formato dos dados da Hot Wheels Wiki
// antes de construirmos o parser de verdade.

const WIKI_API = 'https://hotwheels.fandom.com/api.php';
const PAGE = 'List of 2024 Hot Wheels';

async function main() {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(PAGE)}&prop=wikitext&format=json`;
  const response = await fetch(url);
  const data = await response.json();

  const wikitext = data.parse.wikitext['*'];

  // Salva num arquivo local para inspecionarmos juntos
  const fs = await import('fs');
  fs.writeFileSync('wikitext-sample.txt', wikitext);

  console.log('Salvo em backend/wikitext-sample.txt');
  console.log('Tamanho:', wikitext.length, 'caracteres');
  console.log('--- Primeiros 2000 caracteres ---');
  console.log(wikitext.slice(0, 2000));
}

main().catch(console.error);