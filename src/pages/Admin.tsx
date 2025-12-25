import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { Shield, Users, RefreshCw, Calendar, ArrowLeft, Crown, Clock, Ban } from 'lucide-react';
import { format } from 'date-fns';

interface UserData {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  subscription: {
    plan_name: string;
    status: string;
    valid_until: string | null;
    amount: number;
  } | null;
  profile: {
    restaurant_name: string | null;
    owner_name: string | null;
  } | null;
}

const ADMIN_EMAIL = 'bsnlsdp3600@gmail.com';

const Admin = () => {
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [extendDays, setExtendDays] = useState('7');
  const [editPlan, setEditPlan] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    if (user?.email !== ADMIN_EMAIL) {
      toast.error('Admin access required');
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user, navigate]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { action: 'get-users' }
      });

      if (error) throw error;
      if (data?.users) {
        setUsers(data.users);
        
        // Sync users to Neon DB
        const usersToSync = data.users.map((u: UserData) => ({
          id: u.id,
          email: u.email,
          restaurant_name: u.profile?.restaurant_name || null,
          owner_name: u.profile?.owner_name || null,
          plan_name: u.subscription?.plan_name || 'trial',
          subscription_status: u.subscription?.status || 'pending',
          valid_until: u.subscription?.valid_until || null
        }));

        // Sync to Neon in background
        supabase.functions.invoke('neon-db', {
          body: { action: 'syncUsers', data: { users: usersToSync } }
        }).then(({ error: syncError }) => {
          if (syncError) {
            console.error('Failed to sync users to Neon:', syncError);
          } else {
            console.log('Users synced to Neon DB');
          }
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtendTrial = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin', {
        body: { 
          action: 'extend-trial', 
          data: { userId, days: parseInt(extendDays) }
        }
      });

      if (error) throw error;
      toast.success(`Trial extended by ${extendDays} days`);
      fetchUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Error extending trial:', error);
      toast.error('Failed to extend trial');
    }
  };

  const handleUpdateSubscription = async (userId: string) => {
    try {
      let validUntil: string | null = null;
      
      if (editPlan === 'lifetime') {
        // Set to year 2099 for lifetime
        validUntil = new Date('2099-12-31').toISOString();
      } else {
        const date = new Date();
        if (editPlan === 'monthly') {
          date.setMonth(date.getMonth() + 1);
        } else if (editPlan === 'yearly') {
          date.setFullYear(date.getFullYear() + 1);
        } else if (editPlan === 'trial') {
          date.setDate(date.getDate() + 7);
        }
        validUntil = date.toISOString();
      }

      const { error } = await supabase.functions.invoke('admin', {
        body: { 
          action: 'update-subscription', 
          data: { 
            userId, 
            planName: editPlan,
            status: editStatus,
            validUntil
          }
        }
      });

      if (error) throw error;
      toast.success('Subscription updated');
      fetchUsers();
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    }
  };

  const handleCancelSubscription = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin', {
        body: { action: 'cancel-subscription', data: { userId } }
      });

      if (error) throw error;
      toast.success('Subscription cancelled');
      fetchUsers();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast.error('Failed to cancel subscription');
    }
  };

  const getStatusBadge = (subscription: UserData['subscription']) => {
    if (!subscription) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-600">No Subscription</Badge>;
    }
    
    const isExpired = subscription.valid_until && new Date(subscription.valid_until) < new Date();
    
    if (subscription.status === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (subscription.plan_name === 'lifetime') {
      return <Badge className="bg-purple-500">Lifetime</Badge>;
    }
    if (isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (subscription.status === 'active') {
      if (subscription.plan_name === 'trial') {
        return <Badge className="bg-amber-500">Trial</Badge>;
      }
      return <Badge className="bg-green-500">Active</Badge>;
    }
    if (subscription.status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="outline">{subscription.status}</Badge>;
  };

  if (user?.email !== ADMIN_EMAIL) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - Restaurant POS</title>
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-950 dark:to-zinc-900 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                  <p className="text-muted-foreground text-sm">Manage users and subscriptions</p>
                </div>
              </div>
            </div>
            
            <Button onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{users.length}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {users.filter(u => u.subscription?.status === 'active' && u.subscription.plan_name !== 'trial').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Paid Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {users.filter(u => u.subscription?.plan_name === 'trial' && u.subscription.status === 'active').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Active Trials</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Ban className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">
                      {users.filter(u => !u.subscription || u.subscription.status === 'cancelled' || 
                        (u.subscription.valid_until && new Date(u.subscription.valid_until) < new Date())).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Expired/No Sub</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage user subscriptions and trials</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valid Until</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => (
                      <TableRow key={userData.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{userData.email}</p>
                            <p className="text-xs text-muted-foreground">{userData.profile?.owner_name || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{userData.profile?.restaurant_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{userData.subscription?.plan_name || 'None'}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(userData.subscription)}</TableCell>
                        <TableCell>
                          {userData.subscription?.plan_name === 'lifetime' 
                            ? 'Forever'
                            : userData.subscription?.valid_until 
                              ? format(new Date(userData.subscription.valid_until), 'MMM dd, yyyy')
                              : '-'}
                        </TableCell>
                        <TableCell>
                          {format(new Date(userData.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedUser(userData);
                                    setEditPlan(userData.subscription?.plan_name || 'trial');
                                    setEditStatus(userData.subscription?.status || 'active');
                                  }}
                                >
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Edit Subscription</DialogTitle>
                                  <DialogDescription>
                                    Update subscription for {userData.email}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Plan</label>
                                    <Select value={editPlan} onValueChange={setEditPlan}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="trial">Trial</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="yearly">Yearly</SelectItem>
                                        <SelectItem value="lifetime">Lifetime</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Status</label>
                                    <Select value={editStatus} onValueChange={setEditStatus}>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-sm font-medium">Extend Trial (days)</label>
                                    <div className="flex gap-2">
                                      <Input 
                                        type="number" 
                                        value={extendDays} 
                                        onChange={(e) => setExtendDays(e.target.value)}
                                        placeholder="7"
                                      />
                                      <Button onClick={() => handleExtendTrial(userData.id)}>
                                        <Calendar className="h-4 w-4 mr-1" />
                                        Extend
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleCancelSubscription(userData.id)}
                                  >
                                    Cancel Sub
                                  </Button>
                                  <Button onClick={() => handleUpdateSubscription(userData.id)}>
                                    Save Changes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Admin;