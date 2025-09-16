import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { 
  Search, 
  Plus, 
  Database, 
  Apple, 
  Scan,
  Info,
  ChefHat,
  Camera,
  Coffee,
  Sun,
  Moon,
  Clock
} from 'lucide-react';
import AddFoodItemForm from './AddFoodItemForm';
import AddRecipeForm from './AddRecipeForm';
import MealTimeBadges from './MealTimeBadges';

type FoodItem = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  calories_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  sodium_per_100mg?: number | null;
  serving_size?: number | null;
  serving_unit?: string | null;
  nutritional_data?: any | null;
  image_url?: string | null;
  is_user_created: boolean;
  is_out_of_stock?: boolean | null;
  preferred_meal_times?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
};

export default function FoodDatabase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [showAddFood, setShowAddFood] = useState(false);
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  const searchFoods = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      
      // First search local database
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) throw error;
      
      let results = data || [];
      
      // If no results in local database, search OpenFoodFacts
      if (results.length === 0) {
        try {
          const openFoodFactsResults = await searchOpenFoodFacts(query);
          results = openFoodFactsResults as any;
          
          if (openFoodFactsResults.length > 0) {
            toast({
              title: "Results from OpenFoodFacts",
              description: `Found ${openFoodFactsResults.length} products from OpenFoodFacts database`,
            });
          }
        } catch (offError) {
          console.error('OpenFoodFacts search failed:', offError);
          // Continue with empty results if OpenFoodFacts fails
        }
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching foods:', error);
      toast({
        title: "Error",
        description: "Failed to search food database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchOpenFoodFacts = async (query: string): Promise<FoodItem[]> => {
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`);
    const data = await response.json();
    
    if (!data.products) {
      return [];
    }
    
    return data.products
      .filter((product: any) => product.product_name && product.nutriments)
      .map((product: any, index: number): FoodItem => ({
        id: `openfoodfacts-${product.id || Date.now() + index}`,
        name: product.product_name || 'Unknown Product',
        brand: product.brands || null,
        category: product.categories?.split(',')[0]?.trim() || null,
        barcode: product.code || null,
        calories_per_100g: product.nutriments?.['energy-kcal_100g'] || product.nutriments?.energy_kcal || 0,
        protein_per_100g: product.nutriments?.proteins_100g || product.nutriments?.proteins || 0,
        carbs_per_100g: product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || 0,
        fat_per_100g: product.nutriments?.fat_100g || product.nutriments?.fat || 0,
        fiber_per_100g: product.nutriments?.fiber_100g || product.nutriments?.fiber || 0,
        sugar_per_100g: product.nutriments?.sugars_100g || product.nutriments?.sugars || 0,
        sodium_per_100mg: product.nutriments?.sodium_100g ? product.nutriments.sodium_100g * 10 : 0, // Convert to per 100mg
        serving_size: product.serving_quantity ? parseFloat(product.serving_quantity) : null,
        serving_unit: product.serving_quantity_unit || 'g',
        nutritional_data: null,
        image_url: product.image_url || null,
        is_user_created: false,
        is_out_of_stock: false,
        preferred_meal_times: ['breakfast', 'lunch', 'dinner', 'snack'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: null,
      }))
      .slice(0, 10);
  };

  const handleSearch = () => {
    searchFoods(searchQuery);
  };

  const scanBarcode = async () => {
    try {
      setLoading(true);
      
      // Check camera permission first
      const status = await BarcodeScanner.checkPermission({ force: true });
      
      if (status.granted) {
        // Hide background and show camera
        document.body.classList.add('scanner-active');
        BarcodeScanner.hideBackground();
        
        // Start scanning
        const result = await BarcodeScanner.startScan();
        
        // Show background again
        BarcodeScanner.showBackground();
        document.body.classList.remove('scanner-active');
        
        if (result.hasContent) {
          await processBarcode(result.content);
        }
      } else {
        // Fallback to manual input if permission denied
        const barcode = prompt('Enter barcode number (or try: 3017620422003 for Nutella):');
        if (barcode) {
          await processBarcode(barcode);
        }
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      // Show background again in case of error
      BarcodeScanner.showBackground();
      document.body.classList.remove('scanner-active');
      
      // Fallback to manual input on error
      const barcode = prompt('Enter barcode number (or try: 3017620422003 for Nutella):');
      if (barcode) {
        await processBarcode(barcode);
      }
    } finally {
      setLoading(false);
    }
  };

  const processBarcode = async (barcode: string) => {
    try {
      // Try OpenFoodFacts API first
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        
        // Create food item from barcode data
        const newFood: Partial<FoodItem> = {
          id: `barcode-${barcode}`,
          name: product.product_name || 'Unknown Product',
          brand: product.brands || undefined,
          category: product.categories?.split(',')[0]?.trim() || undefined,
          barcode: barcode,
          calories_per_100g: product.nutriments?.['energy-kcal_100g'] || 0,
          protein_per_100g: product.nutriments?.proteins_100g || 0,
          carbs_per_100g: product.nutriments?.carbohydrates_100g || 0,
          fat_per_100g: product.nutriments?.fat_100g || 0,
          fiber_per_100g: product.nutriments?.fiber_100g || 0,
          serving_size: product.serving_quantity ? parseFloat(product.serving_quantity) : undefined,
          serving_unit: product.serving_quantity_unit || 'g',
          is_user_created: true,
        };

        // Add to search results and select it
        setSearchResults([newFood as FoodItem]);
        setSelectedFood(newFood as FoodItem);
        setSearchQuery(newFood.name || '');
        
        toast({
          title: "Product found!",
          description: `Found: ${newFood.name}`,
        });
      } else {
        toast({
          title: "Product not found",
          description: "Try a different barcode or add the product manually",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Barcode processing error:', error);
      toast({
        title: "Processing failed",
        description: "Unable to process barcode. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatNutrition = (value?: number) => {
    return value ? Math.round(value * 10) / 10 : 0;
  };

  const toggleStockStatus = async (food: FoodItem) => {
    if (!user) return;

    try {
      const newStockStatus = !food.is_out_of_stock;
      
      const { error } = await supabase
        .from('food_items')
        .update({ is_out_of_stock: newStockStatus })
        .eq('id', food.id);

      if (error) throw error;

      // Update the selected food and search results
      setSelectedFood(prev => prev ? { ...prev, is_out_of_stock: newStockStatus } : null);
      setSearchResults(prev => prev.map(item => 
        item.id === food.id ? { ...item, is_out_of_stock: newStockStatus } : item
      ));

      // If marking as out of stock, optionally add to shopping list
      if (newStockStatus) {
        await addToShoppingList(food);
      }

      toast({
        title: newStockStatus ? "Marked as out of stock" : "Marked as in stock",
        description: newStockStatus 
          ? `${food.name} has been marked as out of stock and added to your shopping list`
          : `${food.name} is now available`,
      });
    } catch (error) {
      console.error('Error updating stock status:', error);
      toast({
        title: "Error",
        description: "Failed to update stock status",
        variant: "destructive",
      });
    }
  };

  const addToShoppingList = async (food: FoodItem) => {
    if (!user) return;

    try {
      // Get or create a default shopping list
      let { data: shoppingList, error } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_completed', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // Create shopping list if none exists
      if (!shoppingList) {
        const { data: newList, error: createError } = await supabase
          .from('shopping_lists')
          .insert([{
            user_id: user.id,
            name: 'Shopping List',
            is_completed: false,
          }])
          .select('id')
          .single();

        if (createError) throw createError;
        shoppingList = newList;
      }

      // Check if item already exists in shopping list
      const { data: existingItem } = await supabase
        .from('shopping_list_items')
        .select('id')
        .eq('shopping_list_id', shoppingList.id)
        .eq('food_item_id', food.id)
        .eq('is_purchased', false)
        .maybeSingle();

      if (!existingItem) {
        // Add to shopping list
        const { error: addError } = await supabase
          .from('shopping_list_items')
          .insert([{
            shopping_list_id: shoppingList.id,
            food_item_id: food.id,
            name: food.name,
            quantity: 1,
            unit: 'item',
            is_purchased: false,
          }]);

        if (addError) throw addError;
      }
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      // Don't show error toast for shopping list issues, as the main action (stock status) succeeded
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Food Database
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search for foods (e.g., banana, chicken breast, oats)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button variant="outline" onClick={scanBarcode} disabled={loading}>
              <Camera className="h-4 w-4 mr-2" />
              Scan with Camera
            </Button>
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              Try searching for: banana, chicken, oats, salmon, broccoli, or scan a barcode (try: 3017620422003)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Results List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results</span>
              {searchResults.length > 0 && (
                <Badge variant="outline">{searchResults.length} items</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((food) => (
                  <div
                    key={food.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedFood?.id === food.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedFood(food)}
                  >
                     <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className={`font-medium ${food.is_out_of_stock ? 'text-muted-foreground line-through' : ''}`}>
                          {food.name}
                        </div>
                        {food.brand && (
                          <div className="text-sm text-muted-foreground">{food.brand}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {food.category && (
                            <Badge variant="secondary" className="text-xs">
                              {food.category}
                            </Badge>
                          )}
                          {food.is_user_created && (
                            <Badge variant="outline" className="text-xs">
                              User Added
                            </Badge>
                          )}
                          {food.is_out_of_stock && (
                            <Badge variant="destructive" className="text-xs">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                        {food.preferred_meal_times && food.preferred_meal_times.length < 4 && (
                          <div className="mt-2">
                            <MealTimeBadges mealTimes={food.preferred_meal_times} />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatNutrition(food.calories_per_100g)} cal
                        </div>
                        <div className="text-xs text-muted-foreground">per 100g</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <Apple className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No foods found</h3>
                <p className="text-muted-foreground mb-4">
                  Try a different search term or add this food to the database
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAddFood(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Food
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddRecipe(true)}>
                    <ChefHat className="h-4 w-4 mr-2" />
                    Create Recipe
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4" />
                <p>Search for foods to see results</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Food Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Food Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedFood ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedFood.name}</h3>
                  {selectedFood.brand && (
                    <p className="text-muted-foreground">{selectedFood.brand}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {selectedFood.category && (
                      <Badge variant="secondary">{selectedFood.category}</Badge>
                    )}
                    {selectedFood.barcode && (
                      <Badge variant="outline">Barcode: {selectedFood.barcode}</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Nutrition per 100g</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-sm text-muted-foreground">Calories</div>
                      <div className="font-medium">{formatNutrition(selectedFood.calories_per_100g)}</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-sm text-muted-foreground">Protein</div>
                      <div className="font-medium">{formatNutrition(selectedFood.protein_per_100g)}g</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-sm text-muted-foreground">Carbs</div>
                      <div className="font-medium">{formatNutrition(selectedFood.carbs_per_100g)}g</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <div className="text-sm text-muted-foreground">Fat</div>
                      <div className="font-medium">{formatNutrition(selectedFood.fat_per_100g)}g</div>
                    </div>
                    {selectedFood.fiber_per_100g && (
                      <div className="p-2 bg-muted/50 rounded">
                        <div className="text-sm text-muted-foreground">Fiber</div>
                        <div className="font-medium">{formatNutrition(selectedFood.fiber_per_100g)}g</div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedFood.serving_size && (
                  <div>
                    <h4 className="font-medium mb-2">Serving Information</h4>
                    <p className="text-sm text-muted-foreground">
                      Typical serving: {selectedFood.serving_size}{selectedFood.serving_unit || 'g'}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    className="flex-1"
                    disabled={selectedFood.is_out_of_stock}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {selectedFood.is_out_of_stock ? 'Out of Stock' : 'Add to Meal'}
                  </Button>
                  <Button 
                    variant={selectedFood.is_out_of_stock ? "default" : "outline"}
                    onClick={() => toggleStockStatus(selectedFood)}
                  >
                    {selectedFood.is_out_of_stock ? 'Mark In Stock' : 'Mark Out of Stock'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4" />
                <p>Select a food item to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom Forms */}
      {showAddFood && (
        <AddFoodItemForm
          onFoodAdded={(food) => {
            toast({
              title: "Food Added",
              description: `${food.name} has been added to the database`,
            });
            setShowAddFood(false);
            // Refresh search if there was a query
            if (searchQuery) {
              searchFoods(searchQuery);
            }
          }}
          onCancel={() => setShowAddFood(false)}
        />
      )}

      {showAddRecipe && (
        <AddRecipeForm
          onRecipeAdded={(recipe) => {
            toast({
              title: "Recipe Created",
              description: `${recipe.name} has been created successfully`,
            });
            setShowAddRecipe(false);
          }}
          onCancel={() => setShowAddRecipe(false)}
        />
      )}

      {/* Quick Add Section */}
      {!showAddFood && !showAddRecipe && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Food & Recipes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Create your own food items and recipes to track custom meals.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowAddFood(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Food Item
                </Button>
                <Button variant="outline" onClick={() => setShowAddRecipe(true)}>
                  <ChefHat className="h-4 w-4 mr-2" />
                  Create Recipe
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}