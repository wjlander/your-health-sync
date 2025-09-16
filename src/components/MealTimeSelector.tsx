import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Coffee, Sun, Moon, Clock } from 'lucide-react';

interface MealTimeSelectorProps {
  selectedMealTimes: string[];
  onMealTimesChange: (mealTimes: string[]) => void;
  label?: string;
}

const mealTimeOptions = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee },
  { value: 'lunch', label: 'Lunch', icon: Sun },
  { value: 'dinner', label: 'Dinner', icon: Moon },
  { value: 'snack', label: 'Snack', icon: Clock },
];

export default function MealTimeSelector({ 
  selectedMealTimes, 
  onMealTimesChange, 
  label = "Preferred Meal Times" 
}: MealTimeSelectorProps) {
  const handleMealTimeToggle = (mealTime: string) => {
    const newMealTimes = selectedMealTimes.includes(mealTime)
      ? selectedMealTimes.filter(time => time !== mealTime)
      : [...selectedMealTimes, mealTime];
    
    onMealTimesChange(newMealTimes);
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-3">
        {mealTimeOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <div key={option.value} className="flex items-center space-x-2">
              <Checkbox
                id={`meal-time-${option.value}`}
                checked={selectedMealTimes.includes(option.value)}
                onCheckedChange={() => handleMealTimeToggle(option.value)}
              />
              <Label 
                htmlFor={`meal-time-${option.value}`}
                className="flex items-center gap-2 cursor-pointer"
              >
                <IconComponent className="h-4 w-4" />
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}