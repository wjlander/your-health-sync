import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TaskTemplateDialog } from './TaskTemplateDialog';
import { Plus, Edit, Trash2, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  project?: string;
  tags?: string[];
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  creator_profile?: { full_name?: string; email?: string };
}

interface TaskTemplateManagerProps {
  onCreateFromTemplate?: (template: TaskTemplate) => void;
}

export const TaskTemplateManager: React.FC<TaskTemplateManagerProps> = ({ onCreateFromTemplate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [deleteTemplate, setDeleteTemplate] = useState<TaskTemplate | null>(null);

  const priorityColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800'
  };

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately and match them
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');

      const templatesWithProfiles = (data || []).map(template => ({
        ...template,
        creator_profile: profiles?.find(p => p.user_id === template.created_by)
      }));

      setTemplates(templatesWithProfiles as TaskTemplate[]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch templates: ' + error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: TaskTemplate) => {
    if (template.created_by !== user?.id) {
      toast({
        title: 'Access Denied',
        description: 'You can only edit templates you created',
        variant: 'destructive'
      });
      return;
    }
    setSelectedTemplate(template);
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTemplate) return;

    try {
      const { error } = await supabase
        .from('task_templates')
        .update({ is_active: false })
        .eq('id', deleteTemplate.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Template deleted successfully!',
      });
      
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete template: ' + error.message,
        variant: 'destructive'
      });
    } finally {
      setDeleteTemplate(null);
    }
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setShowDialog(true);
  };

  const handleUseTemplate = (template: TaskTemplate) => {
    if (onCreateFromTemplate) {
      onCreateFromTemplate(template);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading templates...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Task Templates</h3>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No templates found. Create your first template!</p>
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{template.title}</CardTitle>
                  <Badge className={priorityColors[template.priority]}>
                    {template.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                )}
                
                <div className="space-y-2">
                  {template.project && (
                    <div className="text-sm">
                      <span className="font-medium">Project:</span> {template.project}
                    </div>
                  )}
                  {template.tags && template.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Created by: {template.creator_profile?.full_name || template.creator_profile?.email}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleUseTemplate(template)}
                    className="flex-1"
                  >
                    Use Template
                  </Button>
                  {template.created_by === user?.id && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <TaskTemplateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        template={selectedTemplate}
        onSave={fetchTemplates}
      />

      <AlertDialog open={!!deleteTemplate} onOpenChange={() => setDeleteTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template "{deleteTemplate?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};