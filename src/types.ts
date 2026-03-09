export interface Substituent {
  name: string;
  color: string;
  size: number; // For energy calculation weighting
}

export interface Compound {
  name: string;
  frontSubstituents: [Substituent, Substituent, Substituent];
  backSubstituents: [Substituent, Substituent, Substituent];
  energyFunction: (angle: number) => number;
}

export const ATOMS = {
  H: { name: 'H', color: '#CBD5E1', size: 1 },
  CH3: { name: 'CH3', color: '#F43F5E', size: 3 },
  Cl: { name: 'Cl', color: '#22C55E', size: 2.5 },
  Br: { name: 'Br', color: '#8B5CF6', size: 3.5 },
};
