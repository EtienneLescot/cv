// =============================================================================
// CV TYPST TEMPLATE — Etienne Lescot
// =============================================================================
// Compile example (run from the typst/ directory):
//   typst compile \
//     --font-path ../fonts/Inter/extras/otf \
//     --input locale=fr --input theme=dark \
//     --input cv-url=https://etiennelescot.github.io/cv/ \
//     cv.typ ../dist/pdf/cv-fr-dark.pdf
// =============================================================================

// ── Compile-time inputs ───────────────────────────────────────────────────────
#let locale     = sys.inputs.at("locale",  default: "fr")
#let theme-name = sys.inputs.at("theme",   default: "dark")
#let cv-url     = sys.inputs.at("cv-url",  default: "https://etiennelescot.github.io/cv/")

// ── Data (preprocessed JSON from preprocess.js) ───────────────────────────────
#let d = json("data-" + locale + ".json")

// =============================================================================
// THEME DEFINITIONS
// Colors mapped exactly from style.css / style-pdf.css
// =============================================================================
#let themes = (
  dark: (
    page-fill     : rgb("#121620"),
    section-fill  : rgb("#171d2e"),   // glass-bg dark ≈ rgba(255,255,255,0.03) over #121620
    section-stroke: rgb("#252d42"),   // glass-border dark ≈ rgba(255,255,255,0.1)
    exp-fill      : rgb("#191d27"),   // full-bleed experiences bg (dark) — from style-pdf.css
    text          : rgb("#e0e0e0"),
    heading       : rgb("#ffffff"),
    h1            : rgb("#ffffff"),
    accent        : rgb("#007bff"),
    muted         : rgb("#a0aec0"),
    link          : rgb("#4da3ff"),
    contact-fill  : rgb("#007bff"),
    contact-text  : rgb("#ffffff"),
    divider       : rgb("#252d42"),
  ),
  light: (
    page-fill     : rgb("#e3ebf4"),   // --pdf-page-margin-color
    section-fill  : rgb("#ffffff"),   // --pdf-page-bg
    section-stroke: rgb("#ccd6e4"),   // glass-border light ≈ rgba(255,255,255,0.4) over #e3ebf4
    exp-fill      : rgb("#ffffff"),   // full-bleed experiences bg (light) — white band on grey page
    text          : rgb("#1a1a1c"),
    heading       : rgb("#1a1a1c"),
    h1            : rgb("#1a1a1c"),
    accent        : rgb("#007bff"),
    muted         : rgb("#718096"),
    link          : rgb("#2b6cb0"),
    contact-fill  : rgb("#007bff"),
    contact-text  : rgb("#ffffff"),
    divider       : rgb("#ccd6e4"),
  ),
)

#let t = themes.at(theme-name)

// =============================================================================
// PAGE & BASE TEXT SETUP
// =============================================================================
#set page(
  paper     : "a4",
  margin    : (x: 8mm, y: 8mm),
  fill      : t.page-fill,
  // Paint exp-fill into the top/bottom margins on pages where the experiences
  // section appears, so the band is seamless across page breaks.
  background: context {
    let pg = here().page()
    let ss = query(<exp-bleed-start>)
    let es = query(<exp-bleed-end>)
    if ss.len() == 0 or es.len() == 0 { return }
    let s-loc = ss.first().location()
    let e-loc = es.first().location()
    let sp = s-loc.page()
    let ep = e-loc.page()
    if pg < sp or pg > ep { return }
    let sy    = s-loc.position().y
    let ey    = e-loc.position().y
    let top-y = if pg == sp { sy } else { 0mm }
    let bot-y = if pg == ep { ey } else { 297mm }
    if bot-y <= top-y { return }
    place(left + top, dy: top-y,
      rect(width: 210mm, height: bot-y - top-y, fill: t.exp-fill)
    )
  },
)

#set text(
  font    : "Inter",
  size    : 9.5pt,
  fill    : t.text,
  lang    : d.lang,
  hyphenate: true,
)

#set par(
  justify : true,
  leading : 0.65em,
  spacing : 0.82em,
)

// Disable automatic heading numbering
#set heading(numbering: none)

// No default list markers — we'll draw our own
#set list(marker: none, indent: 0pt, body-indent: 0pt)

// =============================================================================
// COMPONENT LIBRARY
// =============================================================================

// Parse **bold** markers embedded by preprocess.js
#let parse-rich(s) = {
  let parts = s.split("**")
  for (i, part) in parts.enumerate() {
    if calc.rem(i, 2) == 1 { strong(part) } else { part }
  }
}

// Accent bullet — small filled circle (PDF graphic, not in text stream)
#let bullet = box(
  width : 7pt,
  height: 9pt,
  baseline: 1.5pt,
  align(center + horizon,
    circle(radius: 1pt, fill: t.accent)
  )
)

// Muted / secondary text
#let muted(content) = text(fill: t.muted, size: 8.5pt)[#content]

// ── Section heading: uppercase title only (no bar) ───────────────────────────
#let section-heading(title) = {
  text(size: 8.5pt, weight: "bold", fill: t.accent, tracking: 1.5pt)[#upper(title)]
}

// ── Section card (rounded box with stroke) ────────────────────────────────────
#let section-box(title: "", body) = {
  block(
    width  : 100%,
    fill   : t.section-fill,
    stroke : 0.5pt + t.section-stroke,
    radius : 6pt,
    inset  : (x: 11pt, y: 10pt),
    below  : 8pt,
    breakable: true,
  )[
    #section-heading(title)
    #v(8pt)
    #body
  ]
}

// ── Full-bleed experiences box (edge-to-edge, no card border) ──────────────────
// pad(x: -8mm) expands the available width by 2×8mm = full A4 width.
// block(width: 100%) then fills that full width.
// inset x = 8mm (compensate the margin expansion) + 11pt (regular content padding).
#let exp-bleed-box(title: "", body) = {
  // Metadata markers let the page background context know where this section
  // starts/ends so it can paint exp-fill into the top/bottom margin areas,
  // producing a continuous band across the page break.
  [#metadata("s") <exp-bleed-start>]
  pad(x: -8mm)[
    #block(
      width    : 100%,
      fill     : t.exp-fill,
      inset    : (x: 8mm + 11pt, top: 10pt, bottom: 5pt),
      above    : 6pt,
      below    : 0pt,
      breakable: true,
    )[
      #section-heading(title)
      #v(8pt)
      #body
    ]
  ]
  [#metadata("e") <exp-bleed-end>]
  // Force a visible non-collapsible gap in page-fill colour before next section.
  // A block() is immune to Typst's paragraph-spacing collapse, unlike v().
  block(height: 10pt, width: 100%, above: 0pt, below: 0pt)
}

// ── Contact card (blue background, no stroke) ─────────────────────────────────
#let contact-box(body) = {
  block(
    width  : 100%,
    fill   : t.contact-fill,
    radius : 6pt,
    inset  : (x: 11pt, y: 10pt),
    below  : 8pt,
  )[
    // Title (white on blue, no bar)
    #text(size: 8.5pt, weight: "bold", fill: t.contact-text, tracking: 1.5pt)[#upper(d.titles.contact)]
    #v(7pt)
    #body
  ]
}

// ── Standard list item (accent bullet + content) ──────────────────────────────
#let cv-item(content) = {
  grid(
    columns    : (8pt, 1fr),
    column-gutter: 4pt,
    align      : (center + top, left + top),
    bullet,
    block(above: 0pt, below: 4pt, content),
  )
}

// ── Experience title (h3 equivalent) ─────────────────────────────────────────
#let exp-title(content) = {
  v(2pt)
  text(size: 9.5pt, weight: "bold", fill: t.heading)[#content]
  v(1pt)
}

// ── Sub-section label (h4 equivalent, muted uppercase) ───────────────────────
#let sub-label(content) = {
  v(6pt)
  text(size: 7.5pt, weight: "semibold", fill: t.muted, tracking: 0.8pt)[#upper(content)]
  v(4pt)
}

// ── Horizontal rule between experience items ──────────────────────────────────
#let exp-divider = {
  v(6pt)
  line(length: 100%, stroke: 0.4pt + t.divider)
  v(5pt)
}

// =============================================================================
// DOCUMENT CONTENT
// =============================================================================

// ── HEADER — Name + Tagline ───────────────────────────────────────────────────
#block(below: 10pt)[
  #text(
    size    : 21pt,
    weight  : "extrabold",
    fill    : t.h1,
    tracking: 0.8pt,
  )[#upper(d.name)]
  #linebreak()
  #v(1pt)
  #text(
    size    : 7.5pt,
    weight  : "medium",
    fill    : t.muted,
    tracking: 2pt,
  )[#upper(d.tagline)]
]

// ── CONTACT ───────────────────────────────────────────────────────────────────
#contact-box[
  #grid(
    columns     : (1fr, 1fr),
    column-gutter: 14pt,
    row-gutter  : 5pt,
    ..d.contact.map(item => {
      set text(fill: t.contact-text, size: 8.5pt)
      let val = if "url" in item {
        link(item.url)[#text(fill: t.contact-text)[#item.text]]
      } else {
        text(fill: t.contact-text)[#item.text]
      }
      [#text(weight: "bold")[#item.label:] #val]
    }),
    // CV en ligne row
    if cv-url != "" {
      set text(fill: t.contact-text, size: 8.5pt)
      [#text(weight: "bold")[#d.cv_label] #link(cv-url)[#text(fill: t.contact-text)[#cv-url]]]
    },
  )
]

// ── PROFILE ───────────────────────────────────────────────────────────────────
#section-box(title: d.titles.profile)[
  #text(size: 10pt)[#d.profile]
]

// ── SKILLS ──────────────────────────────────────────────────────────────────────────────────────
#section-box(title: d.titles.skills)[
  #for skill in d.skills {
    cv-item(parse-rich(skill))
  }
]

// ── EXPERIENCES ─────────────────────────────────────────────────────────────────────────────────
#exp-bleed-box(title: d.titles.experiences)[

  // ── Experience 1 : Fractional CTO (special structure) ──────────────────────
  #let exp0 = d.experiences.at(0)

  #exp-title(exp0.title)
  #muted(exp0.subtitle)
  #v(2pt)
  #sub-label(exp0.opensource.heading)
  #for proj in exp0.opensource.items {
    v(3pt)
    text(weight: "semibold")[#proj.title]
    linebreak()
    muted(proj.stack)
    h(10pt)
    muted(proj.link)
    v(2pt)
    block(above: 2pt, below: 7pt)[#muted(proj.desc)]
  }

  // CTO Missions
  #sub-label(exp0.missions.heading)
  #for (i, mission) in exp0.missions.items.enumerate() {
    if i > 0 { v(6pt) }
    text(weight: "semibold")[#mission.title]
    linebreak()
    muted(mission.sector)
    v(3pt)
    for pt in mission.points {
      cv-item(parse-rich(pt))
    }
  }

  // ── Experiences 2 & 3 : simple structure ────────────────────────────────────
  #for exp in d.experiences.slice(1) {
    exp-divider

    exp-title(exp.title)
    muted(exp.sector)
    v(4pt)

    for pt in exp.points {
      cv-item(parse-rich(pt))
    }
  }
]

// ── FORMATION ─────────────────────────────────────────────────────────────────
#section-box(title: d.titles.formation)[
  #for item in d.formation {
    cv-item(item)
  }
]

// ── LANGUAGES ───────────────────────────────────────────────────────────────────
#section-box(title: d.titles.languages)[
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 14pt,
    ..d.languages.map(item => cv-item(item)),
  )
]

// ── INTERESTS ───────────────────────────────────────────────────────────────────
#section-box(title: d.titles.interests)[
  #for item in d.interests {
    cv-item(parse-rich(item))
  }
]
