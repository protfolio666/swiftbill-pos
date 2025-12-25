import { useState } from 'react';
import { Search } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { MenuItemCard } from './MenuItemCard';
import { Cart } from './Cart';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function POSView() {
  const { menuItems, categories } = usePOSStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex h-full">
      {/* Menu Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search & Categories */}
        <div className="p-4 border-b border-border bg-card space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 bg-background"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                !selectedCategory
                  ? "pos-gradient text-primary-foreground pos-shadow"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5",
                  selectedCategory === cat.name
                    ? "pos-gradient text-primary-foreground pos-shadow"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                <span>{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-80 xl:w-96 border-l border-border bg-card hidden md:flex flex-col">
        <Cart />
      </div>
    </div>
  );
}
