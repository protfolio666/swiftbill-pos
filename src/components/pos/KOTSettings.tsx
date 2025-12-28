import { useKOT } from '@/hooks/useKOT';
import { OrderAssignmentMode } from '@/types/kot';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Clock, Settings2, Zap, Users, Hand } from 'lucide-react';
import { toast } from 'sonner';

export function KOTSettings() {
  const { kotSettings, updateKOTSettings, staffMember, permissions } = useKOT();

  const canManage = permissions.canManageKOTSettings && staffMember?.role === 'owner';

  const handleToggleKOT = async (enabled: boolean) => {
    const { error } = await updateKOTSettings({ kot_enabled: enabled });
    if (!error) {
      toast.success(enabled ? 'KOT feature enabled' : 'KOT feature disabled');
    }
  };

  const handleAssignmentModeChange = async (mode: OrderAssignmentMode) => {
    const { error } = await updateKOTSettings({ order_assignment_mode: mode });
    if (!error) {
      toast.success('Assignment mode updated');
    }
  };

  const handlePrepTimeChange = async (minutes: number) => {
    if (minutes < 1 || minutes > 120) {
      toast.error('Prep time must be between 1 and 120 minutes');
      return;
    }
    const { error } = await updateKOTSettings({ default_prep_time_minutes: minutes });
    if (!error) {
      toast.success('Default prep time updated');
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5" />
              KOT (Kitchen Order Ticket)
            </CardTitle>
            <CardDescription>
              Advanced kitchen management for larger restaurants
            </CardDescription>
          </div>
          <Badge variant={kotSettings?.kot_enabled ? 'default' : 'secondary'}>
            {kotSettings?.kot_enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium">Enable KOT System</p>
              <p className="text-sm text-muted-foreground">
                Manage staff roles and kitchen workflow
              </p>
            </div>
          </div>
          <Switch
            checked={kotSettings?.kot_enabled ?? false}
            onCheckedChange={handleToggleKOT}
          />
        </div>

        {kotSettings?.kot_enabled && (
          <>
            {/* Order Assignment Mode */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Order Assignment Mode</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleAssignmentModeChange('auto')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    kotSettings.order_assignment_mode === 'auto'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Zap className={`h-5 w-5 mb-2 ${
                    kotSettings.order_assignment_mode === 'auto' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <p className="font-medium">Auto-Assign</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    System assigns to least busy chef
                  </p>
                </button>

                <button
                  onClick={() => handleAssignmentModeChange('claim')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    kotSettings.order_assignment_mode === 'claim'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Hand className={`h-5 w-5 mb-2 ${
                    kotSettings.order_assignment_mode === 'claim' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <p className="font-medium">First-Come</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Chefs claim available orders
                  </p>
                </button>

                <button
                  onClick={() => handleAssignmentModeChange('manual')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    kotSettings.order_assignment_mode === 'manual'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Users className={`h-5 w-5 mb-2 ${
                    kotSettings.order_assignment_mode === 'manual' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <p className="font-medium">Manual</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Manager assigns to chefs
                  </p>
                </button>
              </div>
            </div>

            {/* Default Prep Time */}
            <div className="space-y-3">
              <Label htmlFor="prep-time" className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Default Preparation Time
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="prep-time"
                  type="number"
                  min={1}
                  max={120}
                  value={kotSettings.default_prep_time_minutes}
                  onChange={(e) => handlePrepTimeChange(parseInt(e.target.value) || 15)}
                  className="w-24"
                />
                <span className="text-muted-foreground">minutes</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Expected time for chefs to complete orders
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
