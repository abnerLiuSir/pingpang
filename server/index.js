import { createApp } from './app.js';
import { openDatabase } from './db.js';

const port = Number(process.env.PORT || 5174);
const databasePath = process.env.DATABASE_PATH || 'data/pingpang.sqlite';

const db = openDatabase(databasePath);
const app = createApp({ db });

app.listen(port, () => {
  console.log(`PingPang app listening on http://localhost:${port}`);
});
