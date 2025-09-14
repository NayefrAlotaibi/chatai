'use client';

import { useUIMode } from '@/components/ui/ui-mode';
import { ReceiptsTable } from './receipts-table';
import { BankStatementTable } from './bank-statement-table';
import { ReceiptsImport } from './receipts-import';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import type { Receipt } from '@/lib/db/schema';
import { DashboardOverviewCards } from './dashboard-overview-cards';

export function DashboardOverlay() {
  const { mode, view } = useUIMode();

  if (mode !== 'dashboard') return null;

  return (
    <div className="w-full bg-background">
      <div className="mx-auto max-w-6xl py-6">
        {view === 'receipts' ? (
          <>
            <ReceiptsTable />
          </>
        ) : view === 'bank' ? (
          <>
            <ReceiptsImport />
            <BankStatementTable />
          </>
        ) : (
          <>
            <DashboardOverviewCards />
            <OverviewCards />
          </>
        )}
      </div>
    </div>
  );
}

function OverviewCards() {
  const { data } = useSWR<Array<Receipt>>('/api/receipts?limit=500', fetcher);
  const stats = useMemo(() => {
    const receipts = data || [];
    const total = receipts.reduce((s, r) => s + Number(r.total || 0), 0);
    const tax = receipts.reduce((s, r) => s + Number(r.tax || 0), 0);
    const tip = receipts.reduce((s, r) => s + Number(r.tip || 0), 0);
    const count = receipts.length;
    return { total, tax, tip, count };
  }, [data]);

  return (
    <div className="m-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Total Spent</CardTitle>
            <Badge variant="secondary">This year</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{stats.total.toFixed(2)}</div>
          <div className="text-muted-foreground text-xs">Across {stats.count} receipts</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tax</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{stats.tax.toFixed(2)}</div>
          <Progress value={Math.min(100, (stats.tax / (stats.total || 1)) * 100)} className="mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tip</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{stats.tip.toFixed(2)}</div>
          <Progress value={Math.min(100, (stats.tip / (stats.total || 1)) * 100)} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}


