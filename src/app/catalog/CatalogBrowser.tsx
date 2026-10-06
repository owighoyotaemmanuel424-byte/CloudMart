"use client";

import Link from "next/link";
import type { Route } from "next";
import "./catalog.css";
import { useEffect, useMemo, useState } from "react";

type Service = {
  slug: string;
  name: string;
  category?: string;
  description?: string;
  providerId?: string;
  requiredFields?: string[];
  pricing: { providerAmount: string; providerCurrency: string; sellMinor: string } | null;
};

const label = (value: string) =>
  value.replace(/[-_]+/g, " ").replace(/\b\w/g, character => character.toUpperCase());

const categoryKey = (value?: string) =>
  (value ?? "").trim().toLowerCase().replace(/[-_]+/g, " ");

const price = (service: Service) =>
  service.pricing
    ? "₦" + (Number(service.pricing.sellMinor) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })
    : "Pricing unavailable";

export default function CatalogBrowser({ initialCategory = "" }: { initialCategory?: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load live catalog");
        setServices(body.services || []);
      })
      .catch(error => setError(error instanceof Error ? error.message : "Unable to load live catalog"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => Array.from(
      new Map(
        services
          .filter(service => service.category?.trim())
          .map(service => [categoryKey(service.category), service.category!.trim()]),
      ).entries(),
    ).sort((a, b) => a[1].localeCompare(b[1])),
    [services],
  );

  const categoryCounts = useMemo(
    () => services.reduce<Record<string, number>>((counts, service) => {
      const key = categoryKey(service.category);
      if (key) counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
    [services],
  );

  const filtered = useMemo(() => {
    const selected = categoryKey(category);
    const search = query.trim().toLowerCase();

    return services.filter(service => {
      const matchesCategory = !selected || categoryKey(service.category) === selected;
      const haystack = [
        service.name,
        service.category || "",
        service.slug,
        service.description || "",
        service.providerId || "",
      ].join(" ").toLowerCase();

      return matchesCategory && (!search || haystack.includes(search));
    });
  }, [services, category, query]);

  const selectedCategoryLabel =
    categories.find(([key]) => key === categoryKey(category))?.[1] ||
    (category ? label(category) : "");

  return (
    <main className="catalog-page">
      <nav className="catalog-nav">
        <Link href="/" className="catalog-brand"><span>C</span>CLOUDMART</Link>
        <div>
          <Link href="/login">Sign in</Link>
          <Link href="/dashboard" className="catalog-nav-button">Account →</Link>
        </div>
      </nav>

      <header className="catalog-hero">
        <span className="section-kicker">LIVE TUDOWEBS CATALOG</span>
        <h1>Real products.<br /><em>Live pricing.</em></h1>
        <p>
          Every product shown here is loaded from the connected Tudowebs catalog.
          CloudMart does not use placeholder products or hardcoded catalog entries.
        </p>
        <div className="catalog-live-badge"><i /> Tudowebs connected · {services.length || "—"} live products</div>
      </header>

      <section className="catalog-controls">
        <div className="catalog-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search real products..."
            aria-label="Search live products"
          />
        </div>

        <div className="category-scroll">
          <button className={!category ? "selected" : ""} onClick={() => setCategory("")}>
            All <small>{services.length}</small>
          </button>
          {categories.map(([key, name]) => (
            <button key={key} className={categoryKey(category) === key ? "selected" : ""} onClick={() => setCategory(name)}>
              {label(name)} <small>{categoryCounts[key] || 0}</small>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="catalog-state">
          <strong>Loading live products…</strong>
          <p>Connecting to Tudowebs and reading its current catalog.</p>
        </div>
      ) : error ? (
        <div className="catalog-state error-box">
          <strong>Live catalog unavailable</strong>
          <p>{error}</p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      ) : (
        <>
          <div className="catalog-meta">
            <strong>{filtered.length}</strong> live product{filtered.length === 1 ? "" : "s"}
            {selectedCategoryLabel && <> in <b>{selectedCategoryLabel}</b></>}
          </div>

          {filtered.length ? (
            <div className="catalog-grid">
              {filtered.map((service, index) => (
                <article className="catalog-card" key={service.slug}>
                  <div className="catalog-card-top">
                    <span className="catalog-icon">{service.name.slice(0, 1).toUpperCase() || String(index + 1)}</span>
                    <span className="catalog-category">{label(service.category || "Digital")}</span>
                  </div>

                  <div className="catalog-product-source">
                    <span className="catalog-live-dot" /> LIVE PRODUCT · TUDOWEBS
                  </div>

                  <h2>{service.name}</h2>

                  <p>
                    {service.description ||
                      (service.requiredFields?.length
                        ? String(service.requiredFields.length) + " detail" +
                          (service.requiredFields.length === 1 ? "" : "s") +
                          " required at checkout."
                        : "Available for secure checkout.")}
                  </p>

                  {service.requiredFields?.length ? (
                    <div className="catalog-fields">
                      {service.requiredFields.slice(0, 3).map(field => <span key={field}>{label(field)}</span>)}
                      {service.requiredFields.length > 3 && <span>+{service.requiredFields.length - 3}</span>}
                    </div>
                  ) : null}

                  <div className="catalog-card-bottom">
                    <div>
                      <small>CloudMart selling price</small>
                      <strong>{price(service)}</strong>
                    </div>
                    <Link href={("/services/" + encodeURIComponent(service.slug)) as Route}>
                      Buy product <span>→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="catalog-state">
              <strong>No live products found.</strong>
              <p>Try another search or select All.</p>
              <button onClick={() => { setQuery(""); setCategory(""); }}>Clear filters</button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
