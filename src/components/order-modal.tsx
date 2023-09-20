import { UiInstrument } from '@/types';
import { PlusCircledIcon } from '@radix-ui/react-icons';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

interface OrderModalProps {
  i: UiInstrument;
}

export function OrderModal({ i }: OrderModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="flex h-8 w-8 p-0">
          <PlusCircledIcon className="h-4 w-4" />
          <span className="sr-only">Open order modal</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {i.symbol} {i.strikePrice}
            {i.optionType}
          </DialogTitle>
          <DialogDescription>
            Place sell order for {i.symbol} {i.strikePrice}
            {i.optionType}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">Print net return here</div>
        <DialogFooter>
          <Button type="submit">Place Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
