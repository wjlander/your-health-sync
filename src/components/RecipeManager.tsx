import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Search, 
  ChefHat, 
  Users, 
  Clock,
  ShoppingCart,
  AlertTriangle
 } from 'lucide-react';
import MealTimeBadges from './MealTimeBadges';

interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  prep_time?: number;
  cook_time?: number;
  difficulty: string;
  is_public: boolean;
  is_out_of_stock?: boolean;
  preferred_meal_times?: string[];
  user_id: string;
}

export default function RecipeManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const fetchRecipes = async (query?: string) => {
    if (!user) return;

    try {
      setLoading(true);
      
      let queryBuilder = supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (query?.trim()) {
        queryBuilder = queryBuilder.ilike('name', `%${query}%`);
      }

      const { data, error } = await queryBuilder.limit(50);

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast({
        title: "Error",
        description: "Failed to load recipes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipeStockStatus = async (recipe: Recipe) => {
    try {
      const newStockStatus = !recipe.is_out_of_stock;
      
      const { error } = await supabase
        .from('recipes')
        .update({ is_out_of_stock: newStockStatus })
        .eq('id', recipe.id);

      if (error) throw error;

      // Update local state
      setRecipes(prev => prev.map(r => 
        r.id === recipe.id ? { ...r, is_out_of_stock: newStockStatus } : r
      ));
      
      if (selectedRecipe?.id === recipe.id) {
        setSelectedRecipe(prev => prev ? { ...prev, is_out_of_stock: newStockStatus } : null);
      }

      // If marking as out of stock, add ingredients to shopping list
      if (newStockStatus) {
        await addRecipeIngredientsToShoppingList(recipe);
      }

      toast({
        title: newStockStatus ? "Recipe marked as out of stock" : "Recipe marked as available",
        description: newStockStatus 
          ? `${recipe.name} ingredients have been added to your shopping list`
          : `${recipe.name} is now available for meal planning`,
      });
    } catch (error) {
      console.error('Error updating recipe stock status:', error);
      toast({
        title: "Error",
        description: "Failed to update recipe status",
        variant: "destructive",
      });
    }
  };

  const addRecipeIngredientsToShoppingList = async (recipe: Recipe) => {
    if (!user) return;

    try {
      // Get recipe ingredients
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select(`
          *,
          food_item:food_items(*)
        `)
        .eq('recipe_id', recipe.id);

      if (ingredientsError) throw ingredientsError;
      if (!ingredients?.length) return;

      // Get or create shopping list
      let { data: shoppingList, error } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (!shoppingList) {
        const { data: newList, error: createError } = await supabase
          .from('shopping_lists')
          .insert([{
            user_id: user.id,
            name: `Shopping List for ${recipe.name}`,
            is_completed: false,
          }])
          .select('id')
          .single();

        if (createError) throw createError;
        shoppingList = newList;
      }

      // Add ingredients to shopping list
      const shoppingItems = [];
      for (const ingredient of ingredients) {
        if (ingredient.food_item) {
          // Check if item already exists
          const { data: existingItem } = await supabase
            .from('shopping_list_items')
            .select('id, quantity')
            .eq('shopping_list_id', shoppingList.id)
            .eq('food_item_id', ingredient.food_item.id)
            .eq('is_purchased', false)
            .maybeSingle();

          if (existingItem) {
            // Update quantity
            await supabase
              .from('shopping_list_items')
              .update({ 
                quantity: (existingItem.quantity || 0) + ingredient.quantity 
              })
              .eq('id', existingItem.id);
          } else {
            // Add new item
            shoppingItems.push({
              shopping_list_id: shoppingList.id,
              food_item_id: ingredient.food_item.id,
              name: ingredient.food_item.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              is_purchased: false,
              notes: `For recipe: ${recipe.name}`,
            });
          }
        }
      }

      if (shoppingItems.length > 0) {
        const { error: addError } = await supabase
          .from('shopping_list_items')
          .insert(shoppingItems);

        if (addError) throw addError;
      }
    } catch (error) {
      console.error('Error adding recipe ingredients to shopping list:', error);
      // Don't show error toast for shopping list issues
    }
  };

  const handleSearch = () => {
    fetchRecipes(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [user]);

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'N/A';
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Recipe Manager
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search your recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recipe List */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Recipes</span>
              {recipes.length > 0 && (
                <Badge variant="outline">{recipes.length} recipes</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : recipes.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedRecipe?.id === recipe.id ? 'border-primary bg-primary/5' : ''
                    } ${recipe.is_out_of_stock ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className={`font-medium ${recipe.is_out_of_stock ? 'line-through text-muted-foreground' : ''}`}>
                          {recipe.name}
                        </div>
                        {recipe.description && (
                          <div className="text-sm text-muted-foreground">{recipe.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {recipe.servings}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {recipe.difficulty}
                          </Badge>
                          {recipe.is_out_of_stock && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                        {recipe.preferred_meal_times && recipe.preferred_meal_times.length < 4 && (
                          <div className="mt-2">
                            <MealTimeBadges mealTimes={recipe.preferred_meal_times} />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatTime((recipe.prep_time || 0) + (recipe.cook_time || 0))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ChefHat className="h-12 w-12 mx-auto mb-4" />
                <p>No recipes found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recipe Details */}
        <Card>
          <CardHeader>
            <CardTitle>Recipe Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRecipe ? (
              <div className="space-y-4">
                <div>
                  <h3 className={`font-semibold text-lg ${selectedRecipe.is_out_of_stock ? 'line-through text-muted-foreground' : ''}`}>
                    {selectedRecipe.name}
                  </h3>
                  {selectedRecipe.description && (
                    <p className="text-muted-foreground">{selectedRecipe.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      {selectedRecipe.servings} servings
                    </Badge>
                    <Badge variant="outline">{selectedRecipe.difficulty}</Badge>
                    {selectedRecipe.is_public && (
                      <Badge variant="outline">Public</Badge>
                    )}
                    {selectedRecipe.is_out_of_stock && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Out of Stock
                      </Badge>
                    )}
                  </div>
                  {selectedRecipe.preferred_meal_times && selectedRecipe.preferred_meal_times.length < 4 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-2">Preferred Meal Times:</div>
                      <MealTimeBadges mealTimes={selectedRecipe.preferred_meal_times} size="md" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-sm text-muted-foreground">Prep Time</div>
                    <div className="font-medium">{formatTime(selectedRecipe.prep_time)}</div>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <div className="text-sm text-muted-foreground">Cook Time</div>
                    <div className="font-medium">{formatTime(selectedRecipe.cook_time)}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    className="flex-1"
                    disabled={selectedRecipe.is_out_of_stock}
                  >
                    {selectedRecipe.is_out_of_stock ? 'Recipe Unavailable' : 'Add to Meal'}
                  </Button>
                  <Button 
                    variant={selectedRecipe.is_out_of_stock ? "default" : "outline"}
                    onClick={() => toggleRecipeStockStatus(selectedRecipe)}
                  >
                    {selectedRecipe.is_out_of_stock ? (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Mark Available
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Mark Out of Stock
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ChefHat className="h-12 w-12 mx-auto mb-4" />
                <p>Select a recipe to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}