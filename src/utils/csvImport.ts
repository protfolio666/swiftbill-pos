import { MenuItem } from '@/types/pos';

export interface MenuCSVRow {
  name: string;
  price: number;
  category: string;
  stock: number;
}

export interface InventoryCSVRow {
  name: string;
  stock: number;
}

export function parseMenuCSV(csvText: string): MenuCSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'item' || h === 'item name');
  const priceIdx = headers.findIndex(h => h === 'price' || h === 'rate' || h === 'mrp');
  const categoryIdx = headers.findIndex(h => h === 'category' || h === 'cat');
  const stockIdx = headers.findIndex(h => h === 'stock' || h === 'qty' || h === 'quantity');

  if (nameIdx === -1 || priceIdx === -1) {
    throw new Error('CSV must have "name" and "price" columns');
  }

  const items: MenuCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const name = values[nameIdx]?.trim();
    const price = parseFloat(values[priceIdx]?.trim() || '0');
    const category = categoryIdx !== -1 ? values[categoryIdx]?.trim() || 'Uncategorized' : 'Uncategorized';
    const stock = stockIdx !== -1 ? parseInt(values[stockIdx]?.trim() || '0') : 0;

    if (name && !isNaN(price) && price >= 0) {
      items.push({ name, price, category, stock: isNaN(stock) ? 0 : stock });
    }
  }

  return items;
}

export function parseInventoryCSV(csvText: string): InventoryCSVRow[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'item' || h === 'item name');
  const stockIdx = headers.findIndex(h => h === 'stock' || h === 'qty' || h === 'quantity');

  if (nameIdx === -1 || stockIdx === -1) {
    throw new Error('CSV must have "name" and "stock" columns');
  }

  const items: InventoryCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const name = values[nameIdx]?.trim();
    const stock = parseInt(values[stockIdx]?.trim() || '0');

    if (name && !isNaN(stock) && stock >= 0) {
      items.push({ name, stock });
    }
  }

  return items;
}

// Handle CSV values with commas inside quotes
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

export function matchInventoryToMenu(
  inventoryItems: InventoryCSVRow[],
  menuItems: MenuItem[]
): { matched: { id: string; name: string; stock: number }[]; unmatched: string[] } {
  const matched: { id: string; name: string; stock: number }[] = [];
  const unmatched: string[] = [];

  for (const inv of inventoryItems) {
    const menuItem = menuItems.find(
      m => m.name.toLowerCase() === inv.name.toLowerCase()
    );

    if (menuItem) {
      matched.push({ id: menuItem.id, name: menuItem.name, stock: inv.stock });
    } else {
      unmatched.push(inv.name);
    }
  }

  return { matched, unmatched };
}

export function generateMenuCSVTemplate(): string {
  return `name,price,category,stock
"Butter Chicken",250,Main Course,50
"Paneer Tikka",180,Starters,30
"Mango Lassi",80,Beverages,100`;
}

export function generateInventoryCSVTemplate(): string {
  return `name,stock
"Butter Chicken",50
"Paneer Tikka",30
"Mango Lassi",100`;
}
