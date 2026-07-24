import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { AppProvider, useAppContext } from "./context/AppContext";
import AdminPage from "./pages/AdminPage";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import CompanyInfoPage from "./pages/CompanyInfoPage";
import ConversationFlowPage from "./pages/ConversationFlowPage";
import ConversationsPage from "./pages/ConversationsPage";
import CvImportsPage from "./pages/CvImportsPage";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import RankingPage from "./pages/RankingPage";
import SignupPage from "./pages/SignupPage";
import TenantQuestionsPage from "./pages/TenantQuestionsPage";
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

// Rutas reservadas al administrador general (rol company → dashboard).
function SuperadminRoute() {
  const { isSuperadmin } = useAppContext();
  return isSuperadmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
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
              <Route path="/cv-imports" element={<CvImportsPage />} />
              <Route path="/applications/:applicationId" element={<ApplicationDetailPage />} />
              <Route path="/vacancies/new" element={<VacancyFormPage />} />
              <Route path="/vacancies/:vacancyId/edit" element={<VacancyEditPage />} />
              <Route path="/vacancies/:vacancyId/questions" element={<VacancyQuestionsPage />} />
              <Route path="/tenant-questions" element={<TenantQuestionsPage />} />
              <Route element={<SuperadminRoute />}>
                <Route path="/conversation-flow" element={<ConversationFlowPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>
              <Route path="/company-info" element={<CompanyInfoPage />} />
              <Route path="/conversations" element={<ConversationsPage />} />
            </Route>

            <Route path="*" element={<NotFoundRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
