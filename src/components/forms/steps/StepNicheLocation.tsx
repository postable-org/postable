'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const BR_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const schema = z.object({
  niche: z.string().min(1, 'Nicho é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().min(2, 'Estado é obrigatório'),
});

type FormValues = z.infer<typeof schema>;

interface StepNicheLocationProps {
  defaultValues?: Partial<FormValues>;
  onNext: (data: FormValues) => void;
}

export default function StepNicheLocation({ defaultValues, onNext }: StepNicheLocationProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <h2 className="text-xl font-semibold mb-4">Sobre o seu negócio</h2>

      <div className="mb-4">
        <label htmlFor="niche" className="block text-sm font-medium mb-1">
          Nicho do negócio
        </label>
        <input
          id="niche"
          type="text"
          placeholder="Ex: padaria, academia, clínica odontológica"
          className="w-full border rounded px-3 py-2"
          {...register('niche')}
        />
        {errors.niche && (
          <p className="text-red-500 text-sm mt-1">{errors.niche.message}</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="city" className="block text-sm font-medium mb-1">
          Cidade
        </label>
        <input
          id="city"
          type="text"
          placeholder="Ex: São Paulo"
          className="w-full border rounded px-3 py-2"
          {...register('city')}
        />
        {errors.city && (
          <p className="text-red-500 text-sm mt-1">{errors.city.message}</p>
        )}
      </div>

      <div className="mb-6">
        <label htmlFor="state" className="block text-sm font-medium mb-1">
          Estado
        </label>
        <select
          id="state"
          className="w-full border rounded px-3 py-2"
          {...register('state')}
          defaultValue=""
        >
          <option value="" disabled>
            Selecione um estado
          </option>
          {BR_STATES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        {errors.state && (
          <p className="text-red-500 text-sm mt-1">{errors.state.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
      >
        Próximo
      </button>
    </form>
  );
}
