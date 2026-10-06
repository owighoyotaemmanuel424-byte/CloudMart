import CatalogBrowser from "./CatalogBrowser";
import { getLiveCatalogServices } from "@/lib/catalog/live-services";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  try {
    const services = await getLiveCatalogServices();
    return <CatalogBrowser initialServices={services} />;
  } catch {
    return <CatalogBrowser initialServices={[]} />;
  }
}
