import { useAuth } from "@/contexts/AuthContext";
import { User } from "@supabase/supabase-js";

// Mantém a mesma assinatura para compatibilidade, mas usa AuthContext como fonte única de verdade
export const useAdmin = (_user: User | null) => {
  const { isAdmin, status } = useAuth();
  const loading = status === "loading";
  return { isAdmin, loading };
};
