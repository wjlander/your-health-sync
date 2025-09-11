import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, CheckCircle2, Circle, RefreshCw, ListTodo } from 'lucide-react';

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated: string;
}

interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

const GoogleTasks = () => {
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskList, setSelectedTaskList] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const { user, session } = useAuth();

  useEffect(() => {
    if (user && session) {
      fetchTaskLists();
    }
  }, [user, session]);

  useEffect(() => {
    if (selectedTaskList) {
      fetchTasks(selectedTaskList);
    }
  }, [selectedTaskList]);

  const fetchTaskLists = async () => {
    try {
      setLoading(true);
      console.log('Fetching Google Task Lists...');
      
      const { data, error } = await supabase.functions.invoke('list-google-tasks', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error fetching task lists:', error);
        toast({
          title: "Error",
          description: "Failed to fetch Google Task lists. Make sure your Google account is connected.",
          variant: "destructive",
        });
        return;
      }

      console.log('Task lists fetched:', data);
      setTaskLists(data.taskLists || []);
      
      // Auto-select the first task list if available
      if (data.taskLists && data.taskLists.length > 0) {
        setSelectedTaskList(data.taskLists[0].id);
      }
    } catch (error) {
      console.error('Error fetching task lists:', error);
      toast({
        title: "Error",
        description: "Failed to fetch Google Task lists.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (taskListId: string) => {
    try {
      setTasksLoading(true);
      console.log('Fetching tasks for list:', taskListId);
      
      const { data, error } = await supabase.functions.invoke('list-google-tasks-items', {
        body: { taskListId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast({
          title: "Error",
          description: "Failed to fetch tasks from the selected list.",
          variant: "destructive",
        });
        return;
      }

      console.log('Tasks fetched:', data);
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks.",
        variant: "destructive",
      });
    } finally {
      setTasksLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const completedTasks = tasks.filter(task => task.status === 'completed');
  const pendingTasks = tasks.filter(task => task.status === 'needsAction');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <p>Loading Google Tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Google Tasks
          </h3>
          <p className="text-sm text-muted-foreground">
            View and manage your Google Tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          {taskLists.length > 0 && (
            <Select value={selectedTaskList} onValueChange={setSelectedTaskList}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select task list..." />
              </SelectTrigger>
              <SelectContent>
                {taskLists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button 
            onClick={fetchTaskLists} 
            disabled={syncing}
            size="sm"
          >
            {syncing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {taskLists.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Google Task Lists Found</h3>
              <p className="text-muted-foreground mb-4">
                Make sure your Google account is connected and you have task lists created in Google Tasks.
              </p>
              <Button onClick={fetchTaskLists}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
              </CardContent>
            </Card>
      ) : tasksLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <p>Loading tasks...</p>
        </div>
      ) : (
        <>
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-md font-medium flex items-center gap-2">
                <Circle className="h-4 w-4" />
                Pending Tasks ({pendingTasks.length})
              </h4>
              <div className="grid gap-4">
                {pendingTasks.map((task) => (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={false}
                          className="mt-1"
                          disabled
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          {task.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {task.due && (
                              <Badge variant="outline" className="text-xs">
                                <Calendar className="h-3 w-3 mr-1" />
                                Due: {formatDate(task.due)}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              Updated: {formatDate(task.updated)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-md font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Completed Tasks ({completedTasks.length})
              </h4>
              <div className="grid gap-4">
                {completedTasks.map((task) => (
                  <Card key={task.id} className="opacity-75">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={true}
                          className="mt-1"
                          disabled
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm line-through text-muted-foreground">
                            {task.title}
                          </h4>
                          {task.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.notes}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            {task.completed && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Completed: {formatDate(task.completed)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Tasks */}
          {tasks.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Tasks Found</h3>
                  <p className="text-muted-foreground">
                    The selected task list is empty.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default GoogleTasks;