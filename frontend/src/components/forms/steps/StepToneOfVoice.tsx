'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'bold', label: 'Ousado' },
  { value: 'friendly', label: 'Amigável' },
  { value: 'professional', label: 'Profissional' },
];

interface StepToneOfVoiceProps {
  defaultTone?: string;
  defaultToneCustom?: string;
  onNext: (tone: string, toneCustom?: string) => void;
}

export default function StepToneOfVoice({
  defaultTone,
  defaultToneCustom,
  onNext,
}: StepToneOfVoiceProps) {
  const [selectedTone, setSelectedTone] = useState(defaultTone ?? '');
  const [toneCustom, setToneCustom] = useState(defaultToneCustom ?? '');
  const [error, setError] = useState('');

  const handleSelect = (value: string) => {
    setSelectedTone(value);
    setError('');
    if (value !== 'other') {
      setToneCustom('');
    }
  };

  const handleNext = () => {
    if (!selectedTone) {
      setError('Selecione um tom de voz');
      return;
    }
    if (selectedTone === 'other' && !toneCustom.trim()) {
      setError('Descreva seu tom de voz personalizado');
      return;
    }
    onNext(selectedTone, selectedTone === 'other' ? toneCustom : undefined);
  };

  return (
    <div className="space-y-6">
      <h2
        className="text-xl font-bold"
        style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
      >
        Tom de Voz
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {TONE_OPTIONS.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            variant={selectedTone === value ? 'default' : 'outline'}
            onClick={() => handleSelect(value)}
            className="justify-start"
          >
            {label}
          </Button>
        ))}

        <Button
          type="button"
          variant={selectedTone === 'other' ? 'default' : 'outline'}
          onClick={() => handleSelect('other')}
          className="justify-start"
        >
          Outro
        </Button>
      </div>

      {selectedTone === 'other' && (
        <div className="space-y-1">
          <Label htmlFor="tone_custom">Descreva seu tom de voz</Label>
          <Textarea
            id="tone_custom"
            placeholder="Descreva como você se comunica com seus clientes..."
            className="h-24"
            value={toneCustom}
            onChange={(e) => setToneCustom(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={handleNext}>
        Próximo
      </Button>
    </div>
  );
}
