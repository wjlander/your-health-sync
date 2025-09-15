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
  Plus, 
  Database, 
  Apple, 
  Scan,
  Info,
  ChefHat,
  Camera
} from 'lucide-react';
import AddFoodItemForm from './AddFoodItemForm';
import AddRecipeForm from './AddRecipeForm';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  barcode?: string;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  fiber_per_100g?: number;
  serving_size?: number;
  serving_unit?: string;
  is_user_created: boolean;
}

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
      
      const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) throw error;
      setSearchResults(data || []);
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

  const handleSearch = () => {
    searchFoods(searchQuery);
  };

  const scanBarcode = async () => {
    try {
      setLoading(true);
      
      // For now, use manual input - will be replaced with camera scanning after proper Capacitor setup
      const barcode = prompt('Enter barcode number (or try: 3017620422003 for Nutella):');
      if (barcode) {
        await processBarcode(barcode);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      toast({
        title: "Scan failed",
        description: "Unable to scan barcode. Please try again.",
        variant: "destructive",
      });
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
                        <div className="font-medium">{food.name}</div>
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
                        </div>
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
                  <Button className="flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Meal
                  </Button>
                  <Button variant="outline">
                    Edit
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