import { useState } from 'react';
import { useKOT } from '@/hooks/useKOT';
import { ChefStatus, KOTOrderStatus } from '@/types/kot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChefHat, Clock, CheckCircle, AlertTriangle, Coffee, Wifi, WifiOff, Play, Hand } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { usePOSStore } from '@/stores/posStore';

const STATUS_COLORS: Record<ChefStatus, { bg: string; icon: React.ReactNode }> = {
  online: { bg: 'bg-green-500', icon: <Wifi className="h-4 w-4" /> },
  offline: { bg: 'bg-gray-500', icon: <WifiOff className="h-4 w-4" /> },
  break: { bg: 'bg-amber-500', icon: <Coffee className="h-4 w-4" /> },
};

export function ChefDashboard() {
  const { 
    staffMember, 
    kotOrders, 
    kotSettings,
    updateChefStatus, 
    updateKOTOrderStatus, 
    claimOrder 
  } = useKOT();
  const { brand } = usePOSStore();

  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState('');
  const [delayRemarks, setDelayRemarks] = useState('');

  const isChef = staffMember?.role === 'chef';
  const chefStatus = staffMember?.chef_status || 'offline';

  // Filter orders relevant to this chef
  const myOrders = kotOrders.filter(o => 
    o.assigned_chef_id === staffMember?.id && 
    ['assigned', 'preparing'].includes(o.status)
  );

  const availableOrders = kotOrders.filter(o => 
    o.status === 'pending' && 
    !o.assigned_chef_id &&
    kotSettings?.order_assignment_mode === 'claim'
  );

  const completedOrders = kotOrders.filter(o => 
    o.assigned_chef_id === staffMember?.id && 
    o.status === 'completed'
  );

  const handleStartPreparing = async (orderId: string) => {
    await updateKOTOrderStatus(orderId, 'preparing');
  };

  const handleCompleteOrder = async (orderId: string) => {
    // Check if order is delayed
    const order = kotOrders.find(o => o.id === orderId);
    if (order) {
      const expectedMinutes = order.prep_time_minutes || kotSettings?.default_prep_time_minutes || 15;
      const startedAt = order.started_at ? new Date(order.started_at) : new Date(order.created_at);
      const elapsedMinutes = (Date.now() - startedAt.getTime()) / (1000 * 60);

      if (elapsedMinutes > expectedMinutes) {
        setSelectedOrderId(orderId);
        setDelayDialogOpen(true);
        return;
      }
    }

    await updateKOTOrderStatus(orderId, 'completed');
  };

  const handleConfirmDelayedComplete = async () => {
    if (!selectedOrderId) return;

    await updateKOTOrderStatus(selectedOrderId, 'completed', {
      delay_reason: delayReason,
      delay_remarks: delayRemarks,
    });

    setDelayDialogOpen(false);
    setSelectedOrderId(null);
    setDelayReason('');
    setDelayRemarks('');
  };

  const handleClaimOrder = async (orderId: string) => {
    await claimOrder(orderId);
  };

  if (!isChef) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Chef dashboard is only available for chef accounts</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      {/* Status Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${STATUS_COLORS[chefStatus].bg} flex items-center justify-center text-white`}>
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-lg">{staffMember?.name}</p>
                <Badge className={STATUS_COLORS[chefStatus].bg}>
                  {STATUS_COLORS[chefStatus].icon}
                  <span className="ml-1 capitalize">{chefStatus}</span>
                </Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant={chefStatus === 'online' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateChefStatus('online')}
              >
                <Wifi className="h-4 w-4 mr-1" />
                Online
              </Button>
              <Button
                variant={chefStatus === 'break' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateChefStatus('break')}
              >
                <Coffee className="h-4 w-4 mr-1" />
                Break
              </Button>
              <Button
                variant={chefStatus === 'offline' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateChefStatus('offline')}
              >
                <WifiOff className="h-4 w-4 mr-1" />
                Offline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Orders to Claim */}
      {kotSettings?.order_assignment_mode === 'claim' && availableOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Hand className="h-5 w-5" />
            Available Orders
          </h2>
          <div className="grid gap-3">
            {availableOrders.map((order) => (
              <Card key={order.id} className="border-dashed border-2 border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">Order #{order.order_id.slice(-6)}</p>
                      {order.table_number && (
                        <p className="text-sm text-muted-foreground">Table {order.table_number}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Button onClick={() => handleClaimOrder(order.id)}>
                      <Hand className="h-4 w-4 mr-2" />
                      Claim
                    </Button>
                  </div>
                  <div className="mt-3 space-y-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* My Active Orders */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" />
          My Orders ({myOrders.length})
        </h2>

        {myOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No active orders</p>
              {chefStatus !== 'online' && (
                <p className="text-sm mt-2">Go online to receive orders</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {myOrders.map((order) => {
              const isDelayed = order.started_at && 
                (Date.now() - new Date(order.started_at).getTime()) / (1000 * 60) > (order.prep_time_minutes || 15);

              return (
                <Card key={order.id} className={isDelayed ? 'border-amber-500 border-2' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          Order #{order.order_id.slice(-6)}
                          {isDelayed && (
                            <Badge variant="outline" className="text-amber-500 border-amber-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Delayed
                            </Badge>
                          )}
                        </CardTitle>
                        {order.table_number && (
                          <p className="text-sm text-muted-foreground">Table {order.table_number}</p>
                        )}
                        {order.customer_name && (
                          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                        )}
                      </div>
                      <Badge className={order.status === 'preparing' ? 'bg-blue-500' : 'bg-amber-500'}>
                        {order.status === 'preparing' ? 'Preparing' : 'Assigned'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="font-medium">{item.quantity}x {item.name}</span>
                          {item.notes && <span className="text-muted-foreground italic">{item.notes}</span>}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {order.started_at 
                            ? formatDistanceToNow(new Date(order.started_at), { addSuffix: true })
                            : formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                        </span>
                        <span className="text-xs">
                          (Expected: {order.prep_time_minutes || kotSettings?.default_prep_time_minutes || 15} min)
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {order.status === 'assigned' && (
                          <Button size="sm" onClick={() => handleStartPreparing(order.id)}>
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {order.status === 'preparing' && (
                          <Button size="sm" onClick={() => handleCompleteOrder(order.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recently Completed */}
      {completedOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Recently Completed
          </h2>
          <div className="grid gap-2">
            {completedOrders.slice(0, 5).map((order) => (
              <Card key={order.id} className="bg-green-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Order #{order.order_id.slice(-6)}</span>
                      {order.table_number && (
                        <span className="text-muted-foreground ml-2">Table {order.table_number}</span>
                      )}
                    </div>
                    <Badge className="bg-green-500">Completed</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Delay Dialog */}
      <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Order Delayed
            </DialogTitle>
            <DialogDescription>
              This order took longer than expected. Please provide a reason for the delay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Delay Reason *</Label>
              <Select value={delayReason} onValueChange={setDelayReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_volume">High Order Volume</SelectItem>
                  <SelectItem value="complex_order">Complex Order</SelectItem>
                  <SelectItem value="ingredient_issue">Ingredient Availability</SelectItem>
                  <SelectItem value="equipment_issue">Equipment Issue</SelectItem>
                  <SelectItem value="special_request">Special Customer Request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any additional notes..."
                value={delayRemarks}
                onChange={(e) => setDelayRemarks(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDelayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDelayedComplete} disabled={!delayReason}>
              Complete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
