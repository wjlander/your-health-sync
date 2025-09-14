import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  event_id?: string;
  is_health_related: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface EditCalendarEventFormProps {
  event: CalendarEvent;
  onSave: (eventId: string, data: any) => void;
  onCancel: () => void;
}

export const EditCalendarEventForm: React.FC<EditCalendarEventFormProps> = ({ 
  event, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || '',
    start_time: new Date(event.start_time).toISOString().slice(0, 16),
    end_time: new Date(event.end_time).toISOString().slice(0, 16),
  });

  const handleSave = () => {
    const updatedData = {
      title: formData.title,
      description: formData.description,
      startTime: new Date(formData.start_time).toISOString(),
      endTime: new Date(formData.end_time).toISOString(),
    };
    onSave(event.event_id!, updatedData);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="edit-event-title">Title *</Label>
        <Input
          id="edit-event-title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Event title"
        />
      </div>
      
      <div>
        <Label htmlFor="edit-event-description">Description</Label>
        <Textarea
          id="edit-event-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Event description"
          rows={3}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-event-start">Start Time *</Label>
          <Input
            id="edit-event-start"
            type="datetime-local"
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
          />
        </div>
        
        <div>
          <Label htmlFor="edit-event-end">End Time *</Label>
          <Input
            id="edit-event-end"
            type="datetime-local"
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
          />
        </div>
      </div>
      
      <div className="flex space-x-2">
        <Button 
          onClick={handleSave} 
          className="flex-1" 
          disabled={!formData.title.trim() || !formData.start_time || !formData.end_time}
        >
          Update Event
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};