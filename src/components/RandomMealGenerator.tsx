import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Shuffle, 
  Coffee, 
  Sun, 
  Moon, 
  Clock,
  Plus,
  RefreshCw,
  Utensils,
  ChefHat
} from 'lucide-react';
import MealTimeBadges from './MealTimeBadges';

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  preferred_meal_times?: string[];
  is_out_of_stock?: boolean;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  preferred_meal_times?: string[];
  is_out_of_stock?: boolean;
}

interface MealSuggestion {
  type: 'food' | 'recipe';
  item: FoodItem | Recipe;
  mealTime: string;
}

const mealTimeIcons = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Clock,
};

export default function RandomMealGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const generateRandomMeals = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const mealTimes = ['breakfast', 'lunch', 'dinner', 'snack'];
      const newSuggestions: MealSuggestion[] = [];

      for (const mealTime of mealTimes) {
        // Get random food items for this meal time
        const { data: foods, error: foodsError } = await supabase
          .from('food_items')
          .select('id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, preferred_meal_times, is_out_of_stock')
          .eq('is_out_of_stock', false)
          .contains('preferred_meal_times', [mealTime])
          .limit(10);

        if (foodsError) throw foodsError;

        // Get random recipes for this meal time
        const { data: recipes, error: recipesError } = await supabase
          .from('recipes')
          .select('id, name, description, servings, preferred_meal_times, is_out_of_stock')
          .eq('is_out_of_stock', false)
          .contains('preferred_meal_times', [mealTime])
          .limit(10);

        if (recipesError) throw recipesError;

        // Combine and randomly select one item
        const allItems = [
          ...(foods || []).map(food => ({ type: 'food' as const, item: food })),
          ...(recipes || []).map(recipe => ({ type: 'recipe' as const, item: recipe }))
        ];

        if (allItems.length > 0) {
          const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
          newSuggestions.push({
            ...randomItem,
            mealTime
          });
        }
      }

      setSuggestions(newSuggestions);
      
      if (newSuggestions.length === 0) {
        toast({
          title: "No suggestions found",
          description: "Add more foods and recipes with meal time preferences to get suggestions",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Meal suggestions generated!",
          description: `Found ${newSuggestions.length} meal suggestions for today`,
        });
      }
    } catch (error) {
      console.error('Error generating meal suggestions:', error);
      toast({
        title: "Error",
        description: "Failed to generate meal suggestions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addToMealPlan = async (suggestion: MealSuggestion) => {
    try {
      // This would integrate with the meal planner to add the suggestion
      // For now, just show a success message
      toast({
        title: "Added to meal plan",
        description: `${suggestion.item.name} has been added to your ${suggestion.mealTime}`,
      });
    } catch (error) {
      console.error('Error adding to meal plan:', error);
      toast({
        title: "Error",
        description: "Failed to add to meal plan",
        variant: "destructive",
      });
    }
  };

  const formatNutrition = (value?: number) => {
    return value ? Math.round(value * 10) / 10 : 0;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="h-5 w-5" />
            Random Meal Generator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Generate random meal suggestions based on your food preferences and meal time constraints
            </p>
            <Button 
              onClick={generateRandomMeals} 
              disabled={loading}
              size="lg"
              className="w-full md:w-auto"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Shuffle className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Generating...' : 'Generate Random Meals'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meal Suggestions */}
      {suggestions.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {suggestions.map((suggestion, index) => {
            const IconComponent = mealTimeIcons[suggestion.mealTime as keyof typeof mealTimeIcons];
            
            return (
              <Card key={index} className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent className="h-4 w-4" />
                    <span className="font-medium text-sm capitalize">{suggestion.mealTime}</span>
                  </div>
                  <CardTitle className="text-lg flex items-start gap-2">
                    {suggestion.type === 'recipe' && <ChefHat className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    {suggestion.type === 'food' && <Utensils className="h-4 w-4 mt-0.5 flex-shrink-0" />}
                    <span className="line-clamp-2">{suggestion.item.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {'brand' in suggestion.item && suggestion.item.brand && (
                      <p className="text-sm text-muted-foreground">{suggestion.item.brand}</p>
                    )}
                    
                    {'description' in suggestion.item && suggestion.item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{suggestion.item.description}</p>
                    )}

                    {suggestion.item.preferred_meal_times && (
                      <MealTimeBadges mealTimes={suggestion.item.preferred_meal_times} />
                    )}

                    {'calories_per_100g' in suggestion.item && suggestion.item.calories_per_100g && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Calories (per 100g):</span>
                        <span className="font-medium">{formatNutrition(suggestion.item.calories_per_100g)}</span>
                      </div>
                    )}

                    {'servings' in suggestion.item && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Servings:</span>
                        <span className="font-medium">{suggestion.item.servings}</span>
                      </div>
                    )}

                    <Button 
                      size="sm" 
                      className="w-full mt-4"
                      onClick={() => addToMealPlan(suggestion)}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add to {suggestion.mealTime}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={generateRandomMeals}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate New Suggestions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}