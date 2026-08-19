import { Suspense } from "react"
import {
  getResearcherOverview,
  getScoreDistribution,
  getMasteryByMapel,
  getLearningTrend,
  getAgentPerformance,
  getWarningStats,
  getDropoutRisk,
} from "./actions"
import { ResearcherDashboard } from "../_components/researcher-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

function SkeletonPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-80 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}

async function Content() {
  const [overview, scoreDistribution, masteryByMapel, learningTrend, agentPerformance, warningStats, dropoutRisk] =
    await Promise.all([
      getResearcherOverview(),
      getScoreDistribution(),
      getMasteryByMapel(),
      getLearningTrend(),
      getAgentPerformance(),
      getWarningStats(),
      getDropoutRisk(),
    ])

  return (
    <ResearcherDashboard
      overview={overview}
      scoreDistribution={scoreDistribution}
      masteryByMapel={masteryByMapel}
      learningTrend={learningTrend}
      agentPerformance={agentPerformance}
      warningStats={warningStats}
      dropoutRisk={dropoutRisk}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <Content />
    </Suspense>
  )
}
