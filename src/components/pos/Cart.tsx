import { useState } from 'react';
import { Minus, Plus, Trash2, Receipt, Percent, IndianRupee, Printer, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Order } from '@/types/pos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNeon } from '@/contexts/NeonContext';

export function Cart() {
  const { 
    cart, brand, discount, discountType, orderType, tableNumber,
    updateCartQuantity, removeFromCart, clearCart, createOrder, 
    setDiscount, setOrderType, setTableNumber 
  } = usePOSStore();
  const { saveOrder } = useNeon();
  const [discountInput, setDiscountInput] = useState(discount.toString());
  const [localDiscountType, setLocalDiscountType] = useState<'percentage' | 'fixed'>(discountType);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

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

  const printReceipt = (order: Order) => {
    const orderDate = new Date(order.date);
    const hasGST = (order.cgst ?? 0) > 0 || (order.sgst ?? 0) > 0;
    const taxableAmount = order.subtotal - (order.discount ?? 0);
    const totalTax = hasGST ? (order.cgst ?? 0) + (order.sgst ?? 0) : (order.total - taxableAmount);

    const receiptContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${order.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 15px; }
          .brand { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .order-id { font-size: 12px; color: #666; }
          .date { font-size: 12px; margin-top: 5px; }
          .order-info { display: flex; justify-content: center; gap: 20px; margin-top: 8px; font-size: 14px; font-weight: bold; }
          .order-type { background: #000; color: #fff; padding: 2px 8px; border-radius: 4px; }
          .table-num { border: 1px solid #000; padding: 2px 8px; border-radius: 4px; }
          .items { margin: 15px 0; }
          .item { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
          .item-name { flex: 1; }
          .item-qty { width: 30px; text-align: center; }
          .item-price { width: 70px; text-align: right; }
          .divider { border-top: 1px dashed #000; margin: 15px 0; }
          .totals { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
          .discount { color: #16a34a; }
          .tax-section { background: #f5f5f5; padding: 8px; margin: 10px 0; border-radius: 4px; }
          .tax-header { font-weight: bold; margin-bottom: 5px; font-size: 12px; text-transform: uppercase; }
          .grand-total { font-weight: bold; font-size: 18px; margin-top: 10px; border-top: 2px solid #000; padding-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          @media print { body { padding: 0; } .tax-section { background: #f5f5f5; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${brand.logo ? `<img src="${brand.logo}" alt="Logo" style="width: 60px; height: 60px; object-fit: contain; margin: 0 auto 10px;" />` : ''}
          <div class="brand">${brand.name}</div>
          <div class="order-id">${order.id}</div>
          <div class="date">${orderDate.toLocaleDateString()} at ${orderDate.toLocaleTimeString()}</div>
          <div class="order-info">
            <span class="order-type">${order.orderType === 'dine-in' ? 'DINE-IN' : 'TAKEAWAY'}</span>
            ${order.orderType === 'dine-in' && order.tableNumber ? `<span class="table-num">Table ${order.tableNumber}</span>` : ''}
          </div>
        </div>
        <div class="items">
          ${order.items.map(item => `
            <div class="item">
              <span class="item-qty">${item.quantity}x</span>
              <span class="item-name">${item.name}</span>
              <span class="item-price">${brand.currency}${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        <div class="divider"></div>
        <div class="totals">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${brand.currency}${order.subtotal.toFixed(2)}</span>
          </div>
          ${(order.discount ?? 0) > 0 ? `
            <div class="total-row discount">
              <span>Discount</span>
              <span>-${brand.currency}${order.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row">
            <span>Taxable Amount</span>
            <span>${brand.currency}${taxableAmount.toFixed(2)}</span>
          </div>
          <div class="tax-section">
            <div class="tax-header">Tax Details</div>
            ${hasGST ? `
              <div class="total-row">
                <span>CGST @ ${brand.cgstRate ?? 2.5}%</span>
                <span>${brand.currency}${(order.cgst ?? 0).toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>SGST @ ${brand.sgstRate ?? 2.5}%</span>
                <span>${brand.currency}${(order.sgst ?? 0).toFixed(2)}</span>
              </div>
            ` : `
              <div class="total-row">
                <span>Tax @ ${brand.taxRate ?? 5}%</span>
                <span>${brand.currency}${totalTax.toFixed(2)}</span>
              </div>
            `}
            <div class="total-row" style="font-weight: bold; border-top: 1px dashed #ccc; padding-top: 5px; margin-top: 5px;">
              <span>Total Tax</span>
              <span>${brand.currency}${totalTax.toFixed(2)}</span>
            </div>
          </div>
          <div class="total-row grand-total">
            <span>GRAND TOTAL</span>
            <span>${brand.currency}${order.total.toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          <p>Thank you for your visit!</p>
        </div>
      </body>
      </html>
    `;


    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleGenerateBill = async () => {
    const order = createOrder();
    if (order) {
      setDiscountInput('0');
      setLastOrder(order);
      // Save to Neon DB
      await saveOrder(order);
      toast.success(`Bill generated! Order #${order.id}`, {
        description: `Total: ${brand.currency}${order.total.toFixed(2)}`,
      });
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Cart Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <h2 className="font-bold text-sm text-foreground">Current Order</h2>
        <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive h-7 text-xs">
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>

      {/* Cart Items - scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <Receipt className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">Cart is empty</h3>
            <p className="text-xs text-muted-foreground">Add items from the menu</p>
          </div>
        ) : (
          cart.map((item) => (
            <div key={item.id} className="bg-secondary/50 rounded-lg p-2 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground text-sm truncate">{item.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {brand.currency}{item.price.toFixed(2)} each
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeFromCart(item.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0 h-6 w-6"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-6 text-center font-semibold text-foreground text-sm">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="h-6 w-6"
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <span className="font-bold text-foreground text-sm">
                  {brand.currency}{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary - fixed at bottom */}
      <div className="border-t border-border px-3 py-2 space-y-2 bg-card shrink-0">
        {cart.length > 0 ? (
          <>
            {/* Order Type Selection */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Order Type</label>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={orderType === 'dine-in' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-7 text-xs ${orderType === 'dine-in' ? 'pos-gradient' : ''}`}
                  onClick={() => setOrderType('dine-in')}
                >
                  <UtensilsCrossed className="w-3 h-3 mr-1" />
                  Dine-in
                </Button>
                <Button
                  type="button"
                  variant={orderType === 'takeaway' ? 'default' : 'outline'}
                  size="sm"
                  className={`flex-1 h-7 text-xs ${orderType === 'takeaway' ? 'pos-gradient' : ''}`}
                  onClick={() => setOrderType('takeaway')}
                >
                  <ShoppingBag className="w-3 h-3 mr-1" />
                  Takeaway
                </Button>
              </div>
            </div>

            {/* Table Number (only for dine-in) */}
            {orderType === 'dine-in' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Table Number</label>
                <Select 
                  value={tableNumber?.toString() || ''} 
                  onValueChange={(val) => setTableNumber(val ? parseInt(val) : null)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select table" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        Table {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Discount Input */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Discount</label>
              <div className="relative">
                <Input
                  type="number"
                  value={discountInput}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="pr-8 h-8 text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleDiscountType}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                >
                  {localDiscountType === 'percentage' ? (
                    <Percent className="w-3 h-3" />
                  ) : (
                    <IndianRupee className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
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
              <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{brand.currency}{total.toFixed(2)}</span>
              </div>
            </div>

            <Button variant="pos" size="sm" className="w-full h-8" onClick={handleGenerateBill}>
              <Receipt className="w-4 h-4 mr-1" />
              Generate Bill
            </Button>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Add items to generate a bill.
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8"
          disabled={!lastOrder}
          onClick={() => lastOrder && printReceipt(lastOrder)}
        >
          <Printer className="w-4 h-4 mr-1" />
          Print Last Bill
        </Button>
      </div>
    </div>
  );
}
