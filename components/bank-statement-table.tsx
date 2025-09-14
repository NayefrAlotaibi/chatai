'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import type { Receipt } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';

type Row = {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
};

export function BankStatementTable() {
  const { data, isLoading, error } = useSWR<Array<Receipt>>('/api/receipts?limit=500', fetcher);

  const rows: Row[] = (() => {
    const receipts = data || [];

    // Sort asc by date for running balances
    const sorted = [...receipts].sort((a, b) =>
      String(a.receiptDate).localeCompare(String(b.receiptDate)),
    );

    const balanceByCurrency: Record<string, number> = {};
    return sorted.map((r) => {
      const amount = Number(r.total || 0);
      const currency = r.currency || 'USD';
      if (balanceByCurrency[currency] === undefined) balanceByCurrency[currency] = 0;
      balanceByCurrency[currency] += amount;
      return {
        date: String(r.receiptDate || ''),
        description: r.merchantName,
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount >= 0 ? amount : 0,
        balance: balanceByCurrency[currency],
        currency,
      } as Row;
    });
  })();

  return (
    <Card className="m-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bank Statement</CardTitle>
          <Badge variant="secondary">{rows.length} rows</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : error ? (
          <div className="text-destructive text-sm">Failed to load data</div>
        ) : (
          <ScrollArea className="h-[64dvh] w-full">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-6 gap-2 border-b bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                <div>Date</div>
                <div>Description</div>
                <div className="text-right">Debit</div>
                <div className="text-right">Credit</div>
                <div className="text-right">Balance</div>
                <div className="text-right">Currency</div>
              </div>
              <div className="divide-y">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-6 items-center gap-2 px-3 py-2 text-sm">
                    <div>{row.date}</div>
                    <div className="truncate" title={row.description}>{row.description}</div>
                    <div className="text-right">{row.debit ? row.debit.toFixed(2) : '-'}</div>
                    <div className="text-right">{row.credit ? row.credit.toFixed(2) : '-'}</div>
                    <div className="text-right font-medium">{row.balance.toFixed(2)}</div>
                    <div className="text-right">{row.currency}</div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default BankStatementTable;


