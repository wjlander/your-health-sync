import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Plus, 
  Apple, 
  ChefHat,
  X,
  ShoppingCart
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  is_out_of_stock?: boolean;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  is_out_of_stock?: boolean;
}

interface FoodSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onFoodSelected: (food: FoodItem | Recipe, type: 'food' | 'recipe') => void;
  mealType?: string;
}

export default function FoodSelector({ isOpen, onClose, onFoodSelected, mealType }: FoodSelectorProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<(FoodItem | Recipe)[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'foods' | 'recipes'>('foods');

  const searchItems = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      
      if (selectedTab === 'foods') {
        const { data, error } = await supabase
          .from('food_items')
          .select('id, name, brand, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, is_out_of_stock')
          .eq('is_out_of_stock', false) // Only show in-stock items
          .ilike('name', `%${query}%`)
          .order('name', { ascending: true })
          .limit(20);

        if (error) throw error;
        setSearchResults(data || []);
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .select('id, name, description, servings, is_out_of_stock')
          .eq('is_out_of_stock', false) // Only show in-stock recipes
          .ilike('name', `%${query}%`)
          .order('name', { ascending: true })
          .limit(20);

        if (error) throw error;
        setSearchResults(data || []);
      }
    } catch (error) {
      console.error('Error searching items:', error);
      toast({
        title: "Error",
        description: "Failed to search items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    searchItems(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleItemSelect = (item: FoodItem | Recipe) => {
    onFoodSelected(item, selectedTab === 'foods' ? 'food' : 'recipe');
    onClose();
  };

  useEffect(() => {
    if (searchQuery) {
      const debounceTimer = setTimeout(() => {
        searchItems(searchQuery);
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, selectedTab]);

  const formatNutrition = (value?: number) => {
    return value ? Math.round(value * 10) / 10 : 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add to {mealType || 'Meal'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Tab Selection */}
          <div className="flex gap-2">
            <Button
              variant={selectedTab === 'foods' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTab('foods')}
            >
              <Apple className="h-4 w-4 mr-2" />
              Food Items
            </Button>
            <Button
              variant={selectedTab === 'recipes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTab('recipes')}
            >
              <ChefHat className="h-4 w-4 mr-2" />
              Recipes
            </Button>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder={`Search ${selectedTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => handleItemSelect(item)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        {'brand' in item && item.brand && (
                          <div className="text-sm text-muted-foreground">{item.brand}</div>
                        )}
                        {'description' in item && item.description && (
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {'category' in item && item.category && (
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                          )}
                          {'servings' in item && (
                            <Badge variant="outline" className="text-xs">
                              {item.servings} servings
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {'calories_per_100g' in item && (
                          <>
                            <div className="font-medium">
                              {formatNutrition(item.calories_per_100g)} cal
                            </div>
                            <div className="text-xs text-muted-foreground">per 100g</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <Apple className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No {selectedTab} found</h3>
                <p className="text-muted-foreground mb-4">
                  Try a different search term or check if items are marked as out of stock
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    View Shopping List
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4" />
                <p>Search for {selectedTab} to add to your meal</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}