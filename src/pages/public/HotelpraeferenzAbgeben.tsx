import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, prepareChallenge,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm, useJourneySubmit, useRecordSearch, fieldText,
  type JourneyRecord,
} from '@/lib/journey';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'hotelpraeferenz-abgeben';

function hotelItem(r: JourneyRecord) {
  const street = `${fieldText(r, 'strasse')} ${fieldText(r, 'hausnummer')}`.trim();
  const city = `${fieldText(r, 'postleitzahl')} ${fieldText(r, 'ort')}`.trim();
  return {
    id: r.id,
    title: fieldText(r, 'hotel_name'),
    subtitle: [street, city].filter(Boolean).join(', '),
  };
}

function Flow({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const [step, setStep] = useState(1);

  const f = useStepForm('hotelpraeferenzen', {
    fields: ['vorname', 'nachname', 'hotels_gemocht', 'hotels_nicht_gemocht'],
    steps: { vorname: 1, nachname: 1, hotels_gemocht: 2, hotels_nicht_gemocht: 3 },
    autoComplete: true,
  });

  const searchOpts = {
    searchFields: ['hotel_name', 'ort'] as ('hotel_name' | 'ort')[],
    toItem: hotelItem,
  };
  const likes = useRecordSearch(port, 'hotels', searchOpts);
  const dislikes = useRecordSearch(port, 'hotels', searchOpts);

  const submit = useJourneySubmit(
    port,
    [{ key: 'praeferenz', entity: 'hotelpraeferenzen', form: f, primary: true }],
    { draftKey: SLUG },
  );

  useEffect(() => {
    prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(e => e.op === 'create')?.app_id ?? ''}/records`);
  }, [cfg, page]);

  const likeProps = f.records('hotels_gemocht', id => likes.labelOf(id));
  const dislikeProps = f.records('hotels_nicht_gemocht', id => dislikes.labelOf(id));

  const steps = [
    { label: tx('Name'), key: 'name' },
    { label: tx('Hotels, die ich mag'), key: 'mag' },
    { label: tx('Hotels, die ich nicht mag'), key: 'mag-nicht' },
    { label: tx('Prüfen'), key: 'pruefen' },
  ];

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[f]}
      draftKey={SLUG}
    >
      {step === 1 && (
        <>
          <div className="space-y-4">
            <Bound form={f} name="vorname" />
            <Bound form={f} name="nachname" />
          </div>
          <StepNav
            hideBack
            onNext={() => f.validate(['vorname', 'nachname'])}
            nextStepLabel={tx('Hotels, die ich mag')}
          />
        </>
      )}
      {step === 2 && (
        <>
          <Field form={f} name="hotels_gemocht">
          <EntitySelectStep
            {...likes.select}
            {...likeProps}
            searchPlaceholder={tx('Hotel suchen')}
            avatar="none"
          />
          </Field>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['hotels_gemocht'])}
            nextStepLabel={tx('Hotels, die ich nicht mag')}
          />
        </>
      )}
      {step === 3 && (
        <>
          <Field form={f} name="hotels_nicht_gemocht">
          <EntitySelectStep
            {...dislikes.select}
            {...dislikeProps}
            searchPlaceholder={tx('Hotel suchen')}
            avatar="none"
          />
          </Field>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => f.validate(['hotels_nicht_gemocht'])}
            nextStepLabel={tx('Prüfen')}
          />
        </>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[f]}
          submit={submit}
          whatHappensNext={tx('Danke! Deine Hotelpräferenz wird gespeichert.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          title={tx('Danke für deine Angaben')}
        />
      )}
    </IntentWizardShell>
  );
}

export default function HotelpraeferenzAbgeben() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  return (
    <PublicShell
      title={tx('Hotelpräferenz abgeben')}
      description={tx('Sag uns, welche Hotels du magst und welche nicht.')}
    >
      <Flow cfg={cfg} page={page} />
    </PublicShell>
  );
}
