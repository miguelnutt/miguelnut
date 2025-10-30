-- Add columns to support temporary profiles for prize delivery
-- This allows creating profiles for users who haven't logged in yet

ALTER TABLE public.profiles 
ADD COLUMN is_temporary BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN created_via TEXT;

-- Add index for better performance when querying temporary profiles
CREATE INDEX idx_profiles_is_temporary ON public.profiles(is_temporary) WHERE is_temporary = true;

-- Add comment to document the purpose
COMMENT ON COLUMN public.profiles.is_temporary IS 'Indicates if this profile was created temporarily for prize delivery before user login';
COMMENT ON COLUMN public.profiles.created_via IS 'Indicates how this profile was created (e.g., prize_delivery, normal_login)';