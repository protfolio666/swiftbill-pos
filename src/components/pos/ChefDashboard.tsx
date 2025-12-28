import { useState, useEffect, useRef } from 'react';
import { useKOT } from '@/hooks/useKOT';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { ChefStatus, KOTOrder } from '@/types/kot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  ChefHat, Clock, CheckCircle, AlertTriangle, Coffee, Wifi, WifiOff, 
  Play, Hand, Volume2, VolumeX, Maximize2, Minimize2, Timer
} from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';

const STATUS_COLORS: Record<ChefStatus, { bg: string; icon: React.ReactNode }> = {
  online: { bg: 'bg-green-500', icon: <Wifi className="h-4 w-4" /> },
  offline: { bg: 'bg-gray-500', icon: <WifiOff className="h-4 w-4" /> },
  break: { bg: 'bg-amber-500', icon: <Coffee className="h-4 w-4" /> },
};

// Timer component that updates every second
function OrderTimer({ order, defaultPrepTime }: { order: KOTOrder; defaultPrepTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  const startTime = order.started_at || order.created_at;
  const expectedMinutes = order.prep_time_minutes || defaultPrepTime;
  
  useEffect(() => {
    const updateElapsed = () => {
      const seconds = differenceInSeconds(new Date(), new Date(startTime));
      setElapsed(seconds);
    };
    
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const isOverdue = minutes >= expectedMinutes;
  
  return (
    <div className={`flex items-center gap-2 font-mono text-lg ${isOverdue ? 'text-red-500' : 'text-foreground'}`}>
      <Timer className="h-5 w-5" />
      <span className={`tabular-nums ${isOverdue ? 'animate-pulse' : ''}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
      <span className="text-sm text-muted-foreground">/ {expectedMinutes}:00</span>
    </div>
  );
}

export function ChefDashboard() {
  const { 
    staffMember, 
    kotOrders, 
    kotSettings,
    updateChefStatus, 
    updateKOTOrderStatus, 
    claimOrder 
  } = useKOT();
  const { playSound, toggleSound } = useOrderNotifications();

  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState('');
  const [delayRemarks, setDelayRemarks] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousOrdersRef = useRef<string[]>([]);

  const isChef = staffMember?.role === 'chef';
  const chefStatus = staffMember?.chef_status || 'offline';
  const defaultPrepTime = kotSettings?.default_prep_time_minutes || 15;

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

  // Play sound when new orders are assigned
  useEffect(() => {
    const currentOrderIds = myOrders.map(o => o.id);
    const newOrders = currentOrderIds.filter(id => !previousOrdersRef.current.includes(id));
    
    if (newOrders.length > 0 && soundEnabled && chefStatus === 'online') {
      playSound();
    }
    
    previousOrdersRef.current = currentOrderIds;
  }, [myOrders, soundEnabled, chefStatus, playSound]);

  // Also play sound for claimable orders
  useEffect(() => {
    if (availableOrders.length > 0 && soundEnabled && chefStatus === 'online' && kotSettings?.order_assignment_mode === 'claim') {
      // Only play once per new batch
      const newClaimable = availableOrders.filter(
        o => !previousOrdersRef.current.includes(o.id)
      );
      if (newClaimable.length > 0) {
        playSound();
      }
    }
  }, [availableOrders, soundEnabled, chefStatus, kotSettings?.order_assignment_mode, playSound]);

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    toggleSound(enabled);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleStartPreparing = async (orderId: string) => {
    await updateKOTOrderStatus(orderId, 'preparing');
  };

  const handleCompleteOrder = async (orderId: string) => {
    const order = kotOrders.find(o => o.id === orderId);
    if (order) {
      const expectedMinutes = order.prep_time_minutes || defaultPrepTime;
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
    <div 
      ref={containerRef} 
      className={`p-4 space-y-6 bg-background ${isFullscreen ? 'h-screen overflow-auto' : 'max-w-6xl mx-auto'}`}
    >
      {/* Status Bar */}
      <Card className="sticky top-0 z-10 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-full ${STATUS_COLORS[chefStatus].bg} flex items-center justify-center text-white shadow-lg`}>
                <ChefHat className="h-7 w-7" />
              </div>
              <div>
                <p className="font-bold text-xl">{staffMember?.name}</p>
                <Badge className={`${STATUS_COLORS[chefStatus].bg} text-sm`}>
                  {STATUS_COLORS[chefStatus].icon}
                  <span className="ml-1 capitalize">{chefStatus}</span>
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Sound Toggle */}
              <div className="flex items-center gap-2">
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
                <Switch checked={soundEnabled} onCheckedChange={handleToggleSound} />
              </div>

              {/* Fullscreen Toggle */}
              <Button variant="outline" size="icon" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>

              {/* Status Buttons */}
              <div className="flex gap-2">
                <Button
                  variant={chefStatus === 'online' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateChefStatus('online')}
                  className={chefStatus === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  <Wifi className="h-4 w-4 mr-1" />
                  Online
                </Button>
                <Button
                  variant={chefStatus === 'break' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateChefStatus('break')}
                  className={chefStatus === 'break' ? 'bg-amber-500 hover:bg-amber-600' : ''}
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
          </div>
        </CardContent>
      </Card>

      {/* Available Orders to Claim */}
      {kotSettings?.order_assignment_mode === 'claim' && availableOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
            <Hand className="h-6 w-6" />
            Available Orders ({availableOrders.length})
          </h2>
          <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
            {availableOrders.map((order) => (
              <Card key={order.id} className="border-2 border-dashed border-primary/50 hover:border-primary transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-lg">#{order.order_id.slice(-6)}</p>
                      {order.table_number && (
                        <Badge variant="outline">Table {order.table_number}</Badge>
                      )}
                    </div>
                    <Button size="lg" onClick={() => handleClaimOrder(order.id)} className="shadow-md">
                      <Hand className="h-5 w-5 mr-2" />
                      Claim
                    </Button>
                  </div>
                  <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-base flex justify-between">
                        <span className="font-medium">{item.quantity}x {item.name}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* My Active Orders */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6" />
          My Orders ({myOrders.length})
        </h2>

        {myOrders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
              <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">No active orders</p>
              {chefStatus !== 'online' && (
                <p className="text-sm mt-2">Go online to receive orders</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
            {myOrders.map((order) => {
              const startTime = order.started_at || order.created_at;
              const expectedMinutes = order.prep_time_minutes || defaultPrepTime;
              const elapsedMinutes = (Date.now() - new Date(startTime).getTime()) / (1000 * 60);
              const isDelayed = elapsedMinutes > expectedMinutes;

              return (
                <Card 
                  key={order.id} 
                  className={`transition-all ${
                    isDelayed 
                      ? 'border-red-500 border-2 shadow-red-500/20 shadow-lg animate-pulse' 
                      : order.status === 'preparing' 
                        ? 'border-blue-500 border-2 shadow-blue-500/20 shadow-lg' 
                        : 'border-amber-400 border-2'
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-2xl flex items-center gap-2">
                          #{order.order_id.slice(-6)}
                          {isDelayed && (
                            <AlertTriangle className="h-6 w-6 text-red-500" />
                          )}
                        </CardTitle>
                        <div className="flex gap-2 mt-1">
                          {order.table_number && (
                            <Badge variant="outline" className="text-base">Table {order.table_number}</Badge>
                          )}
                          {order.customer_name && (
                            <Badge variant="secondary">{order.customer_name}</Badge>
                          )}
                        </div>
                      </div>
                      <Badge className={`text-base px-3 py-1 ${
                        order.status === 'preparing' ? 'bg-blue-500' : 'bg-amber-500'
                      }`}>
                        {order.status === 'preparing' ? 'Preparing' : 'Assigned'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Timer */}
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <OrderTimer order={order} defaultPrepTime={defaultPrepTime} />
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start text-base p-2 bg-background rounded border">
                          <span className="font-semibold">{item.quantity}x {item.name}</span>
                          {item.notes && (
                            <span className="text-sm text-amber-600 italic ml-2">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {order.status === 'assigned' && (
                        <Button 
                          size="lg" 
                          onClick={() => handleStartPreparing(order.id)}
                          className="flex-1 bg-blue-500 hover:bg-blue-600"
                        >
                          <Play className="h-5 w-5 mr-2" />
                          Start Preparing
                        </Button>
                      )}
                      {order.status === 'preparing' && (
                        <Button 
                          size="lg" 
                          onClick={() => handleCompleteOrder(order.id)}
                          className="flex-1 bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Complete
                        </Button>
                      )}
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
          <h2 className="text-lg font-semibold flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Recently Completed ({completedOrders.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {completedOrders.slice(0, 10).map((order) => (
              <Badge key={order.id} variant="outline" className="bg-green-500/10 text-green-600 py-1 px-3">
                #{order.order_id.slice(-6)}
                {order.table_number && ` • T${order.table_number}`}
              </Badge>
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
