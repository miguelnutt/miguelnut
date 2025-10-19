import { Moon, Sun, LogOut, User, Settings as SettingsIcon, Menu, X, Gift, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import profileImage from "@/assets/profile-miguelnut.png";
import { useTwitchStatus } from "@/contexts/TwitchStatusContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserBadge } from "@/components/UserBadge";
import { TwitchLoginButton } from "@/components/TwitchLoginButton";
import { DailyRewardDialog } from "@/components/DailyRewardDialog";
import { AdminRubiniCoinsResgatesButton } from "@/components/admin/AdminRubiniCoinsResgatesButton";
import { useDailyRewardStatus } from "@/hooks/useDailyRewardStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminConsolePanel } from "@/components/AdminConsolePanel";
import { Loader2 } from "lucide-react";

export const Navbar = () => {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dailyRewardOpen, setDailyRewardOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const { isLive, loading: liveLoading } = useTwitchStatus();
  const { status, sessionUserId, twitchUser, isAdmin, logout } = useAuth();
  
  // Verificar status da recompensa diária - só quando auth estiver pronta
  const { hasRewardAvailable } = useDailyRewardStatus(
    status === 'ready' ? twitchUser?.login : undefined
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleOpenAdminPanel = () => {
    if (status !== 'ready') {
      return; // Não abre se não estiver pronto
    }
    if (!isAdmin) {
      return; // Só admin pode abrir
    }
    setAdminPanelOpen(true);
  };

  // Renderizar skeleton enquanto carrega
  const renderAuthSection = () => {
    if (status === 'loading') {
      return (
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      );
    }

    if (status === 'ready' && twitchUser) {
      return (
        <>
          <UserBadge user={twitchUser} onLogout={() => logout()} />
          {isAdmin && (
            <>
              <AdminRubiniCoinsResgatesButton />
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenAdminPanel}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                title="Console de Administração"
              >
                <Shield className="mr-2 h-4 w-4" />
                Console Admin
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDailyRewardOpen(true)}
            className="rounded-full relative"
            title="Recompensa Diária"
          >
            <Gift className="h-5 w-5" />
            {hasRewardAvailable && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                1
              </span>
            )}
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
      );
    }

    if (status === 'ready' && sessionUserId) {
      return (
        <>
          {isAdmin && (
            <>
              <AdminRubiniCoinsResgatesButton />
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenAdminPanel}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                title="Console de Administração"
              >
                <Shield className="mr-2 h-4 w-4" />
                Console Admin
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/account")}
            className="rounded-full"
            title="Configurações da Conta"
          >
            <SettingsIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="rounded-full"
            title="Sair (Admin)"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </>
      );
    }

    return (
      <Button 
        onClick={() => navigate("/login")}
        className="bg-gradient-primary"
      >
        Login
      </Button>
    );
  };

  return (
    <>
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
              <Link to="/" className="text-sm font-medium transition-colors hover:text-primary">Início</Link>
              <Link to="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">Dashboard</Link>
              <Link to="/games" className="text-sm font-medium transition-colors hover:text-primary">Jogos</Link>
              <Link to="/history" className="text-sm font-medium transition-colors hover:text-primary">Histórico</Link>
              <Link to="/tickets" className="text-sm font-medium transition-colors hover:text-primary">Tickets</Link>

              <div className="flex items-center gap-2 border-l border-border pl-6">
                <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
                  {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>
                {renderAuthSection()}
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-full">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col gap-4">
                <Link to="/" className="text-sm font-medium px-2 py-1" onClick={() => setMobileMenuOpen(false)}>Início</Link>
                <Link to="/dashboard" className="text-sm font-medium px-2 py-1" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
                <Link to="/games" className="text-sm font-medium px-2 py-1" onClick={() => setMobileMenuOpen(false)}>Jogos</Link>
                <Link to="/history" className="text-sm font-medium px-2 py-1" onClick={() => setMobileMenuOpen(false)}>Histórico</Link>
                <Link to="/tickets" className="text-sm font-medium px-2 py-1" onClick={() => setMobileMenuOpen(false)}>Tickets</Link>
                <div className="border-t pt-4">{renderAuthSection()}</div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Admin Panel Dialog */}
      <Dialog open={adminPanelOpen} onOpenChange={setAdminPanelOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" />
              Console de Administração
            </DialogTitle>
          </DialogHeader>
          <AdminConsolePanel />
        </DialogContent>
      </Dialog>

      {/* Daily Reward Dialog */}
      {status === 'ready' && twitchUser && (
        <DailyRewardDialog
          open={dailyRewardOpen}
          onOpenChange={setDailyRewardOpen}
        />
      )}
    </>
  );
};
