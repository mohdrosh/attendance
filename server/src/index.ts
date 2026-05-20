import fs from 'fs';
import path from 'path';
import { createApp } from './app';
import { config } from './config';
import { startCleanupJob } from './services/cleanupJob';

fs.mkdirSync(path.join(__dirname, '../../uploads'), { recursive: true });

const app = createApp();
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  startCleanupJob();
});
