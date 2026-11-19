/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'hotels'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.hotels.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.hotels.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.hotels.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.hotels              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   hotels: hotel_name, strasse, hausnummer, postleitzahl, ort  ·  ← hotelpraeferenzen (list + contextual + + choose existing) · ← hotelpraeferenzen (list + contextual + + choose existing)
 *   hotelpraeferenzen: vorname, nachname, hotels_gemocht, hotels_nicht_gemocht  ·  → hotels
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Hotels, Hotelpraeferenzen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordIds } from '@/services/livingAppsService';
import { enrichHotelpraeferenzen } from '@/lib/enrich';
import type { EnrichedHotelpraeferenzen } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { HotelsDialog, type HotelsDialogDefaults } from '@/components/dialogs/HotelsDialog';
import { HotelsDetails } from '@/components/details/HotelsDetails';
import { HotelpraeferenzenDialog, type HotelpraeferenzenDialogDefaults } from '@/components/dialogs/HotelpraeferenzenDialog';
import { HotelpraeferenzenDetails } from '@/components/details/HotelpraeferenzenDetails';
import { PickExistingDialog } from '@/components/PickExistingDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'hotels'; record: Hotels }
  | { type: 'hotelpraeferenzen'; record: EnrichedHotelpraeferenzen };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  hotels: EntityCrudApi<Hotels, HotelsDialogDefaults>;
  hotelpraeferenzen: EntityCrudApi<Hotelpraeferenzen, HotelpraeferenzenDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { hotels: Hotels[]; hotelpraeferenzen: EnrichedHotelpraeferenzen[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
  const [hotelsDialog, setHotelsDialog] = useState<{ defaults?: HotelsDialogDefaults; editing?: Hotels } | null>(null);
  const [hotelpraeferenzenDialog, setHotelpraeferenzenDialog] = useState<{ defaults?: HotelpraeferenzenDialogDefaults; editing?: Hotelpraeferenzen } | null>(null);
  // „Vorhandene wählen" für den Listenfeld-Rückbezug hotelpraeferenzen.hotels_gemocht → hotels: hält die Hub-record_id.
  const [pickHotelsHotelpraeferenzenHotelsGemocht, setPickHotelsHotelpraeferenzenHotelsGemocht] = useState<string | null>(null);
  // „Vorhandene wählen" für den Listenfeld-Rückbezug hotelpraeferenzen.hotels_nicht_gemocht → hotels: hält die Hub-record_id.
  const [pickHotelsHotelpraeferenzenHotelsNichtGemocht, setPickHotelsHotelpraeferenzenHotelsNichtGemocht] = useState<string | null>(null);
  const enrichedHotelpraeferenzen = useMemo(() => enrichHotelpraeferenzen(data.hotelpraeferenzen, { hotelsMap: data.hotelsMap }), [data.hotelpraeferenzen, data.hotelsMap]);

  function detailHotels(record: Hotels, push = false) {
    const item: OverlayItem = { type: 'hotels', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitHotels(fields: Hotels['fields']) {
    const editing = hotelsDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setHotels(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateHotel(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('hotels')} — ${t('crud_updated')}`, async () => {
        data.setHotels(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateHotel(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createHotel(fields);
      undoToast(`${appLabel('hotels')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  // Link an EXISTING Hotelpraeferenzen to the Hotels hub: append the hub URL to the
  // source's list field. Optimistic setter first, PATCH, undoToast counter-write.
  async function linkHotelsHotelpraeferenzenHotelsGemocht(sourceId: string) {
    const hub = pickHotelsHotelpraeferenzenHotelsGemocht;
    const src = data.hotelpraeferenzen.find(r => r.record_id === sourceId);
    if (!hub || !src) return;
    const ids = extractRecordIds(src.fields.hotels_gemocht);
    if (ids.includes(hub)) return;
    const next = [...ids, hub].map(id => createRecordUrl(APP_IDS.HOTELS, id));
    data.setHotelpraeferenzen(list => list.map(r => (r.record_id === sourceId ? { ...r, fields: { ...r.fields, hotels_gemocht: next } } : r)));
    try {
      await LivingAppsService.updateHotelpraeferenzenEntry(sourceId, { hotels_gemocht: next });
    } catch (err) {
      data.fetchAll();
      throw err;
    }
    undoToast(`${appLabel('hotelpraeferenzen')} — ${t('pick_linked')}`, async () => {
      data.setHotelpraeferenzen(list => list.map(r => (r.record_id === sourceId ? src : r)));
      try { await LivingAppsService.updateHotelpraeferenzenEntry(sourceId, { hotels_gemocht: src.fields.hotels_gemocht }); } catch { data.fetchAll(); }
    });
  }

  // Link an EXISTING Hotelpraeferenzen to the Hotels hub: append the hub URL to the
  // source's list field. Optimistic setter first, PATCH, undoToast counter-write.
  async function linkHotelsHotelpraeferenzenHotelsNichtGemocht(sourceId: string) {
    const hub = pickHotelsHotelpraeferenzenHotelsNichtGemocht;
    const src = data.hotelpraeferenzen.find(r => r.record_id === sourceId);
    if (!hub || !src) return;
    const ids = extractRecordIds(src.fields.hotels_nicht_gemocht);
    if (ids.includes(hub)) return;
    const next = [...ids, hub].map(id => createRecordUrl(APP_IDS.HOTELS, id));
    data.setHotelpraeferenzen(list => list.map(r => (r.record_id === sourceId ? { ...r, fields: { ...r.fields, hotels_nicht_gemocht: next } } : r)));
    try {
      await LivingAppsService.updateHotelpraeferenzenEntry(sourceId, { hotels_nicht_gemocht: next });
    } catch (err) {
      data.fetchAll();
      throw err;
    }
    undoToast(`${appLabel('hotelpraeferenzen')} — ${t('pick_linked')}`, async () => {
      data.setHotelpraeferenzen(list => list.map(r => (r.record_id === sourceId ? src : r)));
      try { await LivingAppsService.updateHotelpraeferenzenEntry(sourceId, { hotels_nicht_gemocht: src.fields.hotels_nicht_gemocht }); } catch { data.fetchAll(); }
    });
  }

  function detailHotelpraeferenzen(record: Hotelpraeferenzen, push = false) {
    const rec = enrichedHotelpraeferenzen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'hotelpraeferenzen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitHotelpraeferenzen(fields: Hotelpraeferenzen['fields']) {
    const editing = hotelpraeferenzenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setHotelpraeferenzen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateHotelpraeferenzenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('hotelpraeferenzen')} — ${t('crud_updated')}`, async () => {
        data.setHotelpraeferenzen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateHotelpraeferenzenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createHotelpraeferenzenEntry(fields);
      undoToast(`${appLabel('hotelpraeferenzen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <HotelsDialog
        open={hotelsDialog !== null}
        onClose={() => setHotelsDialog(null)}
        onSubmit={submitHotels}
        defaultValues={hotelsDialog?.defaults}
        recordId={hotelsDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Hotels']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Hotels']}
      />
      <HotelpraeferenzenDialog
        open={hotelpraeferenzenDialog !== null}
        onClose={() => setHotelpraeferenzenDialog(null)}
        onSubmit={submitHotelpraeferenzen}
        defaultValues={hotelpraeferenzenDialog?.defaults}
        recordId={hotelpraeferenzenDialog?.editing?.record_id}
        hotelsList={data.hotels}
        enablePhotoScan={AI_PHOTO_SCAN['Hotelpraeferenzen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Hotelpraeferenzen']}
      />
      <PickExistingDialog
        open={pickHotelsHotelpraeferenzenHotelsGemocht !== null}
        onClose={() => setPickHotelsHotelpraeferenzenHotelsGemocht(null)}
        title={t('pick_title', { title: appLabel('hotelpraeferenzen') })}
        items={data.hotelpraeferenzen
          .filter(r => !extractRecordIds(r.fields.hotels_gemocht).includes(pickHotelsHotelpraeferenzenHotelsGemocht ?? ''))
          .map(r => ({ id: r.record_id, label: String(r.fields.vorname ?? appLabel('hotelpraeferenzen')) }))}
        onPick={linkHotelsHotelpraeferenzenHotelsGemocht}
      />
      <PickExistingDialog
        open={pickHotelsHotelpraeferenzenHotelsNichtGemocht !== null}
        onClose={() => setPickHotelsHotelpraeferenzenHotelsNichtGemocht(null)}
        title={t('pick_title', { title: appLabel('hotelpraeferenzen') })}
        items={data.hotelpraeferenzen
          .filter(r => !extractRecordIds(r.fields.hotels_nicht_gemocht).includes(pickHotelsHotelpraeferenzenHotelsNichtGemocht ?? ''))
          .map(r => ({ id: r.record_id, label: String(r.fields.vorname ?? appLabel('hotelpraeferenzen')) }))}
        onPick={linkHotelsHotelpraeferenzenHotelsNichtGemocht}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'hotels') {
            return (
              <>
                <RecordHeader title={top.record.fields.hotel_name ?? appLabel('hotels')} subtitle={undefined} />
                <HotelsDetails
                  record={top.record}
                  hotelpraeferenzenHotelsGemochtList={data.hotelpraeferenzen}
                  onOpenHotelpraeferenzenHotelsGemocht={(r) => detailHotelpraeferenzen(r, true)}
                  onAddHotelpraeferenzenHotelsGemocht={perms.canWrite('hotelpraeferenzen') ? () => setHotelpraeferenzenDialog({ defaults: { hotels_gemocht: [createRecordUrl(APP_IDS.HOTELS, top.record.record_id)] } }) : undefined}
                  onPickHotelpraeferenzenHotelsGemocht={perms.canWrite('hotelpraeferenzen') ? () => setPickHotelsHotelpraeferenzenHotelsGemocht(top.record.record_id) : undefined}
                  hotelpraeferenzenHotelsNichtGemochtList={data.hotelpraeferenzen}
                  onOpenHotelpraeferenzenHotelsNichtGemocht={(r) => detailHotelpraeferenzen(r, true)}
                  onAddHotelpraeferenzenHotelsNichtGemocht={perms.canWrite('hotelpraeferenzen') ? () => setHotelpraeferenzenDialog({ defaults: { hotels_nicht_gemocht: [createRecordUrl(APP_IDS.HOTELS, top.record.record_id)] } }) : undefined}
                  onPickHotelpraeferenzenHotelsNichtGemocht={perms.canWrite('hotelpraeferenzen') ? () => setPickHotelsHotelpraeferenzenHotelsNichtGemocht(top.record.record_id) : undefined}
                />
              </>
            );
          }
          if (top.type === 'hotelpraeferenzen') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('hotelpraeferenzen')} subtitle={undefined} />
                <HotelpraeferenzenDetails
                  record={top.record}
                  hotelsList={data.hotels}
                />
              </>
            );
          }
          return null;
        }}
        canEdit={(top) => {
          if (top.type === 'hotels') return perms.canWrite('hotels');
          if (top.type === 'hotelpraeferenzen') return perms.canWrite('hotelpraeferenzen');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'hotels') setHotelsDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'hotelpraeferenzen') setHotelpraeferenzenDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    hotels: {
      openCreate: (defaults?: HotelsDialogDefaults) => (perms.canWrite('hotels') ? setHotelsDialog({ defaults }) : refuse()),
      openEdit: (record: Hotels) => (perms.canWrite('hotels') ? setHotelsDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Hotels) => detailHotels(record, false),
      canWrite: perms.canWrite('hotels'),
    },
    hotelpraeferenzen: {
      openCreate: (defaults?: HotelpraeferenzenDialogDefaults) => (perms.canWrite('hotelpraeferenzen') ? setHotelpraeferenzenDialog({ defaults }) : refuse()),
      openEdit: (record: Hotelpraeferenzen) => (perms.canWrite('hotelpraeferenzen') ? setHotelpraeferenzenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Hotelpraeferenzen) => detailHotelpraeferenzen(record, false),
      canWrite: perms.canWrite('hotelpraeferenzen'),
    },
    enriched: { hotels: data.hotels, hotelpraeferenzen: enrichedHotelpraeferenzen },
  };
}
