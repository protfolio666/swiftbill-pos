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
      // Users table - for syncing with Supabase Auth
      case 'syncUser':
        // Upsert a single user
        const existingUser = await sql`SELECT id FROM users WHERE id = ${data.id} LIMIT 1`;
        if (existingUser.length > 0) {
          result = await sql`
            UPDATE users 
            SET email = ${data.email}, 
                restaurant_name = ${data.restaurant_name || null}, 
                owner_name = ${data.owner_name || null},
                phone = ${data.phone || null},
                address = ${data.address || null},
                gstin = ${data.gstin || null},
                logo_url = ${data.logo_url || null},
                plan_name = ${data.plan_name || 'trial'},
                subscription_status = ${data.subscription_status || 'pending'},
                valid_until = ${data.valid_until || null},
                updated_at = NOW()
            WHERE id = ${data.id}
            RETURNING *`;
        } else {
          result = await sql`
            INSERT INTO users (id, email, restaurant_name, owner_name, phone, address, gstin, logo_url, plan_name, subscription_status, valid_until) 
            VALUES (${data.id}, ${data.email}, ${data.restaurant_name || null}, ${data.owner_name || null}, ${data.phone || null}, ${data.address || null}, ${data.gstin || null}, ${data.logo_url || null}, ${data.plan_name || 'trial'}, ${data.subscription_status || 'pending'}, ${data.valid_until || null}) 
            RETURNING *`;
        }
        break;

      case 'syncUsers':
        // Sync multiple users (admin bulk sync)
        const users = data.users || [];
        for (const user of users) {
          const exists = await sql`SELECT id FROM users WHERE id = ${user.id} LIMIT 1`;
          if (exists.length > 0) {
            await sql`
              UPDATE users 
              SET email = ${user.email}, 
                  restaurant_name = ${user.restaurant_name || null}, 
                  owner_name = ${user.owner_name || null},
                  phone = ${user.phone || null},
                  address = ${user.address || null},
                  gstin = ${user.gstin || null},
                  logo_url = ${user.logo_url || null},
                  plan_name = ${user.plan_name || 'trial'},
                  subscription_status = ${user.subscription_status || 'pending'},
                  valid_until = ${user.valid_until || null},
                  updated_at = NOW()
              WHERE id = ${user.id}`;
          } else {
            await sql`
              INSERT INTO users (id, email, restaurant_name, owner_name, phone, address, gstin, logo_url, plan_name, subscription_status, valid_until) 
              VALUES (${user.id}, ${user.email}, ${user.restaurant_name || null}, ${user.owner_name || null}, ${user.phone || null}, ${user.address || null}, ${user.gstin || null}, ${user.logo_url || null}, ${user.plan_name || 'trial'}, ${user.subscription_status || 'pending'}, ${user.valid_until || null})`;
          }
        }
        result = await sql`SELECT * FROM users ORDER BY created_at DESC`;
        break;

      case 'getUsers':
        result = await sql`SELECT * FROM users ORDER BY created_at DESC`;
        break;

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
        // First, ensure the new columns exist (migration for Neon DB)
        try {
          await sql`ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS upi_id TEXT`;
          await sql`ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 5`;
          await sql`ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS enable_gst BOOLEAN DEFAULT true`;
          await sql`ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC DEFAULT 2.5`;
          await sql`ALTER TABLE brand_settings ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC DEFAULT 2.5`;
        } catch (migrationError) {
          // Columns may already exist, ignore error
          console.log('Migration check completed');
        }

        const existing = await sql`SELECT id FROM brand_settings WHERE user_id = ${userId} LIMIT 1`;
        if (existing.length > 0) {
          result = await sql`
            UPDATE brand_settings 
            SET business_name = ${data.business_name}, 
                logo_url = ${data.logo_url}, 
                primary_color = ${data.primary_color}, 
                currency = ${data.currency},
                upi_id = ${data.upi_id || null},
                tax_rate = ${data.tax_rate || 5},
                enable_gst = ${data.enable_gst ?? true},
                cgst_rate = ${data.cgst_rate || 2.5},
                sgst_rate = ${data.sgst_rate || 2.5}
            WHERE id = ${existing[0].id} AND user_id = ${userId}
            RETURNING *`;
        } else {
          result = await sql`
            INSERT INTO brand_settings (business_name, logo_url, primary_color, currency, user_id, upi_id, tax_rate, enable_gst, cgst_rate, sgst_rate) 
            VALUES (${data.business_name}, ${data.logo_url}, ${data.primary_color}, ${data.currency}, ${userId}, ${data.upi_id || null}, ${data.tax_rate || 5}, ${data.enable_gst ?? true}, ${data.cgst_rate || 2.5}, ${data.sgst_rate || 2.5}) 
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
