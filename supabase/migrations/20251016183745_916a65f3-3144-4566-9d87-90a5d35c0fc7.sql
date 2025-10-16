-- Add ordem column to wheels table
ALTER TABLE public.wheels 
ADD COLUMN ordem INTEGER DEFAULT 0;

-- Update existing wheels with sequential ordem values
WITH numbered_wheels AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) - 1 as row_num
  FROM public.wheels
  WHERE ativa = true
)
UPDATE public.wheels 
SET ordem = numbered_wheels.row_num
FROM numbered_wheels
WHERE wheels.id = numbered_wheels.id;