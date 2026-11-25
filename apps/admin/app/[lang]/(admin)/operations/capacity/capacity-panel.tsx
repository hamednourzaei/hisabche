'use client'

import { useTranslations } from 'next-intl'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from '@/components/ui'
import {
  useCapacityDiscovery,
  useCapacityHistory,
  useCapacitySummary,
} from '@/hooks/use-admin-capacity'
import { UNKNOWN_VALUE } from '@/lib/admin-format'

export function CapacityPanel() {
  const t = useTranslations()
  const discovery = useCapacityDiscovery()
  const summary = useCapacitySummary('mixed_production', 2)
  const history = useCapacityHistory()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.operations.capacity.measuredTitle')}</CardTitle>
            <CardDescription>{t('admin.operations.capacity.measuredDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {summary.data?.measuredCapacity ?? UNKNOWN_VALUE}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.operations.capacity.safeTitle')}</CardTitle>
            <CardDescription>{t('admin.operations.capacity.safeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">
                {summary.data?.safeCapacity ?? UNKNOWN_VALUE}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.operations.capacity.projectedTitle')}</CardTitle>
            <CardDescription>{t('admin.operations.capacity.projectedDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {summary.data?.projectedCapacity ?? UNKNOWN_VALUE}
                </span>
                <Badge variant="outline">{t('admin.operations.capacity.simulationOnly')}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.operations.capacity.discoveryTitle')}</CardTitle>
          <CardDescription>{t('admin.operations.capacity.discoveryDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {discovery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : discovery.data ? (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-muted-foreground">{t('admin.operations.capacity.rss')}</div>
                <div className="font-medium">{discovery.data.processRssMb} MB</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('admin.operations.capacity.heap')}</div>
                <div className="font-medium">{discovery.data.processHeapUsedMb} MB</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t('admin.operations.capacity.eventLoop')}
                </div>
                <div className="font-medium">{discovery.data.eventLoopDelayMs} ms</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t('admin.operations.capacity.logicalCpus')}
                </div>
                <div className="font-medium">{discovery.data.logicalCpuCount}</div>
              </div>
            </div>
          ) : (
            <EmptyState title={t('admin.operations.capacity.noDiscovery')} />
          )}

          {discovery.data?.unavailableTelemetry.length ? (
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              <div className="mb-1 font-medium">
                {t('admin.operations.capacity.unavailableTitle')}
              </div>
              <ul className="list-disc ps-4">
                {discovery.data.unavailableTelemetry.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.operations.capacity.historyTitle')}</CardTitle>
          <CardDescription>{t('admin.operations.capacity.historyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !history.data?.runs.length ? (
            <EmptyState title={t('admin.operations.capacity.noBenchmarks')} />
          ) : (
            <div className="space-y-2 text-sm">
              {history.data.runs.map((run) => (
                <div
                  key={run.runId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <div className="font-medium">{run.suiteId}</div>
                    <div className="text-xs text-muted-foreground">
                      {run.environment} · {run.workloadProfile} · {run.gitRevision}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span>Concurrency: {run.maxStableConcurrency}</span>
                    <span>P95: {run.p95Ms}ms</span>
                    <Badge variant={run.status === 'COMPLETED' ? 'default' : 'destructive'}>
                      {run.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
