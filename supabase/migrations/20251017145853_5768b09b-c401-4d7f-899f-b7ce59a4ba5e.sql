-- Add video_start_time column to site_settings table
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS video_start_time integer DEFAULT 0;