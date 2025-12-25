import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { neon } from "https://esm.sh/@neondatabase/serverless@0.9.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const databaseUrl = Deno.env.get('NEON_DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('NEON_DATABASE_URL is not configured');
    }

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      throw new Error('Authentication required');
    }

    const sql = neon(databaseUrl);
    const { action, data } = await req.json();

    let result;

    switch (action) {
      // Categories - filtered by user_id
      case 'getCategories':
        result = await sql`SELECT * FROM categories WHERE user_id = ${userId} ORDER BY name`;
        break;
      
      case 'createCategory':
        result = await sql`
          INSERT INTO categories (name, color, user_id) 
          VALUES (${data.name}, ${data.color}, ${userId}) 
          RETURNING *`;
        break;

      case 'deleteCategory':
        result = await sql`DELETE FROM categories WHERE id = ${data.id} AND user_id = ${userId} RETURNING *`;
        break;

      // Menu Items - filtered by user_id
      case 'getMenuItems':
        result = await sql`SELECT * FROM menu_items WHERE user_id = ${userId} ORDER BY name`;
        break;

      case 'createMenuItem':
        result = await sql`
          INSERT INTO menu_items (name, price, category_id, image_url, stock, user_id) 
          VALUES (${data.name}, ${data.price}, ${data.category_id}, ${data.image_url}, ${data.stock || 0}, ${userId}) 
          RETURNING *`;
        break;

      case 'updateMenuItem':
        result = await sql`
          UPDATE menu_items 
          SET name = ${data.name}, price = ${data.price}, category_id = ${data.category_id}, 
              image_url = ${data.image_url}, stock = ${data.stock}
          WHERE id = ${data.id} AND user_id = ${userId}
          RETURNING *`;
        break;

      case 'deleteMenuItem':
        result = await sql`DELETE FROM menu_items WHERE id = ${data.id} AND user_id = ${userId} RETURNING *`;
        break;

      // Orders - filtered by user_id
      case 'getOrders':
        result = await sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC`;
        break;

      case 'createOrder':
        result = await sql`
          INSERT INTO orders (items, total, payment_method, status, user_id) 
          VALUES (${JSON.stringify(data.items)}, ${data.total}, ${data.payment_method}, ${data.status || 'completed'}, ${userId}) 
          RETURNING *`;
        break;

      // Brand Settings - filtered by user_id
      case 'getBrandSettings':
        result = await sql`SELECT * FROM brand_settings WHERE user_id = ${userId} LIMIT 1`;
        break;

      case 'updateBrandSettings':
        const existing = await sql`SELECT id FROM brand_settings WHERE user_id = ${userId} LIMIT 1`;
        if (existing.length > 0) {
          result = await sql`
            UPDATE brand_settings 
            SET business_name = ${data.business_name}, logo_url = ${data.logo_url}, 
                primary_color = ${data.primary_color}, currency = ${data.currency}
            WHERE id = ${existing[0].id} AND user_id = ${userId}
            RETURNING *`;
        } else {
          result = await sql`
            INSERT INTO brand_settings (business_name, logo_url, primary_color, currency, user_id) 
            VALUES (${data.business_name}, ${data.logo_url}, ${data.primary_color}, ${data.currency}, ${userId}) 
            RETURNING *`;
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Neon DB action: ${action} for user: ${userId}`, result);

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Neon DB error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
