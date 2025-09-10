import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Target, TrendingDown, Scale, CalendarIcon, Activity, CheckCircle } from 'lucide-react';
import { UnitsPreference, UnitsType, convertWeight, getWeightUnit } from './UnitsPreference';

interface WeightGoal {
  id: string;
  start_weight: number;
  target_weight: number;
  weekly_loss_target: number;
  daily_calorie_deficit: number;
  start_date: string;
  target_date: string;
  is_active: boolean;
}

interface WeightProgress {
  id: string;
  date: string;
  current_weight?: number;
  calories_consumed?: number;
  calories_burned?: number;
  calorie_deficit_achieved?: number;
  notes?: string;
}

interface HealthData {
  data_type: string;
  value: number;
  date: string;
}

export function WeightGoals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeGoal, setActiveGoal] = useState<WeightGoal | null>(null);
  const [todayProgress, setTodayProgress] = useState<WeightProgress | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [caloriesData, setCaloriesData] = useState<{ consumed: number; burned: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [showEndDay, setShowEndDay] = useState(false);
  const [userUnits, setUserUnits] = useState<UnitsType>('imperial');

  // New goal form state
  const [targetWeight, setTargetWeight] = useState('');
  const [weeklyLoss, setWeeklyLoss] = useState('1.0');
  const [dailyDeficit, setDailyDeficit] = useState('500');
  const [targetDate, setTargetDate] = useState<Date>();

  // End day form state
  const [todayWeight, setTodayWeight] = useState('');
  const [todayNotes, setTodayNotes] = useState('');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch active goal
      const { data: goals } = await supabase
        .from('weight_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (goals && goals.length > 0) {
        setActiveGoal(goals[0]);

        // Fetch today's progress
        const today = new Date().toISOString().split('T')[0];
        const { data: progress } = await supabase
          .from('weight_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('goal_id', goals[0].id)
          .eq('date', today)
          .single();

        setTodayProgress(progress);
      }

      // Fetch latest weight from Fitbit data
      const { data: weightData } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('data_type', 'weight')
        .order('date', { ascending: false })
        .limit(1);

      if (weightData && weightData.length > 0) {
        setCurrentWeight(weightData[0].value);
      }

      // Fetch today's calorie data from Fitbit
      const today = new Date().toISOString().split('T')[0];
      const { data: calorieData } = await supabase
        .from('health_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .in('data_type', ['calories-out', 'calories-in']);

      if (calorieData && calorieData.length > 0) {
        const consumed = calorieData.find(d => d.data_type === 'calories-in')?.value || 0;
        const burned = calorieData.find(d => d.data_type === 'calories-out')?.value || 0;
        setCaloriesData({ consumed, burned });
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch weight goal data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSuggestedValues = (startWeight: number, targetWeightInput: number) => {
    const totalLoss = startWeight - targetWeightInput;
    const recommendedWeeklyLoss = Math.min(2, Math.max(0.5, totalLoss / 20)); // 0.5-2 lbs per week
    const recommendedDeficit = Math.round(recommendedWeeklyLoss * 3500 / 7); // 3500 calories per pound
    const estimatedWeeks = Math.ceil(totalLoss / recommendedWeeklyLoss);
    
    return {
      weeklyLoss: recommendedWeeklyLoss,
      dailyDeficit: recommendedDeficit,
      estimatedWeeks
    };
  };

  const handleCreateGoal = async () => {
    if (!user || !currentWeight || !targetWeight) return;

    // Convert input weights back to lbs for storage
    const targetWeightInLbs = convertWeight(parseFloat(targetWeight), userUnits, 'imperial');
    const weeklyLossInLbs = convertWeight(parseFloat(weeklyLoss), userUnits, 'imperial');
    const dailyDeficitNum = parseInt(dailyDeficit);

    const totalLoss = currentWeight - targetWeightInLbs;
    const estimatedWeeks = Math.ceil(totalLoss / weeklyLossInLbs);
    const calculatedTargetDate = new Date();
    calculatedTargetDate.setDate(calculatedTargetDate.getDate() + (estimatedWeeks * 7));

    try {
      // Deactivate existing goal
      if (activeGoal) {
        await supabase
          .from('weight_goals')
          .update({ is_active: false })
          .eq('id', activeGoal.id);
      }

      // Create new goal
      const { data, error } = await supabase
        .from('weight_goals')
        .insert([{
          user_id: user.id,
          start_weight: currentWeight,
          target_weight: targetWeightInLbs,
          weekly_loss_target: weeklyLossInLbs,
          daily_calorie_deficit: dailyDeficitNum,
          target_date: targetDate ? targetDate.toISOString().split('T')[0] : calculatedTargetDate.toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (error) throw error;

      setActiveGoal(data);
      setShowNewGoal(false);
      toast({
        title: 'Goal Created',
        description: 'Your weight loss goal has been set successfully!'
      });
    } catch (error) {
      console.error('Error creating goal:', error);
      toast({
        title: 'Error',
        description: 'Failed to create weight goal',
        variant: 'destructive'
      });
    }
  };

  const handleEndDay = async () => {
    if (!user || !activeGoal) return;

    const today = new Date().toISOString().split('T')[0];
    const currentDeficit = caloriesData ? (caloriesData.burned - caloriesData.consumed) : 0;

    try {
      // Convert weight back to lbs for storage
      const weightInLbs = todayWeight ? 
        convertWeight(parseFloat(todayWeight), userUnits, 'imperial') : 
        currentWeight;

      const progressData = {
        user_id: user.id,
        goal_id: activeGoal.id,
        date: today,
        current_weight: weightInLbs,
        calories_consumed: caloriesData?.consumed || 0,
        calories_burned: caloriesData?.burned || 0,
        calorie_deficit_achieved: currentDeficit,
        notes: todayNotes
      };

      const { error } = await supabase
        .from('weight_progress')
        .upsert([progressData], {
          onConflict: 'user_id,goal_id,date'
        });

      if (error) throw error;

      // Calculate revised target date based on progress
      const actualDeficit = currentDeficit;
      const requiredDeficit = activeGoal.daily_calorie_deficit;
      const deficitRatio = actualDeficit / requiredDeficit;
      
      let revisedDate = new Date(activeGoal.target_date);
      if (deficitRatio < 1) {
        const adjustment = Math.ceil((1 - deficitRatio) * 7); // Add days based on deficit shortfall
        revisedDate.setDate(revisedDate.getDate() + adjustment);
      }

      setShowEndDay(false);
      setTodayWeight('');
      setTodayNotes('');
      
      toast({
        title: 'Day Completed',
        description: `Progress recorded! ${deficitRatio >= 1 ? 'Great job staying on track!' : `Revised target date: ${format(revisedDate, 'PPP')}`}`,
      });

      fetchData();
    } catch (error) {
      console.error('Error ending day:', error);
      toast({
        title: 'Error',
        description: 'Failed to record daily progress',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  const progress = activeGoal && currentWeight ? 
    Math.max(0, ((activeGoal.start_weight - currentWeight) / (activeGoal.start_weight - activeGoal.target_weight)) * 100) : 0;

  const currentDeficit = caloriesData ? (caloriesData.burned - caloriesData.consumed) : 0;
  const deficitProgress = activeGoal ? Math.max(0, (currentDeficit / activeGoal.daily_calorie_deficit) * 100) : 0;

  // Convert weights for display
  const displayCurrentWeight = currentWeight ? convertWeight(currentWeight, 'imperial', userUnits) : null;
  const displayStartWeight = activeGoal ? convertWeight(activeGoal.start_weight, 'imperial', userUnits) : null;
  const displayTargetWeight = activeGoal ? convertWeight(activeGoal.target_weight, 'imperial', userUnits) : null;
  const weightUnit = getWeightUnit(userUnits);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Weight Goals</h2>
        {!activeGoal && (
          <Dialog open={showNewGoal} onOpenChange={setShowNewGoal}>
            <DialogTrigger asChild>
              <Button><Target className="mr-2 h-4 w-4" />Set Goal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Weight Loss Goal</DialogTitle>
                <DialogDescription>
                  Set your target weight and we'll suggest optimal loss rates
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Current Weight: {displayCurrentWeight?.toFixed(1)} {weightUnit}</Label>
                </div>
                <div>
                  <Label htmlFor="target-weight">Target Weight ({weightUnit})</Label>
                  <Input
                    id="target-weight"
                    type="number"
                    step="0.1"
                    value={targetWeight}
                    onChange={(e) => {
                      setTargetWeight(e.target.value);
                      if (currentWeight && e.target.value) {
                        // Convert input back to lbs for calculation
                        const targetInLbs = convertWeight(parseFloat(e.target.value), userUnits, 'imperial');
                        const suggested = calculateSuggestedValues(currentWeight, targetInLbs);
                        setWeeklyLoss(suggested.weeklyLoss.toFixed(1));
                        setDailyDeficit(suggested.dailyDeficit.toString());
                      }
                    }}
                    placeholder={`Enter target weight in ${weightUnit}`}
                  />
                </div>
                <div>
                  <Label htmlFor="weekly-loss">Weekly Loss Target ({weightUnit})</Label>
                  <Input
                    id="weekly-loss"
                    type="number"
                    step="0.1"
                    value={weeklyLoss}
                    onChange={(e) => setWeeklyLoss(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="daily-deficit">Daily Calorie Deficit</Label>
                  <Input
                    id="daily-deficit"
                    type="number"
                    value={dailyDeficit}
                    onChange={(e) => setDailyDeficit(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Target Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !targetDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {targetDate ? format(targetDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={targetDate}
                        onSelect={setTargetDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button onClick={handleCreateGoal} className="w-full">
                  Create Goal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {activeGoal ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Goal Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Current Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Start Weight:</span>
                <span className="font-semibold">{displayStartWeight?.toFixed(1)} {weightUnit}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Weight:</span>
                <span className="font-semibold">{displayCurrentWeight?.toFixed(1) || 'No data'} {displayCurrentWeight ? weightUnit : ''}</span>
              </div>
              <div className="flex justify-between">
                <span>Target Weight:</span>
                <span className="font-semibold">{displayTargetWeight?.toFixed(1)} {weightUnit}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <Progress value={progress} />
              </div>
              <div className="flex justify-between">
                <span>Target Date:</span>
                <span className="font-semibold">{format(new Date(activeGoal.target_date), 'MMM dd, yyyy')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Daily Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Today's Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Required Deficit:</span>
                <span className="font-semibold">{activeGoal.daily_calorie_deficit} cal</span>
              </div>
              <div className="flex justify-between">
                <span>Current Deficit:</span>
                <span className={cn("font-semibold", currentDeficit >= activeGoal.daily_calorie_deficit ? "text-green-600" : "text-orange-600")}>
                  {currentDeficit} cal
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Deficit Progress</span>
                  <span>{Math.min(100, deficitProgress).toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(100, deficitProgress)} />
              </div>
              {caloriesData && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Calories Consumed:</span>
                    <span>{caloriesData.consumed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Calories Burned:</span>
                    <span>{caloriesData.burned}</span>
                  </div>
                </div>
              )}
              <Dialog open={showEndDay} onOpenChange={setShowEndDay}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    End Day
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>End Day Summary</DialogTitle>
                    <DialogDescription>
                      Record your progress and get updated projections
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="today-weight">Today's Weight (optional) ({weightUnit})</Label>
                      <Input
                        id="today-weight"
                        type="number"
                        step="0.1"
                        value={todayWeight}
                        onChange={(e) => setTodayWeight(e.target.value)}
                        placeholder={displayCurrentWeight ? displayCurrentWeight.toFixed(1) : `Enter weight in ${weightUnit}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={todayNotes}
                        onChange={(e) => setTodayNotes(e.target.value)}
                        placeholder="How did today go? Any challenges or wins?"
                      />
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-semibold mb-2">Today's Summary</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Calorie Deficit:</span>
                          <span className={currentDeficit >= activeGoal.daily_calorie_deficit ? "text-green-600" : "text-orange-600"}>
                            {currentDeficit} / {activeGoal.daily_calorie_deficit}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant={currentDeficit >= activeGoal.daily_calorie_deficit ? "default" : "secondary"}>
                            {currentDeficit >= activeGoal.daily_calorie_deficit ? "On Track" : "Behind Target"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleEndDay} className="w-full">
                      Complete Day
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scale className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Goal</h3>
            <p className="text-muted-foreground mb-4 text-center">
              {currentWeight ? 
                `Current weight: ${displayCurrentWeight?.toFixed(1)} ${weightUnit}. Set a goal to start tracking your progress!` :
                'Connect your Fitbit to see your current weight and set goals.'
              }
            </p>
            {currentWeight && (
              <Button onClick={() => setShowNewGoal(true)}>
                <Target className="mr-2 h-4 w-4" />
                Create Your First Goal
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}