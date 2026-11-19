import type { Hotelpraeferenzen } from './app';

export type EnrichedHotelpraeferenzen = Hotelpraeferenzen & {
  hotels_gemochtName: string;
  hotels_nicht_gemochtName: string;
};
