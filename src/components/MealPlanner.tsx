import React, { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calendar, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Utensils, 
  Coffee, 
  Sun, 
  Moon, 
  Clock,
  Edit3
} from 'lucide-react';
import PortionEditor from './PortionEditor';
import FoodSelector from './FoodSelector';

interface MealPlan {
  id: string;
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: Meal[];
}

interface Meal {
  id: string;
  meal_type: string;
  name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_items: MealItem[];
}

interface MealItem {
  id: string;
  quantity: number;
  unit: string;
  calories: number;
  food_item?: {
    name: string;
    brand?: string;
  };
  recipe?: {
    name: string;
  };
}

const mealTypeIcons = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Clock,
};

const mealTypeColors = {
  breakfast: 'bg-orange-100 text-orange-800 border-orange-200',
  lunch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  dinner: 'bg-blue-100 text-blue-800 border-blue-200',
  snack: 'bg-green-100 text-green-800 border-green-200',
};

export default function MealPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPortion, setEditingPortion] = useState<{
    itemId: string;
    quantity: number;
    unit: string;
    foodName: string;
    nutritionPer100g: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
  } | null>(null);
  const [showFoodSelector, setShowFoodSelector] = useState<{
    isOpen: boolean;
    mealId?: string;
    mealType?: string;
  }>({ isOpen: false });

  const fetchMealPlan = async (date: Date) => {
    if (!user) return;

    try {
      setLoading(true);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('meal_plans')
        .select(`
          *,
          meals (
            *,
            meal_items (
              *,
              food_item:food_items(*),
              recipe:recipes(*)
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) throw error;
      setMealPlan(data);
    } catch (error) {
      console.error('Error fetching meal plan:', error);
      toast({
        title: "Error",
        description: "Failed to load meal plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createMealPlan = async () => {
    if (!user) return;

    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('meal_plans')
        .insert([{
          user_id: user.id,
          date: dateStr,
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
        }])
        .select()
        .single();

      if (error) throw error;

      // Create default meals
      const defaultMeals = ['breakfast', 'lunch', 'dinner', 'snack'];
      const mealsData = defaultMeals.map(type => ({
        meal_plan_id: data.id,
        meal_type: type,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }));

      const { error: mealsError } = await supabase
        .from('meals')
        .insert(mealsData);

      if (mealsError) throw mealsError;

      await fetchMealPlan(currentDate);
      toast({
        title: "Success",
        description: "Meal plan created successfully",
      });
    } catch (error) {
      console.error('Error creating meal plan:', error);
      toast({
        title: "Error",
        description: "Failed to create meal plan",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMealPlan(currentDate);
  }, [currentDate, user]);

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)
    );
  };

  const formatNutrition = (value: number) => {
    return Math.round(value || 0);
  };

  const pushToFitbit = async () => {
    if (!mealPlan || !user) return;

    try {
      // Prepare meal data for Fitbit
      const mealData = [];
      
      for (const meal of mealPlan.meals) {
        for (const item of meal.meal_items || []) {
          if (item.food_item) {
            mealData.push({
              foodName: item.food_item.name,
              calories: item.calories,
              quantity: item.quantity,
              mealType: meal.meal_type,
            });
          }
        }
      }

      if (mealData.length === 0) {
        toast({
          title: "No meals to sync",
          description: "Add some food items to your meals first",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/push-nutrition-to-fitbit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
        },
        body: JSON.stringify({
          mealData,
          date: format(currentDate, 'yyyy-MM-dd'),
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        const successCount = result.results.filter(r => r.status === 'success').length;
        toast({
          title: "Fitbit sync completed",
          description: `${successCount} items pushed to Fitbit successfully`,
        });
      } else {
        throw new Error(result.error || 'Failed to sync with Fitbit');
      }
    } catch (error) {
      console.error('Fitbit sync error:', error);
      toast({
        title: "Sync failed", 
        description: "Failed to push meals to Fitbit. Check your Fitbit connection.",
        variant: "destructive",
      });
    }
  };

  const handlePortionEdit = (item: MealItem) => {
    if (!item.food_item) return;
    
    setEditingPortion({
      itemId: item.id,
      quantity: item.quantity,
      unit: item.unit,
      foodName: item.food_item.name,
      nutritionPer100g: {
        calories: item.calories / (item.quantity / 100), // Reverse calculate per 100g
        protein: 0, // We'd need this data from the food_item
        carbs: 0,
        fat: 0,
      }
    });
  };

  const handlePortionSave = async (quantity: number, unit: string) => {
    if (!editingPortion) return;

    try {
      // Calculate new nutrition values based on new quantity
      const multiplier = quantity / 100;
      const newCalories = Math.round(editingPortion.nutritionPer100g.calories * multiplier);

      const { error } = await supabase
        .from('meal_items')
        .update({
          quantity,
          unit,
          calories: newCalories,
        })
        .eq('id', editingPortion.itemId);

      if (error) throw error;

      await fetchMealPlan(currentDate);
      setEditingPortion(null);
      
      toast({
        title: "Portion updated",
        description: "Food portion has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating portion:', error);
      toast({
        title: "Update failed",
        description: "Failed to update portion size",
        variant: "destructive",
      });
    }
  };

  const handleFoodSelected = async (food: any, type: 'food' | 'recipe', mealId: string) => {
    try {
      // Calculate nutrition values based on default portion (100g for foods, 1 serving for recipes)
      let calories = 0;
      let protein = 0;
      let carbs = 0;
      let fat = 0;
      let quantity = 100;
      let unit = 'g';

      if (type === 'food') {
        calories = Math.round((food.calories_per_100g || 0));
        protein = Math.round((food.protein_per_100g || 0));
        carbs = Math.round((food.carbs_per_100g || 0));
        fat = Math.round((food.fat_per_100g || 0));
      } else {
        // For recipes, we'd need to calculate based on ingredients and servings
        // For now, set default values
        quantity = 1;
        unit = 'serving';
        calories = 300; // Default estimate
      }

      const { error } = await supabase
        .from('meal_items')
        .insert([{
          meal_id: mealId,
          food_item_id: type === 'food' ? food.id : null,
          recipe_id: type === 'recipe' ? food.id : null,
          quantity,
          unit,
          calories,
          protein,
          carbs,
          fat,
        }]);

      if (error) throw error;

      await fetchMealPlan(currentDate);
      
      toast({
        title: "Item added",
        description: `${food.name} has been added to your meal`,
      });
    } catch (error) {
      console.error('Error adding food to meal:', error);
      toast({
        title: "Error",
        description: "Failed to add item to meal",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Meal Planner
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-lg px-4">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </div>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!mealPlan ? (
        <Card>
          <CardContent className="text-center py-8">
            <Utensils className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No meal plan for this date</h3>
            <p className="text-muted-foreground mb-4">
              Create a meal plan to start tracking your nutrition
            </p>
            <Button onClick={createMealPlan}>
              <Plus className="h-4 w-4 mr-2" />
              Create Meal Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
      {/* Nutrition Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daily Nutrition Summary</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={pushToFitbit}
            disabled={!mealPlan?.meals?.some(meal => meal.meal_items?.length > 0)}
          >
            Push to Fitbit
          </Button>
        </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {formatNutrition(mealPlan.total_calories)}
                  </div>
                  <div className="text-sm text-muted-foreground">Calories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatNutrition(mealPlan.total_protein)}g
                  </div>
                  <div className="text-sm text-muted-foreground">Protein</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatNutrition(mealPlan.total_carbs)}g
                  </div>
                  <div className="text-sm text-muted-foreground">Carbs</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatNutrition(mealPlan.total_fat)}g
                  </div>
                  <div className="text-sm text-muted-foreground">Fat</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meals */}
          <div className="grid gap-4">
            {mealPlan.meals?.map((meal: Meal) => {
              const IconComponent = mealTypeIcons[meal.meal_type as keyof typeof mealTypeIcons];
              const colorClass = mealTypeColors[meal.meal_type as keyof typeof mealTypeColors];
              
              return (
                <Card key={meal.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-5 w-5" />
                        <span className="capitalize">{meal.meal_type}</span>
                        <Badge variant="outline" className={colorClass}>
                          {formatNutrition(meal.calories)} cal
                        </Badge>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowFoodSelector({
                          isOpen: true,
                          mealId: meal.id,
                          mealType: meal.meal_type
                        })}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Food
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {meal.meal_items?.length > 0 ? (
                      <div className="space-y-2">
                        {meal.meal_items.map((item: MealItem) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded group">
                            <div className="flex-1">
                              <div className="font-medium">
                                {item.food_item?.name || item.recipe?.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.quantity} {item.unit}
                                {item.food_item?.brand && ` • ${item.food_item.brand}`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <div className="font-medium">{formatNutrition(item.calories)} cal</div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handlePortionEdit(item)}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No items added yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Portion Editor Dialog */}
      {editingPortion && (
        <PortionEditor
          isOpen={!!editingPortion}
          onClose={() => setEditingPortion(null)}
          onSave={handlePortionSave}
          currentQuantity={editingPortion.quantity}
          currentUnit={editingPortion.unit}
          foodName={editingPortion.foodName}
          nutritionPer100g={editingPortion.nutritionPer100g}
        />
      )}
      {/* Food Selector Dialog */}
      {showFoodSelector.isOpen && (
        <FoodSelector
          isOpen={showFoodSelector.isOpen}
          onClose={() => setShowFoodSelector({ isOpen: false })}
          onFoodSelected={(food, type) => handleFoodSelected(food, type, showFoodSelector.mealId!)}
          mealType={showFoodSelector.mealType}
        />
      )}
    </div>
  );
}