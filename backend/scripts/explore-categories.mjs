// Explora categorias da Hot Wheels Wiki para descobrirmos quais páginas existem.
// Só lê a Wiki. Não mexe no banco.
// Uso: node scripts/explore-categories.mjs "Hot Wheels by Series" [--depth=1]
const WIKI_API = 'https://hotwheels.fandom.com/api.php';

const args = process.argv.slice(2);
const categories = args.filter((a) => !a.startsWith('--'));
const depthArg = args.find((a) => a.startsWith('--depth='));
const MAX_DEPTH = depthArg ? parseInt(depthArg.split('=')[1], 10) : 1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const visited = new Set();

async function listMembers(category) {
  const pages = [];
  const subcats = [];
  let cont = null;

  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      cmtype: 'page|subcat',
      format: 'json',
    });
    if (cont) params.set('cmcontinue', cont);

    const response = await fetch(`${WIKI_API}?${params}`);
    const data = await response.json();

    for (const member of data.query?.categorymembers ?? []) {
      if (member.ns === 14) subcats.push(member.title.replace(/^Category:/, ''));
      else if (member.ns === 0) pages.push(member.title);
    }
    cont = data.continue?.cmcontinue ?? null;
    await sleep(300);
  } while (cont);

  return { pages, subcats };
}

async function explore(category, depth) {
  if (visited.has(category)) return;
  visited.add(category);

  const { pages, subcats } = await listMembers(category);
  const indent = '  '.repeat(depth);

  console.log(`${indent}[${category}] ${pages.length} páginas, ${subcats.length} subcategorias`);
  if (pages.length > 0) {
    console.log(`${indent}  páginas: ${pages.slice(0, 8).join(' | ')}${pages.length > 8 ? ' ...' : ''}`);
  }
  if (subcats.length > 0) {
    console.log(`${indent}  subcategorias: ${subcats.slice(0, 12).join(' | ')}${subcats.length > 12 ? ' ...' : ''}`);
  }

  if (depth < MAX_DEPTH) {
    for (const sub of subcats) await explore(sub, depth + 1);
  }
}

if (categories.length === 0) {
  console.log('Uso: node scripts/explore-categories.mjs "Hot Wheels by Series" [--depth=1]');
  process.exit(1);
}

for (const category of categories) await explore(category, 0);