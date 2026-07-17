#!/usr/bin/env python3

from pathlib import Path
from shutil import copyfile

from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public" / "social-campaigns" / "flagship-playbook"
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_PDF = PUBLIC_DIR / "public-sector-revenue-playbook-carousel.pdf"
OUTPUT_PDF = OUTPUT_DIR / "public-sector-revenue-playbook-carousel.pdf"

WIDTH = 1080
HEIGHT = 1350

NAVY = HexColor("#14213D")
INK = HexColor("#17202A")
PAPER = HexColor("#FBFAF7")
WHITE = HexColor("#FFFFFF")
TEAL = HexColor("#0E7C86")
GREEN = HexColor("#2E9D70")
AMBER = HexColor("#C7861D")
CORAL = HexColor("#D95D39")
MIST = HexColor("#E9F3F2")
LINE = HexColor("#D7DDD9")
SOFT = HexColor("#F1F2EF")
MUTED = HexColor("#5D6670")


SLIDES = [
    {
        "kicker": "THE 2026 PUBLIC-SECTOR REVENUE PLAYBOOK",
        "title": "The record is not the opportunity.",
        "subtitle": "A 7-step method for turning public evidence into one defensible next action.",
        "accent": CORAL,
        "kind": "cover",
    },
    {
        "kicker": "STEP 1 / TRANSLATE",
        "title": "Define the company before you search.",
        "subtitle": "A useful scan starts with what the business sells, who uses it, where it can deliver, and what is not a fit.",
        "accent": TEAL,
        "kind": "translate",
    },
    {
        "kicker": "STEP 2 / SEARCH BY PURPOSE",
        "title": "Each source answers a different question.",
        "subtitle": "Use the record type to decide what it can prove. Do not promote every result into active pipeline.",
        "accent": AMBER,
        "kind": "sources",
    },
    {
        "kicker": "STEP 3 / LABEL STATUS",
        "title": "Preserve the record's actual status.",
        "subtitle": "A forecast is not a solicitation. An award is not an open bid. A policy signal is not a purchase.",
        "accent": CORAL,
        "kind": "status",
    },
    {
        "kicker": "STEP 4 / NAME THE TARGET",
        "title": "The buyer, program owner, and access point may differ.",
        "subtitle": "Name the organization controlling each decision before choosing an outreach route.",
        "accent": GREEN,
        "kind": "targets",
    },
    {
        "kicker": "STEP 5 / CHOOSE THE MOTION",
        "title": "Match the route to the evidence.",
        "subtitle": "Direct application or agency sales are only two paths. Funded buyers, recipients, partners, and channels can matter too.",
        "accent": TEAL,
        "kind": "motions",
    },
    {
        "kicker": "STEP 6 / BUILD THE PATH",
        "title": "Start with the official route.",
        "subtitle": "Follow source instructions first. Move outward to offices, portals, recipients, or partners before person-level research.",
        "accent": AMBER,
        "kind": "path",
    },
    {
        "kicker": "STEP 7 / ASSIGN THE ACTION",
        "title": "Turn evidence into owned work.",
        "subtitle": "Every retained row needs an owner, supporting evidence, due date, expected answer, and a reason to stop.",
        "accent": GREEN,
        "kind": "action",
    },
]


def wrap_text(text, font, size, max_width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_wrapped(c, text, x, y, max_width, font, size, color, leading=None, max_lines=None):
    lines = wrap_text(text, font, size, max_width)
    if max_lines:
        lines = lines[:max_lines]
    leading = leading or size * 1.18
    c.setFillColor(color)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_mark(c, x, y, size, color=TEAL):
    c.setFillColor(color)
    c.roundRect(x, y, size, size, 9, fill=1, stroke=0)
    c.setStrokeColor(WHITE)
    c.setLineWidth(max(3, size * 0.07))
    inset = size * 0.23
    c.line(x + inset, y + size * 0.7, x + size - inset, y + size * 0.7)
    c.line(x + inset, y + size * 0.5, x + size - inset, y + size * 0.5)
    c.line(x + inset, y + size * 0.3, x + size * 0.65, y + size * 0.3)


def pill(c, x, y, w, h, text, fill, text_color=WHITE, font_size=18):
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, h / 2, fill=1, stroke=0)
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", font_size)
    c.drawCentredString(x + w / 2, y + (h - font_size) / 2 + 4, text)


def base_slide(c, slide, index):
    c.setFillColor(PAPER)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    c.setFillColor(slide["accent"])
    c.rect(0, HEIGHT - 14, WIDTH, 14, fill=1, stroke=0)

    draw_mark(c, 72, 1234, 54)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(144, 1260, "OPPORTUNITY SCANNER")
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 18)
    c.drawRightString(1008, 1260, f"{index:02d} / 08")

    c.setFillColor(slide["accent"])
    c.setFont("Helvetica-Bold", 19)
    c.drawString(72, 1162, slide["kicker"])
    title_y = draw_wrapped(
        c, slide["title"], 72, 1088, 910, "Helvetica-Bold", 64, NAVY, leading=72, max_lines=3
    )
    draw_wrapped(
        c, slide["subtitle"], 72, title_y - 14, 870, "Helvetica", 28, INK, leading=38, max_lines=4
    )

    c.setStrokeColor(LINE)
    c.setLineWidth(2)
    c.line(72, 92, 1008, 92)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 16)
    c.drawString(72, 58, "opportunityscanner.ai")
    c.drawRightString(1008, 58, "Verify current records at the official source before acting.")


def draw_cover(c):
    y = 535
    x0 = 102
    x1 = 978
    c.setStrokeColor(LINE)
    c.setLineWidth(8)
    c.line(x0, y, x1, y)
    labels = ["Translate", "Source", "Status", "Target", "Motion", "Path", "Action"]
    colors = [TEAL, AMBER, CORAL, GREEN, TEAL, AMBER, GREEN]
    step = (x1 - x0) / 6
    for i, (label, color) in enumerate(zip(labels, colors)):
        x = x0 + step * i
        c.setFillColor(color)
        c.circle(x, y, 25, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 17)
        c.drawCentredString(x, y - 62, label)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 14)
        c.drawCentredString(x, y + 48, str(i + 1))

    pill(c, 72, 268, 360, 52, "SOURCE -> DECISION", CORAL, font_size=19)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 30)
    c.drawString(72, 210, "Free field guide + qualification scorecard")


def draw_translate(c):
    fields = [
        ("OFFER", "What is sold?"),
        ("USE CASE", "What changes?"),
        ("BUYER", "Who controls it?"),
        ("GEOGRAPHY", "Where can it deliver?"),
        ("CONSTRAINTS", "What blocks access?"),
        ("NOT A FIT", "What should be rejected?"),
    ]
    x_positions = [72, 546]
    y_positions = [590, 430, 270]
    for i, (label, question) in enumerate(fields):
        x = x_positions[i % 2]
        y = y_positions[i // 2]
        c.setStrokeColor(LINE)
        c.setLineWidth(2)
        c.line(x, y, x + 390, y)
        c.setFillColor(TEAL)
        c.setFont("Helvetica-Bold", 17)
        c.drawString(x, y + 30, label)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 25)
        c.drawString(x, y - 42, question)


def draw_sources(c):
    lanes = [
        ("NOTICES", "Current buying stage", CORAL),
        ("AWARDS", "Incumbents + recipients", TEAL),
        ("FORECASTS", "Possible future demand", AMBER),
        ("RULES", "Policy + compliance signals", GREEN),
    ]
    y = 610
    for label, detail, color in lanes:
        c.setFillColor(color)
        c.roundRect(72, y, 18, 92, 9, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 26)
        c.drawString(120, y + 53, label)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 22)
        c.drawString(390, y + 53, detail)
        c.setStrokeColor(LINE)
        c.setLineWidth(1.5)
        c.line(120, y + 18, 1008, y + 18)
        y -= 130


def draw_status(c):
    statuses = [
        ("ACTIVE", "Action supported now", CORAL),
        ("EARLY DEMAND", "Planning signal", AMBER),
        ("HISTORICAL", "Past money flow", TEAL),
        ("POLICY", "Demand-shaping change", GREEN),
        ("ROUTE", "Access evidence", NAVY),
        ("RESEARCH", "Context only", MUTED),
    ]
    x_positions = [72, 546]
    y_positions = [585, 420, 255]
    for i, (name, meaning, color) in enumerate(statuses):
        x = x_positions[i % 2]
        y = y_positions[i // 2]
        pill(c, x, y + 45, 190, 40, name, color, font_size=15)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 23)
        c.drawString(x, y, meaning)
    c.setFillColor(SOFT)
    c.roundRect(72, 145, 936, 58, 8, fill=1, stroke=0)
    c.setFillColor(CORAL)
    c.setFont("Helvetica-Bold", 19)
    c.drawCentredString(540, 164, "RELEVANT DOES NOT MEAN ACTIONABLE")


def draw_targets(c):
    items = [
        ("ECONOMIC BUYER", "Controls money"),
        ("PROGRAM OWNER", "Controls need"),
        ("ACCESS POINT", "Controls route"),
    ]
    xs = [180, 540, 900]
    colors = [GREEN, TEAL, AMBER]
    c.setStrokeColor(LINE)
    c.setLineWidth(8)
    c.line(xs[0], 470, xs[-1], 470)
    for x, (title, detail), color in zip(xs, items, colors):
        c.setFillColor(color)
        c.circle(x, 470, 68, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 27)
        c.drawCentredString(x, 460, str(xs.index(x) + 1))
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 19)
        c.drawCentredString(x, 348, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 18)
        c.drawCentredString(x, 315, detail)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(540, 196, "Do not assume these roles sit in one organization.")


def draw_motions(c):
    motions = [
        "Direct Apply",
        "Sell to Agency",
        "Sell to Funded Buyer",
        "Sell to Award Recipient",
        "Partner with Recipient",
        "Channel / Distributor",
        "Monitor Policy",
        "Research Only",
    ]
    for i, motion in enumerate(motions):
        col = i % 2
        row = i // 2
        x = 72 + col * 474
        y = 620 - row * 112
        c.setFillColor(MIST if row % 2 == 0 else SOFT)
        c.roundRect(x, y, 420, 76, 7, fill=1, stroke=0)
        c.setFillColor(TEAL if i < 6 else MUTED)
        c.circle(x + 34, y + 38, 10, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 21)
        c.drawString(x + 62, y + 30, motion)
    c.setFillColor(CORAL)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(72, 154, "Choose one primary motion. Keep alternatives secondary.")


def draw_path(c):
    steps = [
        ("1", "SOURCE INSTRUCTIONS", "What the record says to do"),
        ("2", "OFFICIAL OFFICE", "Contracting, grants, or program"),
        ("3", "PORTAL OR RECIPIENT", "Registration or funded route"),
        ("4", "PERSON RESEARCH", "Only after role and reason are clear"),
    ]
    y = 620
    for number, title, detail in steps:
        c.setFillColor(AMBER)
        c.circle(104, y + 22, 30, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(104, y + 14, number)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 23)
        c.drawString(164, y + 32, title)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 19)
        c.drawString(164, y - 1, detail)
        if number != "4":
            c.setStrokeColor(LINE)
            c.setLineWidth(4)
            c.line(104, y - 18, 104, y - 85)
        y -= 125
    pill(c, 72, 142, 444, 48, "CREDIBLE ROUTE > CONTACT LIST", NAVY, font_size=17)


def draw_action(c):
    fields = [
        ("OWNER", "Who moves it?"),
        ("EVIDENCE", "What supports it?"),
        ("DUE DATE", "When is the check?"),
        ("EXPECTED ANSWER", "What uncertainty falls?"),
    ]
    x_positions = [72, 546]
    y_positions = [565, 380]
    for i, (label, detail) in enumerate(fields):
        x = x_positions[i % 2]
        y = y_positions[i // 2]
        c.setFillColor(SOFT)
        c.roundRect(x, y, 420, 130, 7, fill=1, stroke=0)
        c.setFillColor(GREEN)
        c.setFont("Helvetica-Bold", 17)
        c.drawString(x + 24, y + 86, label)
        c.setFillColor(NAVY)
        c.setFont("Helvetica-Bold", 25)
        c.drawString(x + 24, y + 38, detail)

    c.setFillColor(NAVY)
    c.roundRect(72, 188, 936, 108, 8, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(102, 248, "Download the free 2026 playbook")
    c.setFont("Helvetica", 19)
    c.drawString(102, 213, "opportunityscanner.ai/resources")
    c.setFillColor(GREEN)
    c.circle(944, 242, 28, fill=1, stroke=0)
    c.setStrokeColor(WHITE)
    c.setLineWidth(5)
    c.line(932, 242, 942, 232)
    c.line(942, 232, 958, 252)


DRAWERS = {
    "cover": draw_cover,
    "translate": draw_translate,
    "sources": draw_sources,
    "status": draw_status,
    "targets": draw_targets,
    "motions": draw_motions,
    "path": draw_path,
    "action": draw_action,
}


def main():
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(PUBLIC_PDF), pagesize=(WIDTH, HEIGHT), pageCompression=1)
    c.setTitle("From Record to Revenue Motion")
    c.setAuthor("Opportunity Scanner")
    c.setSubject("2026 Public-Sector Revenue Opportunity Playbook carousel")

    for index, slide in enumerate(SLIDES, start=1):
        base_slide(c, slide, index)
        DRAWERS[slide["kind"]](c)
        c.showPage()

    c.save()
    copyfile(PUBLIC_PDF, OUTPUT_PDF)
    print(PUBLIC_PDF)
    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()
