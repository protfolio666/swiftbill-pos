import { useState, useMemo } from 'react';
import { 
  Calendar, 
  Receipt, 
  TrendingUp, 
  ChevronDown, 
  ChevronUp,
  Clock,
  DollarSign,
  Printer,
  Download,
  CalendarIcon,
  Search,
  MessageCircle,
  X
} from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isToday, isThisWeek, startOfDay, startOfWeek, isSameDay, isWithinInterval, endOfDay } from 'date-fns';
import { Order } from '@/types/pos';
import { SalesChart } from './SalesChart';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import { thermalPrinter, PrintOrderData } from '@/services/thermalPrinter';

// Generate UPI payment link
const generateUpiLink = (upiId: string, name: string, amount: number, orderId: string) => {
  const encodedName = encodeURIComponent(name);
  const note = encodeURIComponent(`Payment for ${orderId}`);
  return `upi://pay?pa=${upiId}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR&tn=${note}`;
};

export function OrderHistory() {
  const { orders, brand } = usePOSStore();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>();
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>();

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = new Date(order.date);
      
      // Date filter
      let dateMatch = true;
      if (filter === 'today') dateMatch = isToday(orderDate);
      if (filter === 'week') dateMatch = isThisWeek(orderDate, { weekStartsOn: 1 });
      
      // Search filter - search by customer name, phone, or order ID
      let searchMatch = true;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        searchMatch = 
          order.id.toLowerCase().includes(query) ||
          (order.customerName?.toLowerCase().includes(query) ?? false) ||
          (order.customerPhone?.includes(query) ?? false);
      }
      
      return dateMatch && searchMatch;
    });
  }, [orders, filter, searchQuery]);

  const salesSummary = useMemo(() => {
    const today = new Date();
    const todayStart = startOfDay(today);
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });

    const todayOrders = orders.filter((o) => isSameDay(new Date(o.date), todayStart));
    const weekOrders = orders.filter((o) => new Date(o.date) >= weekStart);

    return {
      todaySales: todayOrders.reduce((sum, o) => sum + o.total, 0),
      todayOrders: todayOrders.length,
      weekSales: weekOrders.reduce((sum, o) => sum + o.total, 0),
      weekOrders: weekOrders.length,
      totalSales: orders.reduce((sum, o) => sum + o.total, 0),
      totalOrders: orders.length,
    };
  }, [orders]);

  const toggleExpanded = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Generate WhatsApp receipt message
  const generateWhatsAppMessage = (order: Order): string => {
    const orderDate = new Date(order.date);
    const itemsList = order.items
      .map((item) => `• ${item.name} x${item.quantity} - ${brand.currency}${(item.price * item.quantity).toFixed(2)}`)
      .join('\n');
    
    let message = `🧾 *Receipt from ${brand.name}*\n\n`;
    message += `📋 Order: ${order.id}\n`;
    message += `📅 Date: ${format(orderDate, 'MMM dd, yyyy')} at ${format(orderDate, 'hh:mm a')}\n`;
    if (order.customerName) message += `👤 Customer: ${order.customerName}\n`;
    message += `\n*Items:*\n${itemsList}\n\n`;
    message += `Subtotal: ${brand.currency}${order.subtotal.toFixed(2)}\n`;
    if (order.discount && order.discount > 0) {
      message += `Discount: -${brand.currency}${order.discount.toFixed(2)}\n`;
    }
    if ((order.cgst ?? 0) > 0 || (order.sgst ?? 0) > 0) {
      message += `CGST: ${brand.currency}${(order.cgst ?? 0).toFixed(2)}\n`;
      message += `SGST: ${brand.currency}${(order.sgst ?? 0).toFixed(2)}\n`;
    }
    message += `*Total: ${brand.currency}${order.total.toFixed(2)}*\n\n`;
    message += `Thank you for your visit! 🙏`;
    
    return message;
  };

  // Generate WhatsApp URL for an order
  const getWhatsAppUrl = (order: Order): string => {
    if (!order.customerPhone) return '';
    
    // Clean phone number - remove spaces and special characters
    let phone = order.customerPhone.replace(/[\s\-\(\)]/g, '');
    
    // Add country code if not present (assuming India +91)
    if (!phone.startsWith('+')) {
      if (phone.startsWith('0')) {
        phone = '91' + phone.substring(1);
      } else if (!phone.startsWith('91')) {
        phone = '91' + phone;
      }
    } else {
      phone = phone.substring(1); // Remove the + for WhatsApp URL
    }
    
    const message = encodeURIComponent(generateWhatsAppMessage(order));
    return `https://wa.me/${phone}?text=${message}`;
  };

  const exportToCSV = () => {
    console.log('Export clicked, total orders:', orders.length);
    
    if (orders.length === 0) {
      toast.error('No orders to export. Create some orders first!');
      return;
    }

    let ordersToExport = orders;

    // Filter by date range if both dates are selected
    if (exportStartDate && exportEndDate) {
      ordersToExport = orders.filter((order) => {
        const orderDate = new Date(order.date);
        return isWithinInterval(orderDate, {
          start: startOfDay(exportStartDate),
          end: endOfDay(exportEndDate),
        });
      });
      
      if (ordersToExport.length === 0) {
        toast.error('No orders found in the selected date range. Try different dates or clear the date filter.');
        return;
      }
    }

    // Create CSV headers
    const headers = [
      'Order ID',
      'Date',
      'Time',
      'Order Type',
      'Table No',
      'Items',
      'Item Details',
      'Subtotal',
      'Discount',
      'CGST',
      'SGST',
      'Total Tax',
      'Grand Total',
    ];

    // Create CSV rows
    const rows = ordersToExport.map((order) => {
      const orderDate = new Date(order.date);
      const itemNames = order.items.map((item) => `${item.quantity}x ${item.name}`).join('; ');
      const itemDetails = order.items
        .map((item) => `${item.name}: ${brand.currency}${item.price} x ${item.quantity} = ${brand.currency}${(item.price * item.quantity).toFixed(2)}`)
        .join('; ');
      const totalTax = (order.cgst ?? 0) + (order.sgst ?? 0) || (order.total - order.subtotal + (order.discount ?? 0));

      return [
        order.id,
        format(orderDate, 'yyyy-MM-dd'),
        format(orderDate, 'HH:mm:ss'),
        (order.orderType ?? 'dine-in') === 'dine-in' ? 'Dine-in' : 'Takeaway',
        order.tableNumber ?? '-',
        order.items.length,
        `"${itemDetails}"`,
        order.subtotal.toFixed(2),
        (order.discount ?? 0).toFixed(2),
        (order.cgst ?? 0).toFixed(2),
        (order.sgst ?? 0).toFixed(2),
        totalTax.toFixed(2),
        order.total.toFixed(2),
      ];
    });

    // Calculate summary
    const totalRevenue = ordersToExport.reduce((sum, o) => sum + o.total, 0);
    const totalDiscount = ordersToExport.reduce((sum, o) => sum + (o.discount ?? 0), 0);
    const totalCGST = ordersToExport.reduce((sum, o) => sum + (o.cgst ?? 0), 0);
    const totalSGST = ordersToExport.reduce((sum, o) => sum + (o.sgst ?? 0), 0);
    const totalTaxCollected = totalCGST + totalSGST;

    // Add summary rows
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Total Orders', ordersToExport.length.toString()]);
    rows.push(['Total Revenue', `${brand.currency}${totalRevenue.toFixed(2)}`]);
    rows.push(['Total Discount Given', `${brand.currency}${totalDiscount.toFixed(2)}`]);
    rows.push(['Total CGST Collected', `${brand.currency}${totalCGST.toFixed(2)}`]);
    rows.push(['Total SGST Collected', `${brand.currency}${totalSGST.toFixed(2)}`]);
    rows.push(['Total Tax Collected', `${brand.currency}${totalTaxCollected.toFixed(2)}`]);

    // Convert to CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateRange = exportStartDate && exportEndDate 
      ? `_${format(exportStartDate, 'yyyy-MM-dd')}_to_${format(exportEndDate, 'yyyy-MM-dd')}`
      : '_all_orders';
    link.download = `orders_report${dateRange}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${ordersToExport.length} orders to CSV`);
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

    // Create a hidden iframe for printing
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

  return (
    <div className="h-full overflow-y-auto p-3 md:p-6 bg-muted/30 pb-20 md:pb-6">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Order History</h1>
        <p className="text-sm text-muted-foreground">View completed orders and sales</p>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
        <Card className="border-0 pos-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
              <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-[10px] md:text-sm font-medium">Today</span>
            </div>
            <div className="text-base md:text-2xl font-bold text-foreground">
              {brand.currency}{salesSummary.todaySales.toFixed(0)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {salesSummary.todayOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 pos-shadow">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
              <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-[10px] md:text-sm font-medium">Week</span>
            </div>
            <div className="text-base md:text-2xl font-bold text-foreground">
              {brand.currency}{salesSummary.weekSales.toFixed(0)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {salesSummary.weekOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 pos-shadow bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-1.5 md:gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="text-[10px] md:text-sm font-medium">Total</span>
            </div>
            <div className="text-base md:text-2xl font-bold text-primary">
              {brand.currency}{salesSummary.totalSales.toFixed(0)}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground">
              {salesSummary.totalOrders} orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Section - Hidden on mobile, shown in collapsible */}
      <Card className="border-0 pos-shadow mb-4 md:mb-6 hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Orders Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !exportStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportStartDate ? format(exportStartDate, "PPP") : <span>Start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={exportStartDate}
                    onSelect={setExportStartDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[180px] justify-start text-left font-normal",
                      !exportEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportEndDate ? format(exportEndDate, "PPP") : <span>End date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={exportEndDate}
                    onSelect={setExportEndDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button type="button" onClick={exportToCSV} className="pos-gradient gap-2">
              <Download className="w-4 h-4" />
              Export to CSV
            </Button>

            {(exportStartDate || exportEndDate) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setExportStartDate(undefined);
                  setExportEndDate(undefined);
                }}
              >
                Clear dates
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {!exportStartDate && !exportEndDate 
              ? "Leave dates empty to export all orders" 
              : exportStartDate && exportEndDate 
                ? `Will export orders from ${format(exportStartDate, "MMM dd, yyyy")} to ${format(exportEndDate, "MMM dd, yyyy")}`
                : "Select both dates to filter, or leave empty for all orders"}
          </p>
        </CardContent>
      </Card>

      {/* Mobile Export Button */}
      <div className="md:hidden mb-4">
        <Button 
          type="button" 
          onClick={exportToCSV} 
          variant="outline"
          className="w-full gap-2"
        >
          <Download className="w-4 h-4" />
          Export All Orders to CSV
        </Button>
      </div>

      {/* Orders Section */}
      <Card className="border-0 pos-shadow overflow-hidden mb-6">
        <CardHeader className="border-b border-border bg-card p-3 md:p-6">
          <div className="flex flex-col gap-3">
            {/* Title and Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Receipt className="w-4 h-4 md:w-5 md:h-5" />
                Orders ({filteredOrders.length})
              </CardTitle>
              {/* Filter Buttons */}
              <div className="flex gap-1.5 md:gap-2">
                {(['all', 'today', 'week'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className={cn(
                      "h-8 px-3 text-xs md:text-sm",
                      filter === f ? 'pos-gradient' : ''
                    )}
                  >
                    {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'Week'}
                  </Button>
                ))}
              </div>
            </div>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <ScrollArea className="h-[400px] md:h-[350px]">
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Receipt className="w-12 h-12 mb-3 opacity-50" />
                <p>No orders found</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrders.has(order.id);
                  const orderDate = new Date(order.date);
                  
                    return (
                      <div key={order.id} className="bg-card hover:bg-accent/50 transition-colors">
                        {/* Mobile-optimized order card */}
                        <div className="w-full p-3 md:p-4">
                          {/* Main row - clickable for expand */}
                          <button
                            onClick={() => toggleExpanded(order.id)}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              {/* Left side - Icon and info */}
                              <div className="flex items-start gap-2 md:gap-4 flex-1 min-w-0">
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg pos-gradient flex items-center justify-center shrink-0">
                                  <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1 md:gap-2">
                                    <p className="font-medium text-foreground text-sm md:text-base">{order.id}</p>
                                    <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded ${order.orderType === 'dine-in' ? 'bg-primary/20 text-primary' : 'bg-orange-500/20 text-orange-600'}`}>
                                      {order.orderType === 'dine-in' ? 'Dine' : 'Take'}
                                    </span>
                                    {order.orderType === 'dine-in' && order.tableNumber && (
                                      <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                        T{order.tableNumber}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                                    {format(orderDate, 'MMM dd')} • {format(orderDate, 'hh:mm a')}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Right side - Total and expand icon */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <p className="font-bold text-foreground text-sm md:text-base">
                                    {brand.currency}{order.total.toFixed(0)}
                                  </p>
                                  <p className="text-[10px] md:text-xs text-muted-foreground">
                                    {order.items.length} items
                                  </p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </button>
                          
                          {/* Action buttons - visible on tap/hover */}
                          {isExpanded && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => printReceipt(order)}
                                className="flex-1 gap-1.5 h-9"
                              >
                                <Printer className="w-4 h-4" />
                                Print
                              </Button>

                              {order.customerPhone && (
                                <a
                                  href={getWhatsAppUrl(order)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 text-sm font-medium rounded-md border text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 transition-colors"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Expanded details section */}
                        {isExpanded && (
                          <div className="px-3 md:px-4 pb-3 md:pb-4 pt-0 animate-fade-in">
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                            {/* Customer Details */}
                            {(order.customerName || order.customerPhone) && (
                              <div className="border-b border-border pb-2 mb-2">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-medium text-muted-foreground">Customer Details</p>
                                  {order.customerPhone && (
                                    <a
                                      href={getWhatsAppUrl(order)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center h-6 px-2 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 rounded gap-1 transition-colors"
                                    >
                                      <MessageCircle className="w-3 h-3" />
                                      <span>Send Receipt</span>
                                    </a>
                                  )}
                                </div>
                                {order.customerName && (
                                  <p className="text-sm text-foreground">Name: {order.customerName}</p>
                                )}
                                {order.customerPhone && (
                                  <p className="text-sm text-foreground">Phone: {order.customerPhone}</p>
                                )}
                              </div>
                            )}
                            {order.items.map((item, index) => (
                              <div 
                                key={`${order.id}-${item.id}-${index}`}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-foreground">
                                  {item.quantity}x {item.name}
                                </span>
                                <span className="text-muted-foreground">
                                  {brand.currency}{(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-border pt-2 mt-2 space-y-1 text-sm">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{brand.currency}{order.subtotal.toFixed(2)}</span>
                              </div>
                              {order.discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>Discount</span>
                                  <span>-{brand.currency}{order.discount.toFixed(2)}</span>
                                </div>
                              )}
                              {(order.cgst > 0 || order.sgst > 0) ? (
                                <>
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>CGST ({brand.cgstRate ?? 2.5}%)</span>
                                    <span>{brand.currency}{order.cgst.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>SGST ({brand.sgstRate ?? 2.5}%)</span>
                                    <span>{brand.currency}{order.sgst.toFixed(2)}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Tax</span>
                                  <span>{brand.currency}{(order.total - order.subtotal + order.discount).toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium pt-2 border-t border-border">
                                <span>Total</span>
                                <span className="text-primary">{brand.currency}{order.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Sales Chart */}
      <SalesChart />
    </div>
  );
}
