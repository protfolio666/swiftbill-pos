import { useState } from 'react';
import { useKOT } from '@/hooks/useKOT';
import { StaffRole } from '@/types/kot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UserPlus, Users, ChefHat, ClipboardList, Trash2, Edit2, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_ICONS: Record<StaffRole, React.ReactNode> = {
  owner: <Users className="h-4 w-4" />,
  manager: <ClipboardList className="h-4 w-4" />,
  waiter: <Users className="h-4 w-4" />,
  chef: <ChefHat className="h-4 w-4" />,
};

const ROLE_COLORS: Record<StaffRole, string> = {
  owner: 'bg-purple-500',
  manager: 'bg-blue-500',
  waiter: 'bg-green-500',
  chef: 'bg-orange-500',
};

export function StaffManagement() {
  const { staffMember, staffList, createStaff, updateStaff, deleteStaff, permissions } = useKOT();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'waiter' as StaffRole,
    phone: '',
  });

  const canManageStaff = permissions.canManageStaff && staffMember?.role === 'owner';

  const handleCreateStaff = async () => {
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsCreating(true);
    const { error } = await createStaff(
      formData.email,
      formData.password,
      formData.name,
      formData.role,
      formData.phone || undefined
    );
    setIsCreating(false);

    if (!error) {
      setIsAddDialogOpen(false);
      setFormData({ email: '', password: '', name: '', role: 'waiter', phone: '' });
    }
  };

  const handleToggleActive = async (staffId: string, isActive: boolean) => {
    await updateStaff(staffId, { is_active: isActive });
  };

  const handleDeleteStaff = async (staffId: string) => {
    await deleteStaff(staffId);
  };

  const filteredStaff = staffList.filter(s => s.role !== 'owner');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Management
          </CardTitle>
          <CardDescription>
            Create and manage your restaurant staff
          </CardDescription>
        </div>
        {canManageStaff && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Staff Member</DialogTitle>
                <DialogDescription>
                  Create a new account for your staff member
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@restaurant.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: StaffRole) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Manager
                        </div>
                      </SelectItem>
                      <SelectItem value="waiter">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Waiter
                        </div>
                      </SelectItem>
                      <SelectItem value="chef">
                        <div className="flex items-center gap-2">
                          <ChefHat className="h-4 w-4" />
                          Chef
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateStaff} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Staff'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent>
        {filteredStaff.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No staff members yet</p>
            <p className="text-sm">Add managers, waiters, and chefs to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStaff.map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${ROLE_COLORS[staff.role]} flex items-center justify-center text-white`}>
                    {ROLE_ICONS[staff.role]}
                  </div>
                  <div>
                    <p className="font-medium">{staff.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="capitalize text-xs">
                        {staff.role}
                      </Badge>
                      {staff.phone && <span>{staff.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {staff.role === 'chef' && (
                    <Badge
                      className={
                        staff.chef_status === 'online'
                          ? 'bg-green-500'
                          : staff.chef_status === 'break'
                          ? 'bg-amber-500'
                          : 'bg-gray-500'
                      }
                    >
                      {staff.chef_status}
                    </Badge>
                  )}

                  {canManageStaff && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${staff.id}`} className="text-xs text-muted-foreground">
                          Active
                        </Label>
                        <Switch
                          id={`active-${staff.id}`}
                          checked={staff.is_active}
                          onCheckedChange={(checked) => handleToggleActive(staff.id, checked)}
                        />
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {staff.name}'s account. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
