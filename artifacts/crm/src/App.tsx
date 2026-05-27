import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import InvoicesPage from "@/pages/invoices";
import InvoiceNewPage from "@/pages/invoice-new";
import InvoiceDetailPage from "@/pages/invoice-detail";
import QuotationsPage from "@/pages/quotations";
import QuotationNewPage from "@/pages/quotation-new";
import QuotationDetailPage from "@/pages/quotation-detail";
import InvoiceEditPage from "@/pages/invoice-edit";
import QuotationEditPage from "@/pages/quotation-edit";
import TasksPage from "@/pages/tasks";
import FinancePage from "@/pages/finance";
import FinanceDetailPage from "@/pages/finance-detail";
import SettingsPage from "@/pages/settings";
import ImportPage from "@/pages/import";

const queryClient = new QueryClient();

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (user) return <Redirect to="/dashboard" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
      <Route path="/signup" component={() => <PublicRoute component={SignupPage} />} />
      <Route path="/forgot-password" component={() => <PublicRoute component={ForgotPasswordPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/customers/:id" component={() => <ProtectedRoute component={CustomerDetailPage} />} />
      <Route path="/customers" component={() => <ProtectedRoute component={CustomersPage} />} />
      <Route path="/invoices/new" component={() => <ProtectedRoute component={InvoiceNewPage} />} />
      <Route path="/invoices/:id/edit" component={() => <ProtectedRoute component={InvoiceEditPage} />} />
      <Route path="/invoices/:id" component={() => <ProtectedRoute component={InvoiceDetailPage} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={InvoicesPage} />} />
      <Route path="/quotations/new" component={() => <ProtectedRoute component={QuotationNewPage} />} />
      <Route path="/quotations/:id/edit" component={() => <ProtectedRoute component={QuotationEditPage} />} />
      <Route path="/quotations/:id" component={() => <ProtectedRoute component={QuotationDetailPage} />} />
      <Route path="/quotations" component={() => <ProtectedRoute component={QuotationsPage} />} />
      <Route path="/tasks" component={() => <ProtectedRoute component={TasksPage} />} />
      <Route path="/finance/:id" component={() => <ProtectedRoute component={FinanceDetailPage} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={FinancePage} />} />
      <Route path="/import" component={() => <ProtectedRoute component={ImportPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
