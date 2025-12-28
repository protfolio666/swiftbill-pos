import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  StaffMember, 
  KOTSettings, 
  KOTOrder, 
  StaffRole, 
  ChefStatus, 
  OrderAssignmentMode,
  KOTOrderStatus,
  getRolePermissions 
} from '@/types/kot';
import { toast } from 'sonner';

export function useKOT() {
  const { user } = useAuth();
  const [staffMember, setStaffMember] = useState<StaffMember | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [kotSettings, setKotSettings] = useState<KOTSettings | null>(null);
  const [kotOrders, setKotOrders] = useState<KOTOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const role = staffMember?.role || null;
  const permissions = getRolePermissions(role);
  const isKOTEnabled = kotSettings?.kot_enabled ?? false;
  const ownerId = staffMember?.owner_id || user?.id;

  // Fetch current user's staff record
  const fetchStaffMember = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching staff member:', error);
      return;
    }

    if (data) {
      setStaffMember(data as StaffMember);
    } else {
      // User is not a staff member - they might be a legacy owner
      // Auto-create owner record for them
      const { data: newStaff, error: createError } = await supabase
        .from('staff_members')
        .insert({
          user_id: user.id,
          owner_id: user.id,
          role: 'owner',
          name: user.user_metadata?.owner_name || user.email?.split('@')[0] || 'Owner',
          is_active: true,
          chef_status: 'offline',
        })
        .select()
        .single();

      if (!createError && newStaff) {
        setStaffMember(newStaff as StaffMember);
      }
    }
  }, [user]);

  // Fetch staff list (for owners/managers)
  const fetchStaffList = useCallback(async () => {
    if (!ownerId) return;

    const { data, error } = await supabase
      .from('staff_members')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching staff list:', error);
      return;
    }

    setStaffList((data || []) as StaffMember[]);
  }, [ownerId]);

  // Fetch KOT settings
  const fetchKOTSettings = useCallback(async () => {
    if (!ownerId) return;

    const { data, error } = await supabase
      .from('kot_settings')
      .select('*')
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching KOT settings:', error);
      return;
    }

    if (data) {
      setKotSettings(data as KOTSettings);
    } else {
      // Create default settings for owner
      if (staffMember?.role === 'owner') {
        const { data: newSettings } = await supabase
          .from('kot_settings')
          .insert({
            owner_id: ownerId,
            kot_enabled: false,
            order_assignment_mode: 'auto',
            default_prep_time_minutes: 15,
            auto_assign_enabled: true,
          })
          .select()
          .single();

        if (newSettings) {
          setKotSettings(newSettings as KOTSettings);
        }
      }
    }
  }, [ownerId, staffMember?.role]);

  // Fetch KOT orders
  const fetchKOTOrders = useCallback(async () => {
    if (!ownerId || !isKOTEnabled) return;

    const { data, error } = await supabase
      .from('kot_orders')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching KOT orders:', error);
      return;
    }

    // Transform database records to KOTOrder type
    const orders: KOTOrder[] = (data || []).map((record: any) => ({
      ...record,
      items: Array.isArray(record.items) ? record.items : [],
    }));
    setKotOrders(orders);
  }, [ownerId, isKOTEnabled]);

  // Create staff member via edge function
  const createStaff = async (
    email: string,
    password: string,
    name: string,
    staffRole: StaffRole,
    phone?: string
  ) => {
    if (!user || staffMember?.role !== 'owner') {
      toast.error('Only owners can create staff');
      return { error: new Error('Unauthorized') };
    }

    try {
      // Get session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('No session found');
      }

      // Call edge function to create staff (uses admin API, doesn't affect current session)
      const response = await supabase.functions.invoke('create-staff', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          email,
          password,
          name,
          role: staffRole,
          phone,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create staff');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`${name} added as ${staffRole}`);
      await fetchStaffList();
      return { error: null };
    } catch (error: any) {
      console.error('Error creating staff:', error);
      toast.error(error.message || 'Failed to create staff');
      return { error };
    }
  };

  // Update staff member
  const updateStaff = async (staffId: string, updates: Partial<StaffMember>) => {
    const { error } = await supabase
      .from('staff_members')
      .update(updates)
      .eq('id', staffId);

    if (error) {
      toast.error('Failed to update staff');
      return { error };
    }

    toast.success('Staff updated');
    await fetchStaffList();
    return { error: null };
  };

  // Delete staff member
  const deleteStaff = async (staffId: string) => {
    if (staffMember?.role !== 'owner') {
      toast.error('Only owners can delete staff');
      return { error: new Error('Unauthorized') };
    }

    const { error } = await supabase
      .from('staff_members')
      .delete()
      .eq('id', staffId);

    if (error) {
      toast.error('Failed to delete staff');
      return { error };
    }

    toast.success('Staff removed');
    await fetchStaffList();
    return { error: null };
  };

  // Update KOT settings
  const updateKOTSettings = async (updates: Partial<KOTSettings>) => {
    if (!ownerId || staffMember?.role !== 'owner') {
      toast.error('Only owners can update KOT settings');
      return { error: new Error('Unauthorized') };
    }

    const { error } = await supabase
      .from('kot_settings')
      .update(updates)
      .eq('owner_id', ownerId);

    if (error) {
      toast.error('Failed to update settings');
      return { error };
    }

    await fetchKOTSettings();
    return { error: null };
  };

  // Update chef status
  const updateChefStatus = async (status: ChefStatus) => {
    if (!staffMember || staffMember.role !== 'chef') return;

    const { error } = await supabase
      .from('staff_members')
      .update({ chef_status: status })
      .eq('id', staffMember.id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    setStaffMember({ ...staffMember, chef_status: status });
    toast.success(`Status changed to ${status}`);
  };

  // Create KOT order
  const createKOTOrder = async (order: {
    order_id: string;
    items: any[];
    table_number?: number;
    customer_name?: string;
  }) => {
    if (!ownerId) return { error: new Error('No owner ID') };

    const waiterId = staffMember?.role === 'waiter' ? staffMember.id : undefined;

    // Auto-assign to chef if enabled
    let assignedChefId: string | undefined;
    if (kotSettings?.order_assignment_mode === 'auto') {
      const availableChefs = staffList.filter(
        s => s.role === 'chef' && s.is_active && s.chef_status === 'online'
      );

      if (availableChefs.length > 0) {
        // Get chef with least active orders
        const chefOrderCounts = await Promise.all(
          availableChefs.map(async (chef) => {
            const { count } = await supabase
              .from('kot_orders')
              .select('*', { count: 'exact', head: true })
              .eq('assigned_chef_id', chef.id)
              .in('status', ['assigned', 'preparing']);
            return { chefId: chef.id, count: count || 0 };
          })
        );

        chefOrderCounts.sort((a, b) => a.count - b.count);
        assignedChefId = chefOrderCounts[0]?.chefId;
      }
    }

    const { data, error } = await supabase
      .from('kot_orders')
      .insert({
        owner_id: ownerId,
        order_id: order.order_id,
        waiter_id: waiterId,
        assigned_chef_id: assignedChefId,
        status: assignedChefId ? 'assigned' : 'pending',
        items: order.items,
        table_number: order.table_number,
        customer_name: order.customer_name,
        prep_time_minutes: kotSettings?.default_prep_time_minutes || 15,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create KOT order');
      return { error };
    }

    await fetchKOTOrders();
    return { data, error: null };
  };

  // Update KOT order status
  const updateKOTOrderStatus = async (
    orderId: string,
    status: KOTOrderStatus,
    extras?: { delay_reason?: string; delay_remarks?: string }
  ) => {
    const updates: any = { status, ...extras };

    if (status === 'preparing') {
      updates.started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    } else if (status === 'served') {
      updates.served_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('kot_orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to update order');
      return { error };
    }

    await fetchKOTOrders();
    return { error: null };
  };

  // Claim order (for claim mode)
  const claimOrder = async (orderId: string) => {
    if (!staffMember || staffMember.role !== 'chef') return;

    const { error } = await supabase
      .from('kot_orders')
      .update({
        assigned_chef_id: staffMember.id,
        status: 'assigned',
      })
      .eq('id', orderId)
      .is('assigned_chef_id', null);

    if (error) {
      toast.error('Failed to claim order');
      return;
    }

    toast.success('Order claimed');
    await fetchKOTOrders();
  };

  // Assign order manually
  const assignOrderToChef = async (orderId: string, chefId: string) => {
    if (staffMember?.role !== 'owner' && staffMember?.role !== 'manager') {
      toast.error('Only owners/managers can assign orders');
      return;
    }

    const { error } = await supabase
      .from('kot_orders')
      .update({
        assigned_chef_id: chefId,
        status: 'assigned',
      })
      .eq('id', orderId);

    if (error) {
      toast.error('Failed to assign order');
      return;
    }

    toast.success('Order assigned');
    await fetchKOTOrders();
  };

  // Initialize
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const init = async () => {
      setIsLoading(true);
      await fetchStaffMember();
      setIsLoading(false);
    };

    init();
  }, [user, fetchStaffMember]);

  // Fetch dependent data when staff member is loaded
  useEffect(() => {
    if (staffMember) {
      fetchStaffList();
      fetchKOTSettings();
    }
  }, [staffMember, fetchStaffList, fetchKOTSettings]);

  // Fetch orders when KOT is enabled
  useEffect(() => {
    if (isKOTEnabled) {
      fetchKOTOrders();
    }
  }, [isKOTEnabled, fetchKOTOrders]);

  // Realtime subscriptions
  useEffect(() => {
    if (!ownerId || !isKOTEnabled) return;

    let previousOrderCount = kotOrders.length;

    const ordersChannel = supabase
      .channel('kot-orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'kot_orders',
          filter: `owner_id=eq.${ownerId}`,
        },
        (payload) => {
          console.log('New KOT order received:', payload);
          fetchKOTOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kot_orders',
          filter: `owner_id=eq.${ownerId}`,
        },
        () => {
          fetchKOTOrders();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'kot_orders',
          filter: `owner_id=eq.${ownerId}`,
        },
        () => {
          fetchKOTOrders();
        }
      )
      .subscribe();

    const staffChannel = supabase
      .channel('staff-members')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_members',
          filter: `owner_id=eq.${ownerId}`,
        },
        () => {
          fetchStaffList();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(staffChannel);
    };
  }, [ownerId, isKOTEnabled, fetchKOTOrders, fetchStaffList]);

  return {
    // State
    user,
    staffMember,
    staffList,
    kotSettings,
    kotOrders,
    isLoading,
    role,
    permissions,
    isKOTEnabled,
    ownerId,

    // Staff management
    createStaff,
    updateStaff,
    deleteStaff,

    // KOT settings
    updateKOTSettings,

    // Chef actions
    updateChefStatus,

    // Order actions
    createKOTOrder,
    updateKOTOrderStatus,
    claimOrder,
    assignOrderToChef,

    // Refresh functions
    refreshStaff: fetchStaffList,
    refreshOrders: fetchKOTOrders,
    refreshSettings: fetchKOTSettings,
  };
}
