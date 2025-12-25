import { Minus, Plus, Trash2, Receipt } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function Cart() {
  const { cart, brand, updateCartQuantity, removeFromCart, clearCart, createOrder } = usePOSStore();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * (brand.taxRate / 100);
  const total = subtotal + tax;

  const handleGenerateBill = () => {
    const order = createOrder();
    if (order) {
      toast.success(`Bill generated! Order #${order.id}`, {
        description: `Total: ${brand.currency}${order.total.toFixed(2)}`,
      });
    }
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Receipt className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">Cart is empty</h3>
        <p className="text-sm text-muted-foreground">Add items from the menu to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cart Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-bold text-lg text-foreground">Current Order</h2>
        <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.map((item) => (
          <div
            key={item.id}
            className="bg-secondary/50 rounded-xl p-3 animate-fade-in"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">{item.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {brand.currency}{item.price.toFixed(2)} each
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeFromCart(item.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-8 text-center font-semibold text-foreground">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                  disabled={item.quantity >= item.stock}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <span className="font-bold text-foreground">
                {brand.currency}{(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Summary */}
      <div className="border-t border-border p-4 space-y-3 bg-card">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{brand.currency}{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax ({brand.taxRate}%)</span>
            <span>{brand.currency}{tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{brand.currency}{total.toFixed(2)}</span>
          </div>
        </div>
        <Button variant="pos" size="lg" className="w-full" onClick={handleGenerateBill}>
          <Receipt className="w-5 h-5 mr-2" />
          Generate Bill
        </Button>
      </div>
    </div>
  );
}
