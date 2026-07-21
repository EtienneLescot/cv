// =============================================================================
// CV TYPST TEMPLATE — Etienne Lescot
// Design: "doc-page" maquette (Claude Design) — single column, Inter,
// thin blue underlined uppercase section headers, A4 12mm margins.
// =============================================================================
// Compile example (run from the typst/ directory):
//   typst compile \
//     --font-path ../fonts/Inter/extras/otf \
//     --input locale=fr --input theme=light \
//     --input cv-url=https://etiennelescot.github.io/cv/ \
//     cv.typ ../dist/pdf/cv-fr-light.pdf
// =============================================================================

// ── Compile-time inputs ───────────────────────────────────────────────────────
#let locale     = sys.inputs.at("locale",  default: "fr")
#let theme-name = sys.inputs.at("theme",   default: "light")
#let cv-url     = sys.inputs.at("cv-url",  default: "https://etiennelescot.github.io/cv/")

// ── Data (preprocessed JSON from preprocess.js) ───────────────────────────────
#let d = json("data-" + locale + ".json")

// =============================================================================
// THEME — maquette palette (oklch, mapped from the Claude Design file)
// =============================================================================
#let themes = (
  light: (
    bg     : white,
    text   : oklch(24%, 0.01, 260deg),
    name   : oklch(20%, 0.01, 260deg),
    accent : oklch(42%, 0.09, 255deg),
    grey40 : oklch(40%, 0.01, 260deg),
    grey45 : oklch(45%, 0.01, 260deg),
    rule   : oklch(87%, 0.005, 255deg),
  ),
  dark: (
    bg     : oklch(20%, 0.015, 260deg),
    text   : oklch(90%, 0.006, 260deg),
    name   : oklch(98%, 0.002, 260deg),
    accent : oklch(72%, 0.11, 250deg),
    grey40 : oklch(68%, 0.01, 260deg),
    grey45 : oklch(62%, 0.01, 260deg),
    rule   : oklch(38%, 0.012, 260deg),
  ),
)
#let t = themes.at(theme-name, default: themes.light)

// =============================================================================
// PAGE & BASE TEXT
// =============================================================================
#set page(paper: "a4", margin: 12mm, fill: t.bg)

#set text(
  font     : "Inter",
  size     : 10.5pt,
  fill     : t.text,
  lang     : d.lang,
  hyphenate: false,
)
#set par(justify: false, leading: 0.5em, spacing: 0.5em)
#set heading(numbering: none)

// Bullet lists — small disc, hanging indent (mirrors ul padding-left:20px)
#set list(marker: text(fill: t.grey45)[•], indent: 1.5mm, body-indent: 2.4mm, spacing: 4pt)

// =============================================================================
// HELPERS
// =============================================================================
#let parse-rich(s) = {
  let parts = s.split("**")
  for (i, part) in parts.enumerate() {
    if calc.rem(i, 2) == 1 { strong(part) } else { part }
  }
}
#let strip-proto(u) = u.replace("https://", "").replace("http://", "")

// Section header — uppercase blue, thin bottom rule
#let section(title, first: false) = {
  if not first { v(13pt) }
  block(breakable: false, above: 0pt, below: 6pt)[
    #text(size: 9.75pt, weight: "bold", fill: t.accent, tracking: 0.7pt)[#upper(title)]
    #v(3.5pt)
    #line(length: 100%, stroke: 0.6pt + t.rule)
  ]
}

// Job title (h3) + optional italic sector line
#let job(title, sector: none, big: false) = {
  text(size: if big { 11pt } else { 10pt }, weight: "bold", fill: t.name)[#title]
  if sector != none and sector != "" {
    v(1.5pt)
    text(size: 8.25pt, style: "italic", fill: t.grey45)[#sector]
  }
  v(2.5pt)
}

// Sub-label (h4) — italic bold grey
#let sublabel(s) = {
  v(4pt)
  text(size: 9pt, weight: "bold", style: "italic", fill: t.grey40)[#s]
  v(2pt)
}

#let bullets(items) = list(..items)

// =============================================================================
// HEADER — Name · Tagline · Contact
// =============================================================================
#text(size: 19.5pt, weight: "bold", fill: t.name, tracking: -0.2pt)[#d.name]
#v(3pt)
#text(size: 9.75pt, weight: "semibold", fill: t.accent)[#d.tagline]
#v(6pt)
#{
  set text(size: 7.9pt, fill: t.grey40)
  let items = d.contact.map(item => {
    let val = if "url" in item { link(item.url)[#item.text] } else { item.text }
    [#item.label : #val]
  })
  items.join([ #text(fill: t.grey45)[·] ])
}
#v(10pt)

// =============================================================================
// PROFILE
// =============================================================================
#section(d.titles.profile, first: true)
#d.profile

// =============================================================================
// SKILLS
// =============================================================================
#section(d.titles.skills)
#bullets(d.skills.map(parse-rich))

// =============================================================================
// EXPERIENCES
// =============================================================================
#section(d.titles.experiences)

#let exp0 = d.experiences.at(0)
#job(exp0.title, big: true)
#exp0.subtitle

#sublabel(exp0.opensource.heading)
#for proj in exp0.opensource.items {
  v(3pt)
  text(size: 10pt, weight: "bold", fill: t.name)[#proj.title]
  v(1pt)
  text(size: 7.9pt, fill: t.grey45)[#strip-proto(proj.link)]
  v(1pt)
  proj.stack
  v(1.5pt)
  proj.desc
}

#sublabel(exp0.missions.heading)
#for (i, m) in exp0.missions.items.enumerate() {
  if i > 0 { v(4pt) }
  job(m.title, sector: m.sector)
  bullets(m.points.map(parse-rich))
}

#for exp in d.experiences.slice(1) {
  v(6pt)
  job(exp.title, sector: exp.sector)
  bullets(exp.points.map(parse-rich))
}

// =============================================================================
// FORMATION · LANGUAGES · INTERESTS
// =============================================================================
#section(d.titles.formation)
#bullets(d.formation)

#section(d.titles.languages)
#bullets(d.languages)

#if d.interests.len() > 0 {
  section(d.titles.interests)
  bullets(d.interests.map(parse-rich))
}
