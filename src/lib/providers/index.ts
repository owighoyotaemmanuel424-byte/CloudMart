import { GlobalgleClient } from "./globalgle";

export function getProvider(name: string) {
  switch (name) {
    case "globalgle": return new GlobalgleClient();
    default: throw new Error(`Unsupported provider: ${name}`);
  }
}
