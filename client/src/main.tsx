import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route, Router as WouterRouter } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import { Loader2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";

function AppContent() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#2C3E50]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }
  
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route>
        <div className="min-h-screen bg-[#2C3E50] flex items-center justify-center text-white">
          404 Page Not Found
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <StrictMode>
      <WouterRouter>
        <QueryClientProvider client={queryClient}>
          <AppContent />
          <Toaster />
        </QueryClientProvider>
      </WouterRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
