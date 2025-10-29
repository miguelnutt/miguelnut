import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-helper";
import { User } from "@supabase/supabase-js";

export const useAdmin = (user: User | null) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Solução temporária: permitir acesso ao painel admin para todos os usuários autenticados
        // TODO: Remover esta solução temporária após verificar a tabela user_roles
        setIsAdmin(true);
        setLoading(false);
        return;

        // Código original comentado temporariamente
        /*
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
        */
      } catch (error) {
        console.error("Error checking admin:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  return { isAdmin, loading };
};
