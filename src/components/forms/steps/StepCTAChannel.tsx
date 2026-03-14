'use client';

import { useState } from 'react';

const CTA_OPTIONS = [
  {
    value: 'whatsapp' as const,
    label: 'WhatsApp',
    description: 'Direcione clientes via mensagem direta',
    icon: '📱',
  },
  {
    value: 'landing_page' as const,
    label: 'Landing Page',
    description: 'Envie para uma página de captura ou site',
    icon: '🔗',
  },
  {
    value: 'dm' as const,
    label: 'Direct Message',
    description: 'Engaje via DM direto no Instagram',
    icon: '💬',
  },
];

type CTAChannel = 'whatsapp' | 'landing_page' | 'dm';

interface StepCTAChannelProps {
  defaultChannel?: CTAChannel;
  onNext: (channel: CTAChannel) => void;
}

export default function StepCTAChannel({ defaultChannel, onNext }: StepCTAChannelProps) {
  const [selected, setSelected] = useState<CTAChannel | ''>(defaultChannel ?? '');
  const [error, setError] = useState('');

  const handleNext = () => {
    if (!selected) {
      setError('Selecione um canal de CTA');
      return;
    }
    onNext(selected as CTAChannel);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Canal de CTA</h2>

      <div className="grid gap-3 mb-4">
        {CTA_OPTIONS.map(({ value, label, description, icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSelected(value);
              setError('');
            }}
            className={`border rounded px-4 py-3 text-left transition-colors flex items-start gap-3 ${
              selected === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="font-medium">{label}</div>
              <div className={`text-sm ${selected === value ? 'text-blue-100' : 'text-gray-500'}`}>
                {description}
              </div>
            </div>
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleNext}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Próximo
      </button>
    </div>
  );
}
