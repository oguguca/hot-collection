import { splitCollectionNumber } from './collection-number.util';

describe('splitCollectionNumber', () => {
  it('separa número e total', () => {
    expect(splitCollectionNumber('120/365')).toEqual({ number: '120', total: 365 });
    expect(splitCollectionNumber(' 3 / 5 ')).toEqual({ number: '3', total: 5 });
  });

  it('mantém zeros à esquerda no número', () => {
    expect(splitCollectionNumber('008/250')).toEqual({ number: '008', total: 250 });
    expect(splitCollectionNumber('000')).toEqual({ number: '000', total: null });
  });

  it('número sem total fica sem total', () => {
    expect(splitCollectionNumber('232')).toEqual({ number: '232', total: null });
  });

  it('preserva marcadores de "sem número" como texto', () => {
    expect(splitCollectionNumber('No #')).toEqual({ number: 'No #', total: null });
    expect(splitCollectionNumber('N/A')).toEqual({ number: 'N/A', total: null });
  });

  it('não transforma valores quebrados em números', () => {
    expect(splitCollectionNumber('75px')).toEqual({ number: '75px', total: null });
    expect(splitCollectionNumber('072 · 196')).toEqual({ number: '072 · 196', total: null });
    expect(splitCollectionNumber('002|Shock Factor|1999 Bonus Cars|2/4|}}')).toEqual({
      number: '002|Shock Factor|1999 Bonus Cars|2/4|}}',
      total: null,
    });
  });

  it('descarta total impossível', () => {
    expect(splitCollectionNumber('365/250')).toEqual({ number: '365/250', total: null });
    expect(splitCollectionNumber('1/0')).toEqual({ number: '1/0', total: null });
  });

  it('remove comentários da Wiki', () => {
    expect(splitCollectionNumber('178<!-- Incorrectly numbered as 160 -->/250')).toEqual({
      number: '178',
      total: 250,
    });
  });

  it('vazio vira nulo', () => {
    expect(splitCollectionNumber(null)).toEqual({ number: null, total: null });
    expect(splitCollectionNumber('   ')).toEqual({ number: null, total: null });
  });
});
