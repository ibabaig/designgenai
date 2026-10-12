"use client";

import { useState } from "react";
import { ArrowDownRight, Sparkles } from "lucide-react";
import "./gallery.css";

const works = [
  { id: "01", title: "Hello, World", pronunciation: "heh-LOH, wurld", lang: "en", dir: "ltr", artist: "S. Terminal", year: "1972 / recompiled 2026", medium: "Letterpress ink on warm stock", style: "work-serif", span: "frame-tall" },
  { id: "02", title: "مرحبًا بالعالم", pronunciation: "Marhaban bil-'aalam", lang: "ar", dir: "rtl", artist: "A. Routine", year: "1984", medium: "Eight-color screenprint", style: "work-stencil", span: "frame-wide" },
  { id: "03", title: "¡Hola, mundo!", pronunciation: "OH-lah, MOON-doh", lang: "es", dir: "ltr", artist: "A. Syntax", year: "1991", medium: "Monospace laser transfer", style: "work-mono", span: "frame-square" },
  { id: "04", title: "Привет, мир!", pronunciation: "pree-VYET, meer", lang: "ru", dir: "ltr", artist: "M. Memory", year: "2001", medium: "Vinyl typography on black", style: "work-condensed frame-dark", span: "frame-wide" },
  { id: "05", title: "你好，世界！", pronunciation: "nǐ hǎo, shìjiè", lang: "zh-Hans", dir: "ltr", artist: "N. Neural", year: "2017", medium: "Pigment on cotton rag", style: "work-script", span: "frame-square" },
  { id: "06", title: "سلام، دنیا!", pronunciation: "salaam, dunya", lang: "ur", dir: "rtl", artist: "C. Prompt", year: "2026", medium: "Reflective aluminum & ambient light", style: "work-hero", span: "frame-ultrawide" },
] as const;

type Work = (typeof works)[number];

export default function Home() {
  const [activeWork, setActiveWork] = useState<Work>(works[0]);
  return (
    <div className="gallery-shell">
      <header className="site-header">
        <nav className="top-tabs" aria-label="Main navigation">
          <a href="/">Hello</a>
          <a href="/permanent">Collection</a>
        </nav>
        <a className="header-center" href="/" aria-label="Museum of Digital Art home">Museum of Digital Art</a>
        <a className="header-account" href="/login">Member Sign In</a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="exhibition-title">
          <div className="hero-topline"><span>EXHIBITION 01</span></div>
          <h1 id="exhibition-title">HELLO<br /><em>WORLD.</em></h1>
          <div className="hero-bottomline">
            <p>A typographic study in first contact,<br className="desktop-only" /> systems, and small beginnings.</p>
            <a href="/collection" className="hero-link">Enter the collection <ArrowDownRight size={19} strokeWidth={1.5} /></a>
            <a href="/permanent" className="hero-link">Browse the permanent collection <ArrowDownRight size={19} strokeWidth={1.5} /></a>
          </div>
        </section>

        <section id="gallery" className="gallery-section" aria-labelledby="gallery-title">
          <div className="section-heading">
            <div><p className="eyebrow">THE PERMANENT COLLECTION</p><h2 id="gallery-title">Six ways<br />to greet a world.</h2></div>
            <div className="legend" aria-hidden="true"><span className="legend-dot" /><span>HOVER TO STEP CLOSER</span></div>
          </div>
          <div className="gallery-layout">
            <div className="gallery-grid" aria-label="Hello World typographic artworks">
              {works.map((work, index) => <article key={work.id} className={`artwork ${work.span}`}>
                <button type="button" className={`artwork-frame ${work.style} ${activeWork.id === work.id ? "is-active" : ""}`} onMouseEnter={() => setActiveWork(work)} onFocus={() => setActiveWork(work)} onClick={() => setActiveWork(work)} aria-label={`View ${work.title}, work ${work.id}`}>
                  <span className="frame-corner corner-tl" /><span className="frame-corner corner-br" />
                  <span className="work-index">{String(index + 1).padStart(2, "0")}</span><span className="work-title" lang={work.lang} dir={work.dir} aria-label={`Hello, World — ${work.lang}`}>{work.title}</span><span className="work-detail">{work.pronunciation}</span>
                </button>
              </article>)}
            </div>
            <aside className="work-label" aria-live="polite">
              <div className="label-marker"><Sparkles size={14} strokeWidth={1.7} /></div>
            <p className="label-number">WORK {activeWork.id} / 06</p><h3 lang={activeWork.lang} dir={activeWork.dir}>{activeWork.title}</h3><p>{activeWork.artist}</p><p>{activeWork.year}</p><div className="label-rule" /><p className="label-medium">{activeWork.medium}</p>
            </aside>
          </div>
        </section>

        <section id="about" className="about-section">
          <div className="about-stamp">M_DA<br />26</div>
          <p className="about-copy">A beginning is never neutral. It contains every version of what follows.</p>
        </section>
      </main>

      <footer id="visit" className="site-footer">
        <div className="footer-title">MUSEUM<br />OF DIGITAL ART</div>
        <div className="footer-meta"><p>Online exhibition, everywhere.</p><p>Open continuously.</p></div>
        <a className="footer-link" href="mailto:hello@example.com">Say hello <ArrowDownRight size={17} strokeWidth={1.7} /></a>
      </footer>
    </div>
  );
}
