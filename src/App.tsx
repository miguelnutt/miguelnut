import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Games from "./pages/Games";
import Wheels from "./pages/Wheels";
import TibiaTermo from "./pages/TibiaTermo";
import AdminTibiaTermo from "./pages/AdminTibiaTermo";
import History from "./pages/History";
import Tickets from "./pages/Tickets";
import Login from "./pages/Login";
import AccountSettings from "./pages/AccountSettings";
import TwitchCallback from "./pages/TwitchCallback";
import SiteSettings from "./pages/SiteSettings";
import NotFound from "./pages/NotFound";
import { Footer } from "@/components/Footer";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="flex flex-col min-h-screen">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/games" element={<Games />} />
            <Route path="/wheels" element={<Wheels />} />
            <Route path="/tibiatermo" element={<TibiaTermo />} />
            <Route path="/tibiadle" element={<TibiaTermo />} /> {/* Redirect antigo */}
            <Route path="/admin/tibiatermo" element={<AdminTibiaTermo />} />
            <Route path="/history" element={<History />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<AccountSettings />} />
            <Route path="/settings" element={<SiteSettings />} />
            <Route path="/auth/twitch/callback" element={<TwitchCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
