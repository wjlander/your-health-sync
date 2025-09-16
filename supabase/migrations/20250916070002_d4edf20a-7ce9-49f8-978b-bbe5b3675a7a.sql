-- Add out of stock tracking for food items and recipes
ALTER TABLE public.food_items 
ADD COLUMN is_out_of_stock boolean DEFAULT false;

ALTER TABLE public.recipes 
ADD COLUMN is_out_of_stock boolean DEFAULT false;

-- Create index for better performance when filtering out of stock items
CREATE INDEX idx_food_items_out_of_stock ON public.food_items(is_out_of_stock);
CREATE INDEX idx_recipes_out_of_stock ON public.recipes(is_out_of_stock);