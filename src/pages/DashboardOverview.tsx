import { useMemo } from 'react';
import { IconBuildingSkyscraper, IconHeart, IconPlus, IconThumbDown, IconUsers } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { extractRecordIds } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useClock, gruss, namen } from '@/lib/polish';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatCard, StatCardRow } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { hotels } = data;
  const crud = useEntityCrud(data);
  const prefs = crud.enriched.hotelpraeferenzen;
  const clock = useClock();

  // Likes / dislikes per hotel across all preferences
  const stats = useMemo(() => {
    const likes = new Map<string, number>();
    const dislikes = new Map<string, number>();
    for (const p of prefs) {
      for (const id of extractRecordIds(p.fields.hotels_gemocht)) likes.set(id, (likes.get(id) ?? 0) + 1);
      for (const id of extractRecordIds(p.fields.hotels_nicht_gemocht)) dislikes.set(id, (dislikes.get(id) ?? 0) + 1);
    }
    return hotels.map(h => ({
      hotel: h,
      likes: likes.get(h.record_id) ?? 0,
      dislikes: dislikes.get(h.record_id) ?? 0,
    }));
  }, [hotels, prefs]);

  const newest = useMemo(
    () => [...prefs].sort((a, b) => (b.createdat || '').localeCompare(a.createdat || '')),
    [prefs],
  );
  const ranked = useMemo(
    () => stats.filter(s => s.likes + s.dislikes > 0)
      .sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes)),
    [stats],
  );
  const unrated = useMemo(() => stats.filter(s => s.likes + s.dislikes === 0), [stats]);
  const top = ranked[0];

  const fullName = (p: (typeof prefs)[number]) =>
    `${p.fields.vorname ?? ''} ${p.fields.nachname ?? ''}`.trim() || tx('Ohne Namen');

  const context = prefs.length === 0
    ? tx('Noch keine Präferenz abgegeben — sobald jemand mitmacht, siehst du es hier.')
    : top && top.likes > 0
      ? tx`Zuletzt hat ${namen(newest.slice(0, 2).map(p => p.fields.vorname ?? fullName(p)))} abgestimmt — am beliebtesten ist ${top.hotel.fields.hotel_name ?? ''}.`
      : tx`Zuletzt hat ${namen(newest.slice(0, 2).map(p => p.fields.vorname ?? fullName(p)))} abgestimmt.`;

  const noHotels = hotels.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.hotels.canWrite && (
          <Button onClick={() => crud.hotels.openCreate({})} className="shrink-0">
            <IconPlus size={16} className="shrink-0" />
            {tx('Hotel anlegen')}
          </Button>
        )}
      </div>

      <DashboardGrid
        hero={noHotels && crud.hotels.canWrite ? (
          <HeroBanner
            icon={<IconBuildingSkyscraper size={18} />}
            action={{ label: tx('Erstes Hotel anlegen'), onClick: () => crud.hotels.openCreate({}) }}
          >
            {tx('Lege zuerst Hotels an — nur dann können Leute ihre Präferenzen dazu abgeben.')}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatCardRow>
            <StatCard
              title={tx('Hotels im System')}
              value={hotels.length}
              description={unrated.length > 0 ? tx`${unrated.length} noch ohne Stimme` : tx('Alle Hotels haben Stimmen')}
              icon={<IconBuildingSkyscraper size={18} className="text-muted-foreground" />}
            />
            <StatCard
              title={tx('Abgegebene Präferenzen')}
              value={prefs.length}
              description={newest[0] ? tx`Neueste von ${fullName(newest[0])}` : tx('Noch keine Abgaben')}
              icon={<IconUsers size={18} className="text-muted-foreground" />}
            />
          </StatCardRow>
        }
        primary={
          <WorkList
            title={tx('Neueste Hotelpräferenzen')}
            icon={<IconUsers size={16} />}
            items={newest.map(p => ({
              id: p.record_id,
              title: fullName(p),
              secondLine: (
                <>
                  <span className="font-medium text-emerald-600">
                    {tx`${extractRecordIds(p.fields.hotels_gemocht).length} mag ich`}
                  </span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-medium text-amber-600">
                    {tx`${extractRecordIds(p.fields.hotels_nicht_gemocht).length} mag ich nicht`}
                  </span>
                  <span className="text-muted-foreground"> · {formatDate(p.createdat)}</span>
                </>
              ),
            }))}
            max={8}
            onItemClick={id => {
              const rec = prefs.find(p => p.record_id === id);
              if (rec) crud.hotelpraeferenzen.openDetail(rec);
            }}
            empty={{
              text: tx('Noch keine Präferenzen abgegeben.'),
              action: crud.hotelpraeferenzen.canWrite
                ? { label: tx('Präferenz erfassen'), onClick: () => crud.hotelpraeferenzen.openCreate({}) }
                : undefined,
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Beliebteste Hotels')}
              icon={<IconHeart size={16} />}
              items={ranked.map(s => ({
                id: s.hotel.record_id,
                title: s.hotel.fields.hotel_name ?? tx('Ohne Namen'),
                secondLine: (
                  <>
                    <span className="font-medium text-emerald-600">{tx`${s.likes} mögen`}</span>
                    <span className="text-muted-foreground"> · </span>
                    <span className="font-medium text-amber-600">{tx`${s.dislikes} mögen nicht`}</span>
                  </>
                ),
              }))}
              max={5}
              onItemClick={id => {
                const rec = hotels.find(h => h.record_id === id);
                if (rec) crud.hotels.openDetail(rec);
              }}
              empty={{ text: tx('Sobald Präferenzen eingehen, erscheint hier die Rangliste.') }}
            />
            <WorkList
              title={tx('Noch ohne Stimme')}
              icon={<IconThumbDown size={16} />}
              items={unrated.map(s => ({
                id: s.hotel.record_id,
                title: s.hotel.fields.hotel_name ?? tx('Ohne Namen'),
                secondLine: (
                  <span className="text-muted-foreground">
                    {[s.hotel.fields.postleitzahl, s.hotel.fields.ort].filter(Boolean).join(' ')}
                  </span>
                ),
              }))}
              max={5}
              onItemClick={id => {
                const rec = hotels.find(h => h.record_id === id);
                if (rec) crud.hotels.openDetail(rec);
              }}
              empty={{ text: tx('Jedes Hotel wurde schon bewertet.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
