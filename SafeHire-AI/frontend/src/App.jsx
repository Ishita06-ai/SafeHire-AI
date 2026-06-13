import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import { setCredentials, setLoading } from "./app/store/authSlice";
import { authApi } from "./services/api/auth.api";

function AppContent() {
  const dispatch   = useDispatch();
  const hasChecked = useRef(false); // ← prevents double call in dev strict mode

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    const checkSession = async () => {
      try {
        const { data } = await authApi.refresh();
        const accessToken = data.data.accessToken;
        const { data: meData } = await authApi.getMe();
        dispatch(setCredentials({
          user:        meData.data,
          accessToken,
        }));
      } catch {
        dispatch(setLoading(false));
      }
    };

    checkSession();
  }, [dispatch]);

  return <AppRouter />;
}

export default function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}