import { Plus, Minus } from 'lucide-react';
import { MenuItem } from '@/types/pos';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MenuItemCardProps {
  item: MenuItem;
}

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { addToCart, cart, updateCartQuantity, brand } = usePOSStore();
  const isOutOfStock = item.stock <= 0;
  
  // Check if item is already in cart
  const cartItem = cart.find(c => c.id === item.id);
  const quantity = cartItem?.quantity || 0;

  const handleAdd = () => {
    if (!isOutOfStock) {
      addToCart(item);
    }
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < item.stock) {
      updateCartQuantity(item.id, quantity + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateCartQuantity(item.id, quantity - 1);
  };

  return (
    <div
      className={cn(
        "group bg-card rounded-2xl border border-border p-3 md:p-4 transition-all duration-200 active:scale-[0.98] animate-scale-in",
        isOutOfStock && "opacity-60",
        quantity > 0 && "border-primary/50 bg-primary/5"
      )}
      onClick={handleAdd}
    >
      <div className="flex flex-col gap-2">
        {/* Item Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm md:text-base line-clamp-2 leading-tight">
            {item.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 hidden md:block">
            {item.category}
          </p>
        </div>

        {/* Price and Stock */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-base md:text-lg font-bold text-primary">
              {brand.currency}{item.price.toFixed(0)}
            </span>
            <span className={cn(
              "text-[10px] md:text-xs font-medium",
              item.stock <= 5 
                ? "text-destructive" 
                : "text-muted-foreground"
            )}>
              {item.stock} left
            </span>
          </div>

          {/* Add/Quantity Controls */}
          {quantity > 0 ? (
            <div className="flex items-center gap-1 bg-primary/10 rounded-full p-0.5" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 rounded-full hover:bg-primary/20"
                onClick={handleDecrement}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="w-5 text-center font-bold text-sm text-foreground">
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 rounded-full hover:bg-primary/20"
                onClick={handleIncrement}
                disabled={quantity >= item.stock}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="icon-sm"
              disabled={isOutOfStock}
              className="h-9 w-9 rounded-full border-primary/30 hover:bg-primary hover:text-primary-foreground hover:border-primary shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleAdd();
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
