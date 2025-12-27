import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log(`Razorpay action: ${action}`, data);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'create-trial') {
      const { userId } = data;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Check if user already has an ACTIVE subscription
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Only skip if there's an active subscription with valid date
      if (existingSub && existingSub.status === 'active' && existingSub.valid_until) {
        const isStillValid = new Date(existingSub.valid_until) > new Date();
        if (isStillValid) {
          return new Response(JSON.stringify({ 
            success: true, 
            message: 'User already has active subscription', 
            subscription: existingSub 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Create 7-day trial
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 7);

      let newSub;
      if (existingSub) {
        // Update existing pending/expired subscription to trial
        const { data: updatedSub, error: updateError } = await supabase
          .from('subscriptions')
          .update({
            plan_name: 'trial',
            status: 'active',
            amount: 0,
            currency: 'INR',
            valid_until: trialEndDate.toISOString(),
          })
          .eq('user_id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating to trial:', updateError);
          throw updateError;
        }
        newSub = updatedSub;
      } else {
        // Create new trial subscription
        const { data: createdSub, error: subError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_name: 'trial',
            status: 'active',
            amount: 0,
            currency: 'INR',
            valid_until: trialEndDate.toISOString(),
          })
          .select()
          .single();

        if (subError) {
          console.error('Error creating trial:', subError);
          throw subError;
        }
        newSub = createdSub;
      }

      console.log('Trial subscription created/updated:', newSub);
      return new Response(JSON.stringify({ success: true, subscription: newSub }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create-order') {
      const { amount, currency, userId, planName } = data;
      
      // Create Razorpay order
      const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
      const orderResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount * 100, // Razorpay expects amount in paise
          currency: currency || 'INR',
          receipt: `receipt_${Date.now()}`,
        }),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('Razorpay order creation failed:', errorText);
        throw new Error(`Failed to create Razorpay order: ${errorText}`);
      }

      const order = await orderResponse.json();
      console.log('Razorpay order created:', order);

      // Check existing subscription - DON'T change status to pending, just store order_id
      // This preserves trial status until payment is verified
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSub) {
        // Only update order info, keep current status and plan intact
        await supabase
          .from('subscriptions')
          .update({
            razorpay_order_id: order.id,
            // Store intended plan for after payment verification
          })
          .eq('user_id', userId);
      } else {
        // Create new subscription with pending status only if none exists
        await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            plan_name: planName,
            razorpay_order_id: order.id,
            status: 'pending',
            amount: amount,
            currency: currency || 'INR',
          });
      }

      // Store the intended plan name in the response so it can be used during verification
      return new Response(JSON.stringify({ 
        success: true, 
        order,
        key_id: RAZORPAY_KEY_ID,
        intendedPlan: planName,
        intendedAmount: amount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify-payment') {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId, planName, amount } = data;
      
      // Verify signature
      const crypto = await import("https://deno.land/std@0.168.0/crypto/mod.ts");
      const encoder = new TextEncoder();
      const keyData = encoder.encode(RAZORPAY_KEY_SECRET);
      const message = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`);
      
      const key = await crypto.crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      
      const signature = await crypto.crypto.subtle.sign("HMAC", key, message);
      const generatedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      console.log('Generated signature:', generatedSignature);
      console.log('Received signature:', razorpay_signature);

      if (generatedSignature === razorpay_signature) {
        // Update subscription with new plan - 1 year for paid plans
        const validUntil = new Date();
        validUntil.setFullYear(validUntil.getFullYear() + 1);

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            razorpay_payment_id,
            razorpay_signature,
            status: 'active',
            plan_name: planName || 'yearly', // Update plan only on successful payment
            amount: amount || 0,
            valid_until: validUntil.toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          throw new Error('Failed to update subscription');
        }

        console.log('Payment verified and subscription activated with plan:', planName);
        return new Response(JSON.stringify({ success: true, message: 'Payment verified' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        console.error('Signature mismatch');
        return new Response(JSON.stringify({ success: false, message: 'Invalid signature' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'check-subscription') {
      const { userId } = data;
      
      // Get the most recent subscription regardless of status
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking subscription:', error);
      }

      let hasActiveSubscription = false;
      let isTrialActive = false;
      let trialDaysRemaining = 0;

      if (subscription && subscription.valid_until && subscription.status === 'active') {
        hasActiveSubscription = new Date(subscription.valid_until) > new Date();
        isTrialActive = subscription.plan_name === 'trial' && hasActiveSubscription;
        if (isTrialActive) {
          trialDaysRemaining = Math.max(0, Math.ceil((new Date(subscription.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        hasActiveSubscription,
        subscription,
        isTrialActive,
        trialDaysRemaining
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Razorpay function error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
