import { useState, useEffect } from 'react';
import { Minus, Plus, Trash2, Receipt, Percent, IndianRupee, Printer, UtensilsCrossed, ShoppingBag } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Order } from '@/types/pos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNeon } from '@/contexts/NeonContext';
import QRCode from 'qrcode';
import { thermalPrinter, PrintOrderData } from '@/services/thermalPrinter';
import { triggerWebhook } from '@/services/webhookService';
import { useKOT } from '@/hooks/useKOT';

// Generate UPI payment link
const generateUpiLink = (upiId: string, name: string, amount: number, orderId: string) => {
  const encodedName = encodeURIComponent(name);
  const note = encodeURIComponent(`Payment for ${orderId}`);
  return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
};

export function Cart() {
  const { 
    cart, brand, discount, discountType, orderType, tableNumber, customerName, customerPhone, lastOrder,
    updateCartQuantity, removeFromCart, clearCart, createOrder, 
    setDiscount, setOrderType, setTableNumber, setCustomerName, setCustomerPhone, setLastOrder
  } = usePOSStore();
  const { saveOrder } = useNeon();
  const { isKOTEnabled, createKOTOrder } = useKOT();
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

  const printReceipt = async (order: Order) => {
    // Check if thermal printing is enabled
    const thermalPrefs = localStorage.getItem('thermalPrinterPrefs');
    const useThermal = thermalPrefs ? JSON.parse(thermalPrefs).useThermalPrinter : false;

    if (useThermal && thermalPrinter.isConnected()) {
      try {
        await thermalPrinter.printReceipt(order as PrintOrderData, brand);
        toast.success('Receipt sent to thermal printer');
        return;
      } catch (error) {
        console.error('Thermal print failed:', error);
        toast.error('Thermal print failed, using browser print');
        // Fall through to browser print
      }
    }

    const orderDate = new Date(order.date);
    const hasGST = (order.cgst ?? 0) > 0 || (order.sgst ?? 0) > 0;
    const taxableAmount = order.subtotal - (order.discount ?? 0);
    const totalTax = hasGST ? (order.cgst ?? 0) + (order.sgst ?? 0) : (order.total - taxableAmount);

    // Generate UPI QR code if UPI ID is configured
    let qrCodeDataUrl = '';
    if (brand.upiId) {
      try {
        const upiLink = generateUpiLink(brand.upiId, brand.name, order.total, order.id);
        qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    }

    // Check if on mobile/Android - use different print approach
    const isMobile = thermalPrinter.isMobile();

    const receiptContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${order.id}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          @page { margin: 0; size: 80mm auto; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', 'Lucida Console', Monaco, monospace; 
            font-size: 11px;
            line-height: 1.4;
            padding: 10px 8px;
            width: 80mm;
            max-width: 80mm;
            background: #fff;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 8px;
          }
          .logo {
            width: 50px;
            height: 50px;
            object-fit: contain;
            margin-bottom: 4px;
          }
          .brand-name {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
            margin-bottom: 2px;
          }
          .divider {
            border: none;
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .divider-double {
            border: none;
            border-top: 2px solid #000;
            margin: 6px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .info-label {
            font-weight: normal;
          }
          .order-type-badge {
            display: inline-block;
            padding: 2px 8px;
            border: 1px solid #000;
            font-weight: bold;
            margin: 4px 0;
          }
          .items-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            margin: 4px 0;
            padding-bottom: 2px;
            border-bottom: 1px solid #000;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin: 4px 0;
            align-items: flex-start;
          }
          .item-name {
            flex: 1;
            padding-right: 8px;
          }
          .item-qty {
            width: 30px;
            text-align: center;
          }
          .item-price {
            width: 70px;
            text-align: right;
          }
          .totals-section {
            margin-top: 8px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
          }
          .total-row.highlight {
            font-weight: bold;
            font-size: 13px;
            padding: 4px 0;
          }
          .tax-box {
            border: 1px dashed #000;
            padding: 6px;
            margin: 6px 0;
          }
          .tax-title {
            font-weight: bold;
            text-align: center;
            margin-bottom: 4px;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .grand-total {
            font-size: 14px;
            font-weight: bold;
            padding: 6px 0;
            text-align: center;
            background: #000;
            color: #fff;
            margin: 8px 0;
          }
          .qr-section {
            text-align: center;
            margin: 10px 0;
            padding: 8px;
            border: 1px dashed #000;
          }
          .qr-title {
            font-weight: bold;
            margin-bottom: 6px;
            font-size: 10px;
            letter-spacing: 1px;
          }
          .qr-section img {
            width: 100px;
            height: 100px;
          }
          .qr-upi {
            font-size: 9px;
            margin-top: 4px;
            word-break: break-all;
          }
          .footer {
            text-align: center;
            margin-top: 12px;
            font-size: 10px;
          }
          .footer-stars {
            letter-spacing: 4px;
            margin-top: 4px;
          }
          @media print {
            body { padding: 0; }
            .grand-total {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${brand.logo ? `<img class="logo" src="${brand.logo}" alt="Logo" />` : ''}
          <div class="brand-name">${brand.name.toUpperCase()}</div>
          ${brand.showGstOnReceipt && brand.gstin ? `<div style="font-size: 10px; margin-top: 2px;">GSTIN: ${brand.gstin}</div>` : ''}
        </div>
        
        <hr class="divider" />
        
        <div class="info-row">
          <span class="info-label">Slip:</span>
          <span>${order.id}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Date:</span>
          <span>${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div style="text-align: center; margin: 6px 0;">
          <span class="order-type-badge">${order.orderType === 'dine-in' ? 'DINE-IN' : 'TAKEAWAY'}</span>
        </div>
        ${order.orderType === 'dine-in' && order.tableNumber ? `
          <div style="text-align: center; margin: 8px 0; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 6px;">
            TABLE NO: ${order.tableNumber}
          </div>
        ` : ''}
        ${order.customerName || order.customerPhone ? `
          <div style="margin: 6px 0; padding: 6px; border: 1px dashed #000;">
            ${order.customerName ? `<div class="info-row"><span class="info-label">Customer:</span><span>${order.customerName}</span></div>` : ''}
            ${order.customerPhone ? `<div class="info-row"><span class="info-label">Phone:</span><span>${order.customerPhone}</span></div>` : ''}
          </div>
        ` : ''}
        
        <hr class="divider" />
        
        <div class="items-header">
          <span style="flex: 1;">Description</span>
          <span style="width: 30px; text-align: center;">Qty</span>
          <span style="width: 70px; text-align: right;">Amount</span>
        </div>
        
        ${order.items.map(item => `
          <div class="item-row">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-price">${brand.currency}${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
        
        <hr class="divider-double" />
        
        <div class="totals-section">
          <div class="total-row">
            <span>Subtotal</span>
            <span>${brand.currency}${order.subtotal.toFixed(2)}</span>
          </div>
          ${(order.discount ?? 0) > 0 ? `
            <div class="total-row" style="color: #16a34a;">
              <span>Discount</span>
              <span>-${brand.currency}${order.discount.toFixed(2)}</span>
            </div>
          ` : ''}
        </div>
        
        <div class="tax-box">
          <div class="tax-title">Tax Details</div>
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
        </div>
        
        <div class="grand-total">
          TOTAL: ${brand.currency}${order.total.toFixed(2)}
        </div>
        
        ${qrCodeDataUrl ? `
          <div class="qr-section">
            <div class="qr-title">SCAN TO PAY</div>
            <img src="${qrCodeDataUrl}" alt="UPI QR" />
            <div class="qr-upi">UPI: ${brand.upiId}</div>
          </div>
        ` : ''}
        
        <div class="footer">
          <div>Thank you for your visit!</div>
          <div class="footer-stars">* * * * *</div>
          <div style="margin-top: 4px;">Welcome again</div>
        </div>
      </body>
      </html>
    `;

    // For mobile: open in new tab with auto-print
    if (isMobile) {
      const blob = new Blob([receiptContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const printTab = window.open(blobUrl, '_blank');
      
      if (printTab) {
        toast.success('Receipt opened! Tap print or share.');
        printTab.onload = () => {
          // On mobile, the user can print from browser menu or share
          setTimeout(() => {
            try {
              printTab.print();
            } catch (e) {
              // Print might not be available on all mobile browsers
              console.log('Auto-print not available, user can print from menu');
            }
          }, 1000);
        };
      } else {
        toast.error('Unable to open receipt. Please check popup settings.');
        URL.revokeObjectURL(blobUrl);
      }
      return;
    }

    // Desktop: Create a hidden iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(receiptContent);
      frameDoc.close();

      // Wait for content to load then print
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.error('Print failed:', e);
          toast.error('Print failed. Please try again.');
        }
        // Clean up iframe after printing
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 2000);
      }, 500);
    } else {
      // Fallback: Create blob URL and open in new tab
      const blob = new Blob([receiptContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const printTab = window.open(blobUrl, '_blank');
      if (printTab) {
        printTab.onload = () => {
          setTimeout(() => {
            printTab.print();
            URL.revokeObjectURL(blobUrl);
          }, 500);
        };
      } else {
        toast.error('Unable to open print window. Please check popup settings.');
        URL.revokeObjectURL(blobUrl);
      }
      // Cleanup iframe
      document.body.removeChild(printFrame);
    }
  };

  const handleGenerateBill = async () => {
    const order = createOrder();
    if (order) {
      setDiscountInput('0');
      setLastOrder(order);
      // Save to Neon DB
      await saveOrder(order);

      // If KOT is enabled, create KOT order for kitchen
      if (isKOTEnabled) {
        const kotItems = cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }));

        await createKOTOrder({
          order_id: order.id,
          items: kotItems,
          table_number: tableNumber || undefined,
          customer_name: customerName || undefined,
        });

        toast.success(`Order sent to kitchen! #${order.id}`, {
          description: `Total: ${brand.currency}${order.total.toFixed(2)}`,
        });
        return;
      }
      
      // Trigger webhook for automatic WhatsApp (Zapier)
      if (brand.enableAutoWhatsApp && brand.zapierWebhookUrl && order.customerPhone) {
        const webhookTriggered = await triggerWebhook(order, brand);
        if (webhookTriggered) {
          toast.success(`Bill generated! Order #${order.id}`, {
            description: `Total: ${brand.currency}${order.total.toFixed(2)} • WhatsApp sent`,
          });
          return;
        }
      }
      
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

      {/* Cart Summary - fixed at bottom with safe padding */}
      <div className="border-t border-border px-3 py-2 pb-safe space-y-2 bg-card shrink-0 overflow-y-auto" style={{ maxHeight: 'calc(55vh - env(safe-area-inset-bottom, 0px))' }}>
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

            {/* Customer Details */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Customer Details (Optional)</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Name"
                  className="h-8 text-sm"
                />
                <Input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-8 text-sm"
                />
              </div>
            </div>

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
        {lastOrder && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 mb-2"
            onClick={() => printReceipt(lastOrder)}
          >
            <Printer className="w-4 h-4 mr-1" />
            Print Last Bill
          </Button>
        )}
      </div>
    </div>
  );
}
