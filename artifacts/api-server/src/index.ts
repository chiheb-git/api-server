import 'dotenv/config';
import app from "./app";
import { logger } from "./lib/logger";
import { ensureDatabaseSchema } from "./lib/ensureDatabaseSchema";
import { pool } from "@workspace/db";

// Prevent uncaught exceptions from worker threads (e.g. Tesseract OCR bad image)
// from killing the server process. Log the error and keep running.
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — keeping server alive");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled rejection — keeping server alive");
});

async function start(): Promise<void> {
  try {
    await ensureDatabaseSchema(pool);
  } catch (err) {
    logger.error({ err }, "Échec du bootstrap SQL — arrêt");
    process.exit(1);
  }

  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error(
      "PORT environment variable is required but was not provided.",
    );
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();

