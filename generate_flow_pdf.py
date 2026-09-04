"""
DockIQ.AI — End-to-End Flow Screenshots → PDF
Captures 5 complete user flow scenarios with screenshots
"""
import urllib.request
import json
import time
import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

# Screenshot dir
SS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SS_DIR, exist_ok=True)

# We'll manually list the screenshots we capture via browser
# Since we can't automate browser screenshots from Python directly,
# we'll build the PDF structure with placeholder paths

def build_pdf():
    doc = SimpleDocTemplate(
        os.path.join(os.path.dirname(__file__), "DockIQ_Flow_Showcase.pdf"),
        pagesize=LETTER,
        topMargin=0.5*inch, bottomMargin=0.5*inch,
        leftMargin=0.6*inch, rightMargin=0.6*inch,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CoverTitle", parent=styles["Title"], fontSize=36, leading=44,
                               textColor=HexColor("#111827"), spaceAfter=8, fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("CoverSub", parent=styles["Normal"], fontSize=14, leading=20,
                               textColor=HexColor("#6b7280"), spaceAfter=30, alignment=TA_CENTER))
    styles.add(ParagraphStyle("FlowTitle", parent=styles["Heading1"], fontSize=22, leading=28,
                               textColor=HexColor("#111827"), spaceBefore=10, spaceAfter=6,
                               fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("FlowSub", parent=styles["Normal"], fontSize=11, leading=15,
                               textColor=HexColor("#6b7280"), spaceAfter=16))
    styles.add(ParagraphStyle("StepTitle", parent=styles["Heading2"], fontSize=14, leading=18,
                               textColor=HexColor("#2563eb"), spaceBefore=14, spaceAfter=6,
                               fontName="Helvetica-Bold"))
    styles.add(ParagraphStyle("StepDesc", parent=styles["Normal"], fontSize=10, leading=14,
                               textColor=HexColor("#374151"), spaceAfter=8))
    styles.add(ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, leading=10,
                               textColor=HexColor("#9ca3af"), alignment=TA_CENTER))

    story = []

    # ── COVER PAGE ──
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("DockIQ.AI", styles["CoverTitle"]))
    story.append(Paragraph("End-to-End Flow Showcase", styles["CoverSub"]))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Dock-Door Intelligence Platform — Prototype Demo", styles["CoverSub"]))
    story.append(Spacer(1, 1*inch))

    flows_info = [
        ("Landing Page", "The cinematic product landing page showcasing DockIQ's features"),
        ("Worker Login & Dashboard", "Role selection → worker selection → personalized dashboard"),
        ("Loading Flow", "Complete outbound loading workflow with load patterns and progress tracking"),
        ("Issue Resolution", "AI-powered issue reporting, severity classification, and self-resolution"),
        ("Supervisor Analytics", "Supervisor dashboard, priority alerts, and analytics overview"),
    ]
    for i, (title, desc) in enumerate(flows_info, 1):
        story.append(Paragraph(f"Flow {i}: {title}", styles["StepTitle"]))
        story.append(Paragraph(desc, styles["StepDesc"]))

    story.append(Spacer(1, 1*inch))
    story.append(Paragraph("Prepared by Rishabh Gupta · August 2026", styles["Footer"]))
    story.append(Paragraph("© 2026 DockIQ.AI. All rights reserved.", styles["Footer"]))
    story.append(PageBreak())

    # ── FLOW PAGES ──
    flows = [
        {
            "title": "Flow 1: Landing Page",
            "subtitle": "The cinematic product landing page — first impression for stakeholders",
            "steps": [
                ("Hero Section", "Massive headline, clear value proposition, and call-to-action buttons. The landing page uses scroll-driven animations and Apple-style design language.", "landing_hero.png"),
                ("Stats & Features", "Key metrics ribbon showing impact numbers, followed by AI resolution and severity classifier feature cards.", "landing_features.png"),
                ("Two Portals", "Worker and Supervisor portal feature comparison, showing the complete feature set for each role.", "landing_portals.png"),
            ]
        },
        {
            "title": "Flow 2: Worker Login & Dashboard",
            "subtitle": "Login as Mike Johnson (Senior Operator) → Dashboard showing Walmart outbound assignment",
            "steps": [
                ("Role Selection", "Clean login page with Dock Worker and Supervisor role cards. Warm, approachable design.", "login_role.png"),
                ("Worker Selection", "List of 8 operators with names, IDs, and experience levels. Each worker has unique dock assignments.", "login_workers.png"),
                ("Worker Dashboard", "Personalized dashboard showing dock assignment (Dock 1, Walmart), shift handoff notes, quick actions, stats, and recent issues.", "worker_dashboard.png"),
            ]
        },
        {
            "title": "Flow 3: Loading Workflow",
            "subtitle": "Carlos Rivera loading Kroger order — load pattern, product tracking, SOP reference",
            "steps": [
                ("Loading Overview", "Order details, overall progress bar with target count, and customer-specific load pattern visualization.", "loading_overview.png"),
                ("Trailer Load Pattern", "Top-down 53-foot trailer view showing 22 pallet positions with weight zones (heavy at nose, light at rear), stack height, and label direction.", "loading_pattern.png"),
                ("Product Tracking", "Per-product progress with tap counters (+1, +5, +10, +25), real-time count vs. target, and customer SOP panel.", "loading_products.png"),
            ]
        },
        {
            "title": "Flow 4: Issue Resolution (AI-Powered)",
            "subtitle": "Reporting a damaged pallet — AI classification, RAG-based resolution, self-resolve or escalate",
            "steps": [
                ("Issue Type Selection", "10 issue types with icons — one tap to select. Context (dock, trailer, customer) auto-filled.", "issue_step1.png"),
                ("Quick-Tap Description", "Tappable phrase chips (Crushed, Wet, Torn Label, etc.) for minimum typing. Additional notes optional.", "issue_step2.png"),
                ("AI Resolution", "Severity auto-classified (with scoring breakdown), step-by-step resolution from knowledge base, confidence score, source citation. Self-resolve or escalate to supervisor.", "issue_step3.png"),
            ]
        },
        {
            "title": "Flow 5: Supervisor Portal",
            "subtitle": "Sarah Mitchell — Priority alerts, dock overview, analytics dashboard",
            "steps": [
                ("Supervisor Dashboard", "Priority alert queue sorted by severity (Critical → Low), dock floor grid showing real-time status, broadcast messaging.", "sup_dashboard.png"),
                ("Issue Logs", "Searchable, filterable table of ALL issues (self-resolved + escalated) with severity badges, operator, customer, and cost impact.", "sup_logs.png"),
                ("Analytics Dashboard", "Gradient metric cards, issue trend area chart, severity donut, dock heatmap, operator performance bars, customer/carrier scorecards.", "sup_analytics.png"),
            ]
        },
    ]

    for flow in flows:
        story.append(Paragraph(flow["title"], styles["FlowTitle"]))
        story.append(Paragraph(flow["subtitle"], styles["FlowSub"]))

        for step_title, step_desc, img_file in flow["steps"]:
            story.append(Paragraph(f"▸ {step_title}", styles["StepTitle"]))
            story.append(Paragraph(step_desc, styles["StepDesc"]))

            img_path = os.path.join(SS_DIR, img_file)
            if os.path.exists(img_path):
                img = Image(img_path, width=6.8*inch, height=4*inch)
                img.hAlign = 'CENTER'
                story.append(img)
            else:
                story.append(Paragraph(f"[Screenshot: {img_file} — capture pending]", styles["StepDesc"]))

            story.append(Spacer(1, 12))

        story.append(PageBreak())

    # Final page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("Thank You", styles["CoverTitle"]))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("DockIQ.AI is a fully working prototype demonstrating AI-powered dock-door operations.<br/>All data shown is synthetic sample data for demonstration purposes.", styles["CoverSub"]))
    story.append(Spacer(1, 1*inch))
    story.append(Paragraph("© 2026 DockIQ.AI. All rights reserved.", styles["Footer"]))

    doc.build(story)
    print(f"PDF structure created: DockIQ_Flow_Showcase.pdf")
    print(f"Screenshots needed in: {SS_DIR}")

if __name__ == "__main__":
    build_pdf()
