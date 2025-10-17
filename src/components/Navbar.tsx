import { Moon, Sun, LogOut, User, Settings as SettingsIcon, Menu, X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-helper";
import { Session } from "@supabase/supabase-js";
import profileImage from "@/assets/profile-miguelnut.png";
import { useTwitchStatus } from "@/hooks/useTwitchStatus";
import { useAdmin } from "@/hooks/useAdmin";
import { useTwitchAuth } from "@/hooks/useTwitchAuth";
import { UserBadge, UserBadgeLoading } from "@/components/UserBadge";
import { TwitchLoginButton } from "@/components/TwitchLoginButton";
import { DailyRewardDialog } from "@/components/DailyRewardDialog";

export const Navbar = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [session, setSession] = useState<Session | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dailyRewardOpen, setDailyRewardOpen] = useState(false);
  const { isLive, loading: liveLoading } = useTwitchStatus();
  const { isAdmin } = useAdmin(session?.user ?? null);
  const { user: twitchUser, loading: twitchLoading, logout: twitchLogout } = useTwitchAuth();

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
        <div className="flex h-16 md:h-24 items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <a 
              href="https://www.twitch.tv/miguelnutt" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <div className="flex flex-col items-center gap-1 md:gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                <img 
                  src={profileImage} 
                  alt="Miguelnut Tibiano" 
                  className={`h-10 w-10 md:h-16 md:w-16 rounded-full object-cover ring-2 md:ring-4 transition-all ${
                    !liveLoading && isLive 
                      ? 'ring-red-500 animate-pulse-glow' 
                      : 'ring-gray-400'
                  }`}
                />
                {!liveLoading && (
                  <span className={`text-[9px] md:text-[11px] font-bold uppercase tracking-wider ${
                    isLive ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {isLive ? 'Ao vivo' : 'Offline'}
                  </span>
                )}
              </div>
            </a>
            <Link to="/">
              <span className="text-[27px] md:text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-gradient-shift cursor-pointer hover:opacity-80 transition-opacity" style={{ backgroundSize: '200% 200%', filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25))' }}>
                Miguelnut
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Início
            </Link>
            <Link
              to="/dashboard"
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

              {twitchLoading ? (
                <UserBadgeLoading />
              ) : twitchUser ? (
                <>
                  <UserBadge user={twitchUser} onLogout={twitchLogout} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDailyRewardOpen(true)}
                    className="rounded-full"
                    title="Recompensa Diária"
                  >
                    <Gift className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/account")}
                    className="rounded-full"
                    title="Configurações da Conta"
                  >
                    <User className="h-5 w-5" />
                  </Button>
                </>
              ) : session ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/account")}
                  className="rounded-full"
                  title="Configurações da Conta"
                >
                  <SettingsIcon className="h-5 w-5" />
                </Button>
              ) : (
                <Button 
                  onClick={() => navigate("/login")}
                  className="bg-gradient-primary"
                >
                  Login
                </Button>
              )}

              {session && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="rounded-full"
                  title="Sair (Admin)"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-full"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
              <Link
                to="/"
                className="text-sm font-medium transition-colors hover:text-primary px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Início
              </Link>
              <Link
                to="/dashboard"
                className="text-sm font-medium transition-colors hover:text-primary px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                to="/wheels"
                className="text-sm font-medium transition-colors hover:text-primary px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Roletas
              </Link>
              <Link
                to="/history"
                className="text-sm font-medium transition-colors hover:text-primary px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Histórico
              </Link>
              <Link
                to="/tickets"
                className="text-sm font-medium transition-colors hover:text-primary px-2 py-1"
                onClick={() => setMobileMenuOpen(false)}
              >
                Tickets
              </Link>

              <div className="border-t border-border pt-4 flex flex-col gap-2">
                {twitchLoading ? (
                  <UserBadgeLoading />
                ) : twitchUser ? (
                  <div className="flex flex-col gap-2">
                    <UserBadge user={twitchUser} onLogout={twitchLogout} />
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDailyRewardOpen(true);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <Gift className="mr-2 h-4 w-4" />
                      Recompensa Diária
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate("/account");
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <User className="mr-2 h-4 w-4" />
                      Configurações da Conta
                    </Button>
                  </div>
                ) : session ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate("/account");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Configurações da Conta
                  </Button>
                ) : (
                  <Button 
                    onClick={() => {
                      navigate("/login");
                      setMobileMenuOpen(false);
                    }}
                    className="w-full bg-gradient-primary"
                  >
                    Login
                  </Button>
                )}

                {session && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair (Admin)
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <DailyRewardDialog open={dailyRewardOpen} onOpenChange={setDailyRewardOpen} />
    </nav>
  );
};
