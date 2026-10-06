import CatalogBrowser from "../CatalogBrowser";
import { getLiveCatalogServices } from "@/lib/catalog/live-services";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  try {
    const services = await getLiveCatalogServices();
    return <CatalogBrowser initialCategory={decodeURIComponent(category)} initialServices={services} />;
  } catch {
    return <CatalogBrowser initialCategory={decodeURIComponent(category)} initialServices={[]} />;
  }
}
