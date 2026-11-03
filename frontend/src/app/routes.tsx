import { createBrowserRouter } from 'react-router';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { SecurityLayout } from './components/layout/SecurityLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { Dashboard } from './pages/security/Dashboard';
import { Profile } from './pages/shared/Profile';
import { Alerts } from './pages/security/Alerts';
import { AlertDetails } from './pages/security/AlertDetails';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAlerts } from './pages/admin/AdminAlerts';
import { AdminDevices } from './pages/admin/AdminDevices';
import { AdminDeviceDetail } from './pages/admin/AdminDeviceDetail';
import { AdminLogs } from './pages/admin/AdminLogs';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminAnalytics } from './pages/admin/AdminAnalytics';
import { AdminSettings } from './pages/admin/AdminSettings';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/signup',
    Component: Signup,
  },
  {
    path: '/',
    element: <ProtectedRoute requiredRole="security" />,
    children: [
      {
        Component: SecurityLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: 'alerts', Component: Alerts },
          { path: 'alerts/:id', Component: AlertDetails },
          { path: 'profile', Component: Profile },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <ProtectedRoute requiredRole="admin" />,
    children: [
      {
        Component: AdminLayout,
        children: [
          { index: true, Component: AdminDashboard },
          { path: 'alerts', Component: AdminAlerts },
          { path: 'devices', Component: AdminDevices },
          { path: 'devices/:id', Component: AdminDeviceDetail },
          { path: 'users', Component: AdminUsers },
          { path: 'settings', Component: AdminSettings },
          { path: 'logs', Component: AdminLogs },
          { path: 'analytics', Component: AdminAnalytics },
          { path: 'profile', Component: Profile },
        ],
      },
    ],
  },
]);