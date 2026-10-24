// Funções compartilhadas para ler as páginas da Hot Wheels Wiki (Fandom, CC BY-SA).
const WIKI_API = 'https://hotwheels.fandom.com/api.php';
const CODE_RE = /^(?=.*\d)[A-Z0-9]{4,8}$/;

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

// Lista as páginas cujo título começa com um prefixo (ex: "2024")
export async function listPagesByPrefix(prefix) {
  const titles = [];
  let cont = null;
  do {
    const params = new URLSearchParams({
      action: 'query',
      list: 'allpages',
      apprefix: prefix,
      aplimit: '500',
      apnamespace: '0',
      format: 'json',
    });
    if (cont) params.set('apcontinue', cont);
    const response = await fetch(`${WIKI_API}?${params}`);
    const data = await response.json();
    for (const page of data.query?.allpages ?? []) titles.push(page.title);
    cont = data.continue?.apcontinue ?? null;
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
    name: find(/casting|model\s*name|car\s*name|^name$|^model$/),
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
    const name = get(idx.name);

    // Uma célula pode ter mais de um código (ex: "HRY51 / HRY52").
    // Códigos só numéricos só valem se forem o primeiro (evita pegar um ano por engano).
    const tokens = get(idx.toy)
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((c) => CODE_RE.test(c));
    const codes = [...new Set(tokens.filter((c, i) => i === 0 || /[A-Z]/.test(c)))];

    if (codes.length === 0 || !name) {
      skipped++;
      continue;
    }

    for (const toyNumber of codes) {
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
  }

  return { headings, headers: headerLabels, layout, recognized: true, items, skipped };
}

// "120/365" -> { number: "120", total: 365 }. O número fica como texto ("008", "No #").
// Só separa o formato exato número/número; qualquer outra coisa fica como veio, sem total.
export function splitCollectionNumber(raw) {
  if (raw == null) return { number: null, total: null };
  const text = String(raw)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[​ ]/g, ' ')
    .trim();
  if (!text) return { number: null, total: null };
  const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return { number: text, total: null };
  const total = parseInt(match[2], 10);
  if (total < 1 || parseInt(match[1], 10) > total) return { number: text, total: null };
  return { number: match[1], total };
}

// Total declarado no título da seção da tabela: "Hot Wheels #1-365", "#1 – 250"
export function totalFromHeadings(headings) {
  for (const heading of [...headings].reverse()) {
    const match = heading.match(/#\s*0*1\s*[-–]\s*(\d{2,4})\b/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

// Número e total de coleção de uma linha de tabela.
// O total vem da célula ("3/5") ou do título da seção; sem uma das duas fontes fica nulo.
export function resolveCollectionNumber(rawColNumber, headings = []) {
  const cell = splitCollectionNumber(rawColNumber);
  if (cell.total) return { collectionNumber: cell.number, collectionTotal: cell.total, totalFrom: 'cell' };

  const headingTotal = totalFromHeadings(headings);
  const isPlainNumber = /^\d+$/.test(cell.number ?? '');
  if (headingTotal && isPlainNumber && parseInt(cell.number, 10) <= headingTotal) {
    return { collectionNumber: cell.number, collectionTotal: headingTotal, totalFrom: 'heading' };
  }
  return { collectionNumber: cell.number, collectionTotal: null, totalFrom: null };
}

// Separa "(2nd Color)" do nome, como o importador antigo fazia
export function splitVariation(rawName) {
  const match = rawName.match(/\s*\(([^)]*colou?r[^)]*)\)\s*/i);
  if (!match) return { name: rawName.trim(), variation: null };
  return {
    name: rawName.replace(match[0], ' ').replace(/\s+/g, ' ').trim(),
    variation: match[1].trim(),
  };
}

// "List of 2024 Hot Wheels" -> Mainline | "2024 Car Culture" -> Car Culture
export function deriveLine(pageTitle) {
  const mainline = pageTitle.match(/^List of (?:19|20)\d{2} Hot Wheels\s*(.*)$/i);
  if (mainline) return mainline[1] ? `Mainline ${mainline[1]}` : 'Mainline';
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

// Nome da seção da tabela (ex: "Mix 1", "German Racers"), ignorando títulos que são só o ano
export function deriveSection(pageTitle, headings) {
  for (let i = headings.length - 1; i >= 0; i--) {
    const heading = headings[i];
    if (!heading || /^(19|20)\d{2}$/.test(heading)) continue;
    if (heading.toLowerCase() === pageTitle.toLowerCase()) continue;
    return heading;
  }
  return null;
}