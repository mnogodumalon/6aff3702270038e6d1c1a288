import type { Hotelpraeferenzen, Hotels } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { usePermissions } from '@/lib/permissions';

export interface HotelpraeferenzenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Hotelpraeferenzen;
  /** N:1-Ziel „Hotels": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  hotelsList: Hotels[];
  /** Reserviert — Hotels ist hier nur über ein Mehrfach-Feld verknüpft (Text-Join, keine Einzel-Relation); Übergabe erlaubt, aber ohne Wirkung. */
  onOpenHotels?: (record: Hotels) => void;
}

export function HotelpraeferenzenDetails({
  record,
  hotelsList,
}: HotelpraeferenzenDetailsProps) {
  // attachments are a write to this record — read-only without the platform right
  const perms = usePermissions();
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('hotelpraeferenzen', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('hotelpraeferenzen', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('hotelpraeferenzen', 'hotels_gemocht')} value={Array.isArray(record.fields.hotels_gemocht) ? record.fields.hotels_gemocht.map((u: unknown) => hotelsList.find(t => t.record_id === extractRecordId(u))?.fields.hotel_name ?? '—').join(', ') : null} format="text" />
        <RecordField label={fieldLabel('hotelpraeferenzen', 'hotels_nicht_gemocht')} value={Array.isArray(record.fields.hotels_nicht_gemocht) ? record.fields.hotels_nicht_gemocht.map((u: unknown) => hotelsList.find(t => t.record_id === extractRecordId(u))?.fields.hotel_name ?? '—').join(', ') : null} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.HOTELPRAEFERENZEN} recordId={record.record_id} readOnly={!perms.canWrite('hotelpraeferenzen')} />
    </>
  );
}
