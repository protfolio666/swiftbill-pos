import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Admin email - only this user can access admin functions
const ADMIN_EMAIL = 'bsnlsdp3600@gmail.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user making the request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      console.log('Admin access denied for:', user?.email);
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, data } = await req.json();
    console.log('Admin action:', action, 'by:', user.email);

    if (action === 'get-users') {
      // Get all users with their subscriptions
      const { data: authUsers, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      // Get all subscriptions
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('*');

      if (subError) {
        console.error('Error fetching subscriptions:', subError);
      }

      // Get all profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*');

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      // Get all staff members to identify owners (where user_id = owner_id means they're an owner)
      const { data: staffMembers, error: staffError } = await supabase
        .from('staff_members')
        .select('user_id, owner_id, role')
        .eq('role', 'owner');

      if (staffError) {
        console.error('Error fetching staff members:', staffError);
      }

      // Create a set of owner user IDs
      const ownerUserIds = new Set(staffMembers?.map(s => s.user_id) || []);

      // Filter and combine data - only show owners
      const usersWithData = authUsers.users
        .filter(user => {
          // Include user if they're an owner OR if they don't have a staff record yet (legacy/new users)
          const hasStaffRecord = staffMembers?.some(s => s.user_id === user.id);
          if (!hasStaffRecord) return true; // Show users without staff records (legacy users)
          return ownerUserIds.has(user.id); // Only show owners
        })
        .map(user => {
          const subscription = subscriptions?.find(s => s.user_id === user.id);
          const profile = profiles?.find(p => p.user_id === user.id);
          return {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            subscription,
            profile,
          };
        });

      return new Response(JSON.stringify({ success: true, users: usersWithData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update-subscription') {
      const { userId, planName, status, validUntil } = data;
      
      // Check if subscription exists
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSub) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            plan_name: planName,
            status: status,
            valid_until: validUntil,
          })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_name: planName,
            status: status,
            valid_until: validUntil,
            amount: 0,
            currency: 'INR',
          });

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'extend-trial') {
      const { userId, days } = data;
      
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // If subscription expired, use current date as base, otherwise extend from valid_until
      const now = new Date();
      let currentEnd = now;
      if (sub?.valid_until) {
        const validUntilDate = new Date(sub.valid_until);
        // If not expired, extend from valid_until; if expired, extend from now
        currentEnd = validUntilDate > now ? validUntilDate : now;
      }
      
      const newEnd = new Date(currentEnd);
      newEnd.setDate(newEnd.getDate() + days);

      if (sub) {
        // Update existing subscription
        const { error } = await supabase
          .from('subscriptions')
          .update({
            valid_until: newEnd.toISOString(),
            status: 'active',
            plan_name: sub.plan_name === 'trial' ? 'trial' : sub.plan_name,
          })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Create new trial subscription if none exists
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_name: 'trial',
            status: 'active',
            valid_until: newEnd.toISOString(),
            amount: 0,
            currency: 'INR',
          });

        if (error) throw error;
      }

      return new Response(JSON.stringify({ success: true, newValidUntil: newEnd.toISOString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'cancel-subscription') {
      const { userId } = data;
      
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
        })
        .eq('user_id', userId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin function error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});