-- Add sample food items to make search functional
INSERT INTO food_items (name, brand, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, serving_size, serving_unit, is_user_created) VALUES
('Banana', NULL, 'Fruits', 89, 1.1, 22.8, 0.3, 2.6, 118, 'g', false),
('Chicken Breast', NULL, 'Meat', 165, 31, 0, 3.6, 0, 100, 'g', false),
('Brown Rice', NULL, 'Grains', 123, 2.6, 22.9, 0.9, 1.8, 195, 'g', false),
('Salmon Fillet', NULL, 'Fish', 208, 25.4, 0, 12.4, 0, 100, 'g', false),
('Broccoli', NULL, 'Vegetables', 34, 2.8, 6.6, 0.4, 2.6, 91, 'g', false),
('Sweet Potato', NULL, 'Vegetables', 86, 1.6, 20.1, 0.1, 3, 128, 'g', false),
('Greek Yogurt', 'Plain', 'Dairy', 59, 10.3, 3.6, 0.4, 0, 170, 'g', false),
('Almonds', NULL, 'Nuts', 579, 21.2, 21.6, 49.9, 12.5, 28, 'g', false),
('Oats', 'Rolled', 'Grains', 389, 16.9, 66.3, 6.9, 10.6, 40, 'g', false),
('Apple', NULL, 'Fruits', 52, 0.3, 13.8, 0.2, 2.4, 182, 'g', false),
('Eggs', 'Large', 'Dairy', 155, 13, 1.1, 11, 0, 50, 'g', false),
('Spinach', NULL, 'Vegetables', 23, 2.9, 3.6, 0.4, 2.2, 30, 'g', false),
('Quinoa', NULL, 'Grains', 120, 4.4, 21.3, 1.9, 2.8, 185, 'g', false),
('Avocado', NULL, 'Fruits', 160, 2, 8.5, 14.7, 6.7, 150, 'g', false),
('Tuna', 'Canned in water', 'Fish', 116, 25.5, 0, 0.8, 0, 85, 'g', false);