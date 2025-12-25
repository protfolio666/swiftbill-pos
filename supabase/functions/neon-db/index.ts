import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { neon } from "https://esm.sh/@neondatabase/serverless@0.9.0";

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

    const sql = neon(databaseUrl);
    const { action, data } = await req.json();

    let result;

    switch (action) {
      // Categories
      case 'getCategories':
        result = await sql`SELECT * FROM categories ORDER BY name`;
        break;
      
      case 'createCategory':
        result = await sql`
          INSERT INTO categories (name, color) 
          VALUES (${data.name}, ${data.color}) 
          RETURNING *`;
        break;

      case 'deleteCategory':
        result = await sql`DELETE FROM categories WHERE id = ${data.id} RETURNING *`;
        break;

      // Menu Items
      case 'getMenuItems':
        result = await sql`SELECT * FROM menu_items ORDER BY name`;
        break;

      case 'createMenuItem':
        result = await sql`
          INSERT INTO menu_items (name, price, category_id, image_url, stock) 
          VALUES (${data.name}, ${data.price}, ${data.category_id}, ${data.image_url}, ${data.stock || 0}) 
          RETURNING *`;
        break;

      case 'updateMenuItem':
        result = await sql`
          UPDATE menu_items 
          SET name = ${data.name}, price = ${data.price}, category_id = ${data.category_id}, 
              image_url = ${data.image_url}, stock = ${data.stock}
          WHERE id = ${data.id} 
          RETURNING *`;
        break;

      case 'deleteMenuItem':
        result = await sql`DELETE FROM menu_items WHERE id = ${data.id} RETURNING *`;
        break;

      // Orders
      case 'getOrders':
        result = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
        break;

      case 'createOrder':
        result = await sql`
          INSERT INTO orders (items, total, payment_method, status) 
          VALUES (${JSON.stringify(data.items)}, ${data.total}, ${data.payment_method}, ${data.status || 'completed'}) 
          RETURNING *`;
        break;

      // Brand Settings
      case 'getBrandSettings':
        result = await sql`SELECT * FROM brand_settings LIMIT 1`;
        break;

      case 'updateBrandSettings':
        const existing = await sql`SELECT id FROM brand_settings LIMIT 1`;
        if (existing.length > 0) {
          result = await sql`
            UPDATE brand_settings 
            SET business_name = ${data.business_name}, logo_url = ${data.logo_url}, 
                primary_color = ${data.primary_color}, currency = ${data.currency}
            WHERE id = ${existing[0].id}
            RETURNING *`;
        } else {
          result = await sql`
            INSERT INTO brand_settings (business_name, logo_url, primary_color, currency) 
            VALUES (${data.business_name}, ${data.logo_url}, ${data.primary_color}, ${data.currency}) 
            RETURNING *`;
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Neon DB action: ${action}`, result);

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
