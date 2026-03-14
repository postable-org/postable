'use client';

import { BrandData } from '@/lib/api/brands';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const TONE_LABELS: Record<string, string> = {
  formal: 'Formal',
  casual: 'Casual',
  bold: 'Ousado',
  friendly: 'Amigável',
  professional: 'Profissional',
  other: 'Outro',
};

const CTA_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  landing_page: 'Landing Page',
  dm: 'Direct Message (DM)',
};

interface StepReviewProps {
  formData: Partial<BrandData>;
  onSubmit: () => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
}

export default function StepReview({ formData, onSubmit, onBack, isLoading, error }: StepReviewProps) {
  return (
    <div className="space-y-6">
      <h2
        className="text-xl font-bold"
        style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
      >
        Revisão
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sua Marca</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-sm text-muted-foreground">Nicho</span>
            <p className="font-medium">{formData.niche || '—'}</p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Localização</span>
            <p className="font-medium">
              {formData.city && formData.state
                ? `${formData.city}, ${formData.state}`
                : '—'}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Tom de Voz</span>
            <p className="font-medium">
              {formData.tone_of_voice
                ? TONE_LABELS[formData.tone_of_voice] ?? formData.tone_of_voice
                : '—'}
              {formData.tone_custom && (
                <span className="block text-sm text-muted-foreground">{formData.tone_custom}</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Canal de CTA</span>
            <p className="font-medium">
              {formData.cta_channel
                ? CTA_LABELS[formData.cta_channel] ?? formData.cta_channel
                : '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
        >
          Voltar
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
        >
          {isLoading ? 'Criando...' : 'Confirmar e Criar Marca'}
        </Button>
      </div>
    </div>
  );
}
