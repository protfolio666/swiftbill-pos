import { useState } from 'react';
import { Minus, Plus, Trash2, Receipt, Percent, IndianRupee } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function Cart() {
  const { cart, brand, discount, discountType, updateCartQuantity, removeFromCart, clearCart, createOrder, setDiscount } = usePOSStore();
  const [discountInput, setDiscountInput] = useState(discount.toString());
  const [localDiscountType, setLocalDiscountType] = useState<'percentage' | 'fixed'>(discountType);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = localDiscountType === 'percentage' 
    ? subtotal * (parseFloat(discountInput) || 0) / 100 
    : parseFloat(discountInput) || 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  
  let cgst = 0;
  let sgst = 0;
  let tax = 0;
  
  if (brand.enableGST) {
    cgst = afterDiscount * (brand.cgstRate / 100);
    sgst = afterDiscount * (brand.sgstRate / 100);
    tax = cgst + sgst;
  } else {
    tax = afterDiscount * (brand.taxRate / 100);
  }
  
  const total = afterDiscount + tax;

  const handleDiscountChange = (value: string) => {
    setDiscountInput(value);
    setDiscount(parseFloat(value) || 0, localDiscountType);
  };

  const toggleDiscountType = () => {
    const newType = localDiscountType === 'percentage' ? 'fixed' : 'percentage';
    setLocalDiscountType(newType);
    setDiscount(parseFloat(discountInput) || 0, newType);
  };

  const handleGenerateBill = () => {
    const order = createOrder();
    if (order) {
      setDiscountInput('0');
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
        {/* Discount Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Discount</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="number"
                value={discountInput}
                onChange={(e) => handleDiscountChange(e.target.value)}
                placeholder="0"
                min="0"
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleDiscountType}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              >
                {localDiscountType === 'percentage' ? (
                  <Percent className="w-4 h-4" />
                ) : (
                  <IndianRupee className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{brand.currency}{subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount {localDiscountType === 'percentage' ? `(${discountInput}%)` : ''}</span>
              <span>-{brand.currency}{discountAmount.toFixed(2)}</span>
            </div>
          )}
          {brand.enableGST ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>CGST ({brand.cgstRate}%)</span>
                <span>{brand.currency}{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>SGST ({brand.sgstRate}%)</span>
                <span>{brand.currency}{sgst.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({brand.taxRate}%)</span>
              <span>{brand.currency}{tax.toFixed(2)}</span>
            </div>
          )}
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
