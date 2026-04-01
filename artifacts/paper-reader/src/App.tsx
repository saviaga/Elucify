import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/Home";
import PaperView from "./pages/PaperView";
import { ApiKeyContext, useApiKeyProvider } from "@/hooks/use-api-key";

// Configure query client with aggressive caching for sections
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60, // 1 hour
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/papers/:id" component={PaperView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const value = useApiKeyProvider();
  return <ApiKeyContext.Provider value={value}>{children}</ApiKeyContext.Provider>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiKeyProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ApiKeyProvider>
    </QueryClientProvider>
  );
}

export default App;
