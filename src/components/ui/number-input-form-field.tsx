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
};

export function NumberInputFormField({
  form,
  name,
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
              {...form.register(name, { valueAsNumber: true })}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
