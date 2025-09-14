'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, { textEditor } from 'react-data-grid';
import { parse, unparse } from 'papaparse';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from '@/components/icons';
import { chatModels } from '@/lib/ai/models';
import { toast } from 'sonner';

import 'react-data-grid/lib/styles.css';

type SheetEditorProps = {
  content: string;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  status: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  metadata?: any;
  setMetadata?: any;
};

const MIN_ROWS = 50;
const MIN_COLS = 26;

const PureSpreadsheetEditor = ({
  content,
  saveContent,
  status,
  isCurrentVersion,
  metadata,
  setMetadata,
}: SheetEditorProps) => {
  const { resolvedTheme } = useTheme();

  const parseData = useMemo(() => {
    if (!content) return Array(MIN_ROWS).fill(Array(MIN_COLS).fill(''));
    const result = parse<string[]>(content, { skipEmptyLines: true });

    const paddedData = result.data.map((row) => {
      const paddedRow = [...row];
      while (paddedRow.length < MIN_COLS) {
        paddedRow.push('');
      }
      return paddedRow;
    });

    while (paddedData.length < MIN_ROWS) {
      paddedData.push(Array(MIN_COLS).fill(''));
    }

    return paddedData;
  }, [content]);

  const createBaseColumns = useCallback(() => {
    const rowNumberColumn = {
      key: 'rowNumber',
      name: '',
      frozen: true,
      width: 50,
      renderCell: ({ rowIdx }: { rowIdx: number }) => rowIdx + 1,
      cellClass: 'border-t border-r dark:bg-zinc-950 dark:text-zinc-50',
      headerCellClass: 'border-t border-r dark:bg-zinc-900 dark:text-zinc-50',
    } as const;

    const dataColumns = Array.from({ length: MIN_COLS }, (_, i) => ({
      key: i.toString(),
      name: String.fromCharCode(65 + i),
      renderEditCell: textEditor,
      width: 120,
      cellClass: cn(`border-t dark:bg-zinc-950 dark:text-zinc-50`, {
        'border-l': i !== 0,
      }),
      headerCellClass: cn(`border-t dark:bg-zinc-900 dark:text-zinc-50`, {
        'border-l': i !== 0,
      }),
    }));

    return [rowNumberColumn, ...dataColumns];
  }, []);

  const [columns, setColumns] = useState<any[]>(createBaseColumns());

  const initialRows = useMemo(() => {
    return parseData.map((row, rowIndex) => {
      const rowData: any = {
        id: rowIndex,
        rowNumber: rowIndex + 1,
      };

      columns.slice(1).forEach((col, colIndex) => {
        rowData[col.key] = row[colIndex] || '';
      });

      return rowData;
    });
  }, [parseData, columns]);

  const [localRows, setLocalRows] = useState(initialRows);

  useEffect(() => {
    setLocalRows(initialRows);
  }, [initialRows]);

  const generateCsv = (data: any[][]) => {
    return unparse(data);
  };

  const saveFromRows = useCallback(
    (cols: any[], rows: any[]) => {
      const updatedData = rows.map((row) => {
        return cols.slice(1).map((col) => row[col.key] || '');
      });

      const newCsvContent = generateCsv(updatedData);
      saveContent(newCsvContent, true);
    },
    [saveContent],
  );

  const handleRowsChange = (newRows: any[]) => {
    setLocalRows(newRows);
    saveFromRows(columns, newRows);
  };

  const sortByColumn = useCallback(
    (key: string, direction: 'asc' | 'desc') => {
      setLocalRows((prev) => {
        const rows = [...prev].sort((a, b) => {
          const av = a[key] ?? '';
          const bv = b[key] ?? '';
          const an = Number(av);
          const bn = Number(bv);
          const bothNumeric = !Number.isNaN(an) && !Number.isNaN(bn);
          const cmp = bothNumeric
            ? an - bn
            : String(av).localeCompare(String(bv), undefined, { numeric: true });
          return direction === 'asc' ? cmp : -cmp;
        });
        // persist
        saveFromRows(columns, rows);
        return rows;
      });
    },
    [columns, saveFromRows],
  );

  const togglePinColumn = useCallback(
    (key: string) => {
      setColumns((prev) => {
        const next = prev.map((c) =>
          c.key === key ? { ...c, frozen: !c.frozen } : c,
        );
        // Move all frozen columns (except rowNumber) to the left, right after rowNumber
        const rowCol = next[0];
        const frozen = next.slice(1).filter((c) => c.frozen);
        const unfrozen = next.slice(1).filter((c) => !c.frozen);
        return [rowCol, ...frozen, ...unfrozen];
      });
    },
    [],
  );

  const hideColumn = useCallback((key: string) => {
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setLocalRows((prev) => {
      const rows = prev.map((r) => {
        const { [key]: _removed, ...rest } = r;
        return rest;
      });
      // persist
      saveFromRows(
        columns.filter((c) => c.key !== key),
        rows,
      );
      return rows;
    });
  }, [columns, saveFromRows]);

  const deleteColumn = useCallback((key: string) => {
    // Behaves same as hide, but also clears values before persisting
    setColumns((prev) => prev.filter((c) => c.key !== key));
    setLocalRows((prev) => {
      const rows = prev.map((r) => {
        const newRow = { ...r } as any;
        delete newRow[key];
        return newRow;
      });
      saveFromRows(
        columns.filter((c) => c.key !== key),
        rows,
      );
      return rows;
    });
  }, [columns, saveFromRows]);

  const copyColumnInfo = useCallback((label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(label);
    }
  }, []);

  const slugify = useCallback((value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }, []);

  const withHeaderMenu = useMemo(() => {
    return columns.map((col) => {
      if (col.key === 'rowNumber') return col;
      return {
        ...col,
        renderHeaderCell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-between w-full px-1 py-0.5 rounded hover:bg-zinc-800/40"
                aria-label={`Column ${col.name} menu`}
              >
                <span>{col.name}</span>
                <MoreHorizontalIcon size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openAIConfig(col.key, String(col.name))}>
                Configure AI…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => sortByColumn(col.key, 'asc')}>
                <ArrowUpIcon />
                Sort ascending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => sortByColumn(col.key, 'desc')}>
                <ArrowUpIcon style={{ transform: 'rotate(180deg)' }} />
                Sort descending
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => togglePinColumn(col.key)}>
                {/* Using copy icon as placeholder for pin visual */}
                <CopyIcon />
                {col.frozen ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => hideColumn(col.key)}>
                <EyeIcon />
                Hide from view
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => copyColumnInfo(String(col.key))}>
                <CopyIcon />
                Copy property ID
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyColumnInfo(slugify(String(col.name)))}>
                <CopyIcon />
                Copy property slug
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => deleteColumn(col.key)}
                className="text-red-500"
              >
                <TrashIcon />
                Delete Property
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      };
    });
  }, [columns, sortByColumn, togglePinColumn, hideColumn, copyColumnInfo, deleteColumn]);

  // AI Config Panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiColumnKey, setAiColumnKey] = useState<string | null>(null);
  const [aiColumnLabel, setAiColumnLabel] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getColumnConfig = useCallback(
    (key: string) => {
      const cfg = metadata?.columnConfigs?.[key] ?? {
        model: 'chat-model',
        prompt: '',
        files: [] as Array<{ name: string; url: string; type?: string }>,
      };
      return cfg;
    },
    [metadata],
  );

  const setColumnConfig = useCallback(
    (key: string, cfg: any) => {
      setMetadata?.((m: any) => ({
        ...(m ?? {}),
        columnConfigs: { ...(m?.columnConfigs ?? {}), [key]: cfg },
      }));
    },
    [setMetadata],
  );

  const openAIConfig = useCallback((key: string, label: string) => {
    setAiColumnKey(key);
    setAiColumnLabel(label);
    setAiPanelOpen(true);
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      return { name: data.pathname, url: data.url as string, type: data.contentType as string };
    } catch (e) {
      toast.error('Upload failed');
      return null;
    }
  }, []);

  const recomputeStale = useCallback(async () => {
    if (!aiColumnKey) return;
    const cfg = getColumnConfig(aiColumnKey);
    const indices = localRows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => !String(r[aiColumnKey] ?? '').trim())
      .map(({ i }) => i);

    if (indices.length === 0) {
      toast.info('No stale fields to recompute.');
      return;
    }

    const rowsToSend = indices.map((i) => {
      const { rowNumber, ...rest } = localRows[i];
      return rest;
    });

    const response = await fetch('/api/column/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        prompt: cfg.prompt,
        targetKey: aiColumnKey,
        files: cfg.files,
        rows: rowsToSend,
      }),
    });

    if (!response.ok) {
      toast.error('Recompute failed');
      return;
    }

    const { rows: updatedPartial } = await response.json();
    setLocalRows((prev) => {
      const next = [...prev];
      indices.forEach((idx, j) => {
        next[idx] = { ...next[idx], [aiColumnKey]: updatedPartial[j][aiColumnKey] };
      });
      saveFromRows(columns, next);
      return next;
    });
    toast.success('Recomputed');
  }, [aiColumnKey, getColumnConfig, localRows, columns, saveFromRows]);

  return (
    <>
      <DataGrid
        className={resolvedTheme === 'dark' ? 'rdg-dark' : 'rdg-light'}
        columns={withHeaderMenu}
        rows={localRows}
        enableVirtualization
        onRowsChange={handleRowsChange}
        onCellClick={(args) => {
          if (args.column.key !== 'rowNumber') {
            args.selectCell(true);
          }
        }}
        style={{ height: '100%' }}
        defaultColumnOptions={{
          resizable: true,
          sortable: true,
        }}
      />

      <Sheet open={aiPanelOpen} onOpenChange={setAiPanelOpen}>
        <SheetContent side="right" className="w-[420px]">
          <SheetHeader>
            <SheetTitle>Configure AI for column {aiColumnLabel}</SheetTitle>
          </SheetHeader>
          {aiColumnKey && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Tool</label>
                <Select
                  value={getColumnConfig(aiColumnKey).model}
                  onValueChange={(val) =>
                    setColumnConfig(aiColumnKey, {
                      ...getColumnConfig(aiColumnKey),
                      model: val,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {chatModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Inputs</label>
                <Textarea
                  placeholder="Provide the prompt. You can reference row fields like {{A}} or {{0}}"
                  value={getColumnConfig(aiColumnKey).prompt}
                  onChange={(e) =>
                    setColumnConfig(aiColumnKey, {
                      ...getColumnConfig(aiColumnKey),
                      prompt: e.target.value,
                    })
                  }
                  className="min-h-32"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Upload files</label>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    {getColumnConfig(aiColumnKey).files?.map((f: any) => (
                      <span key={f.url} className="text-xs rounded bg-muted px-2 py-1">
                        {f.name || 'file'}
                      </span>
                    ))}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      const uploads = await Promise.all(files.map((f) => uploadFile(f)));
                      const ok = uploads.filter(Boolean) as any[];
                      setColumnConfig(aiColumnKey, {
                        ...getColumnConfig(aiColumnKey),
                        files: [...(getColumnConfig(aiColumnKey).files ?? []), ...ok],
                      });
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />
                  <div>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Upload files
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={recomputeStale} className="w-full">
                  Recompute all stale fields
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

function areEqual(prevProps: SheetEditorProps, nextProps: SheetEditorProps) {
  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === 'streaming' && nextProps.status === 'streaming') &&
    prevProps.content === nextProps.content &&
    prevProps.saveContent === nextProps.saveContent
  );
}

export const SpreadsheetEditor = memo(PureSpreadsheetEditor, areEqual);
