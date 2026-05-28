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
import TechniciansPage from "@/pages/technicians";
import TechnicianDetailPage from "@/pages/technician-detail";
import WorkOrdersPage from "@/pages/work-orders";
import WorkOrderDetailPage from "@/pages/work-order-detail";
import AssetsPage from "@/pages/assets";
import AssetDetailPage from "@/pages/asset-detail";
import ContractsPage from "@/pages/contracts";
import ContractDetailPage from "@/pages/contract-detail";
import ReportsPage from "@/pages/reports";
import CalendarPage from "@/pages/calendar";
import PortalPage from "@/pages/portal";
import AdminPage from "@/pages/admin";
import PricingPage from "@/pages/pricing";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import RefundPage from "@/pages/refund";

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

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase();
  if (loading) return <Spinner />;
  if (!user) return <Redirect to="/login" />;
  if (adminEmail && user.email?.trim().toLowerCase() !== adminEmail) return <Redirect to="/dashboard" />;
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
      <Route path="/technicians/:id" component={() => <ProtectedRoute component={TechnicianDetailPage} />} />
      <Route path="/technicians" component={() => <ProtectedRoute component={TechniciansPage} />} />
      <Route path="/finance/:id" component={() => <ProtectedRoute component={FinanceDetailPage} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={FinancePage} />} />
      <Route path="/work-orders/:id" component={() => <ProtectedRoute component={WorkOrderDetailPage} />} />
      <Route path="/work-orders" component={() => <ProtectedRoute component={WorkOrdersPage} />} />
      <Route path="/assets/:id" component={() => <ProtectedRoute component={AssetDetailPage} />} />
      <Route path="/assets" component={() => <ProtectedRoute component={AssetsPage} />} />
      <Route path="/contracts/:id" component={() => <ProtectedRoute component={ContractDetailPage} />} />
      <Route path="/contracts" component={() => <ProtectedRoute component={ContractsPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/calendar" component={() => <ProtectedRoute component={CalendarPage} />} />
      <Route path="/portal/:invoiceId" component={PortalPage} />
      <Route path="/import" component={() => <ProtectedRoute component={ImportPage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/admin" component={() => <AdminRoute component={AdminPage} />} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund" component={RefundPage} />
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
