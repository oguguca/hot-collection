export type HotWheelItem = {
  id: string;
  code: string;
  name: string;
  series: string;
  collectionNumber: string;
  year: number;
  favorite: boolean;
};

export const mockGarage: HotWheelItem[] = [
  {
    id: '1',
    code: 'HYY04-N7C6',
    name: 'Nissan Skyline GT-R (BCNR33)',
    series: "HW: '70s vs. '90s",
    collectionNumber: '144/250',
    year: 2025,
    favorite: true,
  },
  {
    id: '2',
    code: 'GTB45-K2P1',
    name: 'Ford Mustang Mach 1',
    series: 'HW Speed Graphics',
    collectionNumber: '32/250',
    year: 2024,
    favorite: false,
  },
  {
    id: '3',
    code: 'HKG89-M4T7',
    name: 'Toyota Supra MK4',
    series: 'Fast & Furious',
    collectionNumber: '5/10',
    year: 2023,
    favorite: true,
  },
];