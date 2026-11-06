import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { RequireOwner } from './RequireOwner'
import { AppShell } from '../components/AppShell'
import { LoadingState } from '../components/States'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'

// Everything except sign-in and the dashboard loads on demand, so the first page stays small.
const PublicLayout = lazy(() => import('../pages/public/PublicLayout').then((m) => ({ default: m.PublicLayout })))
const PublicCollectionPage = lazy(() => import('../pages/public/PublicCollectionPage').then((m) => ({ default: m.PublicCollectionPage })))
const PublicWantlistPage = lazy(() => import('../pages/public/PublicWantlistPage').then((m) => ({ default: m.PublicWantlistPage })))
const PublicJournalPage = lazy(() => import('../pages/public/PublicJournalPage').then((m) => ({ default: m.PublicJournalPage })))
const PublicGearPage = lazy(() => import('../pages/public/PublicGearPage').then((m) => ({ default: m.PublicGearPage })))
const PublicMapPage = lazy(() => import('../pages/public/PublicMapPage').then((m) => ({ default: m.PublicMapPage })))
const PublicStatsPage = lazy(() => import('../pages/public/PublicStatsPage').then((m) => ({ default: m.PublicStatsPage })))
const CollectionPage = lazy(() => import('../pages/CollectionPage').then((m) => ({ default: m.CollectionPage })))
const AddAlbumPage = lazy(() => import('../pages/AddAlbumPage').then((m) => ({ default: m.AddAlbumPage })))
const AlbumDetailPage = lazy(() => import('../pages/AlbumDetailPage').then((m) => ({ default: m.AlbumDetailPage })))
const WantlistPage = lazy(() => import('../pages/WantlistPage').then((m) => ({ default: m.WantlistPage })))
const JournalPage = lazy(() => import('../pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const MapPage = lazy(() => import('../pages/MapPage').then((m) => ({ default: m.MapPage })))
const GearPage = lazy(() => import('../pages/GearPage').then((m) => ({ default: m.GearPage })))
const StatisticsPage = lazy(() => import('../pages/StatisticsPage').then((m) => ({ default: m.StatisticsPage })))
const AdminPage = lazy(() => import('../pages/AdminPage').then((m) => ({ default: m.AdminPage })))
const DataPage = lazy(() => import('../pages/DataPage').then((m) => ({ default: m.DataPage })))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const publicRoutes = (
  <>
    <Route index element={<PublicCollectionPage />} />
    <Route path="wantlist" element={<PublicWantlistPage />} />
    <Route path="journal" element={<PublicJournalPage />} />
    <Route path="gear" element={<PublicGearPage />} />
    <Route path="map" element={<PublicMapPage />} />
    <Route path="stats" element={<PublicStatsPage />} />
  </>
)

/**
 * HashRouter keeps deep links working on GitHub Pages (no server-side rewrites).
 *   /view, /public/:id   read-only, no sign-in
 *   /login               owner sign-in
 *   everything else      owner only; signed-out visitors are sent to /view
 */
export function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<div className="p-8"><LoadingState label="Loading" /></div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/view" element={<PublicLayout />}>{publicRoutes}</Route>
            <Route path="/public/:shareId" element={<PublicLayout />}>{publicRoutes}</Route>
            <Route path="/sharing" element={<Navigate to="/admin" replace />} />
            <Route element={<RequireOwner />}>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="collection" element={<CollectionPage />} />
                <Route path="collection/add" element={<AddAlbumPage />} />
                <Route path="collection/:albumId" element={<AlbumDetailPage />} />
                <Route path="wantlist" element={<WantlistPage />} />
                <Route path="map" element={<MapPage />} />
                <Route path="gear" element={<GearPage />} />
                <Route path="statistics" element={<StatisticsPage />} />
                <Route path="journal" element={<JournalPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="data" element={<DataPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  )
}
