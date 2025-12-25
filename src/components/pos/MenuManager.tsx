import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Upload, Download } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MenuItem } from '@/types/pos';
import { useNeon } from '@/contexts/NeonContext';
import { parseMenuCSV, generateMenuCSVTemplate } from '@/utils/csvImport';

const CATEGORY_ICONS = ['🍔', '🍕', '🍜', '🍣', '🥗', '🍰', '☕', '🥤', '🍺', '🍷'];

export function MenuManager() {
  const { menuItems, categories, brand } = usePOSStore();
  const { addMenuItem, updateMenuItem, deleteMenuItem, addCategory: addCategoryRemote } = useNeon();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('🍔');
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    stock: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const resetForm = () => {
    setFormData({ name: '', price: '', category: '', stock: '' });
    setEditingItem(null);
    setIsAddingCategory(false);
    setNewCategoryName('');
    setNewCategoryIcon('🍔');
  };

  const handleAddNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Please enter a category name');
      return;
    }

    const existingCategory = categories.find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      toast.error('Category already exists');
      return;
    }

    const ok = await addCategoryRemote(name, newCategoryIcon);
    if (!ok) return;

    setFormData({ ...formData, category: name });
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  const handleOpenDialog = (item?: MenuItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        price: item.price.toString(),
        category: item.category,
        stock: item.stock.toString(),
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.price || !formData.category) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    const selectedCategory = categories.find(c => c.name === formData.category);
    const categoryId = selectedCategory ? Number(selectedCategory.id) : null;

    const itemData = {
      name: formData.name,
      price: parseFloat(formData.price),
      category: formData.category,
      stock: parseInt(formData.stock) || 0,
    };

    let success = false;
    if (editingItem) {
      success = await updateMenuItem(editingItem.id, itemData, categoryId);
    } else {
      success = await addMenuItem(itemData, categoryId);
    }

    setIsSubmitting(false);

    if (success) {
      setIsDialogOpen(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMenuItem(id);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const csvText = event.target?.result as string;
        const parsedItems = parseMenuCSV(csvText);

        if (parsedItems.length === 0) {
          toast.error('No valid items found in CSV');
          return;
        }

        let added = 0;
        let updated = 0;

        for (const item of parsedItems) {
          // Check if category exists, if not create it
          const existingCategory = categories.find(
            c => c.name.toLowerCase() === item.category.toLowerCase()
          );
          
          if (!existingCategory && item.category !== 'Uncategorized') {
            await addCategoryRemote(item.category, '🍽️');
          }

          // Check if item already exists
          const existingItem = menuItems.find(
            m => m.name.toLowerCase() === item.name.toLowerCase()
          );

          const categoryId = existingCategory ? Number(existingCategory.id) : null;

          if (existingItem) {
            await updateMenuItem(existingItem.id, {
              price: item.price,
              category: item.category,
              stock: item.stock,
            }, categoryId);
            updated++;
          } else {
            await addMenuItem({
              name: item.name,
              price: item.price,
              category: item.category,
              stock: item.stock,
            }, categoryId);
            added++;
          }
        }

        toast.success(`CSV Import Complete`, {
          description: `Added: ${added}, Updated: ${updated} items`,
        });
      } catch (err) {
        toast.error('Failed to parse CSV', {
          description: err instanceof Error ? err.message : 'Invalid format',
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const template = generateMenuCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Menu Management</h1>
          <p className="text-muted-foreground">Add, edit, or remove menu items</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVImport}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-1" />
            Template
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? 'Importing...' : 'Import CSV'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="pos" onClick={() => handleOpenDialog()}>
                <Plus className="w-5 h-5 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Grilled Chicken"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ({brand.currency})</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="category">Category</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary"
                    onClick={() => setIsAddingCategory(!isAddingCategory)}
                  >
                    {isAddingCategory ? 'Select Existing' : '+ Add New'}
                  </Button>
                </div>
                
                {isAddingCategory ? (
                  <div className="space-y-3 p-3 border border-border rounded-lg bg-secondary/30">
                    <div className="flex gap-2">
                      <Select
                        value={newCategoryIcon}
                        onValueChange={setNewCategoryIcon}
                      >
                        <SelectTrigger className="w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_ICONS.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              {icon}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Category name"
                        className="flex-1"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={handleAddNewCategory}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Category
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="pos" className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Add'} Item
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Item</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Category</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Stock</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {menuItems.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{item.name}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {brand.currency}{item.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.stock <= 5 
                        ? 'bg-destructive/10 text-destructive' 
                        : 'bg-success/10 text-success'
                    }`}>
                      {item.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenDialog(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
