import { startCase } from 'lodash-es';
import type { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';
import { Input } from './input';

type NumberInputFormFieldProps = {
  form: UseFormReturn<any>;
  name: string;
  min: number;
  max: number;
  step: number;
};

export function NumberInputFormField({
  form,
  name,
  min,
  max,
  step,
}: NumberInputFormFieldProps) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel>{startCase(name)}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={min}
              max={max}
              step={step}
              className="w-48"
              {...form.register(name, { valueAsNumber: true })}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
