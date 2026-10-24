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
  cleanWikiText,
  splitVariation,
  sameCar,
  treasureHuntKind,
  tagsFromSeriesNotes,
  applyWikiErrata,
  subsetOf,
} from './wiki-parser.mjs';

test('tagsFromSeriesNotes: anotações da série viram etiquetas, sem perder nada', () => {
  assert.deepEqual(tagsFromSeriesNotes(['Kmart Exclusive']), ['Kmart Exclusive']);
  assert.deepEqual(tagsFromSeriesNotes(["'Walmart Exclusive", 'Wal-Mart Exclusive']), ['Walmart Exclusive']);
  assert.deepEqual(tagsFromSeriesNotes(['Dollar Tree/Family Dollar Exclusive']), ['Family Dollar/Dollar Tree Exclusive']);
  assert.deepEqual(tagsFromSeriesNotes(['New for 2024!', 'New Model', '10 New Models']), ['New Model']);
  assert.deepEqual(tagsFromSeriesNotes(['New in Mainline']), ['New in Mainline']);
  assert.deepEqual(tagsFromSeriesNotes(['Zamac Exclusive', 'Zamac']), ['Zamac']);
  // Ignorados: posição na série e TH/STH (vêm das páginas de Treasure Hunts)
  assert.deepEqual(tagsFromSeriesNotes(['5/10', '3/5​', 'Super Treasure Hunt', 'Treasure Hunt']), []);
  assert.deepEqual(tagsFromSeriesNotes(['New for 2019!Kroger Exclusive']), ['New Model', 'Kroger Exclusive']);
  assert.deepEqual(tagsFromSeriesNotes(['Kmart', '45']), ['Kmart Exclusive']);
  // Desconhecido: fica com o próprio texto
  assert.deepEqual(tagsFromSeriesNotes(["Ryu's Rides", '"From the Vault" Exclusive']), ["Ryu's Rides", 'From the Vault Exclusive']);
});

test('parseTable guarda as anotações da série em seriesNotes', () => {
  const wikitext = [
    '{|',
    '! Toy # !! Model Name !! Series',
    '|-',
    "| DHY07 || Corvette C7.R || <font>HW Race Team<br>'''Kmart Exclusive'''</font>",
    '|}',
  ].join('\n');
  const [table] = extractTables(wikitext).map(parseTable);
  assert.equal(table.items[0].series, 'HW Race Team');
  assert.deepEqual(table.items[0].seriesNotes, ['Kmart Exclusive']);
});

test('applyWikiErrata corrige só a linha anotada', () => {
  const page = '2012 Treasure Hunts Series';
  assert.equal(applyWikiErrata({ toyNumber: 'V5378', name: "'70 Camaro Road Race" }, page).toyNumber, 'V5371');
  assert.equal(applyWikiErrata({ toyNumber: 'V5378', name: "'69 Camaro" }, page).toyNumber, 'V5378');
  assert.equal(applyWikiErrata({ toyNumber: 'V5378', name: "'70 Camaro Road Race" }, 'Outra').toyNumber, 'V5378');
});

test('subsetOf: ZAMAC é variante própria; os outros subconjuntos têm linha pai', () => {
  assert.equal(subsetOf('ZAMAC First Editions').parent, null);
  assert.equal(subsetOf('First Editions').parent, 'Mainline');
  assert.equal(subsetOf('New Models (International)').parent, 'Mainline (International)');
  assert.equal(subsetOf('Mystery Models').tag, 'Mystery Model');
  assert.equal(subsetOf('Car Culture'), null);
});

test('sameCar reconhece o mesmo carrinho escrito de outro jeito', () => {
  assert.equal(sameCar("'63 Split Window", "Split Window '63"), true);
  assert.equal(sameCar("'71 Buick Riviera", '1971 Buick Riviera'), true);
  assert.equal(sameCar('Nomad', 'Classic Nomad'), true);
  assert.equal(sameCar("'70 Chevy Chevelle SS", "'70 Chevy Chevelle"), true);
  assert.equal(sameCar('1971 Plymouth GTX', "'70 Plymouth Barracuda"), false);
  assert.equal(sameCar("'12 Ford Fiesta", 'Sky Knife'), false);
});

test('treasureHuntKind separa as tabelas de TH e de STH', () => {
  assert.equal(treasureHuntKind(['2024 Treasure Hunts']), 'Treasure Hunt');
  assert.equal(treasureHuntKind(['2024 Super Treasure Hunts']), 'Super Treasure Hunt');
  assert.equal(treasureHuntKind(['2007 Trea$ure Hunt$']), 'Super Treasure Hunt');
  assert.equal(treasureHuntKind(['Super Treasure Hunts']), 'Super Treasure Hunt');
});

test('parseTable não lê largura de imagem ("75px") como código', () => {
  const wikitext = ['{|', '! Toy # !! Model Name', '|-', '| 75px || 75px', '|-', '| HTF30 || Ford Escort RS2000', '|}'].join('\n');
  const [table] = extractTables(wikitext).map(parseTable);
  assert.deepEqual(table.items.map((i) => i.toyNumber), ['HTF30']);
});

test('splitVariation não deixa "·" solto quando a cor vinha depois de um <br>', () => {
  assert.deepEqual(splitVariation(cleanWikiText('[[Ford Focus RS]]<br />(2nd Color)')), {
    name: 'Ford Focus RS',
    variation: '2nd Color',
  });
  assert.deepEqual(splitVariation('Ford Focus RS (2nd Color)'), {
    name: 'Ford Focus RS',
    variation: '2nd Color',
  });
});

test('cleanWikiText não deixa "·" solto nas pontas', () => {
  assert.equal(cleanWikiText('Ram 1500<br>'), 'Ram 1500');
  assert.equal(cleanWikiText('<br />Epic Fast'), 'Epic Fast');
  assert.equal(cleanWikiText('Base code(s): M31<br><br>'), 'Base code(s): M31');
  assert.equal(cleanWikiText('Base code(s):<br>'), 'Base code(s):');
  // "·" no meio continua (separa duas informações)
  assert.equal(cleanWikiText('Porsche Carrera<br>P-911'), 'Porsche Carrera · P-911');
});

test('parseTable limpa atributos de célula e <font> da série', () => {
  const wikitext = [
    '{|',
    '! Toy # !! Col. # !! Model Name !! Series !! Series #',
    '|-',
    '| BFF39 || 106 || [[Ram 1500]]<br> || bgcolor="purple" |<font color="black">HW Glow Wheels</font> || 2/5',
    '|}',
  ].join('\n');
  const [table] = extractTables(wikitext).map(parseTable);
  assert.equal(table.items[0].name, 'Ram 1500');
  assert.equal(table.items[0].series, 'HW Glow Wheels');
  assert.equal(table.items[0].seriesNumber, '2/5');
});

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
