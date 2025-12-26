import { ShoppingBag, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePOSStore } from '@/stores/posStore';
import { Cart } from './Cart';
import { cn } from '@/lib/utils';

interface MobileCartProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileCart({ open, onOpenChange }: MobileCartProps) {
  const { cart, brand } = usePOSStore();
  
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cart.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <button className="fixed bottom-20 right-4 z-40 md:hidden flex items-center gap-2 px-4 py-3 rounded-full pos-gradient pos-shadow-lg animate-scale-in">
          <ShoppingBag className="w-5 h-5 text-primary-foreground" />
          <span className="text-primary-foreground font-bold text-sm">
            {itemCount} items
          </span>
          <span className="text-primary-foreground/80 text-sm">•</span>
          <span className="text-primary-foreground font-bold text-sm">
            {brand.currency}{total.toFixed(0)}
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-2" />
        <Cart />
      </SheetContent>
    </Sheet>
  );
}
