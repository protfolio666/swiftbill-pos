import { useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { usePOSStore } from '@/stores/posStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp } from 'lucide-react';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';

export function SalesChart() {
  const { orders, brand } = usePOSStore();

  const dailyData = useMemo(() => {
    const today = new Date();
    const last7Days = eachDayOfInterval({
      start: subDays(today, 6),
      end: today,
    });

    return last7Days.map((day) => {
      const dayStart = startOfDay(day);
      const dayOrders = orders.filter((order) => {
        const orderDate = startOfDay(new Date(order.date));
        return orderDate.getTime() === dayStart.getTime();
      });

      const revenue = dayOrders.reduce((sum, o) => sum + o.total, 0);
      const orderCount = dayOrders.length;

      return {
        date: format(day, 'EEE'),
        fullDate: format(day, 'MMM dd'),
        revenue: Number(revenue.toFixed(2)),
        orders: orderCount,
      };
    });
  }, [orders]);

  const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = dailyData.reduce((sum, d) => sum + d.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{payload[0]?.payload?.fullDate}</p>
          <p className="text-sm text-primary">
            Revenue: {brand.currency}{payload[0]?.value?.toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            Orders: {payload[0]?.payload?.orders}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-0 pos-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Revenue Trends (Last 7 Days)
        </CardTitle>
        <div className="flex gap-4 mt-2 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold text-foreground">
              {brand.currency}{totalRevenue.toFixed(2)}
            </span>
          </div>
          <div className="text-muted-foreground">
            Avg Order: <span className="font-semibold text-foreground">{brand.currency}{avgOrderValue.toFixed(2)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="area" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="area">Area</TabsTrigger>
            <TabsTrigger value="bar">Bar</TabsTrigger>
          </TabsList>
          
          <TabsContent value="area" className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `${brand.currency}${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="bar" className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `${brand.currency}${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="revenue" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
