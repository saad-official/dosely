// Deletes every row of every table (used by "Delete all data").
import { db } from './db';
import { doses, escalationsSent, medications, profiles, settings, syncState } from './schema';
import { notifyTables, TABLES } from './store';

export function wipeAllTables(): void {
  db.transaction((tx) => {
    for (const table of [doses, medications, profiles, settings, syncState, escalationsSent]) tx.delete(table).run();
  });
  notifyTables(...TABLES);
}
