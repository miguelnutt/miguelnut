-- Add duracao_spin column to wheels table
ALTER TABLE public.wheels
ADD COLUMN duracao_spin integer NOT NULL DEFAULT 4;