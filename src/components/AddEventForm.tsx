import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AddEventFormProps {
  onSave: (eventData: any) => void;
  onCancel: () => void;
}

export const AddEventForm: React.FC<AddEventFormProps> = ({ onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    all_day: false
  });

  const handleSave = () => {
    if (!formData.title.trim()) return;
    
    const eventData = {
      ...formData,
      start_datetime: formData.all_day ? 
        formData.start_date + 'T00:00:00' : 
        formData.start_date,
      end_datetime: formData.all_day ? 
        formData.end_date + 'T23:59:59' : 
        formData.end_date
    };
    
    onSave(eventData);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="event-title">Title *</Label>
        <Input
          id="event-title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Event title"
        />
      </div>
      <div>
        <Label htmlFor="event-description">Description</Label>
        <Textarea
          id="event-description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Event description"
        />
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="all-day"
          checked={formData.all_day}
          onChange={(e) => setFormData(prev => ({ ...prev, all_day: e.target.checked }))}
        />
        <Label htmlFor="all-day">All day event</Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-date">Start {formData.all_day ? 'Date' : 'Date & Time'}</Label>
          <Input
            id="start-date"
            type={formData.all_day ? 'date' : 'datetime-local'}
            value={formData.start_date}
            onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="end-date">End {formData.all_day ? 'Date' : 'Date & Time'}</Label>
          <Input
            id="end-date"
            type={formData.all_day ? 'date' : 'datetime-local'}
            value={formData.end_date}
            onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex space-x-2">
        <Button onClick={handleSave} className="flex-1" disabled={!formData.title.trim()}>
          Add Event
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};