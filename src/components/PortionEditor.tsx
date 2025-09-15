import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Calculator } from 'lucide-react';

interface PortionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (quantity: number, unit: string) => void;
  currentQuantity: number;
  currentUnit: string;
  foodName: string;
  nutritionPer100g: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

const commonUnits = [
  'g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'piece', 'slice', 'serving'
];

export default function PortionEditor({
  isOpen,
  onClose,
  onSave,
  currentQuantity,
  currentUnit,
  foodName,
  nutritionPer100g,
}: PortionEditorProps) {
  const [quantity, setQuantity] = useState(currentQuantity.toString());
  const [unit, setUnit] = useState(currentUnit);

  const calculateNutrition = (qty: number) => {
    const multiplier = qty / 100; // Base nutrition is per 100g
    return {
      calories: Math.round(nutritionPer100g.calories * multiplier),
      protein: Math.round(nutritionPer100g.protein * multiplier * 10) / 10,
      carbs: Math.round(nutritionPer100g.carbs * multiplier * 10) / 10,
      fat: Math.round(nutritionPer100g.fat * multiplier * 10) / 10,
    };
  };

  const handleSave = () => {
    const numQuantity = parseFloat(quantity);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      return;
    }
    onSave(numQuantity, unit);
    onClose();
  };

  const currentNutrition = calculateNutrition(parseFloat(quantity) || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Edit Portion Size
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">{foodName}</Label>
            <p className="text-xs text-muted-foreground">Adjust the quantity and unit</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="0.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {commonUnits.map((unitOption) => (
                    <SelectItem key={unitOption} value={unitOption}>
                      {unitOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div>
            <Label className="text-sm font-medium">Calculated Nutrition</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-2 bg-muted/50 rounded text-center">
                <div className="text-lg font-semibold text-primary">
                  {currentNutrition.calories}
                </div>
                <div className="text-xs text-muted-foreground">Calories</div>
              </div>
              <div className="p-2 bg-muted/50 rounded text-center">
                <div className="text-lg font-semibold text-green-600">
                  {currentNutrition.protein}g
                </div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div className="p-2 bg-muted/50 rounded text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {currentNutrition.carbs}g
                </div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div className="p-2 bg-muted/50 rounded text-center">
                <div className="text-lg font-semibold text-orange-600">
                  {currentNutrition.fat}g
                </div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              className="flex-1"
              disabled={!quantity || parseFloat(quantity) <= 0}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}