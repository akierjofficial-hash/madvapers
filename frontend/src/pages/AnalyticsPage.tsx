import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBranchesQuery, useDashboardSummaryQuery } from '../api/queries';
import { useAuth } from '../auth/AuthProvider';

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function monthInputFromDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function dateInputFromDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeMonthInput(value: string | null, fallback: string): string {
  if (!value) return fallback;
  return /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

function monthBounds(monthInput: string): { from: string; to: string; label: string } {
  const fallback = monthInputFromDate(new Date());
  const safe = normalizeMonthInput(monthInput, fallback);
  const [yearRaw, monthRaw] = safe.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      from: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`,
      to: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`,
      label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    };
  }

  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return {
    from: `${yearRaw}-${monthRaw}-01`,
    to: `${yearRaw}-${monthRaw}-${String(last.getDate()).padStart(2, '0')}`,
    label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

function money(value: number): string {
  return Number(value ?? 0).toLocaleString(undefined, {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  });
}

function numberFmt(value: number): string {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function textFromCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return String(value);

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((chunk) => {
          const chunkText = (chunk as Record<string, unknown>).text;
          return typeof chunkText === 'string' ? chunkText : '';
        })
        .join('');
    }

    if (typeof obj.text === 'string') return obj.text;
    if (obj.result !== undefined && obj.result !== null) return String(obj.result);
    if (obj.formula !== undefined && obj.formula !== null) return String(obj.formula);

    const maybeToString = (obj as { toString?: () => string }).toString;
    if (typeof maybeToString === 'function') {
      const text = maybeToString.call(obj);
      if (text && text !== '[object Object]') return text;
    }
  }

  return String(value);
}

function autoFitWorksheetColumns(
  worksheet: import('exceljs').Worksheet,
  options?: { minWidth?: number; maxWidth?: number; padding?: number }
): void {
  const minWidth = options?.minWidth ?? 10;
  const maxWidth = options?.maxWidth ?? 48;
  const padding = options?.padding ?? 2;
  const widths = new Map<number, number>();

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const cellMeta = cell as unknown as { isMerged?: boolean };
      if (cellMeta.isMerged) return;

      const text = textFromCellValue(cell.value);
      if (!text) return;

      const contentWidth = text
        .split(/\r?\n/)
        .reduce((max, line) => Math.max(max, line.trimEnd().length), 0);

      if (contentWidth <= 0) return;

      const current = widths.get(colNumber) ?? 0;
      if (contentWidth > current) {
        widths.set(colNumber, contentWidth);
      }
    });
  });

  widths.forEach((contentWidth, colNumber) => {
    const next = Math.min(maxWidth, Math.max(minWidth, contentWidth + padding));
    worksheet.getColumn(colNumber).width = next;
  });
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderColor: `${tone}66`,
        background: `linear-gradient(180deg, ${tone}10 0%, rgba(255,255,255,0.95) 100%)`,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {hint}
      </Typography>
    </Paper>
  );
}

const EMPTY_FINANCE = {
  revenue: 0,
  cash_in: 0,
  cogs: 0,
  gross_profit: 0,
  restock_spend: 0,
  net_cashflow: 0,
  expense_total: 0,
  net_income: 0,
  voided_sales_count: 0,
  voided_sales_amount: 0,
  voided_paid_amount: 0,
};

export function AnalyticsPage() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const { user, can } = useAuth();
  const canDashboardView = can('USER_VIEW');
  const canBranchView = can('BRANCH_VIEW');
  const canReportExport = can('REPORT_EXPORT');
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [openTodayReport, setOpenTodayReport] = useState(false);

  const currentMonth = useMemo(() => monthInputFromDate(new Date()), []);
  const [month, setMonth] = useState<string>(() => normalizeMonthInput(searchParams.get('month'), currentMonth));
  const [branchId, setBranchId] = useState<number | ''>(() => toInt(searchParams.get('branch_id')) ?? '');

  const branchesQuery = useBranchesQuery(canBranchView);

  useEffect(() => {
    if (canBranchView) return;
    const assigned = user?.branch_id ?? '';
    if (branchId !== assigned) setBranchId(assigned);
  }, [canBranchView, user?.branch_id, branchId]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('month', month);
    if (typeof branchId === 'number') next.set('branch_id', String(branchId));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [month, branchId, searchParams, setSearchParams]);

  const range = useMemo(() => monthBounds(month), [month]);
  const todayDate = useMemo(() => dateInputFromDate(new Date()), []);
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  const summaryQuery = useDashboardSummaryQuery(
    {
      branch_id: typeof branchId === 'number' ? branchId : undefined,
      date_from: range.from,
      date_to: range.to,
    },
    canDashboardView
  );

  const todaySummaryQuery = useDashboardSummaryQuery(
    {
      branch_id: typeof branchId === 'number' ? branchId : undefined,
      date_from: todayDate,
      date_to: todayDate,
    },
    canDashboardView && openTodayReport
  );

  const finance = summaryQuery.data?.finance ?? EMPTY_FINANCE;
  const todayFinance = todaySummaryQuery.data?.finance ?? EMPTY_FINANCE;
  const topSelling = summaryQuery.data?.top_selling_products ?? [];
  const voidedByBranch = summaryQuery.data?.voided_sales_by_branch ?? [];

  const trends = summaryQuery.data?.trends ?? [];
  const trendMax = useMemo(
    () => Math.max(1, ...trends.map((point) => Math.max(point.in_qty ?? 0, point.out_qty ?? 0))),
    [trends]
  );
  const movementTotals = useMemo(
    () =>
      trends.reduce(
        (acc, point) => {
          acc.inQty += Number(point.in_qty ?? 0);
          acc.outQty += Number(point.out_qty ?? 0);
          acc.adjustments += Number(point.adjustments ?? 0);
          return acc;
        },
        { inQty: 0, outQty: 0, adjustments: 0 }
      ),
    [trends]
  );

  const branchHealth = summaryQuery.data?.branch_health ?? [];
  const topBranches = useMemo(
    () => [...branchHealth].sort((a, b) => Number(b.stock_value ?? 0) - Number(a.stock_value ?? 0)).slice(0, 6),
    [branchHealth]
  );

  const branchLabel =
    typeof branchId === 'number'
      ? branchesQuery.data?.find((b) => b.id === branchId)?.name ?? `Branch #${branchId}`
      : 'All branches';

  const handleExportExcel = async () => {
    if (!canReportExport) return;

    try {
      setExportError(null);
      setIsExporting(true);

      const exceljs = await import('exceljs');
      const workbook = new exceljs.Workbook();
      workbook.creator = 'Mad Vapers';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Monthly Report');
      ws.columns = [
        { width: 7 },
        { width: 16 },
        { width: 30 },
        { width: 24 },
        { width: 12 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 12 },
      ];

      const tableBorder = {
        top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      };

      const styleSectionTitle = (rowNumber: number) => {
        ws.mergeCells(`A${rowNumber}:I${rowNumber}`);
        const cell = ws.getCell(`A${rowNumber}`);
        cell.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        for (let col = 1; col <= 9; col += 1) {
          ws.getCell(rowNumber, col).border = tableBorder;
        }
      };

      const styleHeaderRow = (rowNumber: number) => {
        for (let col = 1; col <= 9; col += 1) {
          const cell = ws.getCell(rowNumber, col);
          cell.font = { bold: true, color: { argb: 'FF111827' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFEFF' } };
          cell.alignment = { vertical: 'middle', horizontal: col <= 4 ? 'left' : 'center' };
          cell.border = tableBorder;
        }
      };

      const styleBodyRow = (rowNumber: number) => {
        for (let col = 1; col <= 9; col += 1) {
          const cell = ws.getCell(rowNumber, col);
          cell.border = tableBorder;
          cell.alignment = { vertical: 'middle', horizontal: col <= 4 ? 'left' : 'right' };
        }
      };

      ws.mergeCells('A1:I1');
      ws.getCell('A1').value = 'Monthly Analytics Report';
      ws.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
      ws.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

      ws.getCell('A2').value = 'Month';
      ws.getCell('B2').value = range.label;
      ws.getCell('A3').value = 'Branch';
      ws.getCell('B3').value = branchLabel;
      ws.getCell('A4').value = 'Coverage';
      ws.getCell('B4').value = `${range.from} to ${range.to}`;
      ['A2', 'A3', 'A4'].forEach((cell) => {
        ws.getCell(cell).font = { bold: true };
      });

      let row = 6;
      ws.getCell(`A${row}`).value = 'Finance Overview';
      styleSectionTitle(row);
      row += 1;

      ws.getCell(`A${row}`).value = 'Metric';
      ws.getCell(`B${row}`).value = 'Value';
      for (let col = 1; col <= 2; col += 1) {
        const cell = ws.getCell(row, col);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        cell.border = tableBorder;
      }
      row += 1;

      const financeRows: Array<{ label: string; value: number; numFmt: string }> = [
        { label: 'Revenue', value: finance.revenue, numFmt: '#,##0.00' },
        { label: 'Cash In', value: finance.cash_in, numFmt: '#,##0.00' },
        { label: 'COGS', value: finance.cogs, numFmt: '#,##0.00' },
        { label: 'Gross Profit', value: finance.gross_profit, numFmt: '#,##0.00' },
        { label: 'Expense Total', value: finance.expense_total, numFmt: '#,##0.00' },
        { label: 'Restock Spend', value: finance.restock_spend, numFmt: '#,##0.00' },
        { label: 'Net Income', value: finance.net_income, numFmt: '#,##0.00' },
        { label: 'Net Cashflow', value: finance.net_cashflow, numFmt: '#,##0.00' },
      ];
      financeRows.forEach(({ label, value, numFmt }) => {
        ws.getCell(`A${row}`).value = label;
        ws.getCell(`B${row}`).value = Number(value ?? 0);
        ws.getCell(`B${row}`).numFmt = numFmt;
        for (let col = 1; col <= 2; col += 1) {
          ws.getCell(row, col).border = tableBorder;
          ws.getCell(row, col).alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        }
        row += 1;
      });

      row += 1;
      ws.getCell(`A${row}`).value = 'Voided / Refund Signals';
      styleSectionTitle(row);
      row += 1;

      ws.getCell(`A${row}`).value = 'Metric';
      ws.getCell(`B${row}`).value = 'Value';
      for (let col = 1; col <= 2; col += 1) {
        const cell = ws.getCell(row, col);
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        cell.border = tableBorder;
      }
      row += 1;

      const voidRows: Array<{ label: string; value: number; numFmt: string }> = [
        { label: 'Voided Sales Count', value: finance.voided_sales_count, numFmt: '#,##0' },
        { label: 'Voided Sales Amount', value: finance.voided_sales_amount, numFmt: '#,##0.00' },
        { label: 'Voided Paid Amount', value: finance.voided_paid_amount, numFmt: '#,##0.00' },
      ];
      voidRows.forEach(({ label, value, numFmt }) => {
        ws.getCell(`A${row}`).value = label;
        ws.getCell(`B${row}`).value = Number(value ?? 0);
        ws.getCell(`B${row}`).numFmt = numFmt;
        for (let col = 1; col <= 2; col += 1) {
          ws.getCell(row, col).border = tableBorder;
          ws.getCell(row, col).alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        }
        row += 1;
      });

      row += 1;
      ws.getCell(`A${row}`).value = 'Voided Sales by Branch';
      styleSectionTitle(row);
      row += 1;

      const voidBranchHeader = ['Branch Code', 'Branch Name', 'Voided Count', 'Voided Amount', 'Paid Amount on Voided'];
      voidBranchHeader.forEach((label, idx) => {
        ws.getCell(row, idx + 1).value = label;
      });
      for (let col = 1; col <= 5; col += 1) {
        const cell = ws.getCell(row, col);
        cell.font = { bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFEFF' } };
        cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'right' };
        cell.border = tableBorder;
      }
      row += 1;

      if (voidedByBranch.length === 0) {
        ws.mergeCells(`A${row}:E${row}`);
        ws.getCell(`A${row}`).value = 'No voided sales by branch for this period.';
        ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
        for (let col = 1; col <= 5; col += 1) {
          ws.getCell(row, col).border = tableBorder;
        }
        row += 1;
      } else {
        voidedByBranch.forEach((item) => {
          ws.getCell(row, 1).value = item.branch_code ?? '-';
          ws.getCell(row, 2).value = item.branch_name ?? '-';
          ws.getCell(row, 3).value = Number(item.voided_sales_count ?? 0);
          ws.getCell(row, 4).value = Number(item.voided_sales_amount ?? 0);
          ws.getCell(row, 5).value = Number(item.voided_paid_amount ?? 0);
          ws.getCell(row, 3).numFmt = '#,##0';
          ws.getCell(row, 4).numFmt = '#,##0.00';
          ws.getCell(row, 5).numFmt = '#,##0.00';
          for (let col = 1; col <= 5; col += 1) {
            ws.getCell(row, col).border = tableBorder;
            ws.getCell(row, col).alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'right' };
          }
          row += 1;
        });
      }

      row += 1;
      ws.getCell(`A${row}`).value = 'Top Selling Products';
      styleSectionTitle(row);
      row += 1;

      const topHeader = ['Rank', 'SKU', 'Product', 'Variant', 'Qty Sold', 'Sales Amount', 'COGS', 'Gross Profit', 'Sales Count'];
      topHeader.forEach((label, idx) => {
        ws.getCell(row, idx + 1).value = label;
      });
      styleHeaderRow(row);
      row += 1;

      if (topSelling.length === 0) {
        ws.mergeCells(`A${row}:I${row}`);
        ws.getCell(`A${row}`).value = 'No posted sales available for this period.';
        ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
        ws.getCell(`A${row}`).border = tableBorder;
        row += 1;
      } else {
        topSelling.forEach((item, idx) => {
          ws.getCell(row, 1).value = idx + 1;
          ws.getCell(row, 2).value = item.sku ?? '-';
          ws.getCell(row, 3).value = item.product_name ?? '-';
          ws.getCell(row, 4).value = item.variant_name ?? '-';
          ws.getCell(row, 5).value = Number(item.qty_sold ?? 0);
          ws.getCell(row, 6).value = Number(item.sales_amount ?? 0);
          ws.getCell(row, 7).value = Number(item.cogs ?? 0);
          ws.getCell(row, 8).value = Number(item.gross_profit ?? 0);
          ws.getCell(row, 9).value = Number(item.sales_count ?? 0);
          ws.getCell(row, 5).numFmt = '#,##0.000';
          ws.getCell(row, 6).numFmt = '#,##0.00';
          ws.getCell(row, 7).numFmt = '#,##0.00';
          ws.getCell(row, 8).numFmt = '#,##0.00';
          styleBodyRow(row);
          row += 1;
        });
      }

      row += 1;
      ws.getCell(`A${row}`).value = 'Daily Trends';
      styleSectionTitle(row);
      row += 1;

      const trendHeader = ['Date', 'Inbound Qty', 'Outbound Qty', 'Adjustments', 'Transfers', 'PO Created', 'PO Received'];
      trendHeader.forEach((label, idx) => {
        ws.getCell(row, idx + 1).value = label;
      });
      styleHeaderRow(row);
      row += 1;

      if (trends.length === 0) {
        ws.mergeCells(`A${row}:I${row}`);
        ws.getCell(`A${row}`).value = 'No trend data available for this period.';
        ws.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
        ws.getCell(`A${row}`).border = tableBorder;
      } else {
        trends.forEach((point) => {
          ws.getCell(row, 1).value = point.date;
          ws.getCell(row, 2).value = Number(point.in_qty ?? 0);
          ws.getCell(row, 3).value = Number(point.out_qty ?? 0);
          ws.getCell(row, 4).value = Number(point.adjustments ?? 0);
          ws.getCell(row, 5).value = Number(point.transfers ?? 0);
          ws.getCell(row, 6).value = Number(point.po_created ?? 0);
          ws.getCell(row, 7).value = Number(point.po_received ?? 0);
          for (let col = 2; col <= 7; col += 1) {
            ws.getCell(row, col).numFmt = '#,##0.00';
          }
          styleBodyRow(row);
          row += 1;
        });
      }

      ws.eachRow((sheetRow) => {
        if (sheetRow.number === 1) {
          sheetRow.height = 24;
          return;
        }
        if (!sheetRow.height) {
          sheetRow.height = 20;
        }
      });
      autoFitWorksheetColumns(ws, { minWidth: 12, maxWidth: 52, padding: 2 });

      const summaryWs = workbook.addWorksheet('Management Summary');
      summaryWs.columns = [
        { width: 28 },
        { width: 18 },
        { width: 28 },
        { width: 18 },
        { width: 28 },
        { width: 18 },
      ];

      summaryWs.mergeCells('A1:F1');
      summaryWs.getCell('A1').value = 'Management Summary';
      summaryWs.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
      summaryWs.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      summaryWs.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      summaryWs.getRow(1).height = 28;

      summaryWs.mergeCells('A2:F2');
      summaryWs.getCell('A2').value = `${range.label} | ${branchLabel}`;
      summaryWs.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
      summaryWs.getCell('A2').font = { size: 11, color: { argb: 'FF334155' } };

      summaryWs.getCell('A4').value = 'Coverage';
      summaryWs.getCell('B4').value = `${range.from} to ${range.to}`;
      summaryWs.getCell('D4').value = 'Generated';
      summaryWs.getCell('E4').value = new Date().toLocaleString();
      ['A4', 'D4'].forEach((cell) => {
        summaryWs.getCell(cell).font = { bold: true };
      });

      let summaryRow = 6;
      summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
      summaryWs.getCell(`A${summaryRow}`).value = 'KPI Snapshot';
      summaryWs.getCell(`A${summaryRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
      summaryWs.getCell(`A${summaryRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
      for (let col = 1; col <= 6; col += 1) {
        summaryWs.getCell(summaryRow, col).border = tableBorder;
      }
      summaryRow += 1;

      const summaryMetrics: Array<[string, number, string, number]> = [
        ['Revenue', finance.revenue, 'Cash In', finance.cash_in],
        ['COGS', finance.cogs, 'Gross Profit', finance.gross_profit],
        ['Expense Total', finance.expense_total, 'Restock Spend', finance.restock_spend],
        ['Net Income', finance.net_income, 'Net Cashflow', finance.net_cashflow],
      ];

      summaryMetrics.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
        summaryWs.getCell(summaryRow, 1).value = leftLabel;
        summaryWs.getCell(summaryRow, 2).value = Number(leftValue ?? 0);
        summaryWs.getCell(summaryRow, 4).value = rightLabel;
        summaryWs.getCell(summaryRow, 5).value = Number(rightValue ?? 0);
        summaryWs.getCell(summaryRow, 2).numFmt = '#,##0.00';
        summaryWs.getCell(summaryRow, 5).numFmt = '#,##0.00';
        summaryWs.getCell(summaryRow, 1).font = { bold: true };
        summaryWs.getCell(summaryRow, 4).font = { bold: true };
        for (const col of [1, 2, 4, 5]) {
          summaryWs.getCell(summaryRow, col).border = tableBorder;
          summaryWs.getCell(summaryRow, col).alignment = { vertical: 'middle', horizontal: col === 1 || col === 4 ? 'left' : 'right' };
        }
        summaryRow += 1;
      });

      summaryRow += 1;
      summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
      summaryWs.getCell(`A${summaryRow}`).value = 'Voided / Refund Signals';
      summaryWs.getCell(`A${summaryRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
      summaryWs.getCell(`A${summaryRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
      for (let col = 1; col <= 6; col += 1) {
        summaryWs.getCell(summaryRow, col).border = tableBorder;
      }
      summaryRow += 1;

      const voidMetrics: Array<[string, number, string]> = [
        ['Voided Sales Count', finance.voided_sales_count, '#,##0'],
        ['Voided Sales Amount', finance.voided_sales_amount, '#,##0.00'],
        ['Voided Paid Amount', finance.voided_paid_amount, '#,##0.00'],
      ];
      voidMetrics.forEach(([label, value, numFmt]) => {
        summaryWs.getCell(summaryRow, 1).value = label;
        summaryWs.getCell(summaryRow, 2).value = Number(value ?? 0);
        summaryWs.getCell(summaryRow, 2).numFmt = numFmt;
        summaryWs.getCell(summaryRow, 1).font = { bold: true };
        for (const col of [1, 2]) {
          summaryWs.getCell(summaryRow, col).border = tableBorder;
          summaryWs.getCell(summaryRow, col).alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        }
        summaryRow += 1;
      });

      summaryRow += 1;
      summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
      summaryWs.getCell(`A${summaryRow}`).value = 'Voided Sales by Branch';
      summaryWs.getCell(`A${summaryRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
      summaryWs.getCell(`A${summaryRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
      for (let col = 1; col <= 6; col += 1) {
        summaryWs.getCell(summaryRow, col).border = tableBorder;
      }
      summaryRow += 1;

      const voidBranchSummaryHeader = ['Branch', 'Code', 'Voided Count', 'Voided Amount', 'Paid Amount on Voided', ''];
      voidBranchSummaryHeader.forEach((label, idx) => {
        const cell = summaryWs.getCell(summaryRow, idx + 1);
        cell.value = label;
        cell.font = { bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFEFF' } };
        cell.alignment = { vertical: 'middle', horizontal: idx <= 1 ? 'left' : 'right' };
        cell.border = tableBorder;
      });
      summaryRow += 1;

      const topVoidedBranches = voidedByBranch.slice(0, 6);
      if (topVoidedBranches.length === 0) {
        summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
        summaryWs.getCell(`A${summaryRow}`).value = 'No voided sales by branch for this period.';
        summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
        for (let col = 1; col <= 6; col += 1) {
          summaryWs.getCell(summaryRow, col).border = tableBorder;
        }
        summaryRow += 1;
      } else {
        topVoidedBranches.forEach((item) => {
          summaryWs.getCell(summaryRow, 1).value = item.branch_name ?? '-';
          summaryWs.getCell(summaryRow, 2).value = item.branch_code ?? '-';
          summaryWs.getCell(summaryRow, 3).value = Number(item.voided_sales_count ?? 0);
          summaryWs.getCell(summaryRow, 4).value = Number(item.voided_sales_amount ?? 0);
          summaryWs.getCell(summaryRow, 5).value = Number(item.voided_paid_amount ?? 0);
          summaryWs.getCell(summaryRow, 3).numFmt = '#,##0';
          summaryWs.getCell(summaryRow, 4).numFmt = '#,##0.00';
          summaryWs.getCell(summaryRow, 5).numFmt = '#,##0.00';
          for (let col = 1; col <= 6; col += 1) {
            const cell = summaryWs.getCell(summaryRow, col);
            cell.border = tableBorder;
            cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'right' };
          }
          summaryRow += 1;
        });
      }

      summaryRow += 1;
      summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
      summaryWs.getCell(`A${summaryRow}`).value = 'Top 5 Selling Products';
      summaryWs.getCell(`A${summaryRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
      summaryWs.getCell(`A${summaryRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
      for (let col = 1; col <= 6; col += 1) {
        summaryWs.getCell(summaryRow, col).border = tableBorder;
      }
      summaryRow += 1;

      const summaryHeader = ['#', 'SKU', 'Product', 'Qty Sold', 'Sales', 'Gross Profit'];
      summaryHeader.forEach((label, idx) => {
        const cell = summaryWs.getCell(summaryRow, idx + 1);
        cell.value = label;
        cell.font = { bold: true, color: { argb: 'FF111827' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFEFF' } };
        cell.alignment = { vertical: 'middle', horizontal: idx <= 2 ? 'left' : 'right' };
        cell.border = tableBorder;
      });
      summaryRow += 1;

      const topFive = topSelling.slice(0, 5);
      if (topFive.length === 0) {
        summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
        summaryWs.getCell(`A${summaryRow}`).value = 'No posted sales available for this period.';
        summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
        summaryWs.getCell(`A${summaryRow}`).border = tableBorder;
        summaryRow += 1;
      } else {
        topFive.forEach((item, idx) => {
          summaryWs.getCell(summaryRow, 1).value = idx + 1;
          summaryWs.getCell(summaryRow, 2).value = item.sku ?? '-';
          summaryWs.getCell(summaryRow, 3).value = item.product_name ?? '-';
          summaryWs.getCell(summaryRow, 4).value = Number(item.qty_sold ?? 0);
          summaryWs.getCell(summaryRow, 5).value = Number(item.sales_amount ?? 0);
          summaryWs.getCell(summaryRow, 6).value = Number(item.gross_profit ?? 0);
          summaryWs.getCell(summaryRow, 4).numFmt = '#,##0.000';
          summaryWs.getCell(summaryRow, 5).numFmt = '#,##0.00';
          summaryWs.getCell(summaryRow, 6).numFmt = '#,##0.00';
          for (let col = 1; col <= 6; col += 1) {
            const cell = summaryWs.getCell(summaryRow, col);
            cell.border = tableBorder;
            cell.alignment = { vertical: 'middle', horizontal: col <= 3 ? 'left' : 'right' };
          }
          summaryRow += 1;
        });
      }

      summaryRow += 1;
      summaryWs.mergeCells(`A${summaryRow}:F${summaryRow}`);
      summaryWs.getCell(`A${summaryRow}`).value = 'Performance Ratios';
      summaryWs.getCell(`A${summaryRow}`).font = { bold: true, color: { argb: 'FF0F172A' } };
      summaryWs.getCell(`A${summaryRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      summaryWs.getCell(`A${summaryRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
      for (let col = 1; col <= 6; col += 1) {
        summaryWs.getCell(summaryRow, col).border = tableBorder;
      }
      summaryRow += 1;

      const collectionRate = finance.revenue > 0 ? finance.cash_in / finance.revenue : 0;
      const grossMargin = finance.revenue > 0 ? finance.gross_profit / finance.revenue : 0;
      const netMargin = finance.revenue > 0 ? finance.net_income / finance.revenue : 0;
      const ratioRows: Array<[string, number]> = [
        ['Collection Rate (Cash In / Revenue)', collectionRate],
        ['Gross Margin (Gross Profit / Revenue)', grossMargin],
        ['Net Margin (Net Income / Revenue)', netMargin],
      ];

      ratioRows.forEach(([label, value]) => {
        summaryWs.getCell(summaryRow, 1).value = label;
        summaryWs.getCell(summaryRow, 2).value = Number(value ?? 0);
        summaryWs.getCell(summaryRow, 2).numFmt = '0.00%';
        summaryWs.getCell(summaryRow, 1).font = { bold: true };
        for (const col of [1, 2]) {
          summaryWs.getCell(summaryRow, col).border = tableBorder;
          summaryWs.getCell(summaryRow, col).alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
        }
        summaryRow += 1;
      });

      summaryWs.eachRow((sheetRow) => {
        if (!sheetRow.height) {
          sheetRow.height = 20;
        }
      });
      autoFitWorksheetColumns(summaryWs, { minWidth: 12, maxWidth: 50, padding: 2 });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `monthly-analytics-${month}${typeof branchId === 'number' ? `-branch-${branchId}` : ''}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError('Failed to export Excel report. Please try again.');
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monthly report for {range.label}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={0.8} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleExportExcel()}
            disabled={!canReportExport || summaryQuery.isLoading || isExporting}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => setOpenTodayReport(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Todays Report
          </Button>
          <Chip size="small" color="primary" variant="outlined" label={branchLabel} />
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1}>
          <TextField
            label="Report month"
            type="month"
            size="small"
            value={month}
            onChange={(event) => setMonth(normalizeMonthInput(event.target.value, currentMonth))}
            sx={{ minWidth: { md: 220 } }}
            InputLabelProps={{ shrink: true }}
          />

          {canBranchView ? (
            <TextField
              select
              label="Branch"
              size="small"
              value={branchId === '' ? 'ALL' : String(branchId)}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === 'ALL') {
                  setBranchId('');
                  return;
                }
                const parsed = Number(raw);
                if (Number.isFinite(parsed) && parsed > 0) setBranchId(parsed);
              }}
              sx={{ minWidth: { md: 240 } }}
            >
              <MenuItem value="ALL">All branches</MenuItem>
              {(branchesQuery.data ?? []).map((branch) => (
                <MenuItem key={branch.id} value={String(branch.id)}>
                  {branch.code} - {branch.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              size="small"
              label="Branch"
              value={user?.branch?.name ?? 'Assigned branch'}
              disabled
              sx={{ minWidth: { md: 240 } }}
            />
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Coverage: {range.from} to {range.to}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {summaryQuery.isFetching && <LinearProgress />}
      {summaryQuery.isError && <Alert severity="error">Failed to load analytics report.</Alert>}
      {exportError && <Alert severity="error">{exportError}</Alert>}

      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
        }}
      >
        <MetricCard label="Revenue" value={money(finance.revenue)} hint="Posted sales amount" tone="#0ea5e9" />
        <MetricCard label="Cash In" value={money(finance.cash_in)} hint="Collected payments" tone="#16a34a" />
        <MetricCard label="COGS" value={money(finance.cogs)} hint="Cost of sold goods" tone="#f97316" />
        <MetricCard label="Gross Profit" value={money(finance.gross_profit)} hint="Revenue - COGS" tone="#22c55e" />
        <MetricCard
          label="Expense Total"
          value={money(finance.expense_total)}
          hint="Posted operating expenses"
          tone="#fb7185"
        />
        <MetricCard
          label="Restock Spend"
          value={money(finance.restock_spend)}
          hint="Received purchase costs"
          tone="#ef4444"
        />
        <MetricCard
          label="Net Income"
          value={money(finance.net_income)}
          hint="Gross profit - expenses"
          tone={finance.net_income >= 0 ? '#0284c7' : '#dc2626'}
        />
        <MetricCard
          label="Net Cashflow"
          value={money(finance.net_cashflow)}
          hint="Cash in - restock spend - expenses"
          tone={finance.net_cashflow >= 0 ? '#0f766e' : '#dc2626'}
        />
        <MetricCard
          label="Voided Sales"
          value={money(finance.voided_sales_amount)}
          hint={`${numberFmt(finance.voided_sales_count)} voided checkout(s)`}
          tone="#b91c1c"
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Voided / Refund Summary
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Tracks checkout reversals posted in the selected month.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
          <Chip
            size="small"
            label={`Voided Sales: ${numberFmt(finance.voided_sales_count)}`}
            sx={{ bgcolor: '#fee2e2' }}
          />
          <Chip
            size="small"
            label={`Voided Amount: ${money(finance.voided_sales_amount)}`}
            sx={{ bgcolor: '#fee2e2' }}
          />
          <Chip
            size="small"
            label={`Paid Amount on Voided: ${money(finance.voided_paid_amount)}`}
            sx={{ bgcolor: '#ffedd5' }}
          />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Voided Sales by Branch
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Branch-level reversal activity for this month.
        </Typography>

        {voidedByBranch.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No voided sales recorded for the selected period.
          </Alert>
        ) : isCompact ? (
          <Stack spacing={0.9} sx={{ mt: 1 }}>
            {voidedByBranch.map((row) => (
              <Paper key={row.branch_id} variant="outlined" sx={{ p: 0.9 }}>
                <Stack spacing={0.45}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {row.branch_name ?? '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.branch_code ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Voided: {numberFmt(row.voided_sales_count)} • {money(row.voided_sales_amount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paid on voided: {money(row.voided_paid_amount)}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Box sx={{ mt: 1, overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <Box component="thead">
                <Box component="tr">
                  {['Branch', 'Code', 'Voided Count', 'Voided Amount', 'Paid Amount on Voided'].map((label) => (
                    <Box
                      key={label}
                      component="th"
                      sx={{
                        textAlign: label === 'Branch' || label === 'Code' ? 'left' : 'right',
                        py: 0.8,
                        px: 0.7,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {voidedByBranch.map((row) => (
                  <Box component="tr" key={row.branch_id}>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {row.branch_name ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {row.branch_code ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {numberFmt(row.voided_sales_count)}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {money(row.voided_sales_amount)}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {money(row.voided_paid_amount)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: '1fr', xl: '1.45fr 1fr' },
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Stock Movement Trend
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Daily inbound vs outbound quantities for the selected month
          </Typography>

          {trends.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No trend data available for this period.
            </Alert>
          ) : (
            <Box sx={{ mt: 1.4, overflowX: 'auto' }}>
              <Stack
                direction="row"
                spacing={0.85}
                alignItems="flex-end"
                sx={{ minWidth: Math.max(620, trends.length * 24), minHeight: 180 }}
              >
                {trends.map((point) => {
                  const inQty = Number(point.in_qty ?? 0);
                  const outQty = Number(point.out_qty ?? 0);
                  const inHeight = Math.max(3, (inQty / trendMax) * 120);
                  const outHeight = Math.max(3, (outQty / trendMax) * 120);
                  const dayText = String(new Date(point.date).getDate() || point.date);

                  return (
                    <Stack key={point.date} spacing={0.3} alignItems="center" sx={{ minWidth: 18 }}>
                      <Stack direction="row" spacing={0.2} alignItems="flex-end">
                        <Box sx={{ width: 6, height: inHeight, bgcolor: '#22c55e', borderRadius: 0.8 }} />
                        <Box sx={{ width: 6, height: outHeight, bgcolor: '#ef4444', borderRadius: 0.8 }} />
                      </Stack>
                      <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
                        {dayText}
                      </Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          )}

          <Stack direction="row" spacing={0.8} sx={{ mt: 1 }}>
            <Chip size="small" label={`Inbound: ${numberFmt(movementTotals.inQty)}`} sx={{ bgcolor: '#dcfce7' }} />
            <Chip size="small" label={`Outbound: ${numberFmt(movementTotals.outQty)}`} sx={{ bgcolor: '#fee2e2' }} />
            <Chip
              size="small"
              label={`Adjustments: ${numberFmt(movementTotals.adjustments)}`}
              sx={{ bgcolor: '#e0f2fe' }}
            />
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Branch Snapshot
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Top branches by current stock value
          </Typography>

          {topBranches.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No branch metrics available.
            </Alert>
          ) : (
            <Stack spacing={0.9} sx={{ mt: 1.2 }}>
              {topBranches.map((row) => (
                <Paper key={row.branch_id} variant="outlined" sx={{ p: 0.9 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {row.branch_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Low {numberFmt(row.low_stock_count)} - Out {numberFmt(row.out_of_stock_count)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {money(row.stock_value)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Top Selling Products
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Ranked by sold quantity from posted sales in the selected month
        </Typography>

        {topSelling.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            No posted sales available for this period.
          </Alert>
        ) : isCompact ? (
          <Stack spacing={0.9} sx={{ mt: 1 }}>
            {topSelling.map((row, idx) => (
              <Paper key={`${row.product_variant_id}-${idx}`} variant="outlined" sx={{ p: 0.9 }}>
                <Stack spacing={0.45}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      #{idx + 1} {row.product_name ?? '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {numberFmt(row.qty_sold)} sold
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {row.variant_name ?? '-'} • {row.sku ?? '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sales: {money(row.sales_amount)} • COGS: {money(row.cogs)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: row.gross_profit >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}
                  >
                    Gross: {money(row.gross_profit)} • Txns: {numberFmt(row.sales_count)}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Box sx={{ mt: 1, overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <Box component="thead">
                <Box component="tr">
                  {['#', 'SKU', 'Product', 'Variant', 'Qty Sold', 'Sales', 'COGS', 'Gross', 'Txns'].map((label) => (
                    <Box
                      key={label}
                      component="th"
                      sx={{
                        textAlign: label === 'Product' || label === 'Variant' || label === 'SKU' ? 'left' : 'right',
                        py: 0.8,
                        px: 0.7,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        color: 'text.secondary',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {topSelling.map((row, idx) => (
                  <Box component="tr" key={`${row.product_variant_id}-${idx}`}>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {idx + 1}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {row.sku ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {row.product_name ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider' }}>
                      {row.variant_name ?? '-'}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {numberFmt(row.qty_sold)}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {money(row.sales_amount)}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {money(row.cogs)}
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        py: 0.65,
                        px: 0.7,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        textAlign: 'right',
                        color: row.gross_profit >= 0 ? 'success.main' : 'error.main',
                        fontWeight: 600,
                      }}
                    >
                      {money(row.gross_profit)}
                    </Box>
                    <Box component="td" sx={{ py: 0.65, px: 0.7, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'right' }}>
                      {numberFmt(row.sales_count)}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Dialog open={openTodayReport} onClose={() => setOpenTodayReport(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.8}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Todays Report
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Real-time snapshot for {todayLabel}
              </Typography>
            </Box>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={todayDate}
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {todaySummaryQuery.isFetching && <LinearProgress sx={{ mb: 1, height: 4, borderRadius: 999 }} />}
          {todaySummaryQuery.isError ? (
            <Alert severity="error">Failed to load today's results.</Alert>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              }}
            >
              <MetricCard label="Revenue" value={money(todayFinance.revenue)} hint="Posted sales today" tone="#0ea5e9" />
              <MetricCard label="Cash In" value={money(todayFinance.cash_in)} hint="Payments collected today" tone="#16a34a" />
              <MetricCard label="COGS" value={money(todayFinance.cogs)} hint="Cost of sold goods today" tone="#f97316" />
              <MetricCard
                label="Expense Total"
                value={money(todayFinance.expense_total)}
                hint="Operating expenses posted today"
                tone="#fb7185"
              />
              <MetricCard
                label="Net Income"
                value={money(todayFinance.net_income)}
                hint="Gross profit - expenses"
                tone={todayFinance.net_income >= 0 ? '#0284c7' : '#dc2626'}
              />
              <MetricCard
                label="Net Cashflow"
                value={money(todayFinance.net_cashflow)}
                hint="Cash in - restock spend - expenses"
                tone={todayFinance.net_cashflow >= 0 ? '#0f766e' : '#dc2626'}
              />
              <MetricCard
                label="Restock Spend"
                value={money(todayFinance.restock_spend)}
                hint="Purchase costs received today"
                tone="#ef4444"
              />
              <MetricCard
                label="Voided Sales"
                value={money(todayFinance.voided_sales_amount)}
                hint={`${numberFmt(todayFinance.voided_sales_count)} voided checkout(s) today`}
                tone="#b91c1c"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTodayReport(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
