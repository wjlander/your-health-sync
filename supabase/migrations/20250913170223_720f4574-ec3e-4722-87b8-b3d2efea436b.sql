-- Create task_templates table for reusable task templates
CREATE TABLE public.task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  project TEXT,
  tags TEXT[],
  created_by UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for task templates
CREATE POLICY "Users can view all task templates" 
ON public.task_templates 
FOR SELECT 
TO authenticated
USING (is_active = true);

CREATE POLICY "Users can create their own task templates" 
ON public.task_templates 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own task templates" 
ON public.task_templates 
FOR UPDATE 
TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own task templates" 
ON public.task_templates 
FOR DELETE 
TO authenticated
USING (auth.uid() = created_by);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_task_templates_updated_at
BEFORE UPDATE ON public.task_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();