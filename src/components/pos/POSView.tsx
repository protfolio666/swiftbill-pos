import { useState } from 'react';
import { Search, ShoppingBag } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { MenuItemCard } from './MenuItemCard';
import { Cart } from './Cart';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface POSViewProps {
  onCartOpen?: () => void;
}

export function POSView({ onCartOpen }: POSViewProps) {
  const { menuItems, categories, cart, brand } = usePOSStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="flex h-full">
      {/* Menu Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Search */}
        <div className="p-3 md:p-4 border-b border-border bg-card space-y-3">
          {/* Mobile Header */}
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-10 h-10 rounded-xl pos-gradient flex items-center justify-center shrink-0">
              {brand.logo ? (
                <img src={brand.logo} alt={brand.name} className="w-8 h-8 object-contain rounded-lg" />
              ) : (
                <span className="text-primary-foreground font-bold">
                  {brand.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-foreground truncate">{brand.name}</h1>
              <p className="text-xs text-muted-foreground">Point of Sale</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
            <Input
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 md:pl-10 h-10 md:h-12 bg-background text-sm"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all touch-target flex items-center justify-center",
                !selectedCategory
                  ? "pos-gradient text-primary-foreground pos-shadow"
                  : "bg-secondary text-secondary-foreground active:bg-secondary/80"
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 touch-target",
                  selectedCategory === cat.name
                    ? "pos-gradient text-primary-foreground pos-shadow"
                    : "bg-secondary text-secondary-foreground active:bg-secondary/80"
                )}
              >
                <span>{cat.icon}</span>
                <span className="hidden sm:inline">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
            {filteredItems.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No items found</p>
            </div>
          )}
          
          {/* Mobile bottom spacing for cart button */}
          <div className="h-20 md:hidden" />
        </div>
      </div>

      {/* Desktop Cart Section */}
      <div className="w-80 xl:w-96 border-l border-border bg-card hidden md:flex flex-col">
        <Cart />
      </div>
    </div>
  );
}
