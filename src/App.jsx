import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppProvider, useAppContext } from "./context/AppContext";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RankingPage from "./pages/RankingPage";
import SignupPage from "./pages/SignupPage";
import VacancyEditPage from "./pages/VacancyEditPage";
import VacancyFormPage from "./pages/VacancyFormPage";
import VacancyQuestionsPage from "./pages/VacancyQuestionsPage";

function HomeRedirect() {
  const { isAuthenticated } = useAppContext();
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

function NotFoundRedirect() {
  const { isAuthenticated } = useAppContext();
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route
                path="/applications/:applicationId"
                element={<ApplicationDetailPage />}
              />
              <Route path="/vacancies/new" element={<VacancyFormPage />} />
              <Route path="/vacancies/:vacancyId/edit" element={<VacancyEditPage />} />
              <Route
                path="/vacancies/:vacancyId/questions"
                element={<VacancyQuestionsPage />}
              />
            </Route>

            <Route path="*" element={<NotFoundRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
