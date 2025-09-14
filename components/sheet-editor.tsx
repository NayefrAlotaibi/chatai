'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  ArrowUpIcon,
  CopyIcon,
  EyeIcon,
  MoreHorizontalIcon,
  TrashIcon,
} from '@/components/icons';

import 'react-data-grid/lib/styles.css';

type SheetEditorProps = {
  content: string;
  saveContent: (content: string, isCurrentVersion: boolean) => void;
  status: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
};

const MIN_ROWS = 50;
const MIN_COLS = 26;

const PureSpreadsheetEditor = ({
  content,
  saveContent,
  status,
  isCurrentVersion,
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

  return (
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
