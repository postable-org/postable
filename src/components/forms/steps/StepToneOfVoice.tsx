'use client';

import { useState } from 'react';

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
    <div>
      <h2 className="text-xl font-semibold mb-4">Tom de Voz</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {TONE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleSelect(value)}
            className={`border rounded px-4 py-3 text-left transition-colors ${
              selectedTone === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => handleSelect('other')}
          className={`border rounded px-4 py-3 text-left transition-colors ${
            selectedTone === 'other'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white hover:bg-gray-50'
          }`}
        >
          Outro
        </button>
      </div>

      {selectedTone === 'other' && (
        <div className="mb-4">
          <label htmlFor="tone_custom" className="block text-sm font-medium mb-1">
            Descreva seu tom de voz
          </label>
          <textarea
            id="tone_custom"
            placeholder="Descreva como você se comunica com seus clientes..."
            className="w-full border rounded px-3 py-2 h-24"
            value={toneCustom}
            onChange={(e) => setToneCustom(e.target.value)}
          />
        </div>
      )}

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
