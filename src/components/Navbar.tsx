import { Moon, Sun, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";
import { Session } from "@supabase/supabase-js";
import profileImage from "@/assets/profile-miguelnut.png";
import { useTwitchStatus } from "@/hooks/useTwitchStatus";

export const Navbar = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [session, setSession] = useState<Session | null>(null);
  const { isLive, loading: liveLoading } = useTwitchStatus();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg">
      <div className="container mx-auto px-4">
        <div className="flex h-24 items-center justify-between">
          <div className="flex items-center gap-3">
            <a 
              href="https://www.twitch.tv/miguelnutt" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <div className="flex flex-col items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                <img 
                  src={profileImage} 
                  alt="Miguelnut Tibiano" 
                  className={`h-16 w-16 rounded-full object-cover ring-4 transition-all ${
                    !liveLoading && isLive 
                      ? 'ring-red-500 animate-pulse-glow' 
                      : 'ring-gray-400'
                  }`}
                />
                {!liveLoading && (
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    isLive ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {isLive ? 'Ao vivo' : 'Offline'}
                  </span>
                )}
              </div>
            </a>
            <Link to="/">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-gradient-shift cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundSize: '200% 200%', filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25))' }}>
                Miguelnut Tibiano
              </span>
            </Link>
          </div>


          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link
              to="/wheels"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Roletas
            </Link>
            <Link
              to="/history"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Histórico
            </Link>
            <Link
              to="/tickets"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Tickets
            </Link>

            <div className="flex items-center gap-2 border-l border-border pl-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-full"
              >
                {theme === "light" ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>

              {session ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    className="rounded-full"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => navigate("/login")} variant="default">
                  Login Admin
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
