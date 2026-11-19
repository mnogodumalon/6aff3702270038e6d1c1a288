/**
 * Hotelpräferenz abgeben — 4-Schritt-Wizard.
 * Steps: 1) Name eintragen → 2) Hotels wählen, die du magst → 3) Hotels wählen, die du nicht magst → 4) Prüfen & speichern.
 * Reads: hotels. Writes: hotelpraeferenzen (via useHotelpraeferenzAbgebenFlow).
 * Composes: IntentWizardShell, Bound, Field, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { useHotelpraeferenzAbgebenFlow } from '@/lib/journey/flows/HotelpraeferenzAbgeben';
import { tx } from '@/i18n';

export default function HotelpraeferenzAbgebenPage() {
  const [step, setStep] = useState(1);
  const hotelItem = (r: Parameters<typeof fieldText>[0]) => {
    const street = `${fieldText(r, 'strasse')} ${fieldText(r, 'hausnummer')}`.trim();
    const city = `${fieldText(r, 'postleitzahl')} ${fieldText(r, 'ort')}`.trim();
    return {
      id: r.id,
      title: fieldText(r, 'hotel_name'),
      subtitle: [street, city].filter(Boolean).join(', '),
    };
  };
  const flow = useHotelpraeferenzAbgebenFlow({
    steps: { vorname: 1, nachname: 1, hotels_gemocht: 2, hotels_nicht_gemocht: 3 },
    items: { hotels_gemocht: hotelItem, hotels_nicht_gemocht: hotelItem },
  });
  const form = flow.forms.hotelpraeferenzen;

  return (
    <IntentWizardShell
      title={tx('Hotelpräferenz abgeben')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Sag uns, welche Hotels du magst und welche nicht.'),
        needs: [tx('Dein Vor- und Nachname')],
      }}
    >
      <WizardStep label={tx('Name')} description={tx('Trag deinen Vor- und Nachnamen ein.')}>
        <div className="space-y-4">
          <Bound form={form} name="vorname" />
          <Bound form={form} name="nachname" />
          <StepNav hideBack onNext={() => flow.validateStep(1)} nextStepLabel={tx('Hotels, die du magst')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Gemocht')} heading={tx('Hotels, die du magst')} description={tx('Wähle alle Hotels aus, die dir gefallen.')}>
        <div className="space-y-4">
          <Field form={form} name="hotels_gemocht">
            <EntitySelectStep {...flow.picks.hotels_gemocht.select} {...flow.pickMany('hotels_gemocht')} avatar="none" />
          </Field>
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Hotels, die du nicht magst')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Nicht gemocht')} heading={tx('Hotels, die du nicht magst')} description={tx('Wähle alle Hotels aus, die dir nicht gefallen.')}>
        <div className="space-y-4">
          <Field form={form} name="hotels_nicht_gemocht">
            <EntitySelectStep {...flow.picks.hotels_nicht_gemocht.select} {...flow.pickMany('hotels_nicht_gemocht')} avatar="none" />
          </Field>
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Deine Hotelpräferenz wird gespeichert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[{ label: tx('Zum Dashboard'), href: '#/' }]}
        />
      )}
    </IntentWizardShell>
  );
}
