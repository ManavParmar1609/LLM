from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

doc = SimpleDocTemplate(
    r"e:\Downloads\DockIQ\DockIQ_AI_Scenarios_Explained.pdf",
    pagesize=letter,
    topMargin=0.6 * inch,
    bottomMargin=0.6 * inch,
    leftMargin=0.75 * inch,
    rightMargin=0.75 * inch,
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    "MainTitle", parent=styles["Title"], fontSize=22, leading=28,
    textColor=HexColor("#1a1a2e"), spaceAfter=4,
))
styles.add(ParagraphStyle(
    "Subtitle", parent=styles["Normal"], fontSize=11, leading=14,
    textColor=HexColor("#555555"), spaceAfter=20, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    "H2", parent=styles["Heading2"], fontSize=16, leading=20,
    textColor=HexColor("#0f3460"), spaceBefore=18, spaceAfter=8,
    borderPadding=(0, 0, 2, 0),
))
styles.add(ParagraphStyle(
    "H3", parent=styles["Heading3"], fontSize=13, leading=16,
    textColor=HexColor("#16213e"), spaceBefore=14, spaceAfter=6,
))
styles.add(ParagraphStyle(
    "BodyText2", parent=styles["Normal"], fontSize=10, leading=14,
    textColor=HexColor("#222222"), spaceAfter=6,
))
styles.add(ParagraphStyle(
    "CodeBlock", parent=styles["Normal"], fontSize=8.5, leading=12,
    fontName="Courier", textColor=HexColor("#1a1a1a"),
    backColor=HexColor("#f4f4f4"), borderPadding=8,
    spaceBefore=6, spaceAfter=10, leftIndent=12, rightIndent=12,
))
styles.add(ParagraphStyle(
    "BulletItem", parent=styles["Normal"], fontSize=10, leading=14,
    textColor=HexColor("#222222"), spaceAfter=3, leftIndent=20,
    bulletIndent=8,
))
styles.add(ParagraphStyle(
    "LabelGreen", parent=styles["Normal"], fontSize=9, leading=12,
    textColor=HexColor("#0a6640"), fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "LabelRed", parent=styles["Normal"], fontSize=9, leading=12,
    textColor=HexColor("#c62828"), fontName="Helvetica-Bold",
))
styles.add(ParagraphStyle(
    "ScenarioTitle", parent=styles["Heading2"], fontSize=15, leading=19,
    textColor=white, spaceBefore=0, spaceAfter=0,
))
styles.add(ParagraphStyle(
    "Footer", parent=styles["Normal"], fontSize=8, leading=10,
    textColor=HexColor("#999999"), alignment=TA_CENTER,
))

story = []


def add_spacer(h=10):
    story.append(Spacer(1, h))


def add_hr():
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#cccccc"),
                             spaceBefore=8, spaceAfter=8))


def code_block(text):
    """Convert multiline text to a code-style paragraph."""
    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    escaped = escaped.replace("\n", "<br/>")
    return Paragraph(escaped, styles["CodeBlock"])


def scenario_header(title, color="#0f3460"):
    """Create a colored banner for scenario titles."""
    t = Table(
        [[Paragraph(title, styles["ScenarioTitle"])]],
        colWidths=[doc.width],
        rowHeights=[30],
    )
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor(color)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    story.append(t)
    add_spacer(8)


def comparison_table(without_lines, with_lines, without_footer, with_footer):
    """Create a WITHOUT vs WITH comparison."""
    story.append(Paragraph("<b>❌ WITHOUT DockIQ:</b>", styles["LabelRed"]))
    add_spacer(4)
    story.append(code_block(without_lines))
    for line in without_footer:
        story.append(Paragraph(line, styles["BodyText2"]))
    add_spacer(8)
    story.append(Paragraph("<b>✅ WITH DockIQ:</b>", styles["LabelGreen"]))
    add_spacer(4)
    story.append(code_block(with_lines))
    for line in with_footer:
        story.append(Paragraph(line, styles["BodyText2"]))


# ── TITLE ──
story.append(Paragraph("DockIQ.AI — Explained Through Real Scenarios", styles["MainTitle"]))
story.append(Paragraph("A practical guide showing how DockIQ transforms dock-door operations", styles["Subtitle"]))
add_hr()

# ── THE SETTING ──
story.append(Paragraph("The Setting", styles["H2"]))
story.append(Paragraph(
    "Imagine a large cold-storage warehouse with <b>20 dock doors</b>. Trailers pull up, and forklift operators "
    "load or unload them. There are <b>3 supervisors</b> covering <b>20 operators</b> across the floor. "
    "Each operator has a <b>tablet</b> mounted on their forklift or at the dock door.",
    styles["BodyText2"]
))
add_spacer(6)

# ═══════════════════════════════════════════════════════════
# SCENARIO 1
# ═══════════════════════════════════════════════════════════
scenario_header("Scenario 1: \"The Damaged Pallet\"", "#c62828")

comparison_table(
    # WITHOUT
    "1. Operator Mike is unloading a trailer at Dock 12\n"
    "2. He pulls out pallet #6 — it's crushed, product is spilling\n"
    "3. Mike doesn't know what to do. Reject the whole pallet?\n"
    "   Accept it partially? Who does he tell?\n"
    "4. He parks his forklift, walks 400 feet to find Supervisor Sarah\n"
    "5. Sarah is already dealing with another issue at Dock 3\n"
    "6. Mike waits 8 minutes\n"
    "7. Sarah walks back to Dock 12 with Mike (another 3 minutes)\n"
    "8. Sarah looks at the damage, decides to partially accept\n"
    "9. Mike writes the discrepancy on a paper form — chicken scratch,\n"
    "   no photos, hard to read later\n"
    "10. The trailer has been sitting open for 15 minutes\n"
    "    (cold chain risk for frozen product)",
    # WITH
    "1. Operator Mike is unloading a trailer at Dock 12\n"
    "2. He pulls out pallet #6 — it's crushed, product is spilling\n"
    "3. Mike taps the DockIQ tablet → 'Report Issue'\n"
    "4. He sees pre-filled info:\n"
    "   'Dock 12 | Trailer #T-4892 | Customer: Kroger\n"
    "    Product: Frozen Chicken Breasts'\n"
    "5. He selects: Issue Type → 'Damaged Pallet', Severity → 'High'\n"
    "   (System auto-suggests 'High' — perishable product)\n"
    "6. He types or voice-dictates: 'Pallet 6 crushed on left side,\n"
    "   about 8 cases damaged'\n"
    "7. He taps Submit → Sarah gets an INSTANT notification:\n"
    "   'HIGH — Dock 12 — Damaged pallet — Frozen Chicken — Kroger'\n"
    "8. While waiting, Mike taps 'What should I do?' in the AI chat\n"
    "9. The AI responds (pulling from Kroger's SOP + company policy):\n"
    "   'For damaged frozen product (Kroger):\n"
    "    Step 1: Separate damaged cases from intact ones\n"
    "    Step 2: Check if product packaging is punctured\n"
    "    Step 3: Move intact cases to staging\n"
    "    Step 4: Supervisor will authorize partial acceptance\n"
    "    Source: Kroger Receiving SOP v3.2, Section 4.1'\n"
    "10. Mike starts separating cases. Sarah arrives in 3 minutes\n"
    "    (she already knows the full situation from the alert)\n"
    "11. Discrepancy report is auto-generated with all details.",
    ["<b>Total time lost:</b> ~20 minutes&nbsp;&nbsp;|&nbsp;&nbsp;<b>Knowledge captured:</b> A messy paper form in a filing cabinet"],
    ["<b>Total time lost:</b> ~5 minutes&nbsp;&nbsp;|&nbsp;&nbsp;<b>Knowledge captured:</b> Digital record with full context, searchable forever"],
)
add_spacer(12)

# ═══════════════════════════════════════════════════════════
# SCENARIO 2
# ═══════════════════════════════════════════════════════════
scenario_header("Scenario 2: \"The Temperature Emergency\"", "#e65100")

comparison_table(
    # WITHOUT
    "1. Operator Lisa is receiving a frozen seafood shipment at Dock 5\n"
    "2. She checks the temperature probe: reads 28°F\n"
    "   (should be <= 0°F — this is WAY too warm)\n"
    "3. Lisa isn't sure of the exact cutoff. She's only been here 2 months.\n"
    "4. She tries to radio Supervisor Tom — no answer (he's in the freezer)\n"
    "5. She tries again — still nothing\n"
    "6. She waits. The trailer is sitting open. Product getting warmer.\n"
    "7. 12 minutes later, Tom responds. Walks over.\n"
    "8. Tom checks his paper SOP binder. Finds the temp threshold.\n"
    "   Confirms rejection.\n"
    "9. Lisa fills out paper rejection form. Tom calls the carrier.\n"
    "10. Nobody flagged this to the Quality team until end of shift.",
    # WITH
    "1. Operator Lisa is receiving a frozen seafood shipment at Dock 5\n"
    "2. She enters the temperature reading into the tablet: 28°F\n"
    "3. DockIQ IMMEDIATELY flags this:\n"
    "   'CRITICAL — Temperature 28°F exceeds threshold (<= 0°F)\n"
    "    Product: Atlantic Salmon Fillets | Customer: Costco\n"
    "    FOOD SAFETY RISK — Immediate action required'\n"
    "4. Three things happen simultaneously:\n"
    "   a) Supervisor Tom gets a CRITICAL alert\n"
    "   b) Quality Manager gets auto-notified\n"
    "   c) Lisa sees immediate guidance on her screen:\n"
    "      'CRITICAL TEMP DEVIATION — DO NOT ACCEPT:\n"
    "       - Do NOT unload any product\n"
    "       - Close the trailer doors immediately\n"
    "       - Do NOT sign the BOL\n"
    "       - Supervisor is being notified\n"
    "       Source: Cold Chain SOP, Section 2.3'\n"
    "5. Lisa closes the trailer doors right away\n"
    "6. Tom arrives in 4 minutes — he already knows what's happening\n"
    "7. Rejection is logged digitally. Quality team already knows.\n"
    "8. System notes: 3rd temp issue from this carrier this month",
    ["<b>Total time lost:</b> ~25 min&nbsp;&nbsp;|&nbsp;&nbsp;<b>Food safety risk:</b> HIGH&nbsp;&nbsp;|&nbsp;&nbsp;<b>Quality notified:</b> Hours later"],
    ["<b>Total time lost:</b> ~5 min&nbsp;&nbsp;|&nbsp;&nbsp;<b>Food safety risk:</b> MINIMIZED&nbsp;&nbsp;|&nbsp;&nbsp;<b>Quality notified:</b> Instant"],
)
add_spacer(12)

# ═══════════════════════════════════════════════════════════
# SCENARIO 3
# ═══════════════════════════════════════════════════════════
scenario_header("Scenario 3: \"The Wrong Product\"", "#1565c0")

comparison_table(
    # WITHOUT
    "1. Operator Jay is loading a trailer at Dock 18 for a Walmart order\n"
    "2. He's told to load SKU #7742 (Organic Whole Milk, 1 gallon)\n"
    "3. The warehouse picker staged SKU #7743 (Organic 2% Milk, 1 gallon)\n"
    "   — the boxes look almost identical\n"
    "4. Jay doesn't catch it. He loads 200 cases of the wrong milk.\n"
    "5. The trailer ships. Walmart receives the wrong product 2 days later.\n"
    "6. Walmart files a chargeback: $4,200\n"
    "7. Nobody at the warehouse knows what happened until Walmart complains",
    # WITH
    "1. Operator Jay is loading a trailer at Dock 18 for a Walmart order\n"
    "2. DockIQ shows him the pick list:\n"
    "   'Load Plan — Walmart Order #W-9921:\n"
    "    Position 1: SKU #7742 — Organic Whole Milk 1gal — 200 cases\n"
    "    [Visual: Photo of the correct box with label highlighted]'\n"
    "3. Jay scans a case barcode → it reads SKU #7743\n"
    "4. DockIQ flags immediately:\n"
    "   'SKU MISMATCH\n"
    "    Expected: #7742 (Organic Whole Milk)\n"
    "    Scanned:  #7743 (Organic 2% Milk)\n"
    "    DO NOT LOAD — wrong product staged'\n"
    "5. Jay stops. Taps 'Report Issue' → supervisor is notified\n"
    "6. The right product is re-staged. Correct order ships.\n"
    "7. Walmart chargeback: $0",
    ["<b>Savings on this single incident:</b> $0 (loss already happened)"],
    ["<b>Savings on this single incident:</b> $4,200"],
)
add_spacer(12)

# ═══════════════════════════════════════════════════════════
# SCENARIO 4
# ═══════════════════════════════════════════════════════════
scenario_header("Scenario 4: \"The New Employee\"", "#2e7d32")

comparison_table(
    # WITHOUT
    "1. New operator Carlos, day 3 on the job, is assigned Dock 9\n"
    "2. He's loading an order for a customer he's never handled before\n"
    "3. This customer requires a very specific load pattern:\n"
    "   — Heavy items on bottom, light on top\n"
    "   — All labels facing outward\n"
    "   — Maximum 2 pallets high\n"
    "   — Slip sheets between every layer\n"
    "4. Carlos doesn't know any of this. The info is in a binder\n"
    "   in the supervisor's office.\n"
    "5. He loads it the standard way — 3 pallets high, no slip sheets\n"
    "6. Customer rejects the load at delivery → product damaged\n"
    "7. Re-delivery cost + damaged product = $6,000+",
    # WITH
    "1. New operator Carlos, day 3 on the job, is assigned Dock 9\n"
    "2. DockIQ automatically shows him:\n"
    "   'Load Plan for Customer: HEB Grocery\n"
    "    ┌───────────────────────────────────┐\n"
    "    │  MAX 2 PALLETS HIGH               │\n"
    "    │  [LIGHT] on top, [HEAVY] on bottom│\n"
    "    │  Slip sheets between layers       │\n"
    "    │  Labels facing OUT                │\n"
    "    └───────────────────────────────────┘'\n"
    "3. Carlos follows the visual guide\n"
    "4. He's unsure about slip sheets, types in chat:\n"
    "   'where are slip sheets?'\n"
    "5. AI responds: 'Slip sheets are located in Aisle 14, Bay C,\n"
    "   bottom shelf. They are thin cardboard sheets (48x40 inches).\n"
    "   Place one flat on top of each pallet layer before stacking.'\n"
    "6. Carlos loads it correctly. No damage. No re-delivery.",
    ["<b>Cost of mistake:</b> $6,000+"],
    ["<b>Cost of mistake:</b> $0 — prevented by real-time guidance"],
)
add_spacer(12)

# ═══════════════════════════════════════════════════════════
# SCENARIO 5
# ═══════════════════════════════════════════════════════════
scenario_header("Scenario 5: \"The Supervisor's Perspective\"", "#4a148c")

comparison_table(
    # WITHOUT
    "Sarah supervises 8 dock doors. Her shift:\n\n"
    "8:00 AM — Mike radios about a damaged pallet (Dock 12)\n"
    "8:02 AM — Jay walks over asking about a load sequence (Dock 18)\n"
    "8:03 AM — Lisa radios about a temperature issue (Dock 5) ← CRITICAL\n"
    "8:05 AM — Sarah goes to Dock 18 first (Jay got to her first)\n"
    "8:15 AM — Finishes with Jay, heads to Dock 12\n"
    "8:25 AM — Finishes with Mike, NOW goes to Dock 5\n"
    "8:35 AM — Discovers the temp issue — but product has been sitting\n"
    "          in a warm trailer for 32 minutes now\n\n"
    "The critical issue was handled LAST because the system is\n"
    "first-come-first-served based on who physically reaches\n"
    "the supervisor.",
    # WITH
    "Sarah's tablet shows a prioritized queue:\n\n"
    "┌──────────────────────────────────────────────────────┐\n"
    "│  CRITICAL  Dock 5  — Temp deviation 28°F            │\n"
    "│  Frozen Seafood — Lisa — 8:03 AM     [GO TO DOCK 5] │\n"
    "├──────────────────────────────────────────────────────┤\n"
    "│  HIGH      Dock 12 — Damaged pallet                 │\n"
    "│  Frozen Chicken — Mike — 8:00 AM     [VIEW DETAILS] │\n"
    "├──────────────────────────────────────────────────────┤\n"
    "│  MEDIUM    Dock 18 — Load sequence question          │\n"
    "│  Dairy — Jay — 8:02 AM              [VIEW DETAILS]  │\n"
    "└──────────────────────────────────────────────────────┘\n\n"
    "8:03 AM — Sarah sees the critical alert. Goes to Dock 5 FIRST.\n"
    "8:08 AM — Temp issue handled in 5 minutes\n"
    "          (Lisa already closed doors following AI guidance)\n"
    "8:12 AM — Goes to Dock 12\n"
    "          (Mike already separated damaged cases via AI guidance)\n"
    "8:18 AM — Checks Dock 18\n"
    "          (Jay already figured it out from the AI chat)\n\n"
    "Every issue triaged by urgency. Critical = first. Always.",
    ["<b>Result:</b> Critical food-safety issue handled last (32 min delay)"],
    ["<b>Result:</b> Critical issue handled first, two issues self-resolved by operators"],
)
add_spacer(16)

# ═══════════════════════════════════════════════════════════
# SUMMARY SECTION
# ═══════════════════════════════════════════════════════════
add_hr()
story.append(Paragraph("The Simple Way to Think About It", styles["H2"]))
story.append(Paragraph(
    "Think of DockIQ as <b>three things combined into one tablet</b> at the dock door:",
    styles["BodyText2"],
))
add_spacer(4)

summary_data = [
    ["1", "A Smart Assistant",
     "Like having an experienced colleague standing next to every operator, whispering "
     "\"here's what you should do\" based on the exact product, customer, and situation."],
    ["2", "A Panic Button\nwith Brains",
     "Instead of running to find help, one tap sends the right person the right information, "
     "and the most urgent issues get handled first."],
    ["3", "A Memory",
     "Every issue, every resolution, every discrepancy is captured digitally, so the warehouse "
     "stops repeating the same mistakes and actually learns from them."],
]
summary_table = Table(summary_data, colWidths=[30, 100, doc.width - 150])
summary_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, -1), HexColor("#0f3460")),
    ("TEXTCOLOR", (0, 0), (0, -1), white),
    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
    ("TEXTCOLOR", (1, 0), (1, -1), HexColor("#0f3460")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("ALIGN", (0, 0), (0, -1), "CENTER"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#cccccc")),
]))
story.append(summary_table)
add_spacer(14)

story.append(Paragraph(
    "The AI isn't replacing anyone. It's <b>giving operators confidence to handle routine issues "
    "themselves</b> and <b>giving supervisors the information to prioritize what actually matters</b>.",
    styles["BodyText2"],
))
add_spacer(20)
add_hr()
story.append(Paragraph("© 2026 DockIQ.AI. All rights reserved.", styles["Footer"]))

# Build
doc.build(story)
print("PDF generated successfully: DockIQ_AI_Scenarios_Explained.pdf")
