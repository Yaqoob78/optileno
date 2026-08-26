import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)

def build_pdf():
    pdf_filename = "Optileno_30_Day_Growth_Plan.pdf"
    doc = SimpleDocTemplate(
        pdf_filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#4f46e5")
    secondary_color = colors.HexColor("#7c3aed")
    dark_text = colors.HexColor("#0f172a")
    body_text = colors.HexColor("#334155")
    card_bg = colors.HexColor("#f8fafc")
    border_color = colors.HexColor("#e2e8f0")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=primary_color,
        spaceAfter=6
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=secondary_color,
        spaceAfter=14
    )

    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=dark_text,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=body_text,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        'BulletText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=body_text,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#1e1b4b")
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("OPTILENO: 30-DAY SPRINT TO $200+ MRR", title_style))
    story.append(Paragraph("A Step-by-Step Operator Blueprint for $2,400+ ARR | Audience: Solo Agencies & Developers", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceBefore=2, spaceAfter=12))

    # Section 1: Growth Math
    story.append(Paragraph("1. The Growth Mathematics & Conversion Benchmarks", h1_style))
    story.append(Paragraph(
        "To reach and exceed <b>$200/month MRR</b> (or $300+ upfront cash), Optileno leverages a high-value blended tier structure ($19/mo or ₹12,999/yr).",
        body_style
    ))

    math_data = [
        [Paragraph("<b>Target Metric</b>", body_style), Paragraph("<b>Subscribers Needed</b>", body_style), Paragraph("<b>Unit Price</b>", body_style), Paragraph("<b>Resulting Revenue</b>", body_style)],
        [Paragraph("Option A (Monthly Subscriptions)", body_style), Paragraph("11 Users", body_style), Paragraph("$19 / month", body_style), Paragraph("<b>$209 / mo MRR</b>", body_style)],
        [Paragraph("Option B (Annual Cash Flow Boost)", body_style), Paragraph("2 Users", body_style), Paragraph("₹12,999 / $155 yr", body_style), Paragraph("<b>$310 Instant Cash</b>", body_style)],
        [Paragraph("Option C (Blended 30-Day Target)", body_style), Paragraph("6 Monthly + 1 Annual", body_style), Paragraph("Blended", body_style), Paragraph("<b>$269 Total Revenue</b>", body_style)]
    ]
    math_table = Table(math_data, colWidths=[150, 110, 110, 140])
    math_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
        ('TEXTCOLOR', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#ffffff")),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor("#f8fafc")),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor("#ffffff")),
    ]))
    story.append(math_table)
    story.append(Spacer(1, 10))

    # Funnel benchmarks
    story.append(Paragraph(
        "<b>Funnel Targets:</b> 5,000 Unique Visitors &rarr; 300 Free Signups (6%) &rarr; 60 Active Daily Users (20%) &rarr; <b>11-15 Paid Ultra Users (18-25%)</b>.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # Section 2: Product Moat
    story.append(Paragraph("2. Optileno's Architectural Moat & Value Proposition", h1_style))
    story.append(Paragraph(
        "Unlike generic task checklists, Optileno is engineered specifically to prevent cognitive fatigue for technical solo operators.",
        body_style
    ))

    features = [
        "<b>Interactive Chronological Time-Grid:</b> 18-hour continuous planner (06:00 to 23:00) with 7-Day & 1-Day views, live 'Now' indicator, and click-to-schedule empty slots.",
        "<b>Dual AI Brain with Instant Failover:</b> Meta Llama 3.3 70B via NVIDIA NIM with sub-300ms failover to Groq for zero downtime.",
        "<b>Autonomous Deep Work Scheduling:</b> AI detects open calendar gaps and schedules 90-minute focused execution blocks.",
        "<b>Big Five & Burnout Telemetry:</b> Calibrates schedule intensity based on psychological stamina and cognitive workload.",
        "<b>Free Lead-Gen Tools:</b> Public AI Task Prioritizer and Weekly Planner for organic search and viral Reddit acquisition."
    ]
    for feat in features:
        story.append(Paragraph(f"• {feat}", bullet_style))

    story.append(Spacer(1, 10))

    # Section 3: 30-Day Action Blueprint
    story.append(Paragraph("3. Day-by-Day 30-Day Execution Blueprint", h1_style))

    # Week 1
    story.append(Paragraph("Phase 1: Days 1 to 7 — Technical Launch & Free Lead Magnets", h2_style))
    w1_items = [
        "<b>Day 1 (Indexing):</b> Submit sitemap.xml to Google Search Console and Bing Webmaster Tools. Verify all 23 routes return 200 OK.",
        "<b>Day 2 (AI Directories Part 1):</b> Submit to Futurepedia, There's An AI For That (TAAFT), Toolify.ai, TopAI.tools, and Insidr.ai.",
        "<b>Day 3 (AI Directories Part 2):</b> Submit to AlternativeTo (as Motion/Sunsama alternative), Microlaunch, Uneed, and BetaList.",
        "<b>Day 4 (Reddit Seed):</b> Post free tool on r/productivity and r/solopreneur: 'I built a free tool that ranks tasks by revenue leverage'.",
        "<b>Day 5 (Competitor Outreach):</b> Share /vs/motion on Notion/Motion Discord communities showing how Optileno prevents burnout at $19/mo vs $34/mo.",
        "<b>Day 6 (Annual Discount Push):</b> Activate in-app Founding Member Pass: ₹12,999/yr (~$155) with 28% discount.",
        "<b>Day 7 (Week 1 Review):</b> Verify Lemon Squeezy webhook logs, free user activation, and database metrics."
    ]
    for item in w1_items:
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 8))

    # Week 2
    story.append(Paragraph("Phase 2: Days 8 to 15 — The Solo Agency Outbound Engine", h2_style))
    w2_items = [
        "<b>Day 8 (X/Twitter Thread):</b> 'How solo agency founders lose 15 hrs/week to blind calendar overlaps' with a 15-second demo video.",
        "<b>Day 9 (LinkedIn Outreach):</b> Connect with 20 solo web/dev agency owners per day offering a free cognitive workload audit.",
        "<b>Day 10 (Show HN):</b> Submit 'Show HN: Optileno – AI Calendar Planner with Burnout Telemetry' on Hacker News & IndieHackers.",
        "<b>Day 11 (Weekly Planner Push):</b> Distribute /tools/ai-weekly-planner across r/agency and r/freelance communities.",
        "<b>Day 12 (1-on-1 Consults):</b> Offer 3 free 20-min workflow setup calls to early users to observe live friction points.",
        "<b>Day 13 (UI/UX Polish):</b> Eliminate any onboarding friction observed during user setup calls.",
        "<b>Day 14 (Trial Conversion):</b> Trigger in-app upgrade banner for users reaching >10 chat requests.",
        "<b>Day 15 (Mid-Point Check):</b> Target: $57–$155 in revenue banked."
    ]
    for item in w2_items:
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 8))

    # Week 3
    story.append(Paragraph("Phase 3: Days 16 to 22 — In-App Paywall Optimization & Retargeting", h2_style))
    w3_items = [
        "<b>Day 16 (Paywall Gate):</b> Refine locked Deep Work and Goal Timeline prompts highlighting $19/mo and ₹12,999/yr options.",
        "<b>Day 17 (Video Walkthrough):</b> Publish a 3-minute YouTube/Loom demo comparing Optileno directly against Motion and Sunsama.",
        "<b>Day 18 (Newsletter Swap):</b> Partner with 2 tech/freelance micro-newsletters (1k–5k readers) for promotional swaps.",
        "<b>Day 19 (Reddit Case Study):</b> Post breakdown: 'How I built an AI calendar that schedules around cognitive fatigue'.",
        "<b>Day 20 (Annual Plan Cash Blitz):</b> Send direct email to free Explorer tier users offering the ₹12,999/yr early-bird lifetime rate.",
        "<b>Day 21 (Follow-Up Sprint):</b> Re-engage all warm LinkedIn and Twitter contacts from Week 2.",
        "<b>Day 22 (Week 3 Review):</b> Target: 7 Monthly ($133) or 1 Annual + 3 Monthly ($212)."
    ]
    for item in w3_items:
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 8))

    # Week 4
    story.append(Paragraph("Phase 4: Days 23 to 30 — Product Hunt Launch & Scaling", h2_style))
    w4_items = [
        "<b>Day 23 (PH Asset Prep):</b> Finalize 5 gallery screenshots, animated GIF/WebP walkthrough, and maker commentary.",
        "<b>Day 24 (Community Teaser):</b> Announce upcoming launch across X, LinkedIn, and personal networks.",
        "<b>Day 25 (Product Hunt Launch Day):</b> Go live at 12:01 AM PST. Engage every commenter, drive traffic from email list.",
        "<b>Day 26 (Traffic Triage):</b> Capture spike traffic into free registrations and offer direct Ultra Pro upgrade discounts.",
        "<b>Day 27 (Social Proof):</b> Collect testimonials from top active users and embed them directly onto the landing page.",
        "<b>Day 28 (Affiliate Program):</b> Set up 25% recurring Lemon Squeezy affiliate links for productivity influencers.",
        "<b>Day 29 (Final Retargeting):</b> Direct push to users who logged in >3 times during the month.",
        "<b>Day 30 (Goal Achieved):</b> Finalize financial close. <b>Target Milestone: $200+ MRR / $300+ Cash in Bank</b>."
    ]
    for item in w4_items:
        story.append(Paragraph(f"• {item}", bullet_style))

    story.append(Spacer(1, 12))

    # Section 4: 90-Day Forecast Table
    story.append(Paragraph("4. 90-Day Revenue Horizon", h1_style))
    forecast_data = [
        [Paragraph("<b>Milestone</b>", body_style), Paragraph("<b>Free Users</b>", body_style), Paragraph("<b>Monthly Subs ($19)</b>", body_style), Paragraph("<b>Annual Subs ($155)</b>", body_style), Paragraph("<b>Monthly MRR</b>", body_style), Paragraph("<b>Cumulative Cash</b>", body_style)],
        [Paragraph("Day 30 (Target)", body_style), Paragraph("350", body_style), Paragraph("8", body_style), Paragraph("2", body_style), Paragraph("<b>$210 / mo</b>", body_style), Paragraph("<b>$462</b>", body_style)],
        [Paragraph("Day 60", body_style), Paragraph("1,200", body_style), Paragraph("25", body_style), Paragraph("6", body_style), Paragraph("<b>$580 / mo</b>", body_style), Paragraph("<b>$1,405</b>", body_style)],
        [Paragraph("Day 90", body_style), Paragraph("3,000", body_style), Paragraph("60", body_style), Paragraph("18", body_style), Paragraph("<b>$1,420 / mo</b>", body_style), Paragraph("<b>$3,930</b>", body_style)]
    ]
    forecast_table = Table(forecast_data, colWidths=[90, 70, 95, 95, 80, 80])
    forecast_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
        ('TEXTCOLOR', (0, 0), (-1, 0), primary_color),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, border_color),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#ffffff")),
        ('BACKGROUND', (0, 2), (-1, 2), colors.HexColor("#f8fafc")),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor("#ffffff")),
    ]))
    story.append(forecast_table)

    doc.build(story)
    print(f"Successfully generated {pdf_filename} ({os.path.getsize(pdf_filename)} bytes)")

if __name__ == '__main__':
    build_pdf()
