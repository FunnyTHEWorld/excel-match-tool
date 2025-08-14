
export type ExcelRow = { [key: string]: string | number | boolean | null };

export interface ParsedExcelData {
  headers: string[];
  rows: ExcelRow[];
  fileName: string;
  merges?: { s: { r: number; c: number }; e: { r: number; c: number } }[];
}

export interface MismatchedData {
  key: string | number | boolean | null;
  leftValue: string | number | boolean | null;
  rightValue: string | number | boolean | null;
  a_row: ExcelRow;
}

export interface Report {
  isAudit: boolean;
  writes?: number;
  notFound: (string | number | boolean | null)[];
  matches?: number;
  mismatches?: number;
  mismatchedData?: MismatchedData[];
  a_headers?: string[];
  a2_header?: string;
  b2_header?: string;
}

export type CellSelection = Set<string>; // Set of cell coordinates, e.g., "r,c"

export interface ColumnSelectorSpec {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  specialOptions?: { value: string; label: string }[];
}
