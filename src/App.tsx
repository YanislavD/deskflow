import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/app-layout'
import { RequireAdmin } from '@/components/require-admin'
import { RequireAuth } from '@/components/require-auth'
import { RequireMembership } from '@/components/require-membership'
import { AdminPage } from '@/pages/admin-page'
import { LoginPage } from '@/pages/login-page'
import { NewTicketPage } from '@/pages/new-ticket-page'
import { OnboardingPage } from '@/pages/onboarding-page'
import { RegisterPage } from '@/pages/register-page'
import { TicketDetailPage } from '@/pages/ticket-detail-page'
import { TicketsPage } from '@/pages/tickets-page'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Ab hier nur angemeldet */}
      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Ab hier zusätzlich: nur mit Firma */}
        <Route element={<RequireMembership />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<NewTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

export default App
