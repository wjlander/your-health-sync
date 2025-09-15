import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Plus, 
  Save, 
  Search, 
  X,
  ChefHat,
  Clock,
  Users
} from 'lucide-react';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
}

interface Ingredient {
  food_item_id: string;
  food_item: FoodItem;
  quantity: number;
  unit: string;
  notes?: string;
}

interface AddRecipeFormProps {
  onRecipeAdded?: (recipe: any) => void;
  onCancel?: () => void;
}

export default function AddRecipeForm({ onRecipeAdded, onCancel }: AddRecipeFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    servings: 4,
    prep_time: '',
    cook_time: '',
    difficulty: 'medium',
    is_public: false,
    tags: '',
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [showIngredientSearch, setShowIngredientSearch] = useState(false);

  const searchFoods = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      
      const { data, error } = await supabase
        .from('food_items')
        .select('id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching foods:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addIngredient = (foodItem: FoodItem) => {
    const newIngredient: Ingredient = {
      food_item_id: foodItem.id,
      food_item: foodItem,
      quantity: 100,
      unit: 'g',
      notes: '',
    };
    
    setIngredients(prev => [...prev, newIngredient]);
    setSearchQuery('');
    setSearchResults([]);
    setShowIngredientSearch(false);
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    setIngredients(prev => prev.map((ingredient, i) => 
      i === index ? { ...ingredient, [field]: value } : ingredient
    ));
  };

  const removeIngredient = (index: number) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Recipe name is required",
        variant: "destructive",
      });
      return;
    }

    if (ingredients.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one ingredient is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Create recipe
      const recipeData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        instructions: formData.instructions.trim() || null,
        servings: formData.servings,
        prep_time: formData.prep_time ? parseInt(formData.prep_time) : null,
        cook_time: formData.cook_time ? parseInt(formData.cook_time) : null,
        difficulty: formData.difficulty,
        is_public: formData.is_public,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : null,
        user_id: user.id,
      };

      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert([recipeData])
        .select()
        .single();

      if (recipeError) throw recipeError;

      // Add ingredients
      const ingredientData = ingredients.map(ingredient => ({
        recipe_id: recipe.id,
        food_item_id: ingredient.food_item_id,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        notes: ingredient.notes || null,
      }));

      const { error: ingredientError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientData);

      if (ingredientError) throw ingredientError;

      toast({
        title: "Success",
        description: "Recipe created successfully",
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        instructions: '',
        servings: 4,
        prep_time: '',
        cook_time: '',
        difficulty: 'medium',
        is_public: false,
        tags: '',
      });
      setIngredients([]);

      onRecipeAdded?.(recipe);
    } catch (error) {
      console.error('Error creating recipe:', error);
      toast({
        title: "Error",
        description: "Failed to create recipe",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        searchFoods(searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          Create Custom Recipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Recipe Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Grilled Chicken with Vegetables"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of your recipe..."
                rows={2}
              />
            </div>
          </div>

          {/* Recipe Details */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="servings" className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Servings
              </Label>
              <Input
                id="servings"
                type="number"
                min="1"
                value={formData.servings}
                onChange={(e) => handleInputChange('servings', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prep_time" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Prep Time (min)
              </Label>
              <Input
                id="prep_time"
                type="number"
                value={formData.prep_time}
                onChange={(e) => handleInputChange('prep_time', e.target.value)}
                placeholder="15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cook_time">Cook Time (min)</Label>
              <Input
                id="cook_time"
                type="number"
                value={formData.cook_time}
                onChange={(e) => handleInputChange('cook_time', e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={formData.difficulty} onValueChange={(value) => handleInputChange('difficulty', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Ingredients</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowIngredientSearch(!showIngredientSearch)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Ingredient
              </Button>
            </div>

            {showIngredientSearch && (
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <Label>Search for ingredient</Label>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search food items..."
                      className="mb-2"
                    />
                    {searchLoading && (
                      <div className="text-center py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
                      </div>
                    )}
                    {searchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {searchResults.map((food) => (
                          <div
                            key={food.id}
                            className="p-2 border rounded cursor-pointer hover:bg-muted/50"
                            onClick={() => addIngredient(food)}
                          >
                            <div className="font-medium">{food.name}</div>
                            {food.brand && (
                              <div className="text-sm text-muted-foreground">{food.brand}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {ingredients.length > 0 && (
              <div className="space-y-2">
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded">
                    <div className="flex-1">
                      <div className="font-medium">{ingredient.food_item.name}</div>
                      {ingredient.food_item.brand && (
                        <div className="text-sm text-muted-foreground">{ingredient.food_item.brand}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={ingredient.quantity}
                        onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-20"
                      />
                      <Select
                        value={ingredient.unit}
                        onValueChange={(value) => updateIngredient(index, 'unit', value)}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="ml">ml</SelectItem>
                          <SelectItem value="cup">cup</SelectItem>
                          <SelectItem value="piece">piece</SelectItem>
                          <SelectItem value="slice">slice</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => handleInputChange('instructions', e.target.value)}
              placeholder="Step-by-step cooking instructions..."
              rows={4}
            />
          </div>

          {/* Tags and Settings */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => handleInputChange('tags', e.target.value)}
                placeholder="healthy, quick, dinner"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="public"
                checked={formData.is_public}
                onCheckedChange={(checked) => handleInputChange('is_public', checked)}
              />
              <Label htmlFor="public">Make recipe public</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Create Recipe'}
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