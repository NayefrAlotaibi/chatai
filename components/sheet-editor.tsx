'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DataGrid, { textEditor } from 'react-data-grid';
import { parse, unparse } from 'papaparse';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpIcon, CopyIcon, EyeIcon, MoreHorizontalIcon, TrashIcon } from '@/components/icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configColumnKey, setConfigColumnKey] = useState<string | null>(null);

  const gridWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = gridWrapperRef.current;
    if (!el) return;
    if (isConfigOpen) {
      el.setAttribute('inert', '');
    } else {
      el.removeAttribute('inert');
    }
  }, [isConfigOpen]);

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

  // Guard grid handlers while the config dropdown is open
  useEffect(() => {
    const stopKeysWhenOpen = (e: Event) => {
      if (!isConfigOpen) return;
      const target = e.target as HTMLElement | null;
      const insideConfig = !!(target && target.closest && target.closest('[data-sheet-config]'));
      if (insideConfig) {
        // Allow typing/selecting inside config
        return;
      }
      // Block grid/global shortcuts outside the config panel
      e.stopPropagation();
      if ((e as any).stopImmediatePropagation) {
        (e as any).stopImmediatePropagation();
      }
      e.preventDefault();
    };
    const stopPointerInside = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('[data-sheet-config]')) {
        e.stopPropagation();
        if ((e as any).stopImmediatePropagation) {
          (e as any).stopImmediatePropagation();
        }
      }
    };
    document.addEventListener('keydown', stopKeysWhenOpen, true);
    document.addEventListener('keypress', stopKeysWhenOpen, true);
    document.addEventListener('keyup', stopKeysWhenOpen, true);
    document.addEventListener('mousedown', stopPointerInside, true);
    document.addEventListener('pointerdown', stopPointerInside, true);
    return () => {
      document.removeEventListener('keydown', stopKeysWhenOpen, true);
      document.removeEventListener('keypress', stopKeysWhenOpen, true);
      document.removeEventListener('keyup', stopKeysWhenOpen, true);
      document.removeEventListener('mousedown', stopPointerInside, true);
      document.removeEventListener('pointerdown', stopPointerInside, true);
    };
  }, [isConfigOpen]);

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

  // File upload for dropdown per-column
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetKey, setUploadTargetKey] = useState<string | null>(null);

  const withHeaderMenu = useMemo(() => {
    return columns.map((col) => {
      if (col.key === 'rowNumber') return col;
      return {
        ...col,
        renderHeaderCell: () => (
          <button
            className="flex items-center justify-between w-full px-1 py-0.5 rounded hover:bg-zinc-800/40"
            aria-label={`Column ${col.name} menu`}
            onClick={(e) => {
              e.stopPropagation();
              setConfigColumnKey(col.key);
              setIsConfigOpen(true);
            }}
          >
            <span>{col.name}</span>
            <MoreHorizontalIcon size={14} />
          </button>
        ),
      };
    });
  }, [columns, sortByColumn, togglePinColumn, hideColumn, copyColumnInfo, deleteColumn]);

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

  const recomputeForColumn = useCallback(async (key: string, onlyStale: boolean) => {
    const cfg = getColumnConfig(key);
    const indices = localRows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => (onlyStale ? !String(r[key] ?? '').trim() : true))
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
        targetKey: key,
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
        next[idx] = { ...next[idx], [key]: updatedPartial[j][key] };
      });
      saveFromRows(columns, next);
      return next;
    });
    toast.success('Recomputed');
  }, [getColumnConfig, localRows, columns, saveFromRows]);

  return (
    <>
    <div ref={gridWrapperRef as any}></div>
    <DataGrid
      className={resolvedTheme === 'dark' ? 'rdg-dark' : 'rdg-light'}
        columns={withHeaderMenu}
      rows={localRows}
      enableVirtualization
      onRowsChange={handleRowsChange}
      onCellClick={(args) => {
        if (args.column.key !== 'rowNumber') {
          if (isConfigOpen) return; // ignore grid selection when config is open
          args.selectCell(true);
        }
      }}
      style={{ height: '100%' }}
      defaultColumnOptions={{
        resizable: true,
        sortable: true,
      }}
    />

      <Sheet open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <SheetContent side="right" className="w-[400px]" data-sheet-config>
          <SheetHeader>
            <SheetTitle>Column settings</SheetTitle>
            <SheetDescription>
              Configure AI actions for this column. These settings will apply to
              all rows.
            </SheetDescription>
          </SheetHeader>
          {configColumnKey && (
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Type</div>
                <div className="text-sm">Text</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Tool</div>
                <Select
                  value={getColumnConfig(configColumnKey).model}
                  onValueChange={(val) =>
                    setColumnConfig(configColumnKey, { ...getColumnConfig(configColumnKey), model: val })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {chatModels.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-sm">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Inputs</div>
                <Textarea
                  placeholder="Format as: USD 10.00\nThe total amount is: {{E}}"
                  value={getColumnConfig(configColumnKey).prompt}
                  onChange={(e) => {
                    setColumnConfig(configColumnKey, { ...getColumnConfig(configColumnKey), prompt: e.target.value });
                  }}
                  className="min-h-28 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-between">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const uploads = await Promise.all(files.map((f) => uploadFile(f)));
                    const ok = uploads.filter(Boolean) as any[];
                    setColumnConfig(configColumnKey, {
                      ...getColumnConfig(configColumnKey),
                      files: [...(getColumnConfig(configColumnKey).files ?? []), ...ok],
                    });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Upload files
                </Button>
                <Button size="sm" onClick={() => void recomputeForColumn(configColumnKey, true)}>
                  Recompute all stale fields
                </Button>
              </div>
              {getColumnConfig(configColumnKey).files?.length ? (
                <div className="flex flex-wrap gap-1">
                  {getColumnConfig(configColumnKey).files.map((f: any) => (
                    <span key={f.url} className="text-[10px] rounded bg-muted px-2 py-0.5">
                      {f.name || 'file'}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="my-1 h-px bg-muted" />
              <div className="flex flex-col gap-1">
                <Button variant="ghost" className="justify-start" onClick={() => sortByColumn(configColumnKey, 'asc')}><ArrowUpIcon /> Sort ascending</Button>
                <Button variant="ghost" className="justify-start" onClick={() => sortByColumn(configColumnKey, 'desc')}><ArrowUpIcon style={{ transform: 'rotate(180deg)' }} /> Sort descending</Button>
                <Button variant="ghost" className="justify-start" onClick={() => togglePinColumn(configColumnKey)}><CopyIcon /> Pin / Unpin</Button>
                <Button variant="ghost" className="justify-start" onClick={() => hideColumn(configColumnKey)}><EyeIcon /> Hide from view</Button>
                <Button variant="ghost" className="justify-start" onClick={() => copyColumnInfo(String(configColumnKey))}><CopyIcon /> Copy property ID</Button>
                <Button variant="ghost" className="justify-start" onClick={() => copyColumnInfo(slugify(String(columns.find(c => c.key === configColumnKey)?.name ?? '')))}><CopyIcon /> Copy property slug</Button>
                <Button variant="ghost" className="justify-start text-red-500" onClick={() => deleteColumn(configColumnKey)}><TrashIcon /> Delete Property</Button>
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
