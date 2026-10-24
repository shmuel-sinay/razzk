export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  IVR_SECRET: string;
  ADMIN_PASSWORD: string;
  YEMOT_TOKEN?: string;
}

export type Row = Record<string, any>;

export interface ListOpts {
  match?: Row;
  order?: string; // "created_at.desc"
  limit?: number;
}

export interface Db {
  get(table: string, match: Row): Promise<Row | null>;
  list(table: string, opts?: ListOpts): Promise<Row[]>;
  insert(table: string, row: Row): Promise<Row>;
  insertMany(table: string, rows: Row[]): Promise<void>;
  update(table: string, match: Row, patch: Row): Promise<void>;
  upsert(table: string, row: Row, onConflict: string): Promise<Row>;
  remove(table: string, match: Row): Promise<void>;
  /** מחיקה לפי תנאי "ישן מ-" על עמודת זמן */
  removeOlderThan(table: string, col: string, isoDate: string): Promise<void>;
}
