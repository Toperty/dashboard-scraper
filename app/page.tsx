import { MonitoringDashboard } from "@/components/monitoring-dashboard"
import { AuthGate } from "@/components/AuthGate"

export default function Page() {
  return (
    <AuthGate>
      <MonitoringDashboard />
    </AuthGate>
  )
}
