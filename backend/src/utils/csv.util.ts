import Papa from 'papaparse';
import type { MessageTemplate } from '@prisma/client';

const MAX_ROWS = 100_000;

export interface BroadcastCsvRow {
  phoneNumber: string;
  name?: string;
  variables: Record<string, string>;
}

export interface ParseBroadcastCsvResult {
  rows: BroadcastCsvRow[];
  errors: string[];
}

function extractBodyVariableCount(template: Pick<MessageTemplate, 'components'>): number {
  const components = template.components as Array<{ type: string; text?: string }>;
  const body = components.find(c => c.type === 'BODY');
  const matches = body?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
  const numbers = matches.map(m => Number(m.replace(/\{\{|\}\}/g, '')));
  return numbers.length > 0 ? Math.max(...numbers) : 0;
}

export function parseBroadcastCsv(
  buffer: Buffer,
  separator: string,
  template: Pick<MessageTemplate, 'components'>
): ParseBroadcastCsvResult {
  const varCount = extractBodyVariableCount(template);
  const errors: string[] = [];

  const parsed = Papa.parse<Record<string, string>>(buffer.toString('utf-8'), {
    header: true,
    skipEmptyLines: true,
    delimiter: separator,
  });

  if (parsed.errors.length > 0) {
    errors.push(...parsed.errors.map(e => `Row ${e.row ?? '?'}: ${e.message}`));
  }

  const fields = parsed.meta.fields ?? [];
  if (!fields.includes('phone_number')) {
    errors.push('CSV is missing the required "phone_number" column');
    return { rows: [], errors };
  }

  const data = parsed.data.slice(0, MAX_ROWS);
  if (parsed.data.length > MAX_ROWS) {
    errors.push(`CSV has more than ${MAX_ROWS} rows; only the first ${MAX_ROWS} were used`);
  }

  const rows: BroadcastCsvRow[] = [];
  data.forEach((row, i) => {
    const phoneNumber = row.phone_number?.trim();
    if (!phoneNumber) {
      errors.push(`Row ${i + 2}: missing phone_number`);
      return;
    }

    const variables: Record<string, string> = {};
    for (let v = 1; v <= varCount; v++) {
      variables[String(v)] = row[`var${v}`]?.trim() ?? '';
    }

    rows.push({ phoneNumber, name: row.name?.trim() || undefined, variables });
  });

  return { rows, errors };
}

export function buildCsvTemplate(template: Pick<MessageTemplate, 'components'>): string {
  const varCount = extractBodyVariableCount(template);
  const headers = ['phone_number', 'name', ...Array.from({ length: varCount }, (_, i) => `var${i + 1}`)];
  const sampleRow = ['6281234567890', 'Budi', ...Array.from({ length: varCount }, (_, i) => `Sample value ${i + 1}`)];
  return Papa.unparse([headers, sampleRow]);
}
