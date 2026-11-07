import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState, FeedbackProvider, PageLoading } from '@/components/ui';
import type { Permission } from '@/types/domain';
import { AppProvider, AuthProvider, useAuth } from './providers';
import { Shell } from './Shell';

const Landing = lazy(() => import('@/pages/public/Landing'));
const Login = lazy(() => import('@/pages/public/Login'));
const GuestReview = lazy(() => import('@/pages/public/GuestReview'));
const GuestRegister = lazy(() => import('@/pages/public/GuestRegister'));
const loadDashboard = () => import('@/pages/Dashboard');
const loadQuickActions = () => import('@/pages/QuickActions');
const loadFrontDesk = () => import('@/pages/FrontDesk');
const loadReservations = () => import('@/pages/Reservations');
const loadRooms = () => import('@/pages/Rooms');
const loadGuests = () => import('@/pages/Guests');
const loadHousekeeping = () => import('@/pages/Housekeeping');
const loadRestaurant = () => import('@/pages/Restaurant');
const loadBilling = () => import('@/pages/Billing');
const loadStaff = () => import('@/pages/Staff');
const loadReports = () => import('@/pages/Reports');
const loadSettings = () => import('@/pages/Settings');
const loadStayed = () => import('@/pages/customers/Stayed');
const loadLeads = () => import('@/pages/customers/Leads');
const loadTemplates = () => import('@/pages/customers/Templates');
const loadAiOverview = () => import('@/pages/ai/Overview');
const loadAiSmartPricing = () => import('@/pages/ai/SmartPricing');
const loadAiGuestTiming = () => import('@/pages/ai/GuestTiming');
const loadAiGuestInsights = () => import('@/pages/ai/GuestInsights');
const loadAiOccupancyForecast = () => import('@/pages/ai/OccupancyForecast');
const loadAiReviewIntelligence = () => import('@/pages/ai/ReviewIntelligence');
const loadAiStaffPlanner = () => import('@/pages/ai/StaffPlanner');
const loadAiRevenueInsights = () => import('@/pages/ai/RevenueInsights');

const Dashboard = lazy(loadDashboard);
const QuickActions = lazy(loadQuickActions);
const FrontDesk = lazy(loadFrontDesk);
const Reservations = lazy(loadReservations);
const Rooms = lazy(loadRooms);
const Guests = lazy(loadGuests);
const Housekeeping = lazy(loadHousekeeping);
const Restaurant = lazy(loadRestaurant);
const Billing = lazy(loadBilling);
const Staff = lazy(loadStaff);
const Reports = lazy(loadReports);
const Settings = lazy(loadSettings);
const Stayed = lazy(loadStayed);
const Leads = lazy(loadLeads);
const Templates = lazy(loadTemplates);
const BookingLink = lazy(() => import('@/pages/public/BookingLink'));
const AiOverview = lazy(loadAiOverview);
const AiSmartPricing = lazy(loadAiSmartPricing);
const AiGuestTiming = lazy(loadAiGuestTiming);
const AiGuestInsights = lazy(loadAiGuestInsights);
const AiOccupancyForecast = lazy(loadAiOccupancyForecast);
const AiReviewIntelligence = lazy(loadAiReviewIntelligence);
const AiStaffPlanner = lazy(loadAiStaffPlanner);
const AiRevenueInsights = lazy(loadAiRevenueInsights);

const APP_PAGES = [loadDashboard, loadQuickActions, loadFrontDesk, loadReservations, loadRooms, loadGuests, loadHousekeeping, loadRestaurant, loadBilling, loadStaff, loadReports, loadSettings, loadStayed, loadLeads, loadTemplates, loadAiOverview, loadAiSmartPricing, loadAiGuestTiming, loadAiGuestInsights, loadAiOccupancyForecast, loadAiReviewIntelligence, loadAiStaffPlanner, loadAiRevenueInsights];

/** Fetches every screen shortly after sign-in, so moving between pages never shows a loader. */
function usePreloadPages() {
  useEffect(() => {
    const timer = window.setTimeout(() => APP_PAGES.forEach((load) => void load()), 800);
    return () => window.clearTimeout(timer);
  }, []);
}

function RequireAuth() {
  const { user, ready } = useAuth();
  const location = useLocation();
  usePreloadPages();
  // Index.html darkens /app for a saved dark theme; a visitor being sent to sign in should not keep that.
  useEffect(() => {
    if (ready && !user) delete document.documentElement.dataset.boot;
  }, [ready, user]);
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Shell><Suspense fallback={<PageLoading />}><Outlet /></Suspense></Shell>;
}

function Guard({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can, role } = useAuth();
  if (can(permission)) return <>{children}</>;
  return (
    <div className="panel">
      <EmptyState
        icon="key"
        title="Not part of this role"
        message={`${role?.name ?? 'This role'} does not have access to this module. Switch to another demo role from the account menu to see it.`}
        action={<Link className="btn" to="/app/dashboard">Back to dashboard</Link>}
      />
    </div>
  );
}

function NotFound() {
  return (
    <div className="site" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <EmptyState
        icon="key"
        title="This door does not lead anywhere"
        message="The page you were looking for does not exist."
        action={<Link className="btn btn-primary" to="/">Back to the hotel</Link>}
      />
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <FeedbackProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/review/:token" element={<GuestReview />} />
              <Route path="/register/:token" element={<GuestRegister />} />
              <Route path="/book/:token" element={<BookingLink />} />
              <Route path="/app" element={<RequireAuth />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="quick-actions" element={<Guard permission="quickactions.view"><QuickActions /></Guard>} />
                <Route path="ai" element={<Navigate to="overview" replace />} />
                <Route path="ai/overview" element={<Guard permission="reports.view"><AiOverview /></Guard>} />
                <Route path="ai/smart-pricing" element={<Guard permission="reports.view"><AiSmartPricing /></Guard>} />
                <Route path="ai/guest-timing" element={<Guard permission="reports.view"><AiGuestTiming /></Guard>} />
                <Route path="ai/guest-insights" element={<Guard permission="reports.view"><AiGuestInsights /></Guard>} />
                <Route path="ai/occupancy-forecast" element={<Guard permission="reports.view"><AiOccupancyForecast /></Guard>} />
                <Route path="ai/review-intelligence" element={<Guard permission="reports.view"><AiReviewIntelligence /></Guard>} />
                <Route path="ai/staff-planner" element={<Guard permission="reports.view"><AiStaffPlanner /></Guard>} />
                <Route path="ai/revenue-insights" element={<Guard permission="reports.view"><AiRevenueInsights /></Guard>} />
                <Route path="customers" element={<Navigate to="stayed" replace />} />
                <Route path="customers/stayed" element={<Guard permission="customers.view"><Stayed /></Guard>} />
                <Route path="customers/leads" element={<Guard permission="customers.view"><Leads /></Guard>} />
                <Route path="customers/templates" element={<Guard permission="customers.view"><Templates /></Guard>} />
                <Route path="front-desk" element={<Guard permission="frontdesk.use"><FrontDesk /></Guard>} />
                <Route path="reservations" element={<Guard permission="reservations.view"><Reservations /></Guard>} />
                <Route path="rooms" element={<Guard permission="rooms.view"><Rooms /></Guard>} />
                <Route path="guests" element={<Guard permission="guests.view"><Guests /></Guard>} />
                <Route path="housekeeping" element={<Guard permission="housekeeping.view"><Housekeeping /></Guard>} />
                <Route path="restaurant" element={<Guard permission="restaurant.use"><Restaurant /></Guard>} />
                <Route path="billing" element={<Guard permission="billing.use"><Billing /></Guard>} />
                <Route path="staff" element={<Guard permission="staff.view"><Staff /></Guard>} />
                <Route path="reports" element={<Guard permission="reports.view"><Reports /></Guard>} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </FeedbackProvider>
      </AuthProvider>
    </AppProvider>
  );
}
