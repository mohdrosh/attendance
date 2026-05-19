import { createApp } from './app';
import { config } from './config';
import { startCleanupJob } from './services/cleanupJob';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  startCleanupJob();
});
