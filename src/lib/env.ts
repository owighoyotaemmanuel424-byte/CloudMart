import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  GLOBALGLE_API_BASE_URL: z.string().url().default("https://tudowebs.com/api/v1"),
  GLOBALGLE_API_KEY: z.string().optional(),
  GLOBALGLE_WEBHOOK_SECRET: z.string().optional(),
  CLOUDMART_DEFAULT_MARKUP_PERCENT: z.coerce.number().min(0).default(15)
});

export function getEnv() {
  return schema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    GLOBALGLE_API_BASE_URL: process.env.GLOBALGLE_API_BASE_URL,
    GLOBALGLE_API_KEY: process.env.GLOBALGLE_API_KEY,
    GLOBALGLE_WEBHOOK_SECRET: process.env.GLOBALGLE_WEBHOOK_SECRET,
    CLOUDMART_DEFAULT_MARKUP_PERCENT: process.env.CLOUDMART_DEFAULT_MARKUP_PERCENT
  });
}
