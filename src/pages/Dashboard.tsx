import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Activity, Calendar, Settings, LogOut, Target, TrendingUp, Users, Scale, ListTodo } from 'lucide-react';
import HealthMetrics from '@/components/HealthMetrics';
import CalendarEvents from '@/components/CalendarEvents';
import GoogleTasks from '@/components/GoogleTasks';
import RoutinesManager from '@/components/RoutinesManager';
import ApiConfiguration from '@/components/ApiConfiguration';
import UserCreator from '@/components/UserCreator';
import { WeightGoals } from '@/components/WeightGoals';
import { UnitsPreference } from '@/components/UnitsPreference';
import DashboardOverview from '@/components/DashboardOverview';

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Show loading or redirect to login
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Activity className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-health text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Heart className="h-8 w-8" />
            <h1 className="text-2xl font-bold">Health & Wellness Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm opacity-90">Welcome, {user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Health Data</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Calendar</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center space-x-2">
              <ListTodo className="h-4 w-4" />
              <span>Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="routines" className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Routines</span>
            </TabsTrigger>
            <TabsTrigger value="weight" className="flex items-center space-x-2">
              <Scale className="h-4 w-4" />
              <span>Weight Goals</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Users</span>
            </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DashboardOverview />
          </TabsContent>

          <TabsContent value="health">
            <HealthMetrics />
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarEvents />
          </TabsContent>

          <TabsContent value="tasks">
            <GoogleTasks />
          </TabsContent>

          <TabsContent value="routines">
            <RoutinesManager />
          </TabsContent>

          <TabsContent value="weight">
            <WeightGoals />
          </TabsContent>

          <TabsContent value="users">
            <UserCreator />
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <UnitsPreference onUnitsChange={(units) => {
                // Units changed, this could trigger other components to refresh
                console.log('Units changed to:', units);
              }} />
              <ApiConfiguration />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;