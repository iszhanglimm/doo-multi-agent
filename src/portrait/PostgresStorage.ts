import { ChildPortrait, ClassPortraitGroup } from '../core/types';
import { IPortraitStorage } from './IPortraitStorage';
import { Pool } from 'pg';

export class PostgresStorage implements IPortraitStorage {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS portraits (
        child_id VARCHAR(128) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        class_id VARCHAR(128) NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_portraits_class ON portraits(class_id);
    `);
    console.log('✅ PostgreSQL 数据表初始化完成');
  }

  async savePortrait(portrait: ChildPortrait): Promise<void> {
    await this.pool.query(
      `INSERT INTO portraits (child_id, name, class_id, data, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (child_id) DO UPDATE SET
         name = EXCLUDED.name,
         class_id = EXCLUDED.class_id,
         data = EXCLUDED.data,
         updated_at = NOW()`,
      [portrait.childId, portrait.name, portrait.classId, JSON.stringify(portrait)]
    );
  }

  async loadPortrait(childId: string): Promise<ChildPortrait | null> {
    const result = await this.pool.query(
      'SELECT data FROM portraits WHERE child_id = $1',
      [childId]
    );
    if (result.rows.length === 0) return null;
    return this.parsePortrait(result.rows[0].data);
  }

  async deletePortrait(childId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM portraits WHERE child_id = $1',
      [childId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listPortraits(): Promise<string[]> {
    const result = await this.pool.query('SELECT child_id FROM portraits ORDER BY updated_at DESC');
    return result.rows.map(r => r.child_id);
  }

  async loadAllPortraits(): Promise<ChildPortrait[]> {
    const result = await this.pool.query('SELECT data FROM portraits ORDER BY updated_at DESC');
    return result.rows.map(r => this.parsePortrait(r.data)).filter(Boolean) as ChildPortrait[];
  }

  async saveClassGroup(group: ClassPortraitGroup): Promise<void> {
    // Class groups are derived from portraits, no separate storage needed
  }

  async loadClassGroup(_classId: string): Promise<ClassPortraitGroup | null> {
    return null;
  }

  async exportToJSON(): Promise<string> {
    const portraits = await this.loadAllPortraits();
    return JSON.stringify({ exportTime: new Date().toISOString(), portraitCount: portraits.length, portraits }, null, 2);
  }

  async importFromJSON(jsonData: string): Promise<number> {
    try {
      const data = JSON.parse(jsonData);
      for (const portrait of data.portraits as ChildPortrait[]) {
        await this.savePortrait(portrait);
      }
      return data.portraits.length;
    } catch {
      return 0;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private parsePortrait(data: any): ChildPortrait | null {
    try {
      const portrait = typeof data === 'string' ? JSON.parse(data) : data;
      portrait.basePortrait.createdAt = new Date(portrait.basePortrait.createdAt);
      portrait.basePortrait.updatedAt = new Date(portrait.basePortrait.updatedAt);
      for (const a of portrait.basePortrait.assessments) {
        a.timestamp = new Date(a.timestamp);
      }
      return portrait;
    } catch {
      return null;
    }
  }
}
