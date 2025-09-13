import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TaskTemplate {
  id?: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  project?: string;
  tags?: string[];
  created_by?: string;
  is_active?: boolean;
}

interface TaskTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: TaskTemplate | null;
  onSave: () => void;
}

export const TaskTemplateDialog: React.FC<TaskTemplateDialogProps> = ({
  open,
  onOpenChange,
  template,
  onSave
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<TaskTemplate>({
    title: '',
    description: '',
    priority: 'medium',
    project: '',
    tags: []
  });
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData(template);
      setTagsInput(template.tags?.join(', ') || '');
    } else {
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        project: '',
        tags: []
      });
      setTagsInput('');
    }
  }, [template, open]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Template title is required',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        ...formData,
        tags: tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(Boolean) : null,
        created_by: user?.id
      };

      if (template?.id) {
        // Update existing template
        const { error } = await supabase
          .from('task_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Template updated successfully!',
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('task_templates')
          .insert(templateData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Template created successfully!',
        });
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to save template: ' + error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Template' : 'Create New Template'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-title">Title *</Label>
            <Input
              id="template-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Template title"
            />
          </div>
          <div>
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Template description"
            />
          </div>
          <div>
            <Label htmlFor="template-priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value as any }))}
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
            <Label htmlFor="template-project">Project</Label>
            <Input
              id="template-project"
              value={formData.project || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
              placeholder="Project name"
            />
          </div>
          <div>
            <Label htmlFor="template-tags">Tags (comma separated)</Label>
            <Input
              id="template-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? 'Saving...' : (template ? 'Update Template' : 'Create Template')}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};