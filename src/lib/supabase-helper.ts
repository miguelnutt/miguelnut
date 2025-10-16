import { supabase as supabaseClient } from "@/integrations/supabase/client";

// Helper type-safe wrapper until Supabase types are regenerated
export const supabase = supabaseClient as any;
