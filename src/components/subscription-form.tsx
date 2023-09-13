import { EXPIRY_OPTION_LENGTH } from '@/config';
import { getExpiryOptions } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from './ui/button';
import { Form } from './ui/form';
import { NumberInputFormField } from './ui/number-input-form-field';
import { SelectFormField } from './ui/select-form-field';

const expiryOptions = getExpiryOptions(EXPIRY_OPTION_LENGTH);
const formSchema = z.object({
  expiry: z.string(),
  entryPercent: z.number(),
  entryValue: z.number(),
  orderPercent: z.number(),
});

export function SubscriptionForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      expiry: expiryOptions[0],
      entryPercent: 30,
      entryValue: 99,
      orderPercent: 0.5,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-6xl mx-auto p-4 flex gap-4 justify-between"
      >
        <SelectFormField form={form} name="expiry" options={expiryOptions} />
        <NumberInputFormField
          form={form}
          name="entryPercent"
          min={0}
          max={100}
          step={1}
        />
        <NumberInputFormField
          form={form}
          name="entryValue"
          min={0}
          max={10000}
          step={0.05}
        />
        <NumberInputFormField
          form={form}
          name="orderPercent"
          min={0}
          max={100}
          step={0.01}
        />
        <Button type="submit" className="mt-[30px]">
          Subscribe
        </Button>
      </form>
    </Form>
  );
}
