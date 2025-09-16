import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Coffee, Sun, Moon, Clock } from 'lucide-react';

interface MealTimeBadgesProps {
  mealTimes: string[];
  size?: 'sm' | 'md';
}

const mealTimeIcons = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Clock,
};

const mealTimeColors = {
  breakfast: 'bg-orange-100 text-orange-800 border-orange-200',
  lunch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  dinner: 'bg-blue-100 text-blue-800 border-blue-200',
  snack: 'bg-green-100 text-green-800 border-green-200',
};

export default function MealTimeBadges({ mealTimes, size = 'sm' }: MealTimeBadgesProps) {
  if (!mealTimes?.length) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {mealTimes.map((mealTime) => {
        const IconComponent = mealTimeIcons[mealTime as keyof typeof mealTimeIcons];
        const colorClass = mealTimeColors[mealTime as keyof typeof mealTimeColors];
        
        return (
          <Badge 
            key={mealTime} 
            variant="outline" 
            className={`${colorClass} ${size === 'sm' ? 'text-xs px-1 py-0' : 'text-xs'}`}
          >
            {IconComponent && <IconComponent className="h-3 w-3 mr-1" />}
            {mealTime}
          </Badge>
        );
      })}
    </div>
  );
}