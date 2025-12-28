import { Order, BrandSettings } from '@/types/pos';

export interface WebhookPayload {
  order_id: string;
  customer_name: string;
  customer_phone: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  order_type: string;
  table_number?: number;
  restaurant_name: string;
  timestamp: string;
  whatsapp_message: string;
}

export const generateWhatsAppMessage = (order: Order, brand: BrandSettings): string => {
  const itemsList = order.items
    .map(item => `• ${item.name} x${item.quantity} - ${brand.currency}${(item.price * item.quantity).toFixed(2)}`)
    .join('\n');

  const message = `🧾 *${brand.name}*
━━━━━━━━━━━━━━━━
Order: ${order.id}
${order.orderType === 'dine-in' && order.tableNumber ? `Table: ${order.tableNumber}` : `Type: ${order.orderType}`}
━━━━━━━━━━━━━━━━

*Items:*
${itemsList}

━━━━━━━━━━━━━━━━
Subtotal: ${brand.currency}${order.subtotal.toFixed(2)}
${order.discount > 0 ? `Discount: -${brand.currency}${order.discount.toFixed(2)}\n` : ''}${brand.enableGST ? `CGST: ${brand.currency}${order.cgst.toFixed(2)}
SGST: ${brand.currency}${order.sgst.toFixed(2)}` : `Tax: ${brand.currency}${(order.cgst + order.sgst).toFixed(2)}`}
*Total: ${brand.currency}${order.total.toFixed(2)}*
━━━━━━━━━━━━━━━━

Thank you for your order! 🙏`;

  return message;
};

export const triggerWebhook = async (
  order: Order,
  brand: BrandSettings
): Promise<boolean> => {
  if (!brand.zapierWebhookUrl || !brand.enableAutoWhatsApp) {
    return false;
  }

  if (!order.customerPhone) {
    console.log('No customer phone, skipping webhook');
    return false;
  }

  const payload: WebhookPayload = {
    order_id: order.id,
    customer_name: order.customerName || 'Guest',
    customer_phone: order.customerPhone,
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    order_type: order.orderType,
    table_number: order.tableNumber,
    restaurant_name: brand.name,
    timestamp: new Date().toISOString(),
    whatsapp_message: generateWhatsAppMessage(order, brand),
  };

  try {
    console.log('Triggering Zapier webhook:', brand.zapierWebhookUrl);
    
    await fetch(brand.zapierWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'no-cors', // Zapier requires no-cors
      body: JSON.stringify(payload),
    });

    console.log('Webhook triggered successfully');
    return true;
  } catch (error) {
    console.error('Error triggering webhook:', error);
    return false;
  }
};
