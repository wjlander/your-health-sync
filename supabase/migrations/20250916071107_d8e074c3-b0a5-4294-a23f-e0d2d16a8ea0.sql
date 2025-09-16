-- Add meal time preferences for food items and recipes
ALTER TABLE public.food_items 
ADD COLUMN preferred_meal_times text[] DEFAULT '{"breakfast","lunch","dinner","snack"}';

ALTER TABLE public.recipes 
ADD COLUMN preferred_meal_times text[] DEFAULT '{"breakfast","lunch","dinner","snack"}';

-- Create index for better performance when filtering by meal times
CREATE INDEX idx_food_items_meal_times ON public.food_items USING GIN(preferred_meal_times);
CREATE INDEX idx_recipes_meal_times ON public.recipes USING GIN(preferred_meal_times);