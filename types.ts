
export type ExcelRow = { [key: string]: string | number | boolean | null };

export interface ParsedExcelData {
  headers: string[];
  rows: ExcelRow[];
  fileName: string;
}

export interface Report {
  writes: number;
  notFound: (string | number | boolean | null)[];
}

export interface ColumnSelectorSpec {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  specialOptions?: { value: string; label: string }[];
}
