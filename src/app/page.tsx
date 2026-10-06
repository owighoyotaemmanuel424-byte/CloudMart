import Link from "next/link";

const services = [
  { icon: "▦", title: "Airtime & data", text: "Top up major networks quickly from one account." },
  { icon: "◉", title: "Bills & utilities", text: "Pay everyday digital and utility services in one place." },
  { icon: "✦", title: "Digital services", text: "Discover a growing catalog of online products and services." },
  { icon: "↗", title: "Orders & tracking", text: "Follow every purchase from checkout to completion." },
];

const benefits = [
  ["One wallet", "Fund once and use your balance across the marketplace."],
  ["Secure checkout", "Payments are verified before wallet balances are credited."],
  ["Reliable delivery", "Orders are tracked with clear status and provider evidence."],
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand" aria-label="CloudMart home">
          <span className="brand-mark">C</span>
          <span>CLOUDMART</span>
        </Link>
        <div className="nav-links">
          <a href="#services">Services</a>
          <a href="#how-it-works">How it works</a>
        </div>
        <div className="nav-actions">
          <Link href="/login" className="nav-login">Sign in</Link>
          <Link href="/dashboard" className="nav-cta">Get started <span>→</span></Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> DIGITAL SERVICES MARKETPLACE</div>
          <h1>Everything digital.<br /><em>One marketplace.</em></h1>
          <p className="hero-lead">
            Buy digital services, manage your wallet and track every order from one simple CloudMart account.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="primary-btn">Start using CloudMart <span>→</span></Link>
            <a href="#services" className="secondary-btn">Explore services</a>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars"><span>CM</span><span>+</span></div>
            <p><strong>One account.</strong> Multiple digital services.</p>
          </div>
        </div>

        <div className="hero-card-wrap" aria-label="CloudMart wallet preview">
          <div className="glow" />
          <div className="wallet-preview">
            <div className="wallet-top"><span>CloudMart Wallet</span><span className="wallet-pill">NGN</span></div>
            <div className="wallet-balance">₦0.00</div>
            <div className="wallet-label">Available balance</div>
            <div className="wallet-divider" />
            <div className="wallet-bottom"><span>Ready when you are</span><span>•••• 0000</span></div>
          </div>
          <div className="floating-order">
            <span className="check">✓</span>
            <div><strong>Order tracked</strong><small>From checkout to delivery</small></div>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <span>BUILT FOR SIMPLE DIGITAL COMMERCE</span>
        <div><b>Secure wallet</b><i /> <b>Verified payments</b><i /> <b>Live order status</b></div>
      </section>

      <section id="services" className="section">
        <div className="section-heading">
          <div><span className="section-kicker">THE MARKETPLACE</span><h2>Digital services,<br />without the clutter.</h2></div>
          <p>CloudMart brings everyday digital purchases into a focused, easy-to-use experience.</p>
        </div>
        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <span className="service-icon">{service.icon}</span>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
              <Link href="/dashboard">Explore <span>↗</span></Link>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="dark-section">
        <div className="section-heading dark-heading">
          <div><span className="section-kicker">HOW IT WORKS</span><h2>Simple from<br />start to finish.</h2></div>
          <p>Create an account, fund your wallet and use your balance for the services you need.</p>
        </div>
        <div className="steps">
          {[["01", "Create your account", "Get a CloudMart account in a few moments."], ["02", "Fund your wallet", "Add funds securely through the payment flow."], ["03", "Choose a service", "Pick what you need from the live marketplace."], ["04", "Track your order", "See progress and status from your dashboard."]].map(([number, title, text]) => (
            <div className="step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></div>
          ))}
        </div>
      </section>

      <section className="benefits section">
        <div className="benefit-intro"><span className="section-kicker">WHY CLOUDMART</span><h2>Built around<br />your wallet.</h2><p>A cleaner way to manage digital purchases, balances and order history.</p></div>
        <div className="benefit-list">
          {benefits.map(([title, text], index) => <div className="benefit" key={title}><span>0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></div>)}
        </div>
      </section>

      <section className="final-cta">
        <span className="section-kicker">READY WHEN YOU ARE</span>
        <h2>Your digital marketplace<br /><em>starts here.</em></h2>
        <Link href="/dashboard" className="primary-btn">Enter CloudMart <span>→</span></Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="brand"><span className="brand-mark">C</span><span>CLOUDMART</span></Link>
        <p>Digital services, one marketplace.</p>
        <span>© {new Date().getFullYear()} CloudMart</span>
      </footer>
    </main>
  );
}
