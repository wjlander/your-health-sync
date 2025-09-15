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
  Clock
} from 'lucide-react';

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
            <CardHeader>
              <CardTitle>Daily Nutrition Summary</CardTitle>
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
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Food
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {meal.meal_items?.length > 0 ? (
                      <div className="space-y-2">
                        {meal.meal_items.map((item: MealItem) => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <div className="font-medium">
                                {item.food_item?.name || item.recipe?.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {item.quantity} {item.unit}
                                {item.food_item?.brand && ` • ${item.food_item.brand}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatNutrition(item.calories)} cal</div>
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
    </div>
  );
}