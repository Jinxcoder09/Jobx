import io
import re
from typing import Any, List
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

# ─── Font Mapping ─────────────────────────────────────────────────────────────

def get_font_stack(font_family: str) -> tuple[str, str]:
    """Map font families to PostScript base fonts (Regular, Bold)."""
    f = font_family.lower()
    if "serif" in f or "georgia" in f or "source" in f:
        return "Times-Roman", "Times-Bold"
    if "mono" in f or "courier" in f or "jetbrains" in f:
        return "Courier", "Courier-Bold"
    return "Helvetica", "Helvetica-Bold"

# ─── URL Cleaners ─────────────────────────────────────────────────────────────

def clean_url(url: str, prefix: str = "https://") -> str:
    url = url.strip()
    if not url:
        return ""
    if url.startswith("http://") or url.startswith("https://") or url.startswith("mailto:"):
        return url
    if prefix == "mailto:" and "@" in url:
        return f"mailto:{url}"
    return f"{prefix}{url}"

# ─── Height Estimation & Story Partitioning ───────────────────────────────────

def estimate_flowable_height(flowable, col_width_pts: float) -> float:
    if isinstance(flowable, Spacer):
        return getattr(flowable, "_height", 10.0)
    elif isinstance(flowable, HRFlowable):
        return getattr(flowable, "thickness", 1.0) + getattr(flowable, "spaceBefore", 0.0) + getattr(flowable, "spaceAfter", 0.0) + 10.0
    elif isinstance(flowable, Paragraph):
        text = flowable.text or ""
        import re
        plain_text = re.sub(r'<[^>]*>', '', text)
        font_size = flowable.style.fontSize or 10.0
        leading = flowable.style.leading or (font_size * 1.2)
        space_before = flowable.style.spaceBefore or 0.0
        space_after = flowable.style.spaceAfter or 0.0
        
        char_width = 0.45 * font_size
        max_chars_per_line = max(15.0, col_width_pts / char_width)
        lines = len(plain_text) / max_chars_per_line
        lines += plain_text.count('\n')
        
        import math
        lines = math.ceil(lines)
        return lines * leading + space_before + space_after
    elif isinstance(flowable, KeepTogether):
        h_sum = 0.0
        for f in getattr(flowable, "_content", []):
            h_sum += estimate_flowable_height(f, col_width_pts)
        return h_sum
    elif isinstance(flowable, Table):
        row_heights = getattr(flowable, "_rowHeights", [])
        if row_heights and all(h is not None for h in row_heights):
            return sum(row_heights)
        h_sum = 0.0
        for r_idx in range(len(flowable._cellvalues)):
            r_height = 0.0
            for c_idx in range(len(flowable._cellvalues[r_idx])):
                cell = flowable._cellvalues[r_idx][c_idx]
                if isinstance(cell, list):
                    cell_h = sum(estimate_flowable_height(f, col_width_pts) for f in cell)
                else:
                    cell_h = estimate_flowable_height(cell, col_width_pts)
                r_height = max(r_height, cell_h)
            h_sum += r_height
        return h_sum or 20.0
    return 15.0

def partition_story(story: list, col_width_pts: float, page_height=630) -> list:
    pages = []
    current_page = []
    current_height = 0.0
    
    for f in story:
        fh = estimate_flowable_height(f, col_width_pts)
        if current_height + fh > page_height and current_page:
            pages.append(current_page)
            current_page = [f]
            current_height = fh
        else:
            current_page.append(f)
            current_height += fh
            
    if current_page:
        pages.append(current_page)
    return pages

# ─── PDF Document Builder Class ───────────────────────────────────────────────

class PdfResumeBuilder:
    def __init__(self, resume_data: dict):
        self.data = resume_data.get("data", {})
        self.theme = resume_data.get("theme", {})
        self.template_id = resume_data.get("templateId", "modern")

        # Layout configuration
        self.font_family = self.theme.get("fontFamily", "Inter")
        self.font_name, self.font_name_bold = get_font_stack(self.font_family)
        
        self.font_size = self.theme.get("fontSize", 11)
        self.line_spacing = self.theme.get("lineSpacing", 1.4)
        self.section_spacing = self.theme.get("sectionSpacing", 16)
        
        self.primary_color = colors.HexColor(self.theme.get("primaryColor", "#0f172a"))
        self.secondary_color = colors.HexColor(self.theme.get("secondaryColor", "#475569"))
        self.accent_color = colors.HexColor(self.theme.get("accentColor", "#2563eb"))
        
        self.layout_type = self.theme.get("layout", "single")

        # PostScript styles setup
        self.styles = getSampleStyleSheet()
        self.init_styles()

    def init_styles(self):
        # Base text styles
        self.style_normal = ParagraphStyle(
            "ResumeNormal",
            parent=self.styles["Normal"],
            fontName=self.font_name,
            fontSize=self.font_size,
            leading=self.font_size * self.line_spacing,
            textColor=self.secondary_color,
            spaceAfter=4,
        )
        self.style_bold = ParagraphStyle(
            "ResumeBold",
            parent=self.style_normal,
            fontName=self.font_name_bold,
            textColor=self.primary_color,
        )
        self.style_bullet = ParagraphStyle(
            "ResumeBullet",
            parent=self.style_normal,
            leftIndent=15,
            firstLineIndent=-10,
            spaceAfter=2,
        )

    def get_col_widths_for_section(self, section_name: str) -> List[float]:
        """Determine column widths for nested tables based on layout context."""
        is_two_col = (
            self.layout_type == "two-column" or
            self.template_id in ["creative", "two-column", "timeline"]
        )
        if is_two_col:
            sidebar_keys = ["skills", "languages", "certifications", "achievements"]
            if section_name in sidebar_keys:
                return [1.6 * inch, 0.8 * inch]
            else:
                return [3.1 * inch, 1.4 * inch]
        else:
            return [5.0 * inch, 2.1 * inch]

    def keep_together_if_single_column(self, flowables_list: List[Any]) -> List[Any]:
        """Wrap items in KeepTogether only if layout is single-column, avoiding Table nested KeepTogether canv errors."""
        is_two_col = (
            self.layout_type == "two-column" or
            self.template_id in ["creative", "two-column", "timeline"]
        )
        if is_two_col:
            return flowables_list
        else:
            return [KeepTogether(flowables_list)]



    def get_section_heading_style(self, text: str) -> Paragraph:
        """Create styled section headings based on the template ID."""
        t_id = self.template_id
        heading_text = text.upper() if t_id in ["elegant", "classic", "academic", "executive"] else text
        
        # Technical prefix
        if t_id == "technical":
            heading_text = f"# {heading_text}"

        style = ParagraphStyle(
            f"SecHeading_{text}",
            parent=self.styles["Heading2"],
            fontName=self.font_name_bold,
            fontSize=self.font_size + 1.5,
            leading=(self.font_size + 1.5) * 1.3,
            textColor=self.accent_color,
            spaceBefore=8,
            spaceAfter=4,
            keepWithNext=True,
        )
        return Paragraph(heading_text, style)

    def get_link_html(self, text: str, url: str) -> str:
        """Return raw HTML hyperlink for ReportLab paragraphs."""
        accent_hex = self.theme.get("accentColor", "#2563eb")
        return f'<a href="{url}" color="{accent_hex}"><u>{text}</u></a>'

    def build_header(self) -> List[Any]:
        """Generate styled header block based on templateId."""
        p_info = self.data.get("personal", {})
        name = p_info.get("fullName", "Your Name")
        title = p_info.get("title", "")
        
        meta = []
        if p_info.get("email"):
            meta.append(self.get_link_html(p_info["email"], clean_url(p_info["email"], "mailto:")))
        if p_info.get("phone"):
            meta.append(p_info["phone"])
        if p_info.get("location"):
            meta.append(p_info["location"])
        if p_info.get("website"):
            meta.append(self.get_link_html(p_info["website"], clean_url(p_info["website"])))
        if p_info.get("linkedin"):
            meta.append(self.get_link_html("LinkedIn", clean_url(p_info["linkedin"], "https://linkedin.com/in/")))
        if p_info.get("github"):
            meta.append(self.get_link_html("GitHub", clean_url(p_info["github"], "https://github.com/")))

        t_id = self.template_id
        flowables = []

        # Elegant/Classic/Academic centered headers
        if t_id in ["elegant", "academic", "classic"]:
            name_text = name.upper()
            title_text = f"<i>{title}</i>" if title else ""
            
            style_name = ParagraphStyle(
                "HeaderNameElegant",
                parent=self.styles["Heading1"],
                fontName=self.font_name_bold,
                fontSize=self.font_size + 8,
                leading=(self.font_size + 8) * 1.2,
                textColor=self.primary_color,
                alignment=1, # Center
                spaceAfter=3,
            )
            style_title = ParagraphStyle(
                "HeaderTitleElegant",
                parent=self.style_normal,
                fontSize=self.font_size + 1,
                alignment=1, # Center
                spaceAfter=6,
            )
            style_meta = ParagraphStyle(
                "HeaderMetaElegant",
                parent=self.style_normal,
                fontSize=self.font_size - 2,
                alignment=1, # Center
                textColor=self.secondary_color,
            )
            
            flowables.append(Paragraph(name_text, style_name))
            if title_text:
                flowables.append(Paragraph(title_text, style_title))
            
            # Metadata block with top/bottom lines
            meta_str = "   &middot;   ".join(meta)
            flowables.append(HRFlowable(width="100%", thickness=1, color=self.accent_color, spaceBefore=4, spaceAfter=4))
            flowables.append(Paragraph(meta_str, style_meta))
            flowables.append(HRFlowable(width="100%", thickness=1, color=self.accent_color, spaceBefore=4, spaceAfter=8))
            return flowables

        # Executive template header
        if t_id == "executive":
            style_name = ParagraphStyle(
                "HeaderNameExec",
                parent=self.styles["Heading1"],
                fontName=self.font_name_bold,
                fontSize=self.font_size + 9,
                leading=(self.font_size + 9) * 1.2,
                textColor=self.primary_color,
                spaceAfter=4,
            )
            style_title = ParagraphStyle(
                "HeaderTitleExec",
                parent=self.style_normal,
                fontName=self.font_name_bold,
                fontSize=self.font_size - 1,
                textColor=self.accent_color,
                spaceAfter=6,
            )
            style_meta = ParagraphStyle(
                "HeaderMetaExec",
                parent=self.style_normal,
                fontSize=self.font_size - 1,
            )
            flowables.append(Paragraph(name, style_name))
            if title:
                flowables.append(Paragraph(title.upper(), style_title))
            flowables.append(Paragraph("   |   ".join(meta), style_meta))
            flowables.append(Spacer(1, 10))
            return flowables

        # Bold template header
        if t_id == "bold":
            style_name = ParagraphStyle(
                "HeaderNameBold",
                parent=self.styles["Heading1"],
                fontName=self.font_name_bold,
                fontSize=self.font_size + 14,
                leading=(self.font_size + 14) * 1.1,
                textColor=self.primary_color,
                spaceAfter=3,
            )
            style_title = ParagraphStyle(
                "HeaderTitleBold",
                parent=self.style_normal,
                fontName=self.font_name_bold,
                fontSize=self.font_size + 1,
                textColor=self.accent_color,
                spaceAfter=6,
            )
            style_meta = ParagraphStyle(
                "HeaderMetaBold",
                parent=self.style_normal,
                fontSize=self.font_size - 1,
            )
            flowables.append(Paragraph(name, style_name))
            if title:
                flowables.append(Paragraph(title, style_title))
            flowables.append(Paragraph("   &middot;   ".join(meta), style_meta))
            flowables.append(Spacer(1, 12))
            return flowables

        # Technical template header
        if t_id == "technical":
            style_name = ParagraphStyle(
                "HeaderNameTech",
                parent=self.styles["Heading1"],
                fontName=self.font_name_bold,
                fontSize=self.font_size + 6,
                leading=(self.font_size + 6) * 1.2,
                textColor=self.primary_color,
                spaceAfter=2,
            )
            style_title = ParagraphStyle(
                "HeaderTitleTech",
                parent=self.style_normal,
                fontName=self.font_name,
                fontSize=self.font_size,
                textColor=self.accent_color,
                spaceAfter=4,
            )
            flowables.append(Paragraph(name, style_name))
            if title:
                flowables.append(Paragraph(f"// {title}", style_title))
            flowables.append(Paragraph("   &middot;   ".join(meta), self.style_normal))
            flowables.append(Spacer(1, 10))
            return flowables

        # Default / Modern / Creative left-aligned headers
        style_name = ParagraphStyle(
            "HeaderNameDefault",
            parent=self.styles["Heading1"],
            fontName=self.font_name_bold,
            fontSize=self.font_size + 7,
            leading=(self.font_size + 7) * 1.2,
            textColor=self.primary_color,
            spaceAfter=2,
        )
        style_title = ParagraphStyle(
            "HeaderTitleDefault",
            parent=self.style_normal,
            fontName=self.font_name_bold,
            fontSize=self.font_size,
            textColor=self.accent_color,
            spaceAfter=4,
        )
        flowables.append(Paragraph(name, style_name))
        if title:
            flowables.append(Paragraph(title, style_title))
        flowables.append(Paragraph("   &middot;   ".join(meta), self.style_normal))
        flowables.append(Spacer(1, 10))
        return flowables

    def build_summary(self) -> List[Any]:
        summary_text = self.data.get("summary", "")
        if not summary_text:
            return []
        
        flowables = [
            self.get_section_heading_style("Summary"),
            Paragraph(summary_text, self.style_normal),
            Spacer(1, self.section_spacing),
        ]
        return flowables

    def build_experience(self) -> List[Any]:
        exp = self.data.get("experience", [])
        if not exp:
            return []
        
        flowables = [self.get_section_heading_style("Experience")]
        for item in exp:
            company = item.get("company", "")
            role = item.get("role", "")
            loc = item.get("location", "")
            start = item.get("startDate", "")
            end = "Present" if item.get("current") else item.get("endDate", "")
            date_str = " &ndash; ".join(filter(None, [start, end]))

            # Company, Role, Dates row
            header_parts = []
            if role:
                header_parts.append(f"<b>{role}</b>")
            if company:
                header_parts.append(company)
            
            header_left = " &middot; ".join(header_parts)
            
            # Construct a row with metadata on the right
            tbl_data = [
                [Paragraph(header_left, self.style_normal), Paragraph(date_str, ParagraphStyle("DateRight", parent=self.style_normal, alignment=2))]
            ]
            col_w = self.get_col_widths_for_section("experience")
            t = Table(tbl_data, colWidths=col_w)
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 2),
            ]))
            
            exp_flowables = [t]
            if loc:
                exp_flowables.append(Paragraph(f"<i>{loc}</i>", ParagraphStyle("Loc", parent=self.style_normal, fontSize=self.font_size-1, spaceAfter=2)))
            
            for bullet in item.get("bullets", []):
                if bullet.strip():
                    exp_flowables.append(Paragraph(f"&bull; {bullet}", self.style_bullet))
            
            exp_flowables.append(Spacer(1, 6))
            flowables.extend(self.keep_together_if_single_column(exp_flowables))
            
        flowables.append(Spacer(1, self.section_spacing - 6))
        return flowables

    def build_education(self) -> List[Any]:
        edu = self.data.get("education", [])
        if not edu:
            return []
        
        flowables = [self.get_section_heading_style("Education")]
        for item in edu:
            school = item.get("school", "")
            degree = item.get("degree", "")
            field = item.get("field", "")
            loc = item.get("location", "")
            start = item.get("startDate", "")
            end = item.get("endDate", "")
            date_str = " &ndash; ".join(filter(None, [start, end]))
            gpa = item.get("gpa", "")

            degree_field = ", ".join(filter(None, [degree, field]))
            header_left = f"<b>{degree_field}</b>" if degree_field else school
            
            tbl_data = [
                [Paragraph(header_left, self.style_normal), Paragraph(date_str, ParagraphStyle("DateRight", parent=self.style_normal, alignment=2))]
            ]
            col_w = self.get_col_widths_for_section("education")
            t = Table(tbl_data, colWidths=col_w)
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 2),
            ]))
            
            edu_flowables = [t]
            
            sub_parts = []
            if degree_field and school:
                sub_parts.append(school)
            if loc:
                sub_parts.append(loc)
            if gpa:
                sub_parts.append(f"GPA: {gpa}")
                
            if sub_parts:
                edu_flowables.append(Paragraph(" &middot; ".join(sub_parts), ParagraphStyle("EduSub", parent=self.style_normal, fontSize=self.font_size-1, spaceAfter=2)))
            
            desc = item.get("description", "")
            if desc:
                edu_flowables.append(Paragraph(desc, self.style_normal))
                
            edu_flowables.append(Spacer(1, 6))
            flowables.extend(self.keep_together_if_single_column(edu_flowables))
            
        flowables.append(Spacer(1, self.section_spacing - 6))
        return flowables

    def build_projects(self) -> List[Any]:
        proj = self.data.get("projects", [])
        if not proj:
            return []
        
        flowables = [self.get_section_heading_style("Projects")]
        for item in proj:
            name = item.get("name", "")
            link = item.get("link", "")
            desc = item.get("description", "")
            tech = item.get("technologies", [])

            header_left = f"<b>{name}</b>"
            if link:
                header_left += f" &middot; {self.get_link_html(link, clean_url(link))}"
                
            proj_flowables = [Paragraph(header_left, self.style_normal)]
            if desc:
                proj_flowables.append(Paragraph(desc, self.style_normal))
                
            for bullet in item.get("bullets", []):
                if bullet.strip():
                    proj_flowables.append(Paragraph(f"&bull; {bullet}", self.style_bullet))
                    
            if tech:
                proj_flowables.append(Paragraph(f"<i>Technologies: {', '.join(tech)}</i>", ParagraphStyle("Tech", parent=self.style_normal, fontSize=self.font_size-1, textColor=self.secondary_color, spaceBefore=2)))
                
            proj_flowables.append(Spacer(1, 6))
            flowables.extend(self.keep_together_if_single_column(proj_flowables))
            
        flowables.append(Spacer(1, self.section_spacing - 6))
        return flowables

    def build_skills(self) -> List[Any]:
        skills = self.data.get("skills", [])
        if not skills:
            return []
        
        flowables = [self.get_section_heading_style("Skills")]
        for grp in skills:
            cat = grp.get("category", "Skills")
            items = grp.get("items", [])
            if items:
                flowables.append(Paragraph(f"<b>{cat}:</b> {', '.join(items)}", self.style_normal))
                
        flowables.append(Spacer(1, self.section_spacing))
        return flowables

    def build_simple_list(self, heading: str, items: List[dict]) -> List[Any]:
        if not items:
            return []
        
        flowables = [self.get_section_heading_style(heading)]
        for item in items:
            title = item.get("title", "")
            subtitle = item.get("subtitle", "")
            date = item.get("date", "")
            desc = item.get("description", "")

            title_left = f"<b>{title}</b>"
            if subtitle:
                title_left += f" &middot; {subtitle}"
                
            tbl_data = [
                [Paragraph(title_left, self.style_normal), Paragraph(date, ParagraphStyle("DateRight", parent=self.style_normal, alignment=2))]
            ]
            col_w = self.get_col_widths_for_section(heading.lower())
            t = Table(tbl_data, colWidths=col_w)
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 2),
            ]))
            
            item_flowables = [t]
            if desc:
                item_flowables.append(Paragraph(desc, self.style_normal))
                
            item_flowables.append(Spacer(1, 4))
            flowables.extend(self.keep_together_if_single_column(item_flowables))
            
        flowables.append(Spacer(1, self.section_spacing - 4))
        return flowables

    def build_languages(self) -> List[Any]:
        langs = self.data.get("languages", [])
        if not langs:
            return []
        
        flowables = [self.get_section_heading_style("Languages")]
        parts = []
        for l in langs:
            name = l.get("name", "")
            lvl = l.get("level", "")
            parts.append(f"{name} ({lvl})" if lvl else name)
            
        flowables.append(Paragraph(" &middot; ".join(parts), self.style_normal))
        flowables.append(Spacer(1, self.section_spacing))
        return flowables

    def build_custom_sections(self) -> List[Any]:
        customs = self.data.get("custom", [])
        if not customs:
            return []
        
        flowables = []
        for cs in customs:
            title = cs.get("title", "Custom Section")
            items = cs.get("items", [])
            flowables.extend(self.build_simple_list(title, items))
        return flowables

    def build_section(self, key: str) -> List[Any]:
        if key == "summary":
            return self.build_summary()
        if key == "experience":
            return self.build_experience()
        if key == "education":
            return self.build_education()
        if key == "projects":
            return self.build_projects()
        if key == "skills":
            return self.build_skills()
        if key == "certifications":
            return self.build_simple_list("Certifications", self.data.get("certifications", []))
        if key == "achievements":
            return self.build_simple_list("Achievements", self.data.get("achievements", []))
        if key == "languages":
            return self.build_languages()
        return []

    def generate(self) -> bytes:
        """Process section orders and layouts and compile ReportLab PDF stream."""
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            pdf_buffer,
            pagesize=letter,
            leftMargin=0.7*inch,
            rightMargin=0.7*inch,
            topMargin=0.6*inch,
            bottomMargin=0.6*inch,
        )

        order = self.data.get("sectionOrder", [
            "summary", "experience", "education", "projects",
            "skills", "certifications", "achievements", "languages"
        ])

        story = []
        # 1. Header (Personal Info) is always top
        story.extend(self.build_header())

        # 2. Check layout styling
        is_two_col = (
            self.layout_type == "two-column" or
            self.template_id in ["creative", "two-column", "timeline"]
        )

        if is_two_col:
            # Multi-column table layout: split categories
            sidebar_keys = ["skills", "languages", "certifications", "achievements"]
            
            # Distribute sections to left (sidebar) / right (main)
            if self.template_id == "creative":
                # Creative layout: Sidebar on left (asideKeys), Main on right (mainKeys)
                left_keys = [k for k in order if k in sidebar_keys]
                right_keys = [k for k in order if k not in sidebar_keys]
            else:
                # Default two-column layout: Main on left, Sidebar on right
                left_keys = [k for k in order if k not in sidebar_keys]
                right_keys = [k for k in order if k in sidebar_keys]
            
            left_story = []
            for k in left_keys:
                left_story.extend(self.build_section(k))
            # Append custom sections
            if self.template_id != "creative":
                left_story.extend(self.build_custom_sections())

            right_story = []
            for k in right_keys:
                right_story.extend(self.build_section(k))
            if self.template_id == "creative":
                right_story.extend(self.build_custom_sections())

            # Put left and right flows inside a layout Table
            # Usable width on Letter page with 0.7in margins is 8.5 - 1.4 = 7.1 inches
            col_widths = [2.4*inch, 4.5*inch] if self.template_id == "creative" else [4.5*inch, 2.4*inch]
            
            # Partition the story flowables for each column to support multi-page documents without LayoutError
            left_pages = partition_story(left_story, col_widths[0], page_height=630)
            right_pages = partition_story(right_story, col_widths[1], page_height=630)
            
            num_pages = max(len(left_pages), len(right_pages))
            layout_data = []
            for i in range(num_pages):
                left_flow = left_pages[i] if i < len(left_pages) else []
                right_flow = right_pages[i] if i < len(right_pages) else []
                layout_data.append([left_flow, right_flow])
                
            layout_table = Table(layout_data, colWidths=col_widths)
            
            t_style = [
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
                ('BOTTOMPADDING', (0,0), (-1,-1), 0),
                ('TOPPADDING', (0,0), (-1,-1), 0),
            ]
            
            # Creative template sidebar shading
            if self.template_id == "creative":
                t_style.extend([
                    ('BACKGROUND', (0,0), (0,-1), colors.HexColor(self.theme.get("accentColor", "#2563eb") + "0a")), # 4% opacity accent
                    ('LEFTPADDING', (0,0), (0,-1), 8),
                    ('RIGHTPADDING', (0,0), (0,-1), 8),
                ])
                
            layout_table.setStyle(TableStyle(t_style))
            story.append(layout_table)
        else:
            # Single column story
            for key in order:
                story.extend(self.build_section(key))
            story.extend(self.build_custom_sections())

        doc.build(story)
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()


async def generate_pdf_from_html(html_content: str, css_content: str) -> bytes:
    """Render the exact HTML/CSS content to A4 selectable PDF using headless Playwright Chromium."""
    from playwright.async_api import async_playwright
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Prepare HTML document with styles and fonts loaded
        full_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
{css_content}
</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Roboto:wght@300;400;500;700&family=Outfit:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background: white;">
{html_content}
</body>
</html>"""
        
        await page.set_content(full_html)
        # Ensure all web fonts are fully loaded
        await page.evaluate("document.fonts.ready")
        
        # Print to A4 PDF with exact dimensions
        pdf_bytes = await page.pdf(
            print_background=True,
            width="210mm",
            height="297mm",
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
        )
        await browser.close()
        return pdf_bytes
