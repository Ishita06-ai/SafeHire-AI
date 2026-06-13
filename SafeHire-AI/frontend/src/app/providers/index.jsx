import { Provider as ReduxProvider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { store } from "../store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function AppProviders({ children }) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#111118",
                color: "#fff",
                border: "1px solid #22222f",
                borderRadius: "10px",
              },
              success: { iconTheme: { primary: "#22c55e", secondary: "#111118" } },
              error: { iconTheme: { primary: "#ef4444", secondary: "#111118" } },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </ReduxProvider>
  );
}