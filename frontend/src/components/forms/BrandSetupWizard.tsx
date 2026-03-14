'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandData, createBrand } from '@/lib/api/brands';
import { Progress } from '@/components/ui/progress';
import StepNicheLocation from './steps/StepNicheLocation';
import StepToneOfVoice from './steps/StepToneOfVoice';
import StepCTAChannel from './steps/StepCTAChannel';
import StepReview from './steps/StepReview';

const TOTAL_STEPS = 4;

export default function BrandSetupWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<BrandData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleStep1Next = (data: { niche: string; city: string; state: string }) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setCurrentStep(2);
  };

  const handleStep2Next = (tone: string, toneCustom?: string) => {
    setFormData((prev) => ({
      ...prev,
      tone_of_voice: tone,
      tone_custom: toneCustom ?? null,
    }));
    setCurrentStep(3);
  };

  const handleStep3Next = (channel: 'whatsapp' | 'landing_page' | 'dm') => {
    setFormData((prev) => ({ ...prev, cta_channel: channel }));
    setCurrentStep(4);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitError('');
    try {
      await createBrand(formData as BrandData);
      router.push('/dashboard');
    } catch {
      setSubmitError('Erro ao criar marca. Tente novamente.');
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground mb-2">
          Passo {currentStep} de {TOTAL_STEPS}
        </p>
        <Progress value={(currentStep / TOTAL_STEPS) * 100} />
      </div>

      {currentStep === 1 && (
        <StepNicheLocation
          defaultValues={{
            niche: formData.niche,
            city: formData.city,
            state: formData.state,
          }}
          onNext={handleStep1Next}
        />
      )}

      {currentStep === 2 && (
        <StepToneOfVoice
          defaultTone={formData.tone_of_voice}
          defaultToneCustom={formData.tone_custom ?? undefined}
          onNext={handleStep2Next}
        />
      )}

      {currentStep === 3 && (
        <StepCTAChannel
          defaultChannel={formData.cta_channel}
          onNext={handleStep3Next}
        />
      )}

      {currentStep === 4 && (
        <StepReview
          formData={formData}
          onSubmit={handleSubmit}
          onBack={() => setCurrentStep(3)}
          isLoading={isLoading}
          error={submitError}
        />
      )}
    </div>
  );
}
