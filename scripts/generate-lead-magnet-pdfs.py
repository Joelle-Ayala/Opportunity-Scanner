from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Flowable,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "lead-magnets"

INK = colors.HexColor("#14213D")
ACCENT = colors.HexColor("#0E7C86")
SIGNAL = colors.HexColor("#2E9D70")
REVIEW = colors.HexColor("#C7861D")
EMBER = colors.HexColor("#D95D39")
STEEL = colors.HexColor("#42526E")
MUTED = colors.HexColor("#667085")
FIELD = colors.HexColor("#F6F7F9")
LINE = colors.HexColor("#D9DEE7")
MIST = colors.HexColor("#E9F4F3")
CREAM = colors.HexColor("#FBFAF7")
PRODUCT_PROOF_DIR = ROOT / "public" / "product-proof"

def report(slug, title, subtitle, stats, lanes, path):
    return {
        "source": ROOT / "docs" / "lead-magnets" / f"{slug}.md",
        "output": OUTPUT_DIR / f"{slug}.pdf",
        "eyebrow": (
            "OPPORTUNITY SCANNER INDUSTRY PLAYBOOK"
            if "Playbook" in title
            else "OPPORTUNITY SCANNER INDUSTRY REPORT"
        ),
        "title": title,
        "subtitle": subtitle,
        "stats": stats,
        "lanes": lanes,
        "path": path,
    }


DOCUMENTS = [
    {
        "source": ROOT / "docs" / "lead-magnets" / "public-sector-revenue-opportunity-playbook-2026.md",
        "output": OUTPUT_DIR / "public-sector-revenue-opportunity-playbook-2026.pdf",
        "eyebrow": "OPPORTUNITY SCANNER FIELD GUIDE",
        "title": "The 2026 Public-Sector Revenue Opportunity Playbook",
        "subtitle": "A source-backed guide to agencies, funded buyers, recipients, primes, partners, and practical next actions.",
        "stats": [
            ("$179B", "FY2025 prime federal contracts reported to small businesses"),
            ("~$273B", "FY2025 prime plus subcontract awards reported to small businesses"),
            ("7 steps", "From company context to an owned next action"),
        ],
        "lanes": ["Live notices", "Award history", "Funding flows", "Recipients", "Policy signals", "Partner routes"],
        "path": ["Read company context", "Find official evidence", "Choose revenue motion", "Name contact path", "Assign next action"],
    },
    {
        "source": ROOT / "docs" / "lead-magnets" / "healthcare-dme-public-sector-opportunity-report-2026.md",
        "output": OUTPUT_DIR / "healthcare-dme-public-sector-opportunity-report-2026.pdf",
        "eyebrow": "OPPORTUNITY SCANNER INDUSTRY REPORT",
        "title": "The 2026 Healthcare and DME Public-Sector Opportunity Report",
        "subtitle": "A practical guide to VA procurement, Medicare supplier signals, funded providers, recipients, channel partners, and source-backed next actions.",
        "stats": [
            ("14 signals", "Sourced in a real healthcare and DME company scan"),
            ("5 agencies", "Distinct federal buyers or funders surfaced"),
            ("$95.9M", "Largest historical award record in the evidence set"),
        ],
        "lanes": ["VA procurement", "CMS signals", "Funded providers", "Award recipients", "Distribution", "Policy demand"],
        "path": ["Confirm product fit", "Separate six lanes", "Qualify buyer or partner", "Route to right office", "Run 30-day test"],
    },
    report(
        "education-workforce-public-sector-opportunity-report-2026",
        "The 2026 Education, Workforce, and Training Opportunity Report",
        "A field guide to districts, workforce boards, state agencies, funded providers, implementation partners, and training demand.",
        [("21 signals", "Sourced in a real education-workforce company scan"), ("11 agencies", "Distinct federal buyers or funders surfaced"), ("$9.95M", "Largest historical award record in the evidence set")],
        ["District buying", "Workforce boards", "State programs", "Grant recipients", "Training partners", "Policy demand"],
        ["Define learner outcome", "Find funding signal", "Name implementer", "Confirm buying path", "Start focused outreach"],
    ),
    report(
        "creative-economy-live-events-public-sector-opportunity-report-2026",
        "The 2026 Creative Economy and Live Events Opportunity Report",
        "A source-backed guide to arts agencies, tourism, parks, civic events, cultural grants, recipients, and production partners.",
        [("28 signals", "Sourced in a real creative-economy company scan"), ("9 agencies", "Distinct federal buyers or funders surfaced"), ("$24M", "Largest historical award record in the evidence set")],
        ["Arts agencies", "Civic events", "Tourism", "Parks and venues", "Grant recipients", "Production partners"],
        ["Define offer", "Find local signal", "Map funded organizer", "Choose role", "Build timely outreach"],
    ),
    report(
        "software-ai-public-sector-opportunity-report-2026",
        "The 2026 Software and AI Public-Sector Opportunity Playbook",
        "A practical guide to acquisition signals, modernization demand, funded agencies, primes, compliance paths, and responsible AI opportunities.",
        [("6 lanes", "Acquisition, modernization, awards, primes, grants, and policy"), ("Fit first", "Security and acquisition constraints shape the route"), ("30 days", "A qualification-led market test")],
        ["Active acquisition", "Modernization", "Award history", "Prime partners", "Funded programs", "AI policy"],
        ["Scope use case", "Check constraints", "Find buying evidence", "Choose direct or partner", "Run qualified pursuit"],
    ),
    report(
        "infrastructure-construction-public-sector-opportunity-report-2026",
        "The 2026 Infrastructure, Construction, and Engineering Opportunity Playbook",
        "A field guide to capital plans, federal funding flows, local projects, prime contractors, subcontract routes, and pre-bid intelligence.",
        [("6 lanes", "Capital, grant, project, prime, subcontract, and planning routes"), ("Flow down", "Funding must be traced to implementers"), ("30 days", "A geography-led pursuit plan")],
        ["Capital plans", "Federal grants", "Local projects", "Prime awards", "Subcontracting", "Planning signals"],
        ["Define capability", "Choose geography", "Trace money flow", "Map project actors", "Engage before bid"],
    ),
    report(
        "clean-energy-facilities-public-sector-opportunity-report-2026",
        "The 2026 Clean Energy, Facilities, and Sustainability Opportunity Playbook",
        "A source-backed guide to public buildings, resilience programs, energy funding, implementation partners, contractors, and funded buyers.",
        [("6 lanes", "Facilities, grants, recipients, projects, partners, and policy"), ("Buyer map", "Owners and implementers may differ"), ("30 days", "A focused account plan")],
        ["Facility plans", "Energy grants", "Funded owners", "Implementation projects", "Prime partners", "Policy demand"],
        ["Define outcome", "Find funded owner", "Identify implementer", "Check procurement route", "Start account plan"],
    ),
    report(
        "manufacturing-supply-chain-public-sector-opportunity-report-2026",
        "The 2026 Manufacturing and Supply Chain Opportunity Playbook",
        "A practical guide to public procurement, industrial-base demand, award history, primes, suppliers, reshoring programs, and logistics signals.",
        [("6 lanes", "Procurement, awards, primes, suppliers, programs, and policy"), ("Route matters", "Direct and subcontract paths differ"), ("30 days", "A capability-led pursuit plan")],
        ["Procurement", "Award history", "Prime contractors", "Supplier gaps", "Industrial programs", "Policy demand"],
        ["Define capability", "Match codes and buyers", "Trace prior awards", "Choose sales tier", "Open targeted pursuit"],
    ),
    report(
        "nonprofit-community-services-public-sector-opportunity-report-2026",
        "The 2026 Nonprofit and Community Services Opportunity Playbook",
        "A source-backed guide to grants, cooperative agreements, contracts, subawards, intermediaries, local implementation, and policy signals.",
        [("6 lanes", "Grant, contract, subaward, intermediary, local, and policy routes"), ("Fit first", "Mission alignment is not eligibility"), ("30 days", "A capacity-aware funding plan")],
        ["Federal grants", "Service contracts", "Subawards", "Intermediaries", "Local programs", "Policy signals"],
        ["Define service outcome", "Check eligibility", "Map funding chain", "Assess capacity", "Pursue best-fit route"],
    ),
    report(
        "marketing-advertising-digital-services-public-sector-opportunity-report-2026",
        "The 2026 Marketing, Advertising, Content, Website & Digital Services Public-Sector Opportunity Playbook",
        "A source-backed guide to communications procurement, public-information campaigns, accessible digital services, funded recipients, prime partners, and buyer routes.",
        [("8 lanes", "Communications, outreach, content, web, accessibility, analytics, recipient, and prime routes"), ("3 systems", "SAM.gov, USAspending, and Grants.gov evidence paths"), ("30 days", "A qualification-led pursuit plan")],
        ["Communications", "Public outreach", "Content", "Web services", "Accessibility", "Analytics", "Funded recipients", "Prime partners"],
        ["Define capability", "Find official evidence", "Verify current status", "Choose buyer or partner", "Open qualified pursuit"],
    ),
]


class ProcessDiagram(Flowable):
    def __init__(self, title: str, items: list[str], color=ACCENT):
        super().__init__()
        self.title = title
        self.items = items
        self.color = color
        self.width = 7.2 * inch
        self.height = 1.28 * inch

    def draw(self):
        canvas = self.canv
        canvas.setFillColor(INK)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(0, self.height - 12, self.title)
        gap = 8
        box_width = (self.width - gap * (len(self.items) - 1)) / len(self.items)
        y = 7
        for index, item in enumerate(self.items):
            x = index * (box_width + gap)
            canvas.setFillColor(MIST if index % 2 == 0 else FIELD)
            canvas.setStrokeColor(self.color)
            canvas.roundRect(x, y, box_width, 53, 4, fill=1, stroke=1)
            canvas.setFillColor(self.color)
            canvas.setFont("Helvetica-Bold", 7)
            canvas.drawString(x + 7, y + 39, f"{index + 1:02d}")
            canvas.setFillColor(INK)
            text = canvas.beginText(x + 7, y + 27)
            text.setFont("Helvetica-Bold", 7.1)
            words, line = item.split(), ""
            lines = []
            for word in words:
                candidate = f"{line} {word}".strip()
                if canvas.stringWidth(candidate, "Helvetica-Bold", 7.1) > box_width - 14 and line:
                    lines.append(line)
                    line = word
                else:
                    line = candidate
            lines.append(line)
            for value in lines[:3]:
                text.textLine(value)
            canvas.drawText(text)


class LeadMagnetDoc(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs):
        super().__init__(filename, pagesize=letter, **kwargs)
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="body",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=draw_page)])


def draw_mark(canvas, x: float, y: float, size: float = 7) -> None:
    gap = 2
    for dx, dy, color in [
        (0, size + gap, SIGNAL),
        (size + gap, size + gap, REVIEW),
        (0, 0, EMBER),
        (size + gap, 0, ACCENT),
    ]:
        canvas.setFillColor(color)
        canvas.roundRect(x + dx, y + dy, size, size, 1.5, fill=1, stroke=0)


def draw_page(canvas, doc) -> None:
    page = canvas.getPageNumber()
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    if page > 1:
        canvas.setStrokeColor(LINE)
        canvas.line(doc.leftMargin, letter[1] - 38, letter[0] - doc.rightMargin, letter[1] - 38)
        draw_mark(canvas, doc.leftMargin, letter[1] - 31, 4.5)
        canvas.setFillColor(INK)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(doc.leftMargin + 24, letter[1] - 28, "OPPORTUNITY SCANNER")
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(letter[0] - doc.rightMargin, 24, f"{page}")
        canvas.drawString(doc.leftMargin, 24, "Source-backed opportunity intelligence | Updated July 27, 2026")
    canvas.restoreState()


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_eyebrow": ParagraphStyle(
            "cover_eyebrow", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=9,
            leading=12, textColor=ACCENT, spaceAfter=14,
        ),
        "cover_title": ParagraphStyle(
            "cover_title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=30,
            leading=35, textColor=INK, spaceAfter=16,
        ),
        "cover_subtitle": ParagraphStyle(
            "cover_subtitle", parent=base["Normal"], fontName="Helvetica", fontSize=13,
            leading=20, textColor=STEEL, spaceAfter=24,
        ),
        "cover_note": ParagraphStyle(
            "cover_note", parent=base["Normal"], fontName="Helvetica", fontSize=8.5,
            leading=13, textColor=MUTED,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=17,
            leading=21, textColor=INK, spaceBefore=13, spaceAfter=7, keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=11.2,
            leading=14.5, textColor=ACCENT, spaceBefore=9, spaceAfter=4, keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"], fontName="Helvetica", fontSize=8.8,
            leading=13, textColor=STEEL, spaceAfter=5.5,
        ),
        "bullet": ParagraphStyle(
            "bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=8.7,
            leading=12.6, textColor=STEEL, leftIndent=13, firstLineIndent=-9, spaceAfter=3,
        ),
        "table_header": ParagraphStyle(
            "table_header", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=6.9,
            leading=8.6, textColor=colors.white,
        ),
        "table_cell": ParagraphStyle(
            "table_cell", parent=base["Normal"], fontName="Helvetica", fontSize=6.7,
            leading=8.7, textColor=STEEL, wordWrap="CJK",
        ),
        "stat": ParagraphStyle(
            "stat", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=17,
            leading=20, textColor=INK, alignment=TA_CENTER,
        ),
        "stat_label": ParagraphStyle(
            "stat_label", parent=base["Normal"], fontName="Helvetica", fontSize=7.5,
            leading=10, textColor=STEEL, alignment=TA_CENTER,
        ),
        "product_label": ParagraphStyle(
            "product_label", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=7.5,
            leading=10, textColor=ACCENT, spaceAfter=5,
        ),
        "caption": ParagraphStyle(
            "caption", parent=base["Normal"], fontName="Helvetica", fontSize=7.2,
            leading=10, textColor=MUTED, spaceBefore=4, spaceAfter=7,
        ),
        "workflow_note": ParagraphStyle(
            "workflow_note", parent=base["Normal"], fontName="Helvetica", fontSize=8,
            leading=12, textColor=STEEL,
        ),
    }


def inline(text: str) -> str:
    text = html.escape(text.strip())
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^)]+)\)",
        lambda m: f'<link href="{m.group(2)}" color="#0E7C86">{m.group(1)}</link>',
        text,
    )
    text = re.sub(
        r"`(https?://[^`]+)`",
        lambda m: f'<link href="{m.group(1)}" color="#0E7C86">official source</link>',
        text,
    )
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def markdown_table(lines: list[str], style_map: dict) -> Table:
    rows = []
    for index, line in enumerate(lines):
        if index == 1:
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        paragraph_style = style_map["table_header"] if index == 0 else style_map["table_cell"]
        rows.append([Paragraph(inline(cell), paragraph_style) for cell in cells])
    count = len(rows[0])
    width = 7.2 * inch
    if count == 4:
        widths = [width * 0.21, width * 0.30, width * 0.13, width * 0.36]
    elif count == 3:
        widths = [width * 0.25, width * 0.37, width * 0.38]
    else:
        widths = [width / count] * count
    table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, FIELD]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def cover(document: dict, style_map: dict) -> list:
    stat_cells = []
    for stat, label in document["stats"]:
        stat_cells.append([
            Paragraph(stat, style_map["stat"]),
            Paragraph(label, style_map["stat_label"]),
        ])
    stat_table = Table(
        [stat_cells],
        colWidths=[2.25 * inch] * 3,
        hAlign="LEFT",
    )
    stat_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FIELD),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
    ]))
    return [
        Spacer(1, 0.38 * inch),
        Paragraph(document["eyebrow"], style_map["cover_eyebrow"]),
        Paragraph(document["title"], style_map["cover_title"]),
        Paragraph(document["subtitle"], style_map["cover_subtitle"]),
        HRFlowable(width="100%", thickness=2, color=ACCENT, spaceBefore=2, spaceAfter=24),
        stat_table,
        Spacer(1, 0.55 * inch),
        Paragraph(
            "Built for founders and revenue teams that need credible targets, clear revenue motions, "
            "contact paths, and next actions - not a generic list of grants or contracts.",
            style_map["body"],
        ),
        Spacer(1, 0.65 * inch),
        Paragraph("Opportunity Scanner by Opportunity Systems", style_map["h3"]),
        Paragraph(
            "Research current as of July 27, 2026. Always recheck time-sensitive official sources before acting.",
            style_map["cover_note"],
        ),
        PageBreak(),
    ]


def screenshot(name: str, width: float) -> Image:
    path = PRODUCT_PROOF_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Product proof screenshot not found: {path}")
    image = Image(str(path))
    aspect_ratio = image.imageHeight / image.imageWidth
    image.drawWidth = width
    image.drawHeight = width * aspect_ratio
    image.hAlign = "LEFT"
    return image


def workflow_card(title: str, body: str, style_map: dict) -> Table:
    card = Table(
        [[
            Paragraph(title.upper(), style_map["product_label"]),
            Paragraph(body, style_map["workflow_note"]),
        ]],
        colWidths=[1.2 * inch, 5.72 * inch],
        hAlign="LEFT",
    )
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), FIELD),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return card


def product_workflow(style_map: dict) -> list:
    pipeline_proof = KeepTogether([
        screenshot("report-pipeline.png", 7.2 * inch),
        Paragraph(
            "Report view: funded-buyer evidence is separated from live opportunities and carries its source record, target, contact path, and next best action.",
            style_map["caption"],
        ),
    ])
    action_proof = KeepTogether([
        screenshot("report-actions.png", 7.2 * inch),
        Paragraph(
            "Pursuit view: verify the official source, make a fit decision, assign ownership, and keep the next step attached to the evidence.",
            style_map["caption"],
        ),
    ])

    overview = screenshot("report-overview.png", 4.55 * inch)
    overview_detail = Paragraph(
        "<b>What stays with the pursuit</b><br/><br/>"
        "Owner, fit decision, verified due date when one exists, requirements, notes, and the next follow-up.<br/><br/>"
        "Qualified context can then be exported or sent through a secure workflow webhook.",
        style_map["workflow_note"],
    )
    overview_table = Table(
        [[overview, overview_detail]],
        colWidths=[4.7 * inch, 2.22 * inch],
        hAlign="LEFT",
    )
    overview_table.setStyle(TableStyle([
        ("BACKGROUND", (1, 0), (1, 0), MIST),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 10),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
        ("RIGHTPADDING", (1, 0), (1, 0), 12),
        ("TOPPADDING", (1, 0), (1, 0), 12),
        ("BOTTOMPADDING", (1, 0), (1, 0), 12),
    ]))

    return [
        PageBreak(),
        Paragraph("PRODUCT WORKFLOW", style_map["product_label"]),
        Paragraph("Turn source evidence into an owned pursuit", style_map["h2"]),
        Paragraph(
            "Opportunity Scanner first verifies what kind of record it found. Live opportunities retain a current official close date; historical awards become funded-buyer evidence and are never presented as open applications or bids.",
            style_map["body"],
        ),
        ProcessDiagram(
            "From discovery to a workflow-ready next step",
            [
                "Source evidence",
                "Verify record class",
                "Open official route",
                "Start pursuit",
                "Own fit, date, notes",
                "Export or webhook",
            ],
            SIGNAL,
        ),
        Spacer(1, 10),
        pipeline_proof,
        workflow_card(
            "Why classification matters",
            "A verified record class determines the action. A live notice may support a direct application or bid; funded-buyer evidence supports buyer, recipient, partner, and market research.",
            style_map,
        ),
        PageBreak(),
        Paragraph("CUSTOMER WORKSPACE", style_map["product_label"]),
        Paragraph("Keep the next action connected to the evidence", style_map["h2"]),
        Paragraph(
            "Open the authoritative route before acting, then turn a qualified finding into work your team can own and advance.",
            style_map["body"],
        ),
        action_proof,
        Spacer(1, 5),
        overview_table,
        Paragraph(
            "Product walkthrough: a fictional company moves from website analysis to sourced findings and a structured pursuit workspace.",
            style_map["caption"],
        ),
        workflow_card(
            "Your team stays in control",
            "Opportunity Scanner organizes evidence and the pursuit workflow. It does not submit applications or bids on your behalf; your team reviews the official instructions and decides what to send.",
            style_map,
        ),
    ]


def parse_markdown(path: Path, style_map: dict) -> list:
    lines = path.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    skipped_header_fields = 0
    while index < len(lines):
        line = lines[index].rstrip()
        if line == "## Visual and table specifications":
            break
        if index == 0 and line.startswith("# "):
            index += 1
            continue
        if line.startswith("Subtitle:") or line.startswith("Status:") or line.startswith("As-of date:"):
            skipped_header_fields += 1
            index += 1
            continue
        if not line:
            index += 1
            continue
        if line.startswith("## "):
            if line == "## Evidence and source ledger":
                story.append(PageBreak())
            story.append(Paragraph(inline(line[3:]), style_map["h2"]))
            index += 1
            continue
        if line.startswith("### "):
            story.append(Paragraph(inline(line[4:]), style_map["h3"]))
            index += 1
            continue
        if line.startswith("|") and index + 1 < len(lines) and re.match(r"^\|?\s*:?-+", lines[index + 1]):
            table_lines = [line]
            index += 1
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.extend([Spacer(1, 4), markdown_table(table_lines, style_map), Spacer(1, 8)])
            continue
        if re.match(r"^[-*] ", line):
            story.append(Paragraph("- " + inline(line[2:]), style_map["bullet"]))
            index += 1
            continue
        if re.match(r"^\d+\. ", line):
            story.append(Paragraph(inline(line), style_map["bullet"]))
            index += 1
            continue

        paragraph_lines = [line]
        index += 1
        while index < len(lines):
            candidate = lines[index].rstrip()
            if not candidate or candidate.startswith(("#", "|", "- ", "* ")) or re.match(r"^\d+\. ", candidate):
                break
            paragraph_lines.append(candidate)
            index += 1
        story.append(Paragraph(inline(" ".join(paragraph_lines)), style_map["body"]))
    return story


def build(document: dict) -> None:
    style_map = styles()
    story = cover(document, style_map)
    story.extend([
        Paragraph("The opportunity landscape", style_map["h2"]),
        Paragraph(
            "Use these lanes to separate records that imply different buyers, partners, timing, and next actions.",
            style_map["body"],
        ),
        Spacer(1, 8),
        ProcessDiagram(f"{len(document['lanes'])} evidence lanes to investigate", document["lanes"]),
        Spacer(1, 14),
        ProcessDiagram("From signal to an owned revenue action", document["path"], SIGNAL),
        Spacer(1, 10),
        Paragraph(
            "These diagrams are operating maps, not a promise that every lane is open. The report explains the evidence, constraints, and qualification checks behind each route.",
            style_map["cover_note"],
        ),
        PageBreak(),
    ])
    story.extend(parse_markdown(document["source"], style_map))
    story.extend(product_workflow(style_map))
    story.extend([
        Spacer(1, 14),
        HRFlowable(width="100%", thickness=1.5, color=ACCENT, spaceBefore=4, spaceAfter=12),
        Paragraph("Put this guide to work", style_map["h2"]),
        Paragraph(
            "Opportunity Scanner reads your company website, finds source-backed public-sector signals, "
            "and translates them into target organizations, revenue motions, contact paths, and next actions.",
            style_map["body"],
        ),
        Paragraph(
            '<link href="https://www.opportunityscanner.ai/#scan" color="#0E7C86"><b>Run a free company scan at opportunityscanner.ai</b></link>',
            style_map["body"],
        ),
        Paragraph(
            "Recheck official sources before any outreach, application, registration, or bid decision.",
            style_map["cover_note"],
        ),
    ])
    doc = LeadMagnetDoc(
        str(document["output"]),
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.55 * inch,
        title=document["title"],
        author="Opportunity Scanner by Opportunity Systems",
        subject="Source-backed public-sector opportunity intelligence",
    )
    doc.build(story)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for document in DOCUMENTS:
        build(document)
        print(document["output"].relative_to(ROOT))


if __name__ == "__main__":
    main()
