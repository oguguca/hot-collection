import { BadRequestException } from '@nestjs/common';
import { normalizeCollection } from './catalog.service';

describe('normalizeCollection', () => {
  it('separa "120/365" em número e total', () => {
    expect(normalizeCollection({ collectionNumber: '120/365' })).toEqual({
      collectionNumber: '120',
      collectionTotal: 365,
    });
  });

  it('usa collectionTotal enviado separadamente', () => {
    expect(normalizeCollection({ collectionNumber: '008', collectionTotal: 250 })).toEqual({
      collectionNumber: '008',
      collectionTotal: 250,
    });
  });

  it('sem total informado o total fica nulo', () => {
    expect(normalizeCollection({ collectionNumber: '232' })).toEqual({
      collectionNumber: '232',
      collectionTotal: null,
    });
    expect(normalizeCollection({})).toEqual({ collectionNumber: null, collectionTotal: null });
  });

  it('mantém "No #" como texto, sem total', () => {
    expect(normalizeCollection({ collectionNumber: 'No #' })).toEqual({
      collectionNumber: 'No #',
      collectionTotal: null,
    });
  });

  it('recusa totais divergentes', () => {
    expect(() => normalizeCollection({ collectionNumber: '1/250', collectionTotal: 365 })).toThrow(
      BadRequestException,
    );
  });

  it('recusa número maior que o total', () => {
    expect(() => normalizeCollection({ collectionNumber: '300', collectionTotal: 250 })).toThrow(
      BadRequestException,
    );
  });
});
