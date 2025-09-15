import React, { useState, useEffect } from 'react';
import { format, subDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  ChartBar, 
  ChevronLeft, 
  ChevronRight, 
  Target,
  TrendingUp,
  Calendar as CalendarIcon,
  Droplets
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface NutritionLog {
  id: string;
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  total_fiber: number;
  total_sugar: number;
  total_sodium: number;
  water_intake: number;
}

interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

export default function NutritionTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [todayNutrition, setTodayNutrition] = useState<NutritionLog | null>(null);
  const [weeklyData, setWeeklyData] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [goals] = useState<NutritionGoals>({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 65,
    water: 2000, // ml
  });

  const fetchTodayNutrition = async (date: Date) => {
    if (!user) return;

    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) throw error;
      setTodayNutrition(data);
    } catch (error) {
      console.error('Error fetching nutrition log:', error);
    }
  };

  const fetchWeeklyData = async (date: Date) => {
    if (!user) return;

    try {
      const weekStart = startOfWeek(date);
      const weekEnd = endOfWeek(date);
      
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(weekStart, 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date');

      if (error) throw error;
      setWeeklyData(data || []);
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTodayNutrition(currentDate),
        fetchWeeklyData(currentDate)
      ]);
      setLoading(false);
    };

    fetchData();
  }, [currentDate, user]);

  const navigateDate = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1)
    );
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const calculatePercentage = (value: number, goal: number) => {
    return Math.min((value / goal) * 100, 100);
  };

  // Chart data for weekly trends
  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate),
    end: endOfWeek(currentDate)
  });

  const weeklyChartData = {
    labels: weekDays.map(day => format(day, 'EEE')),
    datasets: [
      {
        label: 'Calories',
        data: weekDays.map(day => {
          const dayData = weeklyData.find(d => d.date === format(day, 'yyyy-MM-dd'));
          return dayData?.total_calories || 0;
        }),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const macroChartData = todayNutrition ? {
    labels: ['Protein', 'Carbs', 'Fat'],
    datasets: [
      {
        data: [
          todayNutrition.total_protein * 4, // protein calories
          todayNutrition.total_carbs * 4,   // carb calories
          todayNutrition.total_fat * 9,     // fat calories
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(249, 115, 22, 0.8)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(249, 115, 22)',
        ],
        borderWidth: 2,
      },
    ],
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ChartBar className="h-5 w-5" />
              Nutrition Tracker
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="font-semibold text-lg px-4">
                {format(currentDate, 'EEEE, MMMM d')}
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

      {!todayNutrition ? (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No nutrition data for this date</h3>
            <p className="text-muted-foreground">
              Add meals to your meal planner to track nutrition automatically
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {/* Daily Goals Progress */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Calories</span>
                  <Badge variant="outline">
                    {Math.round(todayNutrition.total_calories)}/{goals.calories}
                  </Badge>
                </div>
                <Progress 
                  value={calculatePercentage(todayNutrition.total_calories, goals.calories)}
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(goals.calories - todayNutrition.total_calories)} remaining
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Protein</span>
                  <Badge variant="outline">
                    {Math.round(todayNutrition.total_protein)}g/{goals.protein}g
                  </Badge>
                </div>
                <Progress 
                  value={calculatePercentage(todayNutrition.total_protein, goals.protein)}
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(goals.protein - todayNutrition.total_protein)}g remaining
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Carbs</span>
                  <Badge variant="outline">
                    {Math.round(todayNutrition.total_carbs)}g/{goals.carbs}g
                  </Badge>
                </div>
                <Progress 
                  value={calculatePercentage(todayNutrition.total_carbs, goals.carbs)}
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(goals.carbs - todayNutrition.total_carbs)}g remaining
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Fat</span>
                  <Badge variant="outline">
                    {Math.round(todayNutrition.total_fat)}g/{goals.fat}g
                  </Badge>
                </div>
                <Progress 
                  value={calculatePercentage(todayNutrition.total_fat, goals.fat)}
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {Math.round(goals.fat - todayNutrition.total_fat)}g remaining
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Weekly Calorie Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Line
                    data={weeklyChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {macroChartData && (
              <Card>
                <CardHeader>
                  <CardTitle>Macronutrient Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Doughnut
                      data={macroChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                          },
                        },
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Additional Nutrients */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Nutrients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {Math.round(todayNutrition.total_fiber)}g
                  </div>
                  <div className="text-sm text-muted-foreground">Fiber</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {Math.round(todayNutrition.total_sugar)}g
                  </div>
                  <div className="text-sm text-muted-foreground">Sugar</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {Math.round(todayNutrition.total_sodium)}mg
                  </div>
                  <div className="text-sm text-muted-foreground">Sodium</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Water Intake */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-5 w-5" />
                Water Intake
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress 
                    value={calculatePercentage(todayNutrition.water_intake, goals.water)}
                    className="h-4"
                  />
                </div>
                <Badge variant="outline">
                  {Math.round(todayNutrition.water_intake)}ml / {goals.water}ml
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {Math.round(goals.water - todayNutrition.water_intake)}ml remaining
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}