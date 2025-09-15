-- Create food_items table for storing food database
CREATE TABLE public.food_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  calories_per_100g NUMERIC,
  protein_per_100g NUMERIC,
  carbs_per_100g NUMERIC,
  fat_per_100g NUMERIC,
  fiber_per_100g NUMERIC,
  sugar_per_100g NUMERIC,
  sodium_per_100mg NUMERIC,
  serving_size NUMERIC,
  serving_unit TEXT DEFAULT 'g',
  image_url TEXT,
  nutritional_data JSONB,
  is_user_created BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  prep_time INTEGER, -- in minutes
  cook_time INTEGER, -- in minutes
  servings INTEGER DEFAULT 1,
  difficulty TEXT DEFAULT 'medium',
  image_url TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create recipe_ingredients table (junction table)
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  food_item_id UUID NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meal_plans table
CREATE TABLE public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  total_calories NUMERIC DEFAULT 0,
  total_protein NUMERIC DEFAULT 0,
  total_carbs NUMERIC DEFAULT 0,
  total_fat NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create meals table
CREATE TABLE public.meals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL, -- breakfast, lunch, dinner, snack
  name TEXT,
  notes TEXT,
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create meal_items table (junction table for meals and food items/recipes)
CREATE TABLE public.meal_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES public.food_items(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT meal_items_food_or_recipe_check CHECK (
    (food_item_id IS NOT NULL AND recipe_id IS NULL) OR 
    (food_item_id IS NULL AND recipe_id IS NOT NULL)
  )
);

-- Create nutrition_logs table for daily nutrition tracking
CREATE TABLE public.nutrition_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  total_calories NUMERIC DEFAULT 0,
  total_protein NUMERIC DEFAULT 0,
  total_carbs NUMERIC DEFAULT 0,
  total_fat NUMERIC DEFAULT 0,
  total_fiber NUMERIC DEFAULT 0,
  total_sugar NUMERIC DEFAULT 0,
  total_sodium NUMERIC DEFAULT 0,
  water_intake NUMERIC DEFAULT 0, -- in ml
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create shopping_lists table
CREATE TABLE public.shopping_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shopping_list_items table
CREATE TABLE public.shopping_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopping_list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  food_item_id UUID REFERENCES public.food_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT DEFAULT 'items',
  is_purchased BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for food_items (viewable by all, manageable by creator)
CREATE POLICY "Food items are viewable by everyone" 
ON public.food_items FOR SELECT USING (true);

CREATE POLICY "Users can create food items" 
ON public.food_items FOR INSERT 
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Users can update their own food items" 
ON public.food_items FOR UPDATE 
USING (auth.uid() = created_by);

-- RLS Policies for recipes
CREATE POLICY "Public recipes are viewable by everyone" 
ON public.recipes FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes" 
ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes" 
ON public.recipes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes" 
ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for recipe_ingredients
CREATE POLICY "Recipe ingredients are viewable if recipe is viewable" 
ON public.recipe_ingredients FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = recipe_ingredients.recipe_id 
  AND (recipes.is_public = true OR recipes.user_id = auth.uid())
));

CREATE POLICY "Users can manage ingredients for their recipes" 
ON public.recipe_ingredients FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.recipes 
  WHERE recipes.id = recipe_ingredients.recipe_id 
  AND recipes.user_id = auth.uid()
));

-- RLS Policies for meal_plans
CREATE POLICY "Users can manage their own meal plans" 
ON public.meal_plans FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for meals
CREATE POLICY "Users can manage meals in their meal plans" 
ON public.meals FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.meal_plans 
  WHERE meal_plans.id = meals.meal_plan_id 
  AND meal_plans.user_id = auth.uid()
));

-- RLS Policies for meal_items
CREATE POLICY "Users can manage items in their meals" 
ON public.meal_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.meals 
  JOIN public.meal_plans ON meal_plans.id = meals.meal_plan_id
  WHERE meals.id = meal_items.meal_id 
  AND meal_plans.user_id = auth.uid()
));

-- RLS Policies for nutrition_logs
CREATE POLICY "Users can manage their own nutrition logs" 
ON public.nutrition_logs FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for shopping_lists
CREATE POLICY "Users can manage their own shopping lists" 
ON public.shopping_lists FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for shopping_list_items
CREATE POLICY "Users can manage items in their shopping lists" 
ON public.shopping_list_items FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.shopping_lists 
  WHERE shopping_lists.id = shopping_list_items.shopping_list_id 
  AND shopping_lists.user_id = auth.uid()
));

-- Create triggers for updated_at columns
CREATE TRIGGER update_food_items_updated_at
  BEFORE UPDATE ON public.food_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_nutrition_logs_updated_at
  BEFORE UPDATE ON public.nutrition_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_food_items_barcode ON public.food_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_food_items_name ON public.food_items(name);
CREATE INDEX idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX idx_meal_plans_user_date ON public.meal_plans(user_id, date);
CREATE INDEX idx_nutrition_logs_user_date ON public.nutrition_logs(user_id, date);
CREATE INDEX idx_shopping_lists_user_id ON public.shopping_lists(user_id);