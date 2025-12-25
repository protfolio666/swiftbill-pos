import { Plus } from 'lucide-react';
import { MenuItem } from '@/types/pos';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MenuItemCardProps {
  item: MenuItem;
}

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { addToCart, brand } = usePOSStore();
  const isOutOfStock = item.stock <= 0;

  return (
    <div
      className={cn(
        "group bg-card rounded-2xl border border-border p-4 transition-all duration-200 hover:border-primary/30 hover:shadow-lg animate-scale-in",
        isOutOfStock && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{item.category}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-bold text-primary">
              {brand.currency}{item.price.toFixed(2)}
            </span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              item.stock <= 5 
                ? "bg-destructive/10 text-destructive" 
                : "bg-success/10 text-success"
            )}>
              {item.stock} left
            </span>
          </div>
        </div>
        <Button
          variant="menu"
          size="icon"
          onClick={() => addToCart(item)}
          disabled={isOutOfStock}
          className="shrink-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
