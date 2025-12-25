import { useState } from 'react';
import { Package, AlertTriangle, TrendingDown, TrendingUp, Search } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function InventoryView() {
  const { menuItems, updateMenuItem, brand } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === 'all' ||
      (filter === 'low' && item.stock > 0 && item.stock <= 10) ||
      (filter === 'out' && item.stock === 0);
    return matchesSearch && matchesFilter;
  });

  const lowStockCount = menuItems.filter((item) => item.stock > 0 && item.stock <= 10).length;
  const outOfStockCount = menuItems.filter((item) => item.stock === 0).length;
  const totalValue = menuItems.reduce((sum, item) => sum + item.price * item.stock, 0);

  const handleStockChange = (id: string, change: number) => {
    const item = menuItems.find((i) => i.id === id);
    if (item) {
      updateMenuItem(id, { stock: Math.max(0, item.stock + change) });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <p className="text-muted-foreground">Track and manage stock levels</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-2xl font-bold text-foreground">{menuItems.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low Stock</p>
              <p className="text-2xl font-bold text-foreground">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stock Value</p>
              <p className="text-2xl font-bold text-foreground">{brand.currency}{totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'low', 'out'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              onClick={() => setFilter(f)}
              size="sm"
            >
              {f === 'all' && 'All'}
              {f === 'low' && `Low Stock (${lowStockCount})`}
              {f === 'out' && `Out of Stock (${outOfStockCount})`}
            </Button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Category</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Stock Level</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Adjust Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            item.stock === 0
                              ? "bg-destructive"
                              : item.stock <= 10
                              ? "bg-warning"
                              : "bg-success"
                          )}
                          style={{ width: `${Math.min(100, (item.stock / 50) * 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-sm font-semibold min-w-[3rem] text-right",
                        item.stock === 0
                          ? "text-destructive"
                          : item.stock <= 10
                          ? "text-warning"
                          : "text-foreground"
                      )}>
                        {item.stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleStockChange(item.id, -1)}
                        disabled={item.stock === 0}
                      >
                        <TrendingDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleStockChange(item.id, 1)}
                      >
                        <TrendingUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStockChange(item.id, 10)}
                      >
                        +10
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No items found</p>
          </div>
        )}
      </div>
    </div>
  );
}
