'use client';

import { useCallback, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

type ParsedRow = Record<string, any>;

type DBField =
  | 'receiptDate'
  | 'merchantName'
  | 'debit'
  | 'credit'
  | 'balance'
  | 'subtotal'
  | 'tax'
  | 'tip'
  | 'total'
  | 'currency'
  | 'receiptNumber';

const DB_FIELDS: Array<{ key: DBField; label: string; required?: boolean }> = [
  { key: 'receiptDate', label: 'Date', required: true },
  { key: 'merchantName', label: 'Description', required: true },
  { key: 'total', label: 'Amount' },
  { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' },
  { key: 'balance', label: 'Balance' },
  { key: 'currency', label: 'Currency' },
  { key: 'subtotal', label: 'Subtotal' },
  { key: 'tax', label: 'Tax' },
  { key: 'tip', label: 'Tip' },
  { key: 'receiptNumber', label: 'Reference #' },
];

function tryAutoDetectMapping(headers: string[]) {
  const h = headers.map((x) => x.toLowerCase());
  const get = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = h.findIndex((x) => x.includes(c));
      if (i !== -1) return headers[i];
    }
    return '';
  };

  return {
    receiptDate: get('date', 'posted', 'transaction date'),
    merchantName: get('description', 'merchant', 'payee', 'narration'),
    debit: get('debit', 'withdrawal', 'dr'),
    credit: get('credit', 'deposit', 'cr'),
    balance: get('balance'),
    subtotal: get('subtotal'),
    tax: get('tax', 'vat'),
    tip: get('tip'),
    total: get('amount', 'total'),
    currency: get('currency', 'ccy'),
    receiptNumber: get('reference', 'ref', 'receipt', 'id'),
  } as Record<DBField, string>;
}

export function ReceiptsImport() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<DBField, string>>({
    receiptDate: '',
    merchantName: '',
    debit: '',
    credit: '',
    balance: '',
    subtotal: '',
    tax: '',
    tip: '',
    total: '',
    currency: '',
    receiptNumber: '',
  });
  const [saving, setSaving] = useState(false);

  const requiredMissing = useMemo(() => {
    const baseMissing = !mapping.receiptDate || !mapping.merchantName;
    const amountProvided = Boolean(mapping.total || mapping.debit || mapping.credit);
    return baseMissing || !amountProvided;
  }, [mapping.receiptDate, mapping.merchantName, mapping.total, mapping.debit, mapping.credit]);

  const onFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const data = (res.data as ParsedRow[]).filter(Boolean);
          setRows(data);
          const hdrs = (res.meta.fields || []) as string[];
          setHeaders(hdrs);
          setMapping(tryAutoDetectMapping(hdrs));
        },
        error: () => toast.error('Failed to parse CSV'),
      });
      return;
    }

    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const data = json as ParsedRow[];
        setRows(data);
        const hdrs = Object.keys(data[0] || {});
        setHeaders(hdrs);
        setMapping(tryAutoDetectMapping(hdrs));
      } catch (e) {
        toast.error('Install dependency "xlsx" to import Excel files');
      }
      return;
    }

    toast.error('Unsupported file type. Please upload CSV or Excel');
  }, []);

  function parseNumber(val: any): number | undefined {
    if (val === undefined || val === null) return undefined;
    const s = String(val).replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    if (s.trim() === '') return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  async function handleSave() {
    if (!rows.length) return;
    if (requiredMissing) {
      toast.error('Please map required fields (Date, Description, and Amount)');
      return;
    }

    const mapped = rows.map((r) => {
      const debit = parseNumber(mapping.debit ? r[mapping.debit] : undefined) || 0;
      const credit = parseNumber(mapping.credit ? r[mapping.credit] : undefined) || 0;
      const totalFromMap = parseNumber(mapping.total ? r[mapping.total] : undefined);
      const total = totalFromMap !== undefined ? totalFromMap : credit - debit;

      return {
        receiptDate: r[mapping.receiptDate],
        merchantName: r[mapping.merchantName],
        subtotal: parseNumber(mapping.subtotal ? r[mapping.subtotal] : undefined),
        tax: parseNumber(mapping.tax ? r[mapping.tax] : undefined),
        tip: parseNumber(mapping.tip ? r[mapping.tip] : undefined),
        total,
        currency: r[mapping.currency] || 'USD',
        receiptNumber: r[mapping.receiptNumber],
      };
    });

    setSaving(true);
    try {
      const res = await fetch('/api/bank/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mapped }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Imported successfully');
      setRows([]);
      setHeaders([]);
    } catch (e) {
      toast.error('Import failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="m-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl md:text-2xl">Confirm import</CardTitle>
          <Badge variant="secondary" className="text-xs md:text-sm">CSV / Excel</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="max-w-lg h-10"
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!headers.length) return;
              setMapping(tryAutoDetectMapping(headers));
            }}
          >
            Auto Map
          </Button>
          <Button disabled={!rows.length || saving} onClick={handleSave} className="h-10 px-6">
            {saving ? 'Importing...' : 'Confirm import'}
          </Button>
        </div>

        {headers.length > 0 && (
          <div className="mt-6 grid gap-6">
            <div className="text-muted-foreground text-sm">We've mapped each column. Review and adjust.</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: CSV selects */}
              <div>
                <div className="mb-2 font-medium text-sm">CSV Data column</div>
                <div className="grid gap-4">
                  {(['receiptDate','merchantName','total','balance'] as DBField[]).map((key) => (
                    <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3">
                      <Select
                        value={mapping[key] || ''}
                        onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === '__none__' ? '' : v }))}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder={`Select ${DB_FIELDS.find(f=>f.key===key)?.label}`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">(none)</SelectItem>
                          {headers.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-muted-foreground">→</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Target schema */}
              <div>
                <div className="mb-2 font-medium text-sm">Target columns</div>
                <div className="grid gap-4">
                  {['Date','Description','Amount','Balance'].map((label) => (
                    <div key={label} className="h-10 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground">
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional mappings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['debit','credit','currency'] as DBField[]).map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <div className="text-muted-foreground text-xs">{DB_FIELDS.find(f=>f.key===key)?.label}</div>
                  <Select
                    value={mapping[key] || ''}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">(none)</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mt-4">
            <div className="text-muted-foreground mb-2 text-sm">Preview (first 20 rows)</div>
            <ScrollArea className="h-[360px] w-full">
              <div className="min-w-[1000px]">
                <div className="grid grid-cols-8 gap-2 border-b bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
                  <div>Date</div>
                  <div>Description</div>
                  <div className="text-right">Debit</div>
                  <div className="text-right">Credit</div>
                  <div className="text-right">Total</div>
                  <div className="text-right">Balance</div>
                  <div className="text-right">Tax</div>
                  <div className="text-right">Currency</div>
                </div>
                <div className="divide-y">
                  {rows.slice(0, 20).map((r, i) => (
                    <div key={i} className="grid grid-cols-8 gap-2 px-3 py-2 text-sm">
                      <div>{mapping.receiptDate ? r[mapping.receiptDate] : ''}</div>
                      <div className="truncate" title={mapping.merchantName ? r[mapping.merchantName] : ''}>
                        {mapping.merchantName ? r[mapping.merchantName] : ''}
                      </div>
                      <div className="text-right">{mapping.debit ? r[mapping.debit] : ''}</div>
                      <div className="text-right">{mapping.credit ? r[mapping.credit] : ''}</div>
                      <div className="text-right">{mapping.total ? r[mapping.total] : ''}</div>
                      <div className="text-right">{mapping.balance ? r[mapping.balance] : ''}</div>
                      <div className="text-right">{mapping.tax ? r[mapping.tax] : ''}</div>
                      <div className="text-right">{mapping.currency ? r[mapping.currency] : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReceiptsImport;


