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

const categoryIcon = (category?: string) => {
  const value = categoryKey(category);
  if (value.includes("website") || value.includes("domain")) return "◈";
  if (value.includes("mail") || value.includes("email")) return "@";
  if (value.includes("sms") || value.includes("message")) return "✦";
  if (value.includes("verify") || value.includes("2fa")) return "✓";
  if (value.includes("sim") || value.includes("esim")) return "⌁";
  if (value.includes("call") || value.includes("voice")) return "◉";
  if (value.includes("receipt")) return "▤";
  if (value.includes("wallet") || value.includes("fund")) return "₦";
  return "C";
};

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

  const groups = useMemo(() => {
    const grouped = new Map<string, Service[]>();
    for (const service of filtered) {
      const key = categoryKey(service.category) || "digital services";
      const existing = grouped.get(key) || [];
      existing.push(service);
      grouped.set(key, existing);
    }
    return Array.from(grouped.entries()).sort((a, b) => {
      const an = a[1][0]?.category || a[0];
      const bn = b[1][0]?.category || b[0];
      return an.localeCompare(bn);
    });
  }, [filtered]);

  const selectedCategoryLabel =
    categories.find(([key]) => key === categoryKey(category))?.[1] ||
    (category ? label(category) : "");

  return (
    <main className="catalog-page">
      <nav className="catalog-nav">
        <Link href="/" className="catalog-brand">
          <span>C</span>
          <b>CLOUDMART</b>
        </Link>

        <div className="catalog-nav-actions">
          <Link href="/catalog" className="catalog-nav-link">Marketplace</Link>
          <Link href="/login" className="catalog-nav-link">Sign in</Link>
          <Link href="/dashboard" className="catalog-nav-button">Account <span>→</span></Link>
        </div>
      </nav>

      <header className="catalog-hero">
        <div className="catalog-hero-copy">
          <span className="catalog-kicker"><i /> LIVE MARKETPLACE</span>
          <h1>Digital services<br /><em>that work.</em></h1>
          <p>
            Browse the live Tudowebs catalog and buy directly through CloudMart.
            Products, required details and pricing are loaded from the connected provider.
          </p>
        </div>

        <div className="catalog-hero-card">
          <div><span>LIVE CATALOG</span><b>{services.length || "—"}</b></div>
          <small>real provider products</small>
          <div className="catalog-hero-line" />
          <div className="catalog-provider"><i /> Tudowebs connected</div>
        </div>
      </header>

      <section className="catalog-controls">
        <div className="catalog-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search products..."
            aria-label="Search live products"
          />
        </div>

        <div className="category-scroll">
          <button className={!category ? "selected" : ""} onClick={() => setCategory("")}>
            All <small>{services.length}</small>
          </button>
          {categories.map(([key, name]) => (
            <button
              key={key}
              className={categoryKey(category) === key ? "selected" : ""}
              onClick={() => setCategory(name)}
            >
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
            <span><strong>{filtered.length}</strong> live products</span>
            {selectedCategoryLabel && <span>· {selectedCategoryLabel}</span>}
          </div>

          {groups.length ? groups.map(([key, items]) => (
            <section className="catalog-section" key={key}>
              <div className="catalog-section-heading">
                <div>
                  <h2>{label(items[0]?.category || key)} <span>TOOLS</span></h2>
                  <p>{items.length} live {items.length === 1 ? "product" : "products"} available</p>
                </div>
                <span className="catalog-section-count">{items.length}</span>
              </div>

              <div className="catalog-grid">
                {items.map(service => (
                  <article className="catalog-card" key={service.slug}>
                    <div className="catalog-card-top">
                      <div className="catalog-icon">{categoryIcon(service.category)}</div>
                      <span className="catalog-live-chip"><i /> LIVE</span>
                    </div>

                    <h3>{service.name}</h3>

                    <p>
                      {service.description ||
                        (service.requiredFields?.length
                          ? service.requiredFields.length + " checkout detail" +
                            (service.requiredFields.length === 1 ? "" : "s") + " required."
                          : "Available for secure checkout.")}
                    </p>

                    {service.requiredFields?.length ? (
                      <div className="catalog-fields">
                        {service.requiredFields.slice(0, 3).map(field => (
                          <span key={field}>{label(field)}</span>
                        ))}
                        {service.requiredFields.length > 3 && (
                          <span>+{service.requiredFields.length - 3}</span>
                        )}
                      </div>
                    ) : null}

                    <div className="catalog-card-bottom">
                      <div>
                        <small>SELLING PRICE</small>
                        <strong>{price(service)}</strong>
                      </div>
                      <Link href={("/services/" + encodeURIComponent(service.slug)) as Route}>
                        Buy <span>→</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )) : (
            <div className="catalog-state">
              <strong>No live products found.</strong>
              <p>Try another search or select All.</p>
              <button onClick={() => { setQuery(""); setCategory(""); }}>Clear filters</button>
            </div>
          )}
        </>
      )}

      <footer className="catalog-footer">
        <span>© CloudMart · Live digital marketplace</span>
        <span>Tudowebs provider connected</span>
      </footer>
    </main>
  );
}
