'use client';

import { BrandData } from '@/lib/api/brands';

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
    <div>
      <h2 className="text-xl font-semibold mb-4">Revisão</h2>

      <div className="bg-gray-50 rounded p-4 mb-6 space-y-3">
        <div>
          <span className="text-sm text-gray-500">Nicho</span>
          <p className="font-medium">{formData.niche || '—'}</p>
        </div>
        <div>
          <span className="text-sm text-gray-500">Localização</span>
          <p className="font-medium">
            {formData.city && formData.state
              ? `${formData.city}, ${formData.state}`
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500">Tom de Voz</span>
          <p className="font-medium">
            {formData.tone_of_voice ? TONE_LABELS[formData.tone_of_voice] ?? formData.tone_of_voice : '—'}
            {formData.tone_custom && (
              <span className="block text-sm text-gray-600">{formData.tone_custom}</span>
            )}
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500">Canal de CTA</span>
          <p className="font-medium">
            {formData.cta_channel ? CTA_LABELS[formData.cta_channel] ?? formData.cta_channel : '—'}
          </p>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="border px-6 py-2 rounded hover:bg-gray-50"
          disabled={isLoading}
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Criando...' : 'Confirmar e Criar Marca'}
        </button>
      </div>
    </div>
  );
}
