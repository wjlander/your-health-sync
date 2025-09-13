import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Activity, Calendar, Settings, LogOut, Target, TrendingUp, Users, Scale, ListTodo, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import HealthMetrics from '@/components/HealthMetrics';
import CalendarEvents from '@/components/CalendarEvents';
import { TaskManager } from '@/components/TaskManager';
import RoutinesManager from '@/components/RoutinesManager';
import { NotificationSoundSelector } from '@/components/NotificationSoundSelector';
import ApiConfiguration from '@/components/ApiConfiguration';
import UserCreator from '@/components/UserCreator';
import { WeightGoals } from '@/components/WeightGoals';
import { UnitsPreference } from '@/components/UnitsPreference';
import DashboardOverview from '@/components/DashboardOverview';
import { CustomTrackers } from '@/components/CustomTrackers';

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="bg-gradient-health text-white p-3 md:p-4 shadow-lg">
        <div className="mx-auto flex justify-between items-center px-2 md:px-4 max-w-full">
          <div className="flex items-center space-x-2">
            <Heart className="h-6 w-6 md:h-8 md:w-8" />
            <h1 className="text-lg md:text-2xl font-bold">{isMobile ? 'Health Sync' : 'Health & Wellness Dashboard'}</h1>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {!isMobile && <span className="text-sm opacity-90">Welcome, {user?.email}</span>}
            <Button
              variant="outline"
              size={isMobile ? "sm" : "sm"}
              onClick={handleSignOut}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <LogOut className="h-4 w-4 mr-1 md:mr-2" />
              {isMobile ? '' : 'Sign Out'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto p-2 md:p-6 max-w-full overflow-x-hidden">
        <Tabs defaultValue="overview" className="space-y-3 md:space-y-6 w-full">
          <TabsList className={`${isMobile ? 'flex overflow-x-auto scrollbar-hide p-2 gap-1 w-full' : 'grid w-full grid-cols-9'} bg-muted rounded-lg`}>
            <TabsTrigger 
              value="overview" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <TrendingUp className="h-4 w-4" />
              {!isMobile && <span>Overview</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="health" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Activity className="h-4 w-4" />
              {!isMobile && <span>Health Data</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="trackers" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Plus className="h-4 w-4" />
              {!isMobile && <span>Trackers</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="calendar" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Calendar className="h-4 w-4" />
              {!isMobile && <span>Calendar</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="tasks" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <ListTodo className="h-4 w-4" />
              {!isMobile && <span>Tasks</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="routines" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Target className="h-4 w-4" />
              {!isMobile && <span>Routines</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="weight" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Scale className="h-4 w-4" />
              {!isMobile && <span>Weight Goals</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Users className="h-4 w-4" />
              {!isMobile && <span>Users</span>}
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className={`flex items-center justify-center ${isMobile ? 'flex-shrink-0 min-w-12 w-12 h-10 p-0' : 'space-x-2'}`}
            >
              <Settings className="h-4 w-4" />
              {!isMobile && <span>Settings</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <DashboardOverview />
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4">Quick Trackers</h3>
              <CustomTrackers />
            </div>
          </TabsContent>

          <TabsContent value="health">
            <HealthMetrics />
          </TabsContent>

          <TabsContent value="trackers">
            <CustomTrackers />
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarEvents />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskManager />
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
              <NotificationSoundSelector />
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