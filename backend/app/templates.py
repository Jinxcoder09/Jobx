from .models import Template

TEMPLATES: list[Template] = [
    Template(
        id="classic", name="Classic",
        description="Timeless serif resume favored by traditional industries.",
        category="Traditional", layout="single",
        accentColor="#1f2937", fontFamily="Georgia",
    ),
    Template(
        id="modern", name="Modern",
        description="Clean sans-serif with a confident accent bar.",
        category="Modern", layout="single",
        accentColor="#2563eb", fontFamily="Inter",
    ),
    Template(
        id="minimal", name="Minimal",
        description="Generous whitespace and quiet typography.",
        category="Minimal", layout="single",
        accentColor="#0f172a", fontFamily="Inter",
    ),
    Template(
        id="elegant", name="Elegant",
        description="Refined serif with thin dividing rules.",
        category="Elegant", layout="single",
        accentColor="#7c2d12", fontFamily="Lora",
    ),
    Template(
        id="creative", name="Creative",
        description="Color block sidebar for designers and creatives.",
        category="Creative", layout="two-column",
        accentColor="#db2777", fontFamily="Inter",
    ),
    Template(
        id="executive", name="Executive",
        description="Authoritative layout with small caps headings.",
        category="Executive", layout="single",
        accentColor="#0b3d2e", fontFamily="Merriweather",
    ),
    Template(
        id="technical", name="Technical",
        description="Dense, monospaced accents for engineers.",
        category="Technical", layout="single",
        accentColor="#0ea5e9", fontFamily="IBM Plex Sans",
    ),
    Template(
        id="compact", name="Compact",
        description="Single-page tight layout for experienced pros.",
        category="Compact", layout="single",
        accentColor="#334155", fontFamily="Inter",
    ),
    Template(
        id="timeline", name="Timeline",
        description="Left rail timeline with date emphasis.",
        category="Modern", layout="two-column",
        accentColor="#9333ea", fontFamily="Inter",
    ),
    Template(
        id="bold", name="Bold",
        description="Oversized name and high contrast headings.",
        category="Bold", layout="single",
        accentColor="#ea580c", fontFamily="Inter",
    ),
    Template(
        id="academic", name="Academic",
        description="CV-style layout for research and academia.",
        category="Academic", layout="single",
        accentColor="#1e3a8a", fontFamily="Source Serif",
    ),
    Template(
        id="two-column", name="Two Column",
        description="Skills and contact left, content right.",
        category="Modern", layout="two-column",
        accentColor="#0d9488", fontFamily="Inter",
    ),
]
