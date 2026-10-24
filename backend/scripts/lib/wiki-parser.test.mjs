// Testes das regras de número/total de coleção do importador.
//   npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitCollectionNumber,
  totalFromHeadings,
  resolveCollectionNumber,
  extractTables,
  parseTable,
} from './wiki-parser.mjs';

test('splitCollectionNumber separa só o formato número/número', () => {
  assert.deepEqual(splitCollectionNumber('120/365'), { number: '120', total: 365 });
  assert.deepEqual(splitCollectionNumber('008'), { number: '008', total: null });
  assert.deepEqual(splitCollectionNumber('No #'), { number: 'No #', total: null });
  assert.deepEqual(splitCollectionNumber('N/A'), { number: 'N/A', total: null });
  assert.deepEqual(splitCollectionNumber('75px'), { number: '75px', total: null });
  assert.deepEqual(splitCollectionNumber('072 · 196'), { number: '072 · 196', total: null });
  assert.deepEqual(splitCollectionNumber('365/250'), { number: '365/250', total: null });
  assert.deepEqual(splitCollectionNumber('178<!-- x -->/250'), { number: '178', total: 250 });
  assert.deepEqual(splitCollectionNumber(null), { number: null, total: null });
});

test('totalFromHeadings lê "#1-N" do título da seção', () => {
  assert.equal(totalFromHeadings(['Hot Wheels #1-365']), 365);
  assert.equal(totalFromHeadings(['2024 Hot Wheels #1-250', 'Mix A']), 250);
  assert.equal(totalFromHeadings(['2011 New Models']), null);
  assert.equal(totalFromHeadings([]), null);
});

test('resolveCollectionNumber: célula, título ou nulo', () => {
  assert.deepEqual(resolveCollectionNumber('3/5', ['Hot Wheels #1-250']), {
    collectionNumber: '3', collectionTotal: 5, totalFrom: 'cell',
  });
  assert.deepEqual(resolveCollectionNumber('047', ['Hot Wheels #1-365']), {
    collectionNumber: '047', collectionTotal: 365, totalFrom: 'heading',
  });
  // Sem fonte para o total: fica nulo (nada de "/250" por suposição)
  assert.deepEqual(resolveCollectionNumber('023', ['2006 First Editions']), {
    collectionNumber: '023', collectionTotal: null, totalFrom: null,
  });
  // Marcadores e valores quebrados não ganham total
  assert.deepEqual(resolveCollectionNumber('No #', ['Hot Wheels #1-365']), {
    collectionNumber: 'No #', collectionTotal: null, totalFrom: null,
  });
  assert.deepEqual(resolveCollectionNumber('75px', ['Hot Wheels #1-250']), {
    collectionNumber: '75px', collectionTotal: null, totalFrom: null,
  });
  // Número acima do total da seção: total descartado
  assert.equal(resolveCollectionNumber('300', ['Hot Wheels #1-250']).collectionTotal, null);
});

test('tabela real: o título da seção chega até as linhas', () => {
  const wikitext = [
    '==Hot Wheels #1-365==',
    '{|',
    "! Toy # !! Col. # !! Model Name !! Series !! Series #",
    '|-',
    '| FJX93 || 047 || [[Mazda RX-7]] || HW Speed Graphics || 3/10',
    '|-',
    '| FJX94 || No # || Treasure Car || HW Race || 1/5',
    '|}',
  ].join('\n');
  const [table] = extractTables(wikitext).map(parseTable);
  const rows = table.items.map((i) => resolveCollectionNumber(i.colNumber, table.headings));
  assert.deepEqual(rows, [
    { collectionNumber: '047', collectionTotal: 365, totalFrom: 'heading' },
    { collectionNumber: 'No #', collectionTotal: null, totalFrom: null },
  ]);
});
