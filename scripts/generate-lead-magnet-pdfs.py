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
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
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
    },
    {
        "source": ROOT / "docs" / "lead-magnets" / "healthcare-dme-public-sector-opportunity-report-2026.md",
        "output": OUTPUT_DIR / "healthcare-dme-public-sector-opportunity-report-2026.pdf",
        "eyebrow": "OPPORTUNITY SCANNER INDUSTRY REPORT",
        "title": "The 2026 Healthcare and DME Public-Sector Opportunity Report",
        "subtitle": "A practical guide to VA procurement, Medicare supplier signals, funded providers, recipients, channel partners, and source-backed next actions.",
        "stats": [
            ("6 lanes", "Procurement, reimbursement, recipients, channels, grants, and policy"),
            ("2026", "Current CMS enrollment constraint clearly separated from sales paths"),
            ("30 days", "A focused operating plan for qualifying the first target list"),
        ],
    },
]


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
        canvas.drawString(doc.leftMargin, 24, "Source-backed opportunity intelligence | As of July 10, 2026")
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
    }


def inline(text: str) -> str:
    text = html.escape(text.strip())
    text = re.sub(
        r"`(https?://[^`]+)`",
        lambda m: f'<link href="{m.group(1)}" color="#0E7C86">official source</link>',
        text,
    )
    text = re.sub(r"`([^`]+)`", r"<font name=\"Courier\">\1</font>", text)
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
            "Research current as of July 10, 2026. Always recheck time-sensitive official sources before acting.",
            style_map["cover_note"],
        ),
        PageBreak(),
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
    story.extend(parse_markdown(document["source"], style_map))
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
