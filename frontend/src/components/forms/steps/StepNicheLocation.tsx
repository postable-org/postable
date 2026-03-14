'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate className="space-y-6">
      <h2
        className="text-xl font-bold"
        style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
      >
        Sobre o seu negócio
      </h2>

      <div className="space-y-1">
        <Label htmlFor="niche">Nicho do negócio</Label>
        <Input
          id="niche"
          type="text"
          placeholder="Ex: padaria, academia, clínica odontológica"
          {...register('niche')}
        />
        {errors.niche && (
          <p className="text-sm text-destructive">{errors.niche.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="city">Cidade</Label>
        <Input
          id="city"
          type="text"
          placeholder="Ex: São Paulo"
          {...register('city')}
        />
        {errors.city && (
          <p className="text-sm text-destructive">{errors.city.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="state">Estado</Label>
        <Select
          defaultValue={defaultValues?.state}
          onValueChange={(val) => { if (val) setValue('state', val, { shouldValidate: true }); }}
        >
          <SelectTrigger id="state">
            <SelectValue placeholder="Selecione um estado" />
          </SelectTrigger>
          <SelectContent>
            {BR_STATES.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.state && (
          <p className="text-sm text-destructive">{errors.state.message}</p>
        )}
      </div>

      <Button type="submit">
        Próximo
      </Button>
    </form>
  );
}
