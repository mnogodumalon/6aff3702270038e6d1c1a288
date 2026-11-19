import type { EnrichedHotelpraeferenzen } from '@/types/enriched';
import type { Hotelpraeferenzen, Hotels } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface HotelpraeferenzenMaps {
  hotelsMap: Map<string, Hotels>;
}

export function enrichHotelpraeferenzen(
  hotelpraeferenzen: Hotelpraeferenzen[],
  maps: HotelpraeferenzenMaps
): EnrichedHotelpraeferenzen[] {
  return hotelpraeferenzen.map(r => ({
    ...r,
    hotels_gemochtName: resolveDisplay(r.fields.hotels_gemocht, maps.hotelsMap, 'hotel_name'),
    hotels_nicht_gemochtName: resolveDisplay(r.fields.hotels_nicht_gemocht, maps.hotelsMap, 'hotel_name'),
  }));
}
