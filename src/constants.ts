import { Compound, ATOMS } from './types';

export const COMPOUNDS: Record<string, Compound> = {
  'Ethane': {
    name: 'Ethane',
    frontSubstituents: [ATOMS.H, ATOMS.H, ATOMS.H],
    backSubstituents: [ATOMS.H, ATOMS.H, ATOMS.H],
    energyFunction: (phi) => {
      const V0 = 12.6; // kJ/mol
      return (V0 / 2) * (1 + Math.cos(3 * (phi * Math.PI / 180)));
    }
  },
  'Propane': {
    name: 'Propane',
    frontSubstituents: [ATOMS.CH3, ATOMS.H, ATOMS.H],
    backSubstituents: [ATOMS.H, ATOMS.H, ATOMS.H],
    energyFunction: (phi) => {
      const V0 = 14.2; // kJ/mol
      return (V0 / 2) * (1 + Math.cos(3 * (phi * Math.PI / 180)));
    }
  },
  'n-Butane (C2-C3)': {
    name: 'n-Butane (C2-C3)',
    frontSubstituents: [ATOMS.CH3, ATOMS.H, ATOMS.H],
    backSubstituents: [ATOMS.CH3, ATOMS.H, ATOMS.H],
    energyFunction: (phi) => {
      const rad = phi * Math.PI / 180;
      // Empirical formula for butane energy profile
      // E = 1.9 + 4.5*cos(phi) + 1.2*cos(2*phi) + 5.2*cos(3*phi) (approximate)
      // Standard values: Anti (0), Gauche (3.8), Eclipsed H-CH3 (14), Eclipsed CH3-CH3 (19)
      // Let's use a simpler Fourier expansion that fits the key points
      return 10 + 5 * Math.cos(rad) + 2 * Math.cos(2 * rad) + 6 * Math.cos(3 * rad);
    }
  }
};
