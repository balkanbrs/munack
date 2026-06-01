import OpenAI from "openai";
import { S3Client } from "@aws-sdk/client-s3";
import { Supervisor } from "@workflowkit/agents";
import { createEdgeCache } from "@vercel/kv-runtime";

export function bootstrap() {
  return {
    client: new OpenAI(),
    storage: new S3Client({}),
    supervisor: new Supervisor(),
    cache: createEdgeCache()
  };
}
