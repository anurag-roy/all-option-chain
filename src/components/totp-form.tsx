import env from '@/env.json';
import ky from 'ky';
import { useRouter } from 'next/router';
import * as React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';

interface TotpFormProps extends React.HTMLAttributes<HTMLFormElement> {}

const TOTP_LENGTH = 6;
export function TotpForm({ className, ...props }: TotpFormProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [buttonState, setButtonState] = React.useState<
    'confirm' | 'confirming'
  >('confirm');

  const fieldSetRef = React.useRef<HTMLFieldSetElement>(null);
  const digitIds = [...Array(TOTP_LENGTH).keys()];

  const otpInputKeydownhandler = (
    event: React.KeyboardEvent<HTMLInputElement>,
    i: number
  ) => {
    const inputContainer = fieldSetRef.current;
    if (!inputContainer) return;

    const inputs = inputContainer.querySelectorAll('input');

    if (event.key === 'Backspace') {
      inputs[i].value = '';
      if (i !== 0) inputs[i - 1].focus();
    } else if (/^[0-9]$/i.test(event.key)) {
      event.preventDefault();
      inputs[i].value = event.key;
      if (i !== inputs.length - 1) inputs[i + 1].focus();
    }
  };

  const confirmTotp = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    let finalOtp = '';
    for (const value of formData.values()) {
      finalOtp = finalOtp + value;
    }
    setButtonState('confirming');
    ky('/api/login?totp=' + finalOtp)
      .json()
      .then((_res) => {
        router.push('/');
      })
      .catch((err) => {
        console.error('Error while logging in', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Error while logging in. Please try again.',
        });
      })
      .finally(() => setButtonState('confirm'));
  };

  return (
    <form
      onSubmit={confirmTotp}
      method="post"
      className="py-2 flex flex-col gap-2 items-center"
      {...props}
    >
      <fieldset className="mb-4 flex w-fit flex-row gap-3" ref={fieldSetRef}>
        <legend className="text-center text-sm text-muted-foreground mb-6">
          Please enter your TOTP to login again.
        </legend>
        {digitIds.map((i) => (
          <Input
            required
            key={i.toString()}
            className="hide-arrows text-center h-12"
            type="number"
            name={`otp-input-${i}`}
            id={`otp-input-${i}`}
            onKeyDown={(event) => otpInputKeydownhandler(event, i)}
          />
        ))}
      </fieldset>

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={buttonState === 'confirming'}
      >
        {buttonState === 'confirm' ? (
          `Login as ${env.USER_ID}`
        ) : (
          <>
            <svg
              className="-ml-1 mr-3 h-5 w-5 animate-spin text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Logging in as {env.USER_ID}...
          </>
        )}
      </Button>
    </form>
  );
}
