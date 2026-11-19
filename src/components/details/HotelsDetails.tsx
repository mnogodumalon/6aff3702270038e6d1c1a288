import type { Hotels, Hotelpraeferenzen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';
import { usePermissions } from '@/lib/permissions';

export interface HotelsDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Hotels;
  /** 1:N „Hotelpräferenzen" (hotels_gemocht): VOLLE Liste — der Block filtert auf diesen Record. */
  hotelpraeferenzenHotelsGemochtList: Hotelpraeferenzen[];
  /** Zeilen-Klick → overlay.push auf das Hotelpraeferenzen-Detail (nie der Edit-Dialog). */
  onOpenHotelpraeferenzenHotelsGemocht: (record: Hotelpraeferenzen) => void;
  /** Kontextuelles „+": öffnet den Hotelpraeferenzen-Dialog mit diesem Record vorgesetzt. */
  onAddHotelpraeferenzenHotelsGemocht?: () => void;
  /** „Vorhandene wählen": Listenfeld-Rückbezug — hängt diesen Record an einen bestehenden Hotelpraeferenzen-Datensatz. */
  onPickHotelpraeferenzenHotelsGemocht?: () => void;
  /** 1:N „Hotelpräferenzen" (hotels_nicht_gemocht): VOLLE Liste — der Block filtert auf diesen Record. */
  hotelpraeferenzenHotelsNichtGemochtList: Hotelpraeferenzen[];
  /** Zeilen-Klick → overlay.push auf das Hotelpraeferenzen-Detail (nie der Edit-Dialog). */
  onOpenHotelpraeferenzenHotelsNichtGemocht: (record: Hotelpraeferenzen) => void;
  /** Kontextuelles „+": öffnet den Hotelpraeferenzen-Dialog mit diesem Record vorgesetzt. */
  onAddHotelpraeferenzenHotelsNichtGemocht?: () => void;
  /** „Vorhandene wählen": Listenfeld-Rückbezug — hängt diesen Record an einen bestehenden Hotelpraeferenzen-Datensatz. */
  onPickHotelpraeferenzenHotelsNichtGemocht?: () => void;
}

export function HotelsDetails({
  record,
  hotelpraeferenzenHotelsGemochtList,
  onOpenHotelpraeferenzenHotelsGemocht,
  onAddHotelpraeferenzenHotelsGemocht,
  onPickHotelpraeferenzenHotelsGemocht,
  hotelpraeferenzenHotelsNichtGemochtList,
  onOpenHotelpraeferenzenHotelsNichtGemocht,
  onAddHotelpraeferenzenHotelsNichtGemocht,
  onPickHotelpraeferenzenHotelsNichtGemocht,
}: HotelsDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('hotels', 'hotel_name')} value={record.fields.hotel_name} format="text" />
        <RecordField label={fieldLabel('hotels', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('hotels', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('hotels', 'postleitzahl')} value={record.fields.postleitzahl} format="text" />
        <RecordField label={fieldLabel('hotels', 'ort')} value={record.fields.ort} format="text" />
      </RecordSection>

      <SatelliteSection
        title={`${appLabel('hotelpraeferenzen')} · ${fieldLabel('hotelpraeferenzen', 'hotels_gemocht')}`}
        items={hotelpraeferenzenHotelsGemochtList.filter(r => Array.isArray(r.fields.hotels_gemocht) && r.fields.hotels_gemocht.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: r.fields.vorname ?? appLabel('hotelpraeferenzen'), meta: undefined })}
        onOpen={onOpenHotelpraeferenzenHotelsGemocht}
        onAdd={onAddHotelpraeferenzenHotelsGemocht}
        onPick={onPickHotelpraeferenzenHotelsGemocht}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={`${appLabel('hotelpraeferenzen')} · ${fieldLabel('hotelpraeferenzen', 'hotels_nicht_gemocht')}`}
        items={hotelpraeferenzenHotelsNichtGemochtList.filter(r => Array.isArray(r.fields.hotels_nicht_gemocht) && r.fields.hotels_nicht_gemocht.some((u: unknown) => extractRecordId(u) === record.record_id))}
        map={r => ({ name: r.fields.vorname ?? appLabel('hotelpraeferenzen'), meta: undefined })}
        onOpen={onOpenHotelpraeferenzenHotelsNichtGemocht}
        onAdd={onAddHotelpraeferenzenHotelsNichtGemocht}
        onPick={onPickHotelpraeferenzenHotelsNichtGemocht}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.HOTELS} recordId={record.record_id} readOnly={!perms.canWrite('hotels')} />
    </>
  );
}
