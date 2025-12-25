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
  CalendarIcon
} from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isToday, isThisWeek, startOfDay, startOfWeek, isSameDay, isWithinInterval, endOfDay } from 'date-fns';
import { Order } from '@/types/pos';
import { SalesChart } from './SalesChart';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function OrderHistory() {
  const { orders, brand } = usePOSStore();
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>();
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>();

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = new Date(order.date);
      if (filter === 'today') return isToday(orderDate);
      if (filter === 'week') return isThisWeek(orderDate, { weekStartsOn: 1 });
      return true;
    });
  }, [orders, filter]);

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

  const exportToCSV = () => {
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
    }

    if (ordersToExport.length === 0) {
      toast.error('No orders found in the selected date range');
      return;
    }

    // Create CSV headers
    const headers = [
      'Order ID',
      'Date',
      'Time',
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
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const dateRange = exportStartDate && exportEndDate 
      ? `_${format(exportStartDate, 'yyyy-MM-dd')}_to_${format(exportEndDate, 'yyyy-MM-dd')}`
      : `_all_orders`;
    link.setAttribute('download', `orders_report${dateRange}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${ordersToExport.length} orders to CSV`);
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
          <div class="brand">${brand.name}</div>
          <div class="order-id">${order.id}</div>
          <div class="date">${format(orderDate, 'MMM dd, yyyy')} at ${format(orderDate, 'hh:mm a')}</div>
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

  return (
    <div className="h-full overflow-y-auto p-6 bg-muted/30">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Order History</h1>
        <p className="text-muted-foreground">View completed orders and sales summary</p>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-0 pos-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Today's Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {brand.currency}{salesSummary.todaySales.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salesSummary.todayOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 pos-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {brand.currency}{salesSummary.weekSales.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salesSummary.weekOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 pos-shadow bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {brand.currency}{salesSummary.totalSales.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {salesSummary.totalOrders} orders
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Export Section */}
      <Card className="border-0 pos-shadow mb-6">
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

            <Button onClick={exportToCSV} className="pos-gradient gap-2">
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

      {/* Orders Section */}
      <Card className="border-0 pos-shadow overflow-hidden mb-6">
        <CardHeader className="border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Orders ({filteredOrders.length})
            </CardTitle>
            {/* Filter Buttons */}
            <div className="flex gap-2">
              {(['all', 'today', 'week'] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(f)}
                  className={filter === f ? 'pos-gradient' : ''}
                >
                  {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'Week'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <ScrollArea className="h-[350px]">
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
                      <div className="w-full p-4 flex items-center justify-between">
                        <button
                          onClick={() => toggleExpanded(order.id)}
                          className="flex items-center gap-4 text-left flex-1"
                        >
                          <div className="w-10 h-10 rounded-lg pos-gradient flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-primary-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{order.id}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(orderDate, 'MMM dd, yyyy')} at {format(orderDate, 'hh:mm a')}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-foreground">
                              {brand.currency}{order.total.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {order.items.length} items
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printReceipt(order)}
                            className="gap-1"
                          >
                            <Printer className="w-4 h-4" />
                            Print
                          </Button>

                          <button onClick={() => toggleExpanded(order.id)}>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 animate-fade-in">
                          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
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
