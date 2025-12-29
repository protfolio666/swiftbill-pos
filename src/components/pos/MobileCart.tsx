import { ShoppingBag, X, Printer } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePOSStore } from '@/stores/posStore';
import { Cart } from './Cart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { thermalPrinter, PrintOrderData } from '@/services/thermalPrinter';
import { Order } from '@/types/pos';

// Generate UPI payment link
const generateUpiLink = (upiId: string, name: string, amount: number, orderId: string) => {
  const encodedName = encodeURIComponent(name);
  const note = encodeURIComponent(`Payment for ${orderId}`);
  return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
};

interface MobileCartProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileCart({ open, onOpenChange }: MobileCartProps) {
  const { cart, brand, lastOrder } = usePOSStore();
  
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const printLastBill = async () => {
    if (!lastOrder) {
      toast.error('No bill to print');
      return;
    }

    // Check if thermal printing is enabled
    const thermalPrefs = localStorage.getItem('thermalPrinterPrefs');
    const useThermal = thermalPrefs ? JSON.parse(thermalPrefs).useThermalPrinter : false;

    if (useThermal && thermalPrinter.isConnected()) {
      try {
        await thermalPrinter.printReceipt(lastOrder as PrintOrderData, brand);
        toast.success('Receipt sent to thermal printer');
        return;
      } catch (error) {
        console.error('Thermal print failed:', error);
        toast.error('Thermal print failed, using browser print');
      }
    }

    const orderDate = new Date(lastOrder.date);
    const hasGST = (lastOrder.cgst ?? 0) > 0 || (lastOrder.sgst ?? 0) > 0;
    const taxableAmount = lastOrder.subtotal - (lastOrder.discount ?? 0);
    const totalTax = hasGST ? (lastOrder.cgst ?? 0) + (lastOrder.sgst ?? 0) : (lastOrder.total - taxableAmount);

    // Generate UPI QR code if UPI ID is configured
    let qrCodeDataUrl = '';
    if (brand.upiId) {
      try {
        const upiLink = generateUpiLink(brand.upiId, brand.name, lastOrder.total, lastOrder.id);
        qrCodeDataUrl = await QRCode.toDataURL(upiLink, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    }

    const receiptContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${lastOrder.id}</title>
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
          .header { text-align: center; margin-bottom: 8px; }
          .logo { width: 50px; height: 50px; object-fit: contain; margin-bottom: 4px; }
          .brand-name { font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-bottom: 2px; }
          .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
          .divider-double { border: none; border-top: 2px solid #000; margin: 6px 0; }
          .info-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .order-type-badge { display: inline-block; padding: 2px 8px; border: 1px solid #000; font-weight: bold; margin: 4px 0; }
          .items-header { display: flex; justify-content: space-between; font-weight: bold; margin: 4px 0; padding-bottom: 2px; border-bottom: 1px solid #000; }
          .item-row { display: flex; justify-content: space-between; margin: 4px 0; align-items: flex-start; }
          .item-name { flex: 1; padding-right: 8px; }
          .item-qty { width: 30px; text-align: center; }
          .item-price { width: 70px; text-align: right; }
          .totals-section { margin-top: 8px; }
          .total-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .tax-box { border: 1px dashed #000; padding: 6px; margin: 6px 0; }
          .tax-title { font-weight: bold; text-align: center; margin-bottom: 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
          .grand-total { font-size: 14px; font-weight: bold; padding: 6px 0; text-align: center; background: #000; color: #fff; margin: 8px 0; }
          .qr-section { text-align: center; margin: 10px 0; padding: 8px; border: 1px dashed #000; }
          .qr-title { font-weight: bold; margin-bottom: 6px; font-size: 10px; letter-spacing: 1px; }
          .qr-section img { width: 100px; height: 100px; }
          .qr-upi { font-size: 9px; margin-top: 4px; word-break: break-all; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; }
          @media print { body { padding: 0; } .grand-total { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${brand.logo ? `<img class="logo" src="${brand.logo}" alt="Logo" />` : ''}
          <div class="brand-name">${brand.name.toUpperCase()}</div>
          ${brand.showGstOnReceipt && brand.gstin ? `<div style="font-size: 10px; margin-top: 2px;">GSTIN: ${brand.gstin}</div>` : ''}
        </div>
        <hr class="divider" />
        <div class="info-row"><span>Slip:</span><span>${lastOrder.id}</span></div>
        <div class="info-row"><span>Date:</span><span>${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
        <div style="text-align: center; margin: 6px 0;">
          <span class="order-type-badge">${lastOrder.orderType === 'dine-in' ? 'DINE-IN' : 'TAKEAWAY'}</span>
        </div>
        ${lastOrder.orderType === 'dine-in' && lastOrder.tableNumber ? `
          <div style="text-align: center; margin: 8px 0; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 6px;">TABLE NO: ${lastOrder.tableNumber}</div>
        ` : ''}
        <hr class="divider" />
        <div class="items-header">
          <span style="flex: 1;">Description</span>
          <span style="width: 30px; text-align: center;">Qty</span>
          <span style="width: 70px; text-align: right;">Amount</span>
        </div>
        ${lastOrder.items.map(item => `
          <div class="item-row">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-price">${brand.currency}${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
        <hr class="divider-double" />
        <div class="totals-section">
          <div class="total-row"><span>Subtotal</span><span>${brand.currency}${lastOrder.subtotal.toFixed(2)}</span></div>
          ${(lastOrder.discount ?? 0) > 0 ? `<div class="total-row" style="color: #16a34a;"><span>Discount</span><span>-${brand.currency}${lastOrder.discount.toFixed(2)}</span></div>` : ''}
        </div>
        <div class="tax-box">
          <div class="tax-title">Tax Details</div>
          ${hasGST ? `
            <div class="total-row"><span>CGST @ ${brand.cgstRate ?? 2.5}%</span><span>${brand.currency}${(lastOrder.cgst ?? 0).toFixed(2)}</span></div>
            <div class="total-row"><span>SGST @ ${brand.sgstRate ?? 2.5}%</span><span>${brand.currency}${(lastOrder.sgst ?? 0).toFixed(2)}</span></div>
          ` : `<div class="total-row"><span>Tax @ ${brand.taxRate ?? 5}%</span><span>${brand.currency}${totalTax.toFixed(2)}</span></div>`}
        </div>
        <div class="grand-total">TOTAL: ${brand.currency}${lastOrder.total.toFixed(2)}</div>
        ${qrCodeDataUrl ? `
          <div class="qr-section">
            <div class="qr-title">SCAN TO PAY</div>
            <img src="${qrCodeDataUrl}" alt="UPI QR" />
            <div class="qr-upi">UPI: ${brand.upiId}</div>
          </div>
        ` : ''}
        <div class="footer">
          <div>Thank you for your visit!</div>
          <div style="letter-spacing: 4px; margin-top: 4px;">* * * * *</div>
          <div style="margin-top: 4px;">Welcome again</div>
        </div>
      </body>
      </html>
    `;

    // For mobile: open in new tab
    const blob = new Blob([receiptContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const printTab = window.open(blobUrl, '_blank');
    
    if (printTab) {
      toast.success('Receipt opened! Tap print or share.');
      printTab.onload = () => {
        setTimeout(() => {
          try {
            printTab.print();
          } catch (e) {
            console.log('Auto-print not available, user can print from menu');
          }
        }, 1000);
      };
    } else {
      toast.error('Unable to open receipt. Please check popup settings.');
      URL.revokeObjectURL(blobUrl);
    }
  };

  return (
    <>
      {/* Print Last Bill Button - shows when there's a last order and cart is empty */}
      {lastOrder && cart.length === 0 && (
        <Button
          onClick={printLastBill}
          className="fixed bottom-20 right-4 z-40 md:hidden flex items-center gap-2 px-4 py-3 rounded-full shadow-lg animate-scale-in"
          variant="outline"
        >
          <Printer className="w-5 h-5" />
          <span className="font-medium text-sm">Print Last Bill</span>
        </Button>
      )}

      {/* Cart Button and Sheet */}
      {cart.length > 0 && (
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
      )}
    </>
  );
}
