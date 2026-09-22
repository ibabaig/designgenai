"use client";

import { useState } from "react";
import { ArrowDownRight, Menu, Sparkles, X } from "lucide-react";
import "./gallery.css";

const works = [
  { id: "01", title: "Hello, World", artist: "S. Terminal", year: "1972 / recompiled 2026", medium: "Letterpress ink on warm stock", style: "work-serif", span: "frame-tall" },
  { id: "02", title: "HELLO WORLD", artist: "A. Routine", year: "1984", medium: "Eight-color screenprint", style: "work-stencil", span: "frame-wide" },
  { id: "03", title: "hello / world", artist: "A. Syntax", year: "1991", medium: "Monospace laser transfer", style: "work-mono", span: "frame-square" },
  { id: "04", title: "HELLO WORLD!", artist: "M. Memory", year: "2001", medium: "Vinyl typography on black", style: "work-condensed frame-dark", span: "frame-wide" },
  { id: "05", title: "hello world", artist: "N. Neural", year: "2017", medium: "Pigment on cotton rag", style: "work-script", span: "frame-square" },
  { id: "06", title: "HELLO WORLD", artist: "C. Prompt", year: "2026", medium: "Reflective aluminum & ambient light", style: "work-hero", span: "frame-ultrawide" },
] as const;

type Work = (typeof works)[number];

export default function Home() {
  const [activeWork, setActiveWork] = useState<Work>(works[0]);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="gallery-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="MDA, return to top">M<span>_</span>DA</a>
        <div className="header-center">MUSEUM OF DIGITAL ART</div>
        <button type="button" className="menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          {menuOpen ? <X size={20} strokeWidth={1.8} /> : <Menu size={21} strokeWidth={1.8} />}
          <span>{menuOpen ? "CLOSE" : "MENU"}</span>
        </button>
      </header>

      {menuOpen && <nav className="drawer-nav" aria-label="Main navigation">
        <a href="#gallery" onClick={() => setMenuOpen(false)}>Gallery</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>About the show</a>
        <a href="#visit" onClick={() => setMenuOpen(false)}>Visit</a>
      </nav>}

      <main id="top">
        <section className="hero" aria-labelledby="exhibition-title">
          <div className="hero-topline"><span>EXHIBITION 01</span><span>GenAI Design Class Week 1</span></div>
          <h1 id="exhibition-title">HELLO<br /><em>WORLD.</em></h1>
          <div className="hero-bottomline">
            <p>A typographic study in first contact,<br className="desktop-only" /> systems, and small beginnings.</p>
            <a href="/artworks" className="hero-link">Enter the collection <ArrowDownRight size={19} strokeWidth={1.5} /></a>
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
                  <span className="work-index">{String(index + 1).padStart(2, "0")}</span><span className="work-title">{work.title}</span><span className="work-detail">A first program</span>
                </button>
              </article>)}
            </div>
            <aside className="work-label" aria-live="polite">
              <div className="label-marker"><Sparkles size={14} strokeWidth={1.7} /></div>
              <p className="label-number">WORK {activeWork.id} / 06</p><h3>{activeWork.title}</h3><p>{activeWork.artist}</p><p>{activeWork.year}</p><div className="label-rule" /><p className="label-medium">{activeWork.medium}</p>
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
