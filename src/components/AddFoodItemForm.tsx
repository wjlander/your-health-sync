import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Save } from 'lucide-react';

interface AddFoodItemFormProps {
  onFoodAdded?: (food: any) => void;
  onCancel?: () => void;
}

export default function AddFoodItemForm({ onFoodAdded, onCancel }: AddFoodItemFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    barcode: '',
    calories_per_100g: '',
    protein_per_100g: '',
    carbs_per_100g: '',
    fat_per_100g: '',
    fiber_per_100g: '',
    sugar_per_100g: '',
    sodium_per_100mg: '',
    serving_size: '',
    serving_unit: 'g',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Food name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const foodData = {
        name: formData.name.trim(),
        brand: formData.brand.trim() || null,
        category: formData.category.trim() || null,
        barcode: formData.barcode.trim() || null,
        calories_per_100g: formData.calories_per_100g ? parseFloat(formData.calories_per_100g) : null,
        protein_per_100g: formData.protein_per_100g ? parseFloat(formData.protein_per_100g) : null,
        carbs_per_100g: formData.carbs_per_100g ? parseFloat(formData.carbs_per_100g) : null,
        fat_per_100g: formData.fat_per_100g ? parseFloat(formData.fat_per_100g) : null,
        fiber_per_100g: formData.fiber_per_100g ? parseFloat(formData.fiber_per_100g) : null,
        sugar_per_100g: formData.sugar_per_100g ? parseFloat(formData.sugar_per_100g) : null,
        sodium_per_100mg: formData.sodium_per_100mg ? parseFloat(formData.sodium_per_100mg) : null,
        serving_size: formData.serving_size ? parseFloat(formData.serving_size) : null,
        serving_unit: formData.serving_unit,
        created_by: user.id,
        is_user_created: true,
      };

      const { data, error } = await supabase
        .from('food_items')
        .insert([foodData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Food item added successfully",
      });

      // Reset form
      setFormData({
        name: '',
        brand: '',
        category: '',
        barcode: '',
        calories_per_100g: '',
        protein_per_100g: '',
        carbs_per_100g: '',
        fat_per_100g: '',
        fiber_per_100g: '',
        sugar_per_100g: '',
        sodium_per_100mg: '',
        serving_size: '',
        serving_unit: 'g',
      });

      onFoodAdded?.(data);
    } catch (error) {
      console.error('Error adding food item:', error);
      toast({
        title: "Error",
        description: "Failed to add food item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Custom Food Item
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Food Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Homemade Chicken Breast"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                placeholder="e.g., Tyson, Store Brand"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meat">Meat & Poultry</SelectItem>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="vegetables">Vegetables</SelectItem>
                  <SelectItem value="fruits">Fruits</SelectItem>
                  <SelectItem value="grains">Grains & Cereals</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => handleInputChange('barcode', e.target.value)}
                placeholder="Optional barcode number"
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Nutrition per 100g</h4>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calories">Calories</Label>
                <Input
                  id="calories"
                  type="number"
                  step="0.1"
                  value={formData.calories_per_100g}
                  onChange={(e) => handleInputChange('calories_per_100g', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number"
                  step="0.1"
                  value={formData.protein_per_100g}
                  onChange={(e) => handleInputChange('protein_per_100g', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number"
                  step="0.1"
                  value={formData.carbs_per_100g}
                  onChange={(e) => handleInputChange('carbs_per_100g', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fat">Fat (g)</Label>
                <Input
                  id="fat"
                  type="number"
                  step="0.1"
                  value={formData.fat_per_100g}
                  onChange={(e) => handleInputChange('fat_per_100g', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fiber">Fiber (g)</Label>
              <Input
                id="fiber"
                type="number"
                step="0.1"
                value={formData.fiber_per_100g}
                onChange={(e) => handleInputChange('fiber_per_100g', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sugar">Sugar (g)</Label>
              <Input
                id="sugar"
                type="number"
                step="0.1"
                value={formData.sugar_per_100g}
                onChange={(e) => handleInputChange('sugar_per_100g', e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sodium">Sodium (mg per 100g)</Label>
              <Input
                id="sodium"
                type="number"
                step="0.1"
                value={formData.sodium_per_100mg}
                onChange={(e) => handleInputChange('sodium_per_100mg', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Serving Information</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serving_size">Typical Serving Size</Label>
                <Input
                  id="serving_size"
                  type="number"
                  step="0.1"
                  value={formData.serving_size}
                  onChange={(e) => handleInputChange('serving_size', e.target.value)}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serving_unit">Unit</Label>
                <Select value={formData.serving_unit} onValueChange={(value) => handleInputChange('serving_unit', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">grams (g)</SelectItem>
                    <SelectItem value="ml">milliliters (ml)</SelectItem>
                    <SelectItem value="oz">ounces (oz)</SelectItem>
                    <SelectItem value="cup">cup</SelectItem>
                    <SelectItem value="piece">piece</SelectItem>
                    <SelectItem value="slice">slice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Adding...' : 'Add Food Item'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}