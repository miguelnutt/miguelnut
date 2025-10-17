import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Wheels from "./pages/Wheels";
import History from "./pages/History";
import Tickets from "./pages/Tickets";
import Login from "./pages/Login";
import AccountSettings from "./pages/AccountSettings";
import SetupTwitch from "./pages/SetupTwitch";
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/wheels" element={<Wheels />} />
            <Route path="/history" element={<History />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<AccountSettings />} />
            <Route path="/setup-twitch" element={<SetupTwitch />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
