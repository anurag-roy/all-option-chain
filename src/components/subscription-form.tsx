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
  percent: z.number().min(0).max(100),
  value: z.number().min(0),
  orderPercent: z.number().min(0).max(100),
});

export function SubscriptionForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      expiry: expiryOptions[0],
      percent: 30,
      value: 500,
      orderPercent: 5,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    console.log(values);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="max-w-7xl mx-auto p-4 flex gap-4 justify-between items-end"
      >
        <SelectFormField form={form} name="expiry" options={expiryOptions} />
        <NumberInputFormField form={form} name="percent" />
        <NumberInputFormField form={form} name="value" />
        <NumberInputFormField form={form} name="orderPercent" />
        <Button type="submit">Subscribe</Button>
      </form>
    </Form>
  );
}
