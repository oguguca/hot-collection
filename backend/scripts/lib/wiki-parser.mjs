// Funções compartilhadas para ler as páginas da Hot Wheels Wiki (Fandom, CC BY-SA).
const WIKI_API = 'https://hotwheels.fandom.com/api.php';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWikitext(page) {
  const url =
    `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}` +
    `&prop=wikitext&redirects=1&format=json`;
  const response = await fetch(url);
  if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
  const data = await response.json();
  if (!data.parse) return { ok: false, error: data.error?.info ?? 'página não encontrada' };
  return { ok: true, title: data.parse.title, wikitext: data.parse.wikitext['*'] };
}

export async function listCategoryPages(category) {
  const titles = [];
  let cont = null;
  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      cmtype: 'page',
      format: 'json',
    });
    if (cont) params.set('cmcontinue', cont);
    const response = await fetch(`${WIKI_API}?${params}`);
    const data = await response.json();
    for (const member of data.query?.categorymembers ?? []) {
      if (member.ns === 0) titles.push(member.title);
    }
    cont = data.continue?.cmcontinue ?? null;
    await sleep(300);
  } while (cont);
  return titles;
}

// Remove a marcação da wiki, mantendo apóstrofos simples (ex: '78 Ford)
export function cleanWikiText(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/\[\[File:[^\]]*\]\]/gi, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''/g, '')
    .replace(/''/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Separa atributos de célula (ex: rowspan="2"|HRT54) do conteúdo
function parseCell(raw) {
  const match = raw.match(
    /^((?:\s*[A-Za-z-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s|]+)\s*)+)\|(?!\|)([\s\S]*)$/,
  );
  if (!match) return { text: raw, rowspan: 1 };
  const rowspan = parseInt(match[1].match(/rowspan\s*=\s*"?(\d+)"?/i)?.[1] ?? '1', 10);
  return { text: match[2].trim(), rowspan };
}

// Separa as tabelas da página, guardando os títulos de seção que as antecedem
export function extractTables(wikitext) {
  const tables = [];
  const path = [];
  let current = null;

  for (const rawLine of wikitext.split('\n')) {
    const line = rawLine.trimEnd();

    if (!current) {
      const heading = line.match(/^(=+)\s*(.*?)\s*=+$/);
      if (heading) {
        const level = heading[1].length;
        while (path.length > 0 && path[path.length - 1].level >= level) path.pop();
        path.push({ level, text: cleanWikiText(heading[2]) });
        continue;
      }
    }
    if (line.startsWith('{|')) {
      current = { headings: path.map((h) => h.text), lines: [] };
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

// Lê uma tabela achando as colunas pelo NOME do cabeçalho (não pela posição)
export function parseTable({ headings, lines }) {
  const headerLabels = [];
  const rows = [];
  let row = null;
  let seenData = false;

  for (const line of lines) {
    if (line.startsWith('|-')) {
      if (row) rows.push(row);
      row = [];
      continue;
    }
    if (line.startsWith('|+')) continue;

    if (line.startsWith('!')) {
      const parts = line.slice(1).split('!!');
      if (seenData) {
        if (!row) row = [];
        for (const part of parts) row.push(parseCell(part.trim()));
      } else {
        for (const part of parts) {
          const flat = part.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
          const label = flat.includes('|') ? flat.slice(flat.lastIndexOf('|') + 1) : flat;
          headerLabels.push(cleanWikiText(label).toLowerCase());
        }
      }
      continue;
    }

    if (line.startsWith('|')) {
      seenData = true;
      if (!row) row = [];
      for (const cell of line.slice(1).split('||')) row.push(parseCell(cell.trim()));
      continue;
    }

    // continuação da célula anterior
    if (row && row.length > 0 && line.trim() !== '') {
      row[row.length - 1].text += ' ' + line.trim();
    }
  }
  if (row) rows.push(row);

  // Aplica rowspan: células que "descem" para as linhas seguintes
  const carry = [];
  const grid = [];
  for (const cells of rows) {
    if (cells.length === 0) continue;
    const out = [];
    let col = 0;
    for (const cell of cells) {
      while (carry[col] && carry[col].remaining > 0) {
        out[col] = carry[col].text;
        carry[col].remaining--;
        col++;
      }
      out[col] = cell.text;
      if (cell.rowspan > 1) carry[col] = { text: cell.text, remaining: cell.rowspan - 1 };
      col++;
    }
    while (carry[col] && carry[col].remaining > 0) {
      out[col] = carry[col].text;
      carry[col].remaining--;
      col++;
    }
    grid.push(out);
  }

  const find = (re) => headerLabels.findIndex((label) => re.test(label));
  const idx = {
    toy: find(/^toy\b/),
    name: find(/casting|model\s*name|^name$|^model$/),
    series: find(/^series(\s*name)?$/),
    seriesNumber: find(/series\s*#|^series\s*no/),
    colNumber: find(/^col(lector)?\.?\s*(#|no\.?)?$/),
    theme: find(/theme/),
    bodyColor: find(/body\s*colou?r|^colou?r$/),
    notes: find(/notes?/),
  };

  const layout = Object.entries(idx)
    .filter(([, i]) => i >= 0)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key)
    .join(',');

  // Tabela sem Toy # e nome não é uma lista de carrinhos
  if (idx.toy < 0 || idx.name < 0) {
    return { headings, headers: headerLabels, layout, recognized: false, items: [], skipped: 0 };
  }

  const items = [];
  let skipped = 0;

  for (const cells of grid) {
    const get = (i) => (i >= 0 && cells[i] != null ? cleanWikiText(cells[i]) : '');
    const toyNumber = get(idx.toy).toUpperCase().replace(/\s+/g, '');
    const name = get(idx.name);

    if (!/^(?=.*\d)[A-Z0-9]{4,8}$/.test(toyNumber) || !name) {
      skipped++;
      continue;
    }

    items.push({
      toyNumber,
      name,
      series: get(idx.series).split(' · ')[0] || null,
      seriesNumber: get(idx.seriesNumber) || null,
      colNumber: get(idx.colNumber) || null,
      theme: get(idx.theme) || null,
      bodyColor: get(idx.bodyColor) || null,
      notes: get(idx.notes) || null,
    });
  }

  return { headings, headers: headerLabels, layout, recognized: true, items, skipped };
}

// "List of 2024 Hot Wheels" -> Mainline | "2024 Car Culture" -> Car Culture
export function deriveLine(pageTitle) {
  if (/^List of \d{4} Hot Wheels$/i.test(pageTitle)) return 'Mainline';
  const line = pageTitle
    .replace(/^List of /i, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return line || pageTitle;
}

// Ano vem do título da página ou de um título de seção que seja só o ano
export function deriveYear(pageTitle, headings) {
  const fromTitle = pageTitle.match(/\b(19|20)\d{2}\b/);
  if (fromTitle) return parseInt(fromTitle[0], 10);
  for (const heading of headings) {
    if (/^(19|20)\d{2}$/.test(heading)) return parseInt(heading, 10);
  }
  return null;
}