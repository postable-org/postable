'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Link, Send } from 'lucide-react';

const CTA_OPTIONS = [
  {
    value: 'whatsapp' as const,
    label: 'WhatsApp',
    description: 'Direcione clientes via mensagem direta',
    Icon: MessageCircle,
  },
  {
    value: 'landing_page' as const,
    label: 'Landing Page',
    description: 'Envie para uma página de captura ou site',
    Icon: Link,
  },
  {
    value: 'dm' as const,
    label: 'Direct Message',
    description: 'Engaje via DM direto no Instagram',
    Icon: Send,
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
    <div className="space-y-6">
      <h2
        className="text-xl font-bold"
        style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
      >
        Canal de CTA
      </h2>

      <div className="grid gap-3">
        {CTA_OPTIONS.map(({ value, label, description, Icon }) => (
          <Button
            key={value}
            type="button"
            variant={selected === value ? 'default' : 'outline'}
            onClick={() => {
              setSelected(value);
              setError('');
            }}
            className="h-auto justify-start gap-3 py-3 px-4"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <div className="font-medium">{label}</div>
              <div className={`text-xs font-normal ${selected === value ? 'opacity-70' : 'text-muted-foreground'}`}>
                {description}
              </div>
            </div>
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={handleNext}>
        Próximo
      </Button>
    </div>
  );
}
