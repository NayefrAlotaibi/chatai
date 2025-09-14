'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { fetcher } from '@/lib/utils';

type BankOverview = {
  totalCredits: number;
  totalDebits: number;
  netAmount: number;
  transactionsCount: number;
  latestBalance: number | null;
  currency: string;
};

export function DashboardOverviewCards() {
  const { data } = useSWR<BankOverview>('/api/bank/overview', fetcher);

  const credits = data?.totalCredits ?? 0;
  const debits = data?.totalDebits ?? 0;
  const net = data?.netAmount ?? 0;
  const balance = data?.latestBalance ?? 0;
  const ccy = data?.currency ?? 'USD';

  return (
    <div className="m-4 grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gross Revenue</CardTitle>
            <Badge variant="secondary">Bank</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{credits.toFixed(2)} {ccy}</div>
          <div className="text-muted-foreground text-xs">Across {data?.transactionsCount ?? 0} txns</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product Refunds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">-{debits.toFixed(2)} {ccy}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Net Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{net.toFixed(2)} {ccy}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance Due</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{balance.toFixed(2)} {ccy}</div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DashboardOverviewCards;


