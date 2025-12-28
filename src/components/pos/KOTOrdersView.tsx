import { useState } from 'react';
import { useKOT } from '@/hooks/useKOT';
import { KOTOrderStatus } from '@/types/kot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ClipboardList, 
  ChefHat, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Table2,
  AlertTriangle,
  UserPlus
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { usePOSStore } from '@/stores/posStore';

const STATUS_CONFIG: Record<KOTOrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', color: 'bg-gray-500', icon: <Clock className="h-3 w-3" /> },
  assigned: { label: 'Assigned', color: 'bg-amber-500', icon: <ChefHat className="h-3 w-3" /> },
  preparing: { label: 'Preparing', color: 'bg-blue-500', icon: <ChefHat className="h-3 w-3" /> },
  completed: { label: 'Ready', color: 'bg-green-500', icon: <CheckCircle className="h-3 w-3" /> },
  served: { label: 'Served', color: 'bg-purple-500', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
};

export function KOTOrdersView() {
  const { 
    kotOrders, 
    kotSettings, 
    staffList, 
    staffMember, 
    permissions,
    assignOrderToChef,
    updateKOTOrderStatus
  } = useKOT();
  const { brand } = usePOSStore();

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedChefId, setSelectedChefId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('active');

  const canManage = staffMember?.role === 'owner' || staffMember?.role === 'manager';

  // Filter orders by tab
  const activeOrders = kotOrders.filter(o => 
    ['pending', 'assigned', 'preparing', 'completed'].includes(o.status)
  );
  const completedOrders = kotOrders.filter(o => o.status === 'served');
  const cancelledOrders = kotOrders.filter(o => o.status === 'cancelled');

  const availableChefs = staffList.filter(s => 
    s.role === 'chef' && s.is_active && s.chef_status === 'online'
  );

  const handleOpenAssignDialog = (orderId: string) => {
    setSelectedOrderId(orderId);
    setAssignDialogOpen(true);
  };

  const handleAssignChef = async () => {
    if (!selectedOrderId || !selectedChefId) return;
    await assignOrderToChef(selectedOrderId, selectedChefId);
    setAssignDialogOpen(false);
    setSelectedOrderId(null);
    setSelectedChefId('');
  };

  const handleCancelOrder = async (orderId: string) => {
    await updateKOTOrderStatus(orderId, 'cancelled');
  };

  const getChefName = (chefId?: string) => {
    if (!chefId) return 'Unassigned';
    const chef = staffList.find(s => s.id === chefId);
    return chef?.name || 'Unknown';
  };

  const getWaiterName = (waiterId?: string) => {
    if (!waiterId) return 'N/A';
    const waiter = staffList.find(s => s.id === waiterId);
    return waiter?.name || 'Unknown';
  };

  const renderOrderCard = (order: typeof kotOrders[0]) => {
    const statusConfig = STATUS_CONFIG[order.status];
    const isDelayed = order.delay_reason;

    return (
      <Card key={order.id} className={isDelayed ? 'border-amber-500' : ''}>
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
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {order.table_number && (
                  <span className="flex items-center gap-1">
                    <Table2 className="h-3 w-3" />
                    Table {order.table_number}
                  </span>
                )}
                {order.customer_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {order.customer_name}
                  </span>
                )}
              </div>
            </div>
            <Badge className={statusConfig.color}>
              {statusConfig.icon}
              <span className="ml-1">{statusConfig.label}</span>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="text-muted-foreground">{brand.currency}{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
            <div className="space-y-1">
              <p>Waiter: {getWaiterName(order.waiter_id)}</p>
              <p className="flex items-center gap-1">
                <ChefHat className="h-3 w-3" />
                Chef: {getChefName(order.assigned_chef_id)}
              </p>
            </div>
            <div className="text-right">
              <p className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </p>
              {order.started_at && (
                <p className="text-xs">Started: {format(new Date(order.started_at), 'HH:mm')}</p>
              )}
            </div>
          </div>

          {isDelayed && (
            <div className="mt-3 p-2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm">
              <p className="font-medium">Delay Reason: {order.delay_reason}</p>
              {order.delay_remarks && <p className="text-xs mt-1">{order.delay_remarks}</p>}
            </div>
          )}

          {canManage && order.status === 'pending' && kotSettings?.order_assignment_mode === 'manual' && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => handleOpenAssignDialog(order.id)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Assign Chef
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleCancelOrder(order.id)}>
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!permissions.canViewKOT) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>You don't have permission to view KOT orders</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KOT Orders</h1>
          <p className="text-muted-foreground">Kitchen Order Ticket Management</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <ChefHat className="h-3 w-3 mr-1" />
            {availableChefs.length} Chefs Online
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="served">
            Served ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {activeOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active orders</p>
              </CardContent>
            </Card>
          ) : (
            activeOrders.map(renderOrderCard)
          )}
        </TabsContent>

        <TabsContent value="served" className="space-y-3 mt-4">
          {completedOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No served orders yet</p>
              </CardContent>
            </Card>
          ) : (
            completedOrders.slice(0, 20).map(renderOrderCard)
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-3 mt-4">
          {cancelledOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No cancelled orders</p>
              </CardContent>
            </Card>
          ) : (
            cancelledOrders.slice(0, 20).map(renderOrderCard)
          )}
        </TabsContent>
      </Tabs>

      {/* Assign Chef Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Chef</DialogTitle>
            <DialogDescription>
              Select a chef to assign this order to
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={selectedChefId} onValueChange={setSelectedChefId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a chef" />
              </SelectTrigger>
              <SelectContent>
                {availableChefs.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No chefs available
                  </SelectItem>
                ) : (
                  availableChefs.map((chef) => (
                    <SelectItem key={chef.id} value={chef.id}>
                      <div className="flex items-center gap-2">
                        <ChefHat className="h-4 w-4" />
                        {chef.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignChef} disabled={!selectedChefId}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
