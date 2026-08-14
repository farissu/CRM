import ExcelJS from 'exceljs';
import type { MessageTemplate } from '@prisma/client';

const MAX_ROWS = 100_000;

export interface BroadcastExcelRow {
  phoneNumber: string;
  name?: string;
  variables: Record<string, string>;
}

export interface ParseBroadcastExcelResult {
  rows: BroadcastExcelRow[];
  errors: string[];
}

function extractBodyVariableCount(template: Pick<MessageTemplate, 'components'>): number {
  const components = template.components as Array<{ type: string; text?: string }>;
  const body = components.find(c => c.type === 'BODY');
  const matches = body?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
  const numbers = matches.map(m => Number(m.replace(/\{\{|\}\}/g, '')));
  return numbers.length > 0 ? Math.max(...numbers) : 0;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if ('richText' in value) {
      return (value as { richText: Array<{ text: string }> }).richText.map(part => part.text).join('').trim();
    }
    if ('error' in value) return '';
    if ('text' in value) return String((value as { text: unknown }).text ?? '').trim();
    if ('result' in value) return String((value as { result: unknown }).result ?? '').trim();
  }
  return String(value).trim();
}

export async function parseBroadcastExcel(
  buffer: Buffer,
  template: Pick<MessageTemplate, 'components'>
): Promise<ParseBroadcastExcelResult> {
  const varCount = extractBodyVariableCount(template);
  const errors: string[] = [];

  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs's own .d.ts shadows the real Node `Buffer` with a local
    // `interface Buffer extends ArrayBuffer {}` on this method's signature, which a
    // real Buffer never structurally satisfies; `any` is the accepted workaround.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
  } catch {
    errors.push('File is not a valid Excel (.xlsx) file');
    return { rows: [], errors };
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount === 0) {
    errors.push('Excel file is empty');
    return { rows: [], errors };
  }

  const headers: string[] = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = cellToString(cell.value);
  });

  const phoneCol = headers.indexOf('phone_number') + 1;
  if (phoneCol === 0) {
    errors.push('Excel file is missing the required "phone_number" column');
    return { rows: [], errors };
  }
  const nameCol = headers.indexOf('name') + 1;
  const varCols = Array.from({ length: varCount }, (_, i) => headers.indexOf(`var${i + 1}`) + 1);

  const totalDataRows = worksheet.rowCount - 1;
  const lastDataRow = Math.min(worksheet.rowCount, MAX_ROWS + 1);
  if (totalDataRows > MAX_ROWS) {
    errors.push(`Excel file has more than ${MAX_ROWS} rows; only the first ${MAX_ROWS} were used`);
  }

  const rows: BroadcastExcelRow[] = [];
  for (let r = 2; r <= lastDataRow; r++) {
    const row = worksheet.getRow(r);
    if (row.actualCellCount === 0) continue;

    const phoneNumber = cellToString(row.getCell(phoneCol).value);
    if (!phoneNumber) {
      errors.push(`Row ${r}: missing phone_number`);
      continue;
    }

    const variables: Record<string, string> = {};
    varCols.forEach((col, idx) => {
      variables[String(idx + 1)] = col > 0 ? cellToString(row.getCell(col).value) : '';
    });

    const name = nameCol > 0 ? cellToString(row.getCell(nameCol).value) : '';
    rows.push({ phoneNumber, name: name || undefined, variables });
  }

  return { rows, errors };
}

export async function buildExcelTemplate(template: Pick<MessageTemplate, 'components'>): Promise<Buffer> {
  const varCount = extractBodyVariableCount(template);
  const headers = ['phone_number', 'name', ...Array.from({ length: varCount }, (_, i) => `var${i + 1}`)];
  const sampleRow = ['6281234567890', 'Budi', ...Array.from({ length: varCount }, (_, i) => `Sample value ${i + 1}`)];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Broadcast');
  worksheet.addRow(headers);
  worksheet.addRow(sampleRow);
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach(column => {
    column.width = 24;
    // Force text format so Excel doesn't auto-convert values like phone numbers
    // to a number and silently drop a leading zero.
    column.numFmt = '@';
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
