import { useKOT } from '@/hooks/useKOT';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, CheckCircle, Clock, ChefHat, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePOSStore } from '@/stores/posStore';
import { toast } from 'sonner';

export function WaiterView() {
  const { staffMember, kotOrders, updateKOTOrderStatus } = useKOT();
  const { brand } = usePOSStore();

  const isWaiter = staffMember?.role === 'waiter';

  // Orders placed by this waiter
  const myPendingOrders = kotOrders.filter(o => 
    o.waiter_id === staffMember?.id && 
    ['pending', 'assigned', 'preparing'].includes(o.status)
  );

  // Orders ready to serve
  const readyToServe = kotOrders.filter(o => 
    o.waiter_id === staffMember?.id && 
    o.status === 'completed'
  );

  // Recently served
  const recentlyServed = kotOrders.filter(o => 
    o.waiter_id === staffMember?.id && 
    o.status === 'served'
  ).slice(0, 5);

  const handleMarkServed = async (orderId: string) => {
    await updateKOTOrderStatus(orderId, 'served');
    toast.success('Order marked as served');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'assigned':
        return <Badge className="bg-amber-500">Assigned</Badge>;
      case 'preparing':
        return <Badge className="bg-blue-500">Preparing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Ready</Badge>;
      case 'served':
        return <Badge variant="secondary">Served</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!isWaiter) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Waiter view is only available for waiter accounts</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {staffMember?.name}</h1>
          <p className="text-muted-foreground">Manage your orders</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <ClipboardList className="h-4 w-4 mr-2" />
          Waiter
        </Badge>
      </div>

      {/* Ready to Serve - Highlighted */}
      {readyToServe.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-green-500 animate-pulse" />
            Ready to Serve ({readyToServe.length})
          </h2>
          <div className="grid gap-3">
            {readyToServe.map((order) => (
              <Card key={order.id} className="border-green-500 border-2 bg-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-lg">Order #{order.order_id.slice(-6)}</span>
                      </div>
                      {order.table_number && (
                        <p className="text-muted-foreground mt-1">Table {order.table_number}</p>
                      )}
                      {order.customer_name && (
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      )}
                    </div>
                    <Button onClick={() => handleMarkServed(order.id)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark Served
                    </Button>
                  </div>

                  <div className="mt-3 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-muted-foreground">{brand.currency}{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* In Progress Orders */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          In Kitchen ({myPendingOrders.length})
        </h2>

        {myPendingOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active orders</p>
              <p className="text-sm mt-2">Place an order from the POS to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {myPendingOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Order #{order.order_id.slice(-6)}</span>
                        {getStatusBadge(order.status)}
                      </div>
                      {order.table_number && (
                        <p className="text-sm text-muted-foreground mt-1">Table {order.table_number}</p>
                      )}
                      {order.customer_name && (
                        <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 inline mr-1" />
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-muted-foreground">{brand.currency}{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {order.status === 'preparing' && (
                    <div className="mt-3 p-2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm flex items-center gap-2">
                      <ChefHat className="h-4 w-4" />
                      Chef is preparing this order...
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recently Served */}
      {recentlyServed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Recently Served
          </h2>
          <div className="grid gap-2">
            {recentlyServed.map((order) => (
              <Card key={order.id} className="bg-secondary/50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">Order #{order.order_id.slice(-6)}</span>
                      {order.table_number && (
                        <span className="text-muted-foreground">Table {order.table_number}</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(order.served_at || order.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
