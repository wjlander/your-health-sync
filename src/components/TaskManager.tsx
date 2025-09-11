import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Plus, MessageCircle, Clock, User, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_by: string;
  assigned_to?: string;
  project?: string;
  tags?: string[];
  calendar_event_id?: string;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
  creator_profile?: { full_name?: string; email?: string };
  assignee_profile?: { full_name?: string; email?: string };
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  user_profile?: { full_name?: string; email?: string };
}

export const TaskManager = () => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, TaskComment[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'assigned' | 'created'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    due_date: '',
    assigned_to: '',
    project: '',
    tags: '',
    add_to_calendar: false
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  const statusColors = {
    pending: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchProfiles();
    }
  }, [user]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately and match them
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      const tasksWithProfiles = (data || []).map(task => ({
        ...task,
        creator_profile: profiles?.find(p => p.user_id === task.created_by),
        assignee_profile: task.assigned_to ? profiles?.find(p => p.user_id === task.assigned_to) : null
      }));

      setTasks(tasksWithProfiles as Task[]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks: ' + error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error('Failed to fetch profiles:', error.message);
    }
  };

  const fetchComments = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately and match them
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      const commentsWithProfiles = (data || []).map(comment => ({
        ...comment,
        user_profile: profiles?.find(p => p.user_id === comment.user_id)
      }));

      setComments(prev => ({ ...prev, [taskId]: commentsWithProfiles as TaskComment[] }));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch comments: ' + error.message,
        variant: 'destructive'
      });
    }
  };

  const createTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: 'Error',
        description: 'Task title is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const taskData = {
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        due_date: newTask.due_date || null,
        created_by: user?.id,
        assigned_to: newTask.assigned_to || null,
        project: newTask.project || null,
        tags: newTask.tags ? newTask.tags.split(',').map(tag => tag.trim()) : null
      };

      const { data: task, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      // Add to Google Calendar if requested and user has connected Google
      if (newTask.add_to_calendar && newTask.due_date) {
        try {
          await supabase.functions.invoke('create-task-reminder', {
            body: { 
              task_id: task.id,
              title: newTask.title,
              description: newTask.description,
              due_date: newTask.due_date,
              assigned_to: newTask.assigned_to
            }
          });
          toast({
            title: 'Success',
            description: 'Task created and added to calendar!',
          });
        } catch (calendarError) {
          toast({
            title: 'Task Created',
            description: 'Task created successfully, but could not add to calendar. You may need to connect to Google Calendar first.',
          });
        }
      } else {
        toast({
          title: 'Success',
          description: 'Task created successfully!',
        });
      }

      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        assigned_to: '',
        project: '',
        tags: '',
        add_to_calendar: false
      });
      setShowNewTaskDialog(false);
      fetchTasks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to create task: ' + error.message,
        variant: 'destructive'
      });
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Task status updated!',
      });
      fetchTasks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update task: ' + error.message,
        variant: 'destructive'
      });
    }
  };

  const addComment = async (taskId: string) => {
    if (!newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user?.id,
          comment: newComment
        });

      if (error) throw error;
      
      setNewComment('');
      fetchComments(taskId);
      toast({
        title: 'Success',
        description: 'Comment added!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add comment: ' + error.message,
        variant: 'destructive'
      });
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'assigned' && task.assigned_to !== user?.id) return false;
    if (filter === 'created' && task.created_by !== user?.id) return false;
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading tasks...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Task Management</h2>
        <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="assigned_to">Assign To</Label>
                  <Select
                    value={newTask.assigned_to}
                    onValueChange={(value) => setNewTask(prev => ({ ...prev, assigned_to: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map(profile => (
                        <SelectItem key={profile.user_id} value={profile.user_id}>
                          {profile.full_name || profile.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="project">Project</Label>
                <Input
                  id="project"
                  value={newTask.project}
                  onChange={(e) => setNewTask(prev => ({ ...prev, project: e.target.value }))}
                  placeholder="Project name"
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={newTask.tags}
                  onChange={(e) => setNewTask(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="add_to_calendar"
                  checked={newTask.add_to_calendar}
                  onChange={(e) => setNewTask(prev => ({ ...prev, add_to_calendar: e.target.checked }))}
                />
                <Label htmlFor="add_to_calendar">Add reminder to Google Calendar</Label>
              </div>
              <div className="flex space-x-2">
                <Button onClick={createTask} className="flex-1">
                  Create Task
                </Button>
                <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex space-x-4">
        <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="assigned">Assigned to Me</SelectItem>
            <SelectItem value="created">Created by Me</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No tasks found. Create your first task!</p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map(task => (
            <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-lg">{task.title}</h3>
                      <Badge className={priorityColors[task.priority]}>
                        {task.priority}
                      </Badge>
                      <Badge className={statusColors[task.status]}>
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-muted-foreground mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>Created by: {task.creator_profile?.full_name || task.creator_profile?.email || 'Unknown'}</span>
                      </div>
                      {task.assigned_to && (
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>Assigned to: {task.assignee_profile?.full_name || task.assignee_profile?.email || 'Unknown'}</span>
                        </div>
                      )}
                      {task.due_date && (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>
                    {task.project && (
                      <div className="mt-2">
                        <Badge variant="outline">Project: {task.project}</Badge>
                      </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <div className="mt-2 flex space-x-1">
                        {task.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col space-y-2">
                    {(task.created_by === user?.id || task.assigned_to === user?.id) && (
                      <Select
                        value={task.status}
                        onValueChange={(value) => updateTaskStatus(task.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        fetchComments(task.id);
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Comments
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Comments Dialog */}
      <Dialog open={selectedTask !== null} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task: {selectedTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-96 overflow-y-auto space-y-2">
              {selectedTask && comments[selectedTask.id]?.map(comment => (
                <div key={comment.id} className="border rounded p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm">
                      {comment.user_profile?.full_name || comment.user_profile?.email || 'Unknown User'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm">{comment.comment}</p>
                </div>
              ))}
              {selectedTask && (!comments[selectedTask.id] || comments[selectedTask.id]?.length === 0) && (
                <p className="text-center text-muted-foreground">No comments yet</p>
              )}
            </div>
            <div className="flex space-x-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1"
              />
              <Button onClick={() => selectedTask && addComment(selectedTask.id)}>
                Add Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};