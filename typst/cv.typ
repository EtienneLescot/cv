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
  paper : "a4",
  margin: (x: 7mm, y: 7mm),
  fill  : t.page-fill,
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
  leading : 0.62em,
  spacing : 0.75em,
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

// Accent bullet glyph
#let bullet = text(fill: t.accent, weight: "bold", size: 9pt)[›]

// Muted / secondary text
#let muted(content) = text(fill: t.muted, size: 8.5pt)[#content]

// ── Section card (rounded box with stroke) ────────────────────────────────────
#let section-box(prefix: "", title: "", body) = {
  block(
    width  : 100%,
    fill   : t.section-fill,
    stroke : 0.5pt + t.section-stroke,
    radius : 6pt,
    inset  : (x: 11pt, y: 10pt),
    below  : 7pt,
    breakable: true,
  )[
    // H2 — decorative prefix + uppercase title
    #text(
      size    : 8.5pt,
      weight  : "bold",
      fill    : t.accent,
      tracking: 1.5pt,
    )[#upper(prefix + " " + title)]
    #v(7pt)
    #body
  ]
}

// ── Contact card (blue background, no stroke) ─────────────────────────────────
#let contact-box(body) = {
  block(
    width  : 100%,
    fill   : t.contact-fill,
    radius : 6pt,
    inset  : (x: 11pt, y: 10pt),
    below  : 7pt,
  )[
    #text(
      size    : 8.5pt,
      weight  : "bold",
      fill    : t.contact-text,
      tracking: 1.5pt,
    )[#upper("## " + d.titles.contact)]
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
    block(above: 0pt, below: 3.5pt, content),
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
  v(5pt)
  text(size: 7.5pt, weight: "semibold", fill: t.muted, tracking: 0.8pt)[#upper(content)]
  v(3pt)
}

// ── Horizontal rule between experience items ──────────────────────────────────
#let exp-divider = {
  v(5pt)
  line(length: 100%, stroke: 0.4pt + t.divider)
  v(4pt)
}

// =============================================================================
// DOCUMENT CONTENT
// =============================================================================

// ── HEADER — Name + Tagline ───────────────────────────────────────────────────
#block(below: 8pt)[
  #text(
    size    : 25pt,
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
    row-gutter  : 4pt,
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
#section-box(prefix: ">>", title: d.titles.profile)[
  #text(size: 10pt)[#d.profile]
]

// ── SKILLS ────────────────────────────────────────────────────────────────────
#section-box(prefix: "[]", title: d.titles.skills)[
  #for skill in d.skills {
    cv-item(parse-rich(skill))
  }
]

// ── EXPERIENCES ───────────────────────────────────────────────────────────────
#section-box(prefix: "//", title: d.titles.experiences)[

  // ── Experience 1 : Fractional CTO (special structure) ──────────────────────
  #let exp0 = d.experiences.at(0)

  #exp-title(exp0.title)
  #muted(exp0.subtitle)

  // Open Source projects
  #sub-label(exp0.opensource.heading)
  #for proj in exp0.opensource.items {
    grid(
      columns      : (1fr, auto),
      column-gutter: 8pt,
      align        : (left + top, right + top),
      [#text(weight: "semibold")[#proj.title]#h(6pt)#muted(proj.stack)],
      muted(proj.link),
    )
    block(above: 2pt, below: 5pt)[#muted(proj.desc)]
  }

  // CTO Missions
  #sub-label(exp0.missions.heading)
  #for (i, mission) in exp0.missions.items.enumerate() {
    if i > 0 { v(4pt) }
    grid(
      columns      : (1fr, auto),
      column-gutter: 8pt,
      align        : (left + top, right + top),
      text(weight: "semibold")[#mission.title],
      muted(mission.sector),
    )
    v(2pt)
    for pt in mission.points {
      cv-item(parse-rich(pt))
    }
  }

  // ── Experiences 2 & 3 : simple structure ────────────────────────────────────
  #for exp in d.experiences.slice(1) {
    exp-divider

    grid(
      columns      : (1fr, auto),
      column-gutter: 8pt,
      align        : (left + top, right + top),
      exp-title(exp.title),
      block(above: 4pt)[#muted(exp.sector)],
    )

    for pt in exp.points {
      cv-item(parse-rich(pt))
    }
  }
]

// ── FORMATION ─────────────────────────────────────────────────────────────────
#section-box(prefix: "<>", title: d.titles.formation)[
  #for item in d.formation {
    cv-item(item)
  }
]

// ── LANGUAGES ─────────────────────────────────────────────────────────────────
#section-box(prefix: "||", title: d.titles.languages)[
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 14pt,
    ..d.languages.map(item => cv-item(item)),
  )
]

// ── INTERESTS ─────────────────────────────────────────────────────────────────
#section-box(prefix: "++", title: d.titles.interests)[
  #for item in d.interests {
    cv-item(parse-rich(item))
  }
]
