'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { fetcher, cn } from '@/lib/utils';
import type { Receipt } from '@/lib/db/schema';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

type SortKey = 'receiptDate' | 'merchantName' | 'total' | 'currency';

export function ReceiptsTable() {
  const { data, isLoading, error } = useSWR<Array<Receipt>>('/api/receipts?limit=500', fetcher);

  const [merchantQuery, setMerchantQuery] = useState('');
  const [currency, setCurrency] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('receiptDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const currencies = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    data.forEach((r) => r.currency && set.add(r.currency));
    return Array.from(set.values());
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [] as Receipt[];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    return data
      .filter((r) =>
        merchantQuery
          ? r.merchantName.toLowerCase().includes(merchantQuery.toLowerCase())
          : true,
      )
      .filter((r) => (currency === 'all' ? true : r.currency === currency))
      .filter((r) => {
        if (!start && !end) return true;
        const d = new Date(r.receiptDate as unknown as string);
        if (start && d < start) return false;
        if (end) {
          const endAdj = new Date(end);
          endAdj.setHours(23, 59, 59, 999);
          if (d > endAdj) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'total') {
          const av = Number(a.total ?? 0);
          const bv = Number(b.total ?? 0);
          return av === bv ? 0 : av > bv ? dir : -dir;
        }
        const av = String(a[sortKey] ?? '');
        const bv = String(b[sortKey] ?? '');
        return av.localeCompare(bv) * dir;
      });
  }, [data, merchantQuery, currency, startDate, endDate, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <Card className="m-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Receipts</CardTitle>
            <Badge variant="secondary">Total {filtered.length}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search merchant..."
              value={merchantQuery}
              onChange={(e) => {
                setMerchantQuery(e.target.value);
                setPage(1);
              }}
              className="h-8 w-44"
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-8 w-38"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-8 w-38"
            />
            <Select
              value={currency}
              onValueChange={(v) => {
                setCurrency(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-8"
              onClick={() => {
                setMerchantQuery('');
                setCurrency('all');
                setStartDate('');
                setEndDate('');
                setSortKey('receiptDate');
                setSortDir('desc');
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : error ? (
          <div className="text-destructive text-sm">Failed to load receipts</div>
        ) : !data || data.length === 0 ? (
          <div className="text-muted-foreground text-sm">No receipts found.</div>
        ) : (
          <>
            <ScrollArea className="h-[64dvh] w-full">
              <div className="min-w-[880px]">
                <div className="grid grid-cols-8 gap-2 border-b bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                  <button className={cn('text-left', 'hover:underline')} onClick={() => toggleSort('receiptDate')}>Date</button>
                  <button className={cn('text-left', 'hover:underline')} onClick={() => toggleSort('merchantName')}>Merchant</button>
                  <div className="text-right">Subtotal</div>
                  <div className="text-right">Tax</div>
                  <div className="text-right">Tip</div>
                  <button className={cn('text-right', 'hover:underline')} onClick={() => toggleSort('total')}>Total</button>
                  <button className={cn('text-right', 'hover:underline')} onClick={() => toggleSort('currency')}>Currency</button>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y">
                  {pageItems.map((r) => (
                    <div key={r.id} className="grid grid-cols-8 items-center gap-2 px-3 py-2 text-sm">
                      <div>{r.receiptDate?.toString?.() || ''}</div>
                      <div className="truncate" title={r.merchantName}>{r.merchantName}</div>
                      <div className="text-right">{r.subtotal ?? '-'}</div>
                      <div className="text-right">{r.tax ?? '-'}</div>
                      <div className="text-right">{r.tip ?? '-'}</div>
                      <div className="text-right font-medium">{r.total}</div>
                      <div className="text-right">{r.currency}</div>
                      <div className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-muted-foreground text-xs">Page {page} of {totalPages}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button variant="default" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


