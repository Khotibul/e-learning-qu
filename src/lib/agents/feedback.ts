import { prisma } from "@/lib/prisma"

export interface FeedbackInput {
  siswaId: string
  agentLogId?: string
  messageId?: string
  rating: number
  category?: string
  comment?: string
  helpful?: boolean
  accurate?: boolean
}

export interface QualityMetrics {
  agent: string
  period: string
  avgRating: number
  totalFeedback: number
  helpfulPct: number
  accuratePct: number
  avgResponseMs: number
  successRate: number
}

export async function submitFeedback(input: FeedbackInput) {
  const feedback = await prisma.agentFeedback.create({
    data: {
      siswaId: input.siswaId,
      agentLogId: input.agentLogId || null,
      messageId: input.messageId || null,
      rating: Math.max(1, Math.min(5, input.rating)),
      category: input.category || null,
      comment: input.comment || null,
      helpful: input.helpful ?? null,
      accurate: input.accurate ?? null,
    },
  })

  return feedback
}

export async function getAgentFeedback(agentLogId: string) {
  return prisma.agentFeedback.findMany({
    where: { agentLogId },
    orderBy: { createdAt: "desc" },
  })
}

export async function getMessageFeedback(messageId: string) {
  return prisma.agentFeedback.findFirst({
    where: { messageId },
  })
}

export async function computeQualityMetrics(agent: string, period: string): Promise<QualityMetrics> {
  const startDate = new Date()
  if (period === "daily") {
    startDate.setHours(0, 0, 0, 0)
  } else if (period === "weekly") {
    startDate.setDate(startDate.getDate() - 7)
  } else if (period === "monthly") {
    startDate.setMonth(startDate.getMonth() - 1)
  }

  const [feedbacks, logs] = await Promise.all([
    prisma.agentFeedback.findMany({
      where: {
        createdAt: { gte: startDate },
        agentLog: { agent },
      },
    }),
    prisma.agentLog.findMany({
      where: {
        createdAt: { gte: startDate },
        agent,
      },
    }),
  ])

  const avgRating = feedbacks.length > 0
    ? feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length
    : 0

  const helpfulCount = feedbacks.filter((f) => f.helpful === true).length
  const helpfulPct = feedbacks.length > 0 ? (helpfulCount / feedbacks.length) * 100 : 0

  const accurateCount = feedbacks.filter((f) => f.accurate === true).length
  const accuratePct = feedbacks.length > 0 ? (accurateCount / feedbacks.length) * 100 : 0

  const successLogs = logs.filter((l) => l.sukses)
  const successRate = logs.length > 0 ? (successLogs.length / logs.length) * 100 : 0

  const avgResponseMs = logs.length > 0
    ? logs.reduce((s, l) => s + (l.durasiMs || 0), 0) / logs.length
    : 0

  const metrics: QualityMetrics = {
    agent,
    period,
    avgRating: Math.round(avgRating * 100) / 100,
    totalFeedback: feedbacks.length,
    helpfulPct: Math.round(helpfulPct * 100) / 100,
    accuratePct: Math.round(accuratePct * 100) / 100,
    avgResponseMs: Math.round(avgResponseMs),
    successRate: Math.round(successRate * 100) / 100,
  }

  await prisma.agentQualityMetrics.upsert({
    where: { agent_period: { agent, period: `${period}-${startDate.toISOString().split("T")[0]}` } },
    create: {
      agent,
      period: `${period}-${startDate.toISOString().split("T")[0]}`,
      avgRating: metrics.avgRating,
      totalFeedback: metrics.totalFeedback,
      helpfulPct: metrics.helpfulPct,
      accuratePct: metrics.accuratePct,
      avgResponseMs: metrics.avgResponseMs,
      successRate: metrics.successRate,
      detail: feedbacks.slice(0, 20).map((f) => ({
        rating: f.rating,
        category: f.category,
        helpful: f.helpful,
        accurate: f.accurate,
        comment: f.comment?.slice(0, 100),
      })),
    },
    update: {
      avgRating: metrics.avgRating,
      totalFeedback: metrics.totalFeedback,
      helpfulPct: metrics.helpfulPct,
      accuratePct: metrics.accuratePct,
      avgResponseMs: metrics.avgResponseMs,
      successRate: metrics.successRate,
    },
  })

  return metrics
}

export async function getAllAgentMetrics(period: string) {
  const agents = ["tutor", "assessor", "recommender", "orchestrator"]
  const results = []

  for (const agent of agents) {
    const metrics = await computeQualityMetrics(agent, period)
    results.push(metrics)
  }

  return results
}

export async function getRecentFeedback(siswaId: string, limit = 20) {
  return prisma.agentFeedback.findMany({
    where: { siswaId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { agentLog: { select: { agent: true, query: true } } },
  })
}
