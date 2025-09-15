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
  Info
} from 'lucide-react';

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
            <Button variant="outline">
              <Scan className="h-4 w-4 mr-2" />
              Scan Barcode
            </Button>
          </div>
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
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Food
                </Button>
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

      {/* Quick Add Section */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Add</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? Add it to the database.
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New Food Item
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}