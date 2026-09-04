import sqlite3
import json
import os
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), "dockiq.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def dict_row(row):
    if row is None:
        return None
    return dict(row)


def dict_rows(rows):
    return [dict(r) for r in rows]


def init_db():
    conn = get_db()
    c = conn.cursor()

    # ── SCHEMA ──
    c.executescript("""
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tier INTEGER NOT NULL,
        count_tolerance REAL NOT NULL,
        load_pattern TEXT NOT NULL,
        sop_rules TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        weight_per_case REAL NOT NULL,
        cases_per_pallet INTEGER NOT NULL,
        temp_min REAL,
        temp_max REAL,
        is_allergen INTEGER DEFAULT 0,
        lot_tracking_required INTEGER DEFAULT 0,
        case_value REAL NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS dock_doors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        door_number INTEGER NOT NULL,
        zone TEXT NOT NULL,
        status TEXT DEFAULT 'idle',
        lifecycle_phase TEXT DEFAULT 'idle',
        current_trailer TEXT,
        current_order_id INTEGER,
        current_operator_id INTEGER,
        trailer_arrived_at TEXT,
        last_activity_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        employee_id TEXT NOT NULL UNIQUE,
        shift TEXT NOT NULL,
        zone TEXT,
        experience_level TEXT
    );

    CREATE TABLE IF NOT EXISTS carriers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        company_id INTEGER NOT NULL,
        carrier_id INTEGER NOT NULL,
        trailer_number TEXT NOT NULL,
        bol_number TEXT NOT NULL,
        dock_door_id INTEGER,
        operator_id INTEGER,
        status TEXT DEFAULT 'pending',
        seal_number TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (company_id) REFERENCES companies(id),
        FOREIGN KEY (carrier_id) REFERENCES carriers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        expected_quantity INTEGER NOT NULL,
        actual_quantity INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        dock_door_id INTEGER,
        operator_id INTEGER,
        supervisor_id INTEGER,
        issue_type TEXT NOT NULL,
        description TEXT,
        quick_tags TEXT,
        severity TEXT NOT NULL,
        severity_score REAL,
        severity_reason TEXT,
        status TEXT DEFAULT 'resolution_in_progress',
        ai_resolution TEXT,
        ai_confidence TEXT,
        resolution_type TEXT,
        resolution_notes TEXT,
        supervisor_notes TEXT,
        product_id INTEGER,
        company_id INTEGER,
        carrier_id INTEGER,
        estimated_cost_impact REAL DEFAULT 0,
        escalated_at TEXT,
        acknowledged_at TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_type TEXT NOT NULL,
        scenario TEXT NOT NULL,
        keywords TEXT NOT NULL,
        resolution_steps TEXT NOT NULL,
        confidence TEXT NOT NULL,
        source_reference TEXT NOT NULL,
        applicable_categories TEXT,
        applicable_companies TEXT
    );

    CREATE TABLE IF NOT EXISTS trailer_inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        dock_door_id INTEGER NOT NULL,
        operator_id INTEGER NOT NULL,
        seal_condition TEXT NOT NULL,
        interior_cleanliness TEXT NOT NULL,
        interior_temperature REAL,
        visible_damage TEXT NOT NULL,
        overall_pass INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quick_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dock_door_id INTEGER,
        operator_id INTEGER NOT NULL,
        request_type TEXT NOT NULL,
        details TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        fulfilled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supervisor_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shift_handoffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supervisor_id INTEGER NOT NULL,
        shift TEXT NOT NULL,
        notes TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        source_reference TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # Check if data already seeded
    count = c.execute("SELECT COUNT(*) FROM companies").fetchone()[0]
    if count > 0:
        conn.close()
        return

    # ── SEED DATA ──
    _seed_companies(c)
    _seed_products(c)
    _seed_dock_doors(c)
    _seed_users(c)
    _seed_carriers(c)
    _seed_knowledge_base(c)
    _seed_orders(c)
    _seed_historical_issues(c)
    _seed_shift_handoff(c)

    conn.commit()
    conn.close()


def _seed_companies(c):
    companies = [
        # Tier 1
        ("Walmart", 1, 0.01, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Double-wrap all pallets. No product overhang beyond pallet edge."
        }, {
            "receiving": "Verify all lot numbers. Reject if temp >5°F above threshold.",
            "shipping": "All pallets must be stretch-wrapped minimum 3 revolutions.",
            "rejection_criteria": "Any punctured packaging on food items = full pallet reject.",
            "temp_check": "Probe minimum 3 cases per pallet for frozen/refrigerated."
        }),
        ("Costco", 1, 0.02, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Club-pack orientation: barcode facing scanner side. Tier sheets between layers."
        }, {
            "receiving": "Count every case. No tolerance on Kirkland brand items.",
            "shipping": "Pallets must not exceed 60 inches height including pallet.",
            "rejection_criteria": "Reject entire lot if any case shows temperature abuse signs.",
            "temp_check": "Digital probe required. Handwritten readings not accepted."
        }),
        ("Kroger", 1, 0.02, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Stack by department: dairy together, frozen together. No mixing categories on same pallet."
        }, {
            "receiving": "Verify expiry dates are minimum 14 days out.",
            "shipping": "Segregate organic from conventional on separate pallets.",
            "rejection_criteria": "Reject if >5% of cases damaged. Partial accept if ≤5%.",
            "temp_check": "Probe center cases, not edge cases."
        }),
        ("Target", 1, 0.02, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "All pallets must have Target pallet tags. No handwritten labels."
        }, {
            "receiving": "Scan every case barcode. Manual entry not permitted.",
            "shipping": "GTIN verification required on every SKU before loading.",
            "rejection_criteria": "Reject if product not in Target's approved vendor list.",
            "temp_check": "Infrared and probe readings both required for frozen."
        }),
        ("Sam's Club", 1, 0.02, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Display-ready pallets must not be re-stacked. Ship as received from vendor."
        }, {
            "receiving": "Match ASN (Advance Ship Notice) to physical count.",
            "shipping": "Pallet weight must not exceed 2,500 lbs.",
            "rejection_criteria": "Reject if pallet is not display-ready when required.",
            "temp_check": "Same as Walmart standards."
        }),
        # Tier 2
        ("HEB", 2, 0.03, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Use HEB-specific slip sheets (brown kraft). No substitutes."
        }, {
            "receiving": "Verify all lot numbers match purchase order.",
            "shipping": "Products must be sorted by aisle planogram order.",
            "rejection_criteria": "Reject if lot number does not match PO.",
            "temp_check": "Reefer unit must show continuous temp log for transit."
        }),
        ("Publix", 2, 0.03, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Canned goods: labels facing same direction for shelf-ready display."
        }, {
            "receiving": "Inspect for pest evidence on all produce pallets.",
            "shipping": "Allergen products must be on separate pallets from non-allergen.",
            "rejection_criteria": "Reject produce with any visible mold or pest damage.",
            "temp_check": "Produce: pulp temperature required, not air temperature."
        }),
        ("Whole Foods", 2, 0.02, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Organic certification docs must accompany every organic pallet."
        }, {
            "receiving": "Verify organic certification on all organic products.",
            "shipping": "Non-GMO and organic must be segregated from conventional.",
            "rejection_criteria": "Reject if organic certification is missing or expired.",
            "temp_check": "Stricter thresholds: frozen must be ≤-5°F (not 0°F)."
        }),
        ("Safeway", 2, 0.03, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Use Safeway-branded pallet tags for all outbound shipments."
        }, {
            "receiving": "Check for recalled product against active recall list.",
            "shipping": "Load nose-to-tail: heaviest pallets at nose of trailer.",
            "rejection_criteria": "Reject any product on active recall list immediately.",
            "temp_check": "Standard thresholds apply."
        }),
        ("Albertsons", 2, 0.03, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Pallets must be GMA standard (48x40). No oversized pallets."
        }, {
            "receiving": "Verify vendor code matches approved vendor list.",
            "shipping": "Maximum 22 pallets per 53-foot trailer.",
            "rejection_criteria": "Reject non-GMA pallets. Request re-palletization.",
            "temp_check": "Albertsons follows Safeway standards."
        }),
        # Tier 3
        ("Aldi", 3, 0.05, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "any",
            "special": "Display-ready packaging preferred. Minimize waste packaging."
        }, {
            "receiving": "Standard receiving procedures apply.",
            "shipping": "Cost-efficient loading: maximize cube utilization.",
            "rejection_criteria": "Standard rejection criteria apply.",
            "temp_check": "Standard thresholds apply."
        }),
        ("Trader Joe's", 3, 0.03, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Private label products must be handled separately from vendor brands."
        }, {
            "receiving": "Verify all items are Trader Joe's private label.",
            "shipping": "Artwork/packaging must be undamaged for shelf display.",
            "rejection_criteria": "Reject if packaging artwork is damaged (brand image).",
            "temp_check": "Standard thresholds apply."
        }),
        ("Meijer", 3, 0.04, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Standard Midwest distribution palletization rules."
        }, {
            "receiving": "Standard receiving procedures.",
            "shipping": "Weather protection required for paper goods in winter.",
            "rejection_criteria": "Standard criteria apply.",
            "temp_check": "Standard thresholds apply."
        }),
        ("WinCo", 3, 0.05, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "any",
            "special": "Bulk items can be floor-stacked if pallet is unavailable."
        }, {
            "receiving": "Standard procedures. WinCo accepts minor cosmetic damage.",
            "shipping": "Maximize pallet count per trailer.",
            "rejection_criteria": "Only reject for safety/quality issues, not cosmetic.",
            "temp_check": "Standard thresholds apply."
        }),
        ("Food Lion", 3, 0.04, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Use Food Lion delivery window scheduling. No early arrivals."
        }, {
            "receiving": "Must arrive within scheduled delivery window.",
            "shipping": "Delivery appointment required. No unscheduled deliveries.",
            "rejection_criteria": "May reject if outside delivery window.",
            "temp_check": "Standard thresholds apply."
        }),
        ("Wegmans", 3, 0.02, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Premium presentation required. No damaged outer packaging."
        }, {
            "receiving": "Higher quality standards than typical Tier 3.",
            "shipping": "All cases must have clean, undamaged outer packaging.",
            "rejection_criteria": "Reject if outer packaging is torn, stained, or crushed.",
            "temp_check": "Standard thresholds apply."
        }),
        ("BJ's Wholesale", 3, 0.03, {
            "max_height": 2, "weight_placement": "heavy_bottom",
            "slip_sheets": True, "label_direction": "facing_out",
            "special": "Club-size packaging. Verify multi-pack counts."
        }, {
            "receiving": "Verify inner pack count on multi-packs.",
            "shipping": "Similar to Costco/Sam's Club palletization standards.",
            "rejection_criteria": "Reject if multi-pack is opened or count is wrong.",
            "temp_check": "Standard thresholds apply."
        }),
        ("Sysco", 3, 0.03, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Foodservice packaging. Cases must withstand restaurant handling."
        }, {
            "receiving": "Verify HACCP documentation accompanies all shipments.",
            "shipping": "Segregate by temperature zone within trailer if mixed load.",
            "rejection_criteria": "Reject without HACCP documentation.",
            "temp_check": "Strict HACCP temperature requirements apply."
        }),
        ("US Foods", 3, 0.03, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "facing_out",
            "special": "Route-optimized loading: first stop loaded last (nose of trailer)."
        }, {
            "receiving": "Standard foodservice receiving procedures.",
            "shipping": "Load in reverse delivery order for multi-stop routes.",
            "rejection_criteria": "Standard criteria. Strict on allergen segregation.",
            "temp_check": "HACCP standards apply."
        }),
        ("McLane", 3, 0.04, {
            "max_height": 3, "weight_placement": "heavy_bottom",
            "slip_sheets": False, "label_direction": "any",
            "special": "Convenience store distribution. Mixed category pallets OK."
        }, {
            "receiving": "Standard procedures. High volume, fast turnaround expected.",
            "shipping": "Mixed category pallets acceptable for convenience store orders.",
            "rejection_criteria": "Standard criteria apply.",
            "temp_check": "Standard thresholds apply."
        }),
    ]

    for name, tier, tol, lp, sop in companies:
        c.execute(
            "INSERT INTO companies (name, tier, count_tolerance, load_pattern, sop_rules) VALUES (?,?,?,?,?)",
            (name, tier, tol, json.dumps(lp), json.dumps(sop))
        )


def _seed_products(c):
    # (company_id, sku, name, category, weight_per_case, cases_per_pallet, temp_min, temp_max, allergen, lot_req, case_value)
    products = [
        # Walmart (1)
        (1, "WMT-FZ-1001", "Great Value Frozen Chicken Breasts", "Frozen", 25.0, 48, -10, 0, 0, 1, 28.50),
        (1, "WMT-RF-1002", "Great Value Whole Milk 1 Gal", "Refrigerated", 34.0, 36, 33, 40, 1, 1, 22.00),
        (1, "WMT-PR-1003", "Fresh Bananas Premium", "Produce", 40.0, 48, 56, 64, 0, 0, 18.00),
        (1, "WMT-DY-1004", "Great Value Canned Corn 15oz", "Dry", 20.0, 60, None, None, 0, 0, 12.50),
        # Costco (2)
        (2, "CST-FZ-2001", "Kirkland Frozen Salmon Fillets", "Frozen", 30.0, 40, -10, 0, 0, 1, 65.00),
        (2, "CST-RF-2002", "Kirkland Organic 2% Milk 2-Pack", "Refrigerated", 36.0, 30, 33, 40, 1, 1, 14.00),
        (2, "CST-PR-2003", "Organic Strawberries 4lb", "Produce", 32.0, 48, 32, 40, 0, 0, 32.00),
        (2, "CST-DY-2004", "Kirkland Olive Oil 2L", "Dry", 28.0, 42, None, None, 0, 0, 24.00),
        # Kroger (3)
        (3, "KRG-FZ-3001", "Kroger Frozen Pizza Pepperoni", "Frozen", 18.0, 56, -10, 0, 1, 0, 35.00),
        (3, "KRG-RF-3002", "Kroger Greek Yogurt Variety 12pk", "Refrigerated", 22.0, 42, 33, 40, 1, 1, 28.00),
        (3, "KRG-PR-3003", "Fresh Romaine Lettuce Hearts", "Produce", 15.0, 60, 34, 40, 0, 0, 16.00),
        (3, "KRG-DY-3004", "Kroger Pasta Spaghetti 1lb", "Dry", 16.0, 72, None, None, 1, 0, 8.50),
        # Target (4)
        (4, "TGT-FZ-4001", "Good & Gather Frozen Shrimp", "Frozen", 24.0, 44, -10, 0, 0, 1, 52.00),
        (4, "TGT-RF-4002", "Good & Gather Fresh Mozzarella", "Refrigerated", 20.0, 48, 33, 40, 1, 1, 38.00),
        (4, "TGT-PR-4003", "Organic Baby Spinach 5oz", "Produce", 10.0, 80, 34, 40, 0, 0, 22.00),
        (4, "TGT-DY-4004", "Good & Gather Granola Bars", "Dry", 14.0, 60, None, None, 1, 0, 18.00),
        # Sam's Club (5)
        (5, "SAM-FZ-5001", "Member's Mark Frozen Chicken Wings", "Frozen", 30.0, 40, -10, 0, 0, 1, 34.00),
        (5, "SAM-RF-5002", "Member's Mark Sharp Cheddar 5lb", "Refrigerated", 40.0, 32, 33, 40, 1, 1, 26.00),
        (5, "SAM-PR-5003", "Fresh Avocados Hass Bulk", "Produce", 25.0, 56, 42, 55, 0, 0, 42.00),
        (5, "SAM-DY-5004", "Member's Mark Paper Towels 15pk", "Dry", 22.0, 36, None, None, 0, 0, 20.00),
        # HEB (6)
        (6, "HEB-FZ-6001", "H-E-B Frozen Fish Sticks", "Frozen", 20.0, 52, -10, 0, 0, 1, 24.00),
        (6, "HEB-RF-6002", "H-E-B Creamy Creations Ice Cream", "Refrigerated", 28.0, 36, -20, -5, 1, 0, 32.00),
        (6, "HEB-PR-6003", "Texas Sweet Onions 3lb Bag", "Produce", 30.0, 56, 50, 65, 0, 0, 10.00),
        (6, "HEB-DY-6004", "H-E-B Flour Tortillas 20ct", "Dry", 12.0, 80, None, None, 1, 0, 6.50),
        # Publix (7)
        (7, "PBX-FZ-7001", "Publix Frozen Meatballs Italian", "Frozen", 22.0, 48, -10, 0, 1, 1, 30.00),
        (7, "PBX-RF-7002", "Publix Deli Turkey Breast Sliced", "Refrigerated", 16.0, 56, 33, 38, 1, 1, 44.00),
        (7, "PBX-PR-7003", "Fresh Florida Oranges 4lb", "Produce", 32.0, 48, 38, 48, 0, 0, 14.00),
        (7, "PBX-DY-7004", "Publix Peanut Butter Creamy 16oz", "Dry", 18.0, 64, None, None, 1, 0, 16.00),
        # Whole Foods (8)
        (8, "WFM-FZ-8001", "365 Organic Frozen Broccoli", "Frozen", 14.0, 64, -15, -5, 0, 1, 20.00),
        (8, "WFM-RF-8002", "365 Organic Whole Milk 1 Gal", "Refrigerated", 34.0, 36, 33, 40, 1, 1, 26.00),
        (8, "WFM-PR-8003", "Organic Kale Bunch", "Produce", 8.0, 80, 34, 40, 0, 0, 12.00),
        (8, "WFM-DY-8004", "365 Organic Quinoa 1lb", "Dry", 12.0, 72, None, None, 0, 0, 22.00),
        # Safeway (9)
        (9, "SFW-FZ-9001", "Safeway Select Frozen Lasagna", "Frozen", 26.0, 44, -10, 0, 1, 0, 28.00),
        (9, "SFW-RF-9002", "Lucerne Sour Cream 16oz", "Refrigerated", 20.0, 48, 33, 40, 1, 1, 14.00),
        (9, "SFW-PR-9003", "Fresh Broccoli Crowns", "Produce", 22.0, 56, 34, 40, 0, 0, 18.00),
        (9, "SFW-DY-9004", "Safeway Chicken Broth 32oz", "Dry", 24.0, 48, None, None, 0, 0, 10.00),
        # Albertsons (10)
        (10, "ALB-FZ-0001", "Albertsons Frozen Waffles", "Frozen", 14.0, 60, -10, 0, 1, 0, 16.00),
        (10, "ALB-RF-0002", "Albertsons Fresh OJ 52oz", "Refrigerated", 30.0, 40, 33, 40, 0, 1, 20.00),
        (10, "ALB-PR-0003", "Fresh Tomatoes Vine Ripe", "Produce", 20.0, 56, 55, 65, 0, 0, 24.00),
        (10, "ALB-DY-0004", "Albertsons Crackers Saltine", "Dry", 10.0, 80, None, None, 1, 0, 8.00),
        # Aldi (11)
        (11, "ALD-FZ-1101", "Simply Nature Frozen Peas", "Frozen", 16.0, 60, -10, 0, 0, 0, 10.00),
        (11, "ALD-RF-1102", "Friendly Farms Whole Milk", "Refrigerated", 34.0, 36, 33, 40, 1, 1, 16.00),
        (11, "ALD-PR-1103", "Fresh Sweet Potatoes 3lb", "Produce", 30.0, 48, 55, 65, 0, 0, 8.00),
        (11, "ALD-DY-1104", "Baker's Corner All Purpose Flour 5lb", "Dry", 25.0, 48, None, None, 1, 0, 6.00),
        # Trader Joe's (12)
        (12, "TJS-FZ-1201", "TJ's Mandarin Orange Chicken", "Frozen", 20.0, 52, -10, 0, 0, 0, 26.00),
        (12, "TJS-RF-1202", "TJ's Unexpected Cheddar Cheese", "Refrigerated", 18.0, 56, 33, 40, 1, 1, 36.00),
        (12, "TJS-PR-1203", "TJ's Organic Bananas", "Produce", 40.0, 48, 56, 64, 0, 0, 12.00),
        (12, "TJS-DY-1204", "TJ's Everything But The Bagel Seasoning", "Dry", 8.0, 96, None, None, 0, 0, 28.00),
        # Meijer (13)
        (13, "MEJ-FZ-1301", "Meijer Frozen Corn 12oz", "Frozen", 14.0, 64, -10, 0, 0, 0, 8.00),
        (13, "MEJ-RF-1302", "Meijer Cottage Cheese 16oz", "Refrigerated", 20.0, 48, 33, 40, 1, 1, 12.00),
        (13, "MEJ-PR-1303", "Fresh Michigan Apples 3lb", "Produce", 30.0, 48, 32, 40, 0, 0, 14.00),
        (13, "MEJ-DY-1304", "Meijer Pinto Beans 15oz Can", "Dry", 18.0, 64, None, None, 0, 0, 6.00),
        # WinCo (14)
        (14, "WIN-FZ-1401", "WinCo Frozen Mixed Vegetables", "Frozen", 16.0, 60, -10, 0, 0, 0, 8.00),
        (14, "WIN-RF-1402", "WinCo Butter Salted 1lb", "Refrigerated", 20.0, 48, 33, 40, 1, 1, 14.00),
        (14, "WIN-PR-1403", "Fresh Russet Potatoes 10lb", "Produce", 40.0, 40, 45, 55, 0, 0, 10.00),
        (14, "WIN-DY-1404", "WinCo Bulk Trail Mix 1lb", "Dry", 16.0, 60, None, None, 1, 0, 12.00),
        # Food Lion (15)
        (15, "FDL-FZ-1501", "Food Lion Frozen Green Beans", "Frozen", 14.0, 64, -10, 0, 0, 0, 8.00),
        (15, "FDL-RF-1502", "Food Lion American Cheese Slices", "Refrigerated", 16.0, 56, 33, 40, 1, 1, 16.00),
        (15, "FDL-PR-1503", "Fresh Cucumbers", "Produce", 18.0, 60, 50, 60, 0, 0, 10.00),
        (15, "FDL-DY-1504", "Food Lion White Rice 2lb", "Dry", 20.0, 56, None, None, 0, 0, 4.00),
        # Wegmans (16)
        (16, "WEG-FZ-1601", "Wegmans Frozen Ravioli Cheese", "Frozen", 22.0, 48, -10, 0, 1, 1, 32.00),
        (16, "WEG-RF-1602", "Wegmans Organic Yogurt 32oz", "Refrigerated", 24.0, 42, 33, 40, 1, 1, 24.00),
        (16, "WEG-PR-1603", "Fresh Heirloom Tomatoes", "Produce", 16.0, 56, 55, 68, 0, 0, 30.00),
        (16, "WEG-DY-1604", "Wegmans Italian Classics Marinara", "Dry", 20.0, 52, None, None, 0, 0, 18.00),
        # BJ's (17)
        (17, "BJS-FZ-1701", "Wellsley Farms Frozen Shrimp 2lb", "Frozen", 28.0, 40, -10, 0, 0, 1, 48.00),
        (17, "BJS-RF-1702", "Wellsley Farms Cream Cheese 3lb", "Refrigerated", 30.0, 36, 33, 40, 1, 1, 18.00),
        (17, "BJS-PR-1703", "Fresh Blueberries 18oz 2-pack", "Produce", 20.0, 52, 32, 40, 0, 0, 28.00),
        (17, "BJS-DY-1704", "Wellsley Farms K-Cup Variety 100ct", "Dry", 14.0, 48, None, None, 0, 0, 42.00),
        # Sysco (18)
        (18, "SYS-FZ-1801", "Sysco Classic Frozen French Fries", "Frozen", 30.0, 40, -10, 0, 0, 0, 22.00),
        (18, "SYS-RF-1802", "Sysco Imperial Fresh Butter Pats", "Refrigerated", 18.0, 56, 33, 38, 1, 1, 34.00),
        (18, "SYS-PR-1803", "Fresh Iceberg Lettuce 24ct", "Produce", 35.0, 40, 34, 40, 0, 0, 20.00),
        (18, "SYS-DY-1804", "Sysco Ketchup Packets 1000ct", "Dry", 22.0, 48, None, None, 0, 0, 16.00),
        # US Foods (19)
        (19, "USF-FZ-1901", "Chef's Line Frozen Burger Patties", "Frozen", 32.0, 36, -10, 0, 0, 1, 38.00),
        (19, "USF-RF-1902", "Cross Valley Farms Shredded Cheddar", "Refrigerated", 24.0, 42, 33, 40, 1, 1, 30.00),
        (19, "USF-PR-1903", "Fresh Bell Peppers Tri-Color", "Produce", 20.0, 52, 45, 55, 0, 0, 26.00),
        (19, "USF-DY-1904", "Monarch Hot Sauce 12oz", "Dry", 16.0, 64, None, None, 0, 0, 10.00),
        # McLane (20)
        (20, "MCL-FZ-2001", "McLane Frozen Breakfast Burritos", "Frozen", 18.0, 56, -10, 0, 1, 0, 20.00),
        (20, "MCL-RF-2002", "McLane Fresh Sandwich Wraps", "Refrigerated", 12.0, 64, 33, 40, 1, 1, 24.00),
        (20, "MCL-PR-2003", "Fresh Cut Fruit Cups 8oz", "Produce", 14.0, 60, 34, 40, 0, 0, 16.00),
        (20, "MCL-DY-2004", "McLane Assorted Candy Bars Box", "Dry", 16.0, 56, None, None, 1, 0, 32.00),
    ]

    for p in products:
        c.execute(
            """INSERT INTO products
               (company_id, sku, name, category, weight_per_case, cases_per_pallet,
                temp_min, temp_max, is_allergen, lot_tracking_required, case_value)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            p
        )


def _seed_dock_doors(c):
    for i in range(1, 13):
        zone = "Zone A" if i <= 4 else ("Zone B" if i <= 8 else "Zone C")
        c.execute(
            "INSERT INTO dock_doors (door_number, zone, status, lifecycle_phase) VALUES (?,?,?,?)",
            (i, zone, "idle", "idle")
        )


def _seed_users(c):
    operators = [
        ("Mike Johnson", "operator", "OP-001", "day", None, "senior"),
        ("Lisa Chen", "operator", "OP-002", "day", None, "experienced"),
        ("Carlos Rivera", "operator", "OP-003", "day", None, "new"),
        ("Jay Patel", "operator", "OP-004", "day", None, "experienced"),
        ("Tanya Brooks", "operator", "OP-005", "day", None, "senior"),
        ("Derek Williams", "operator", "OP-006", "day", None, "experienced"),
        ("Maria Santos", "operator", "OP-007", "day", None, "new"),
        ("Ryan O'Brien", "operator", "OP-008", "day", None, "experienced"),
    ]
    supervisors = [
        ("Sarah Mitchell", "supervisor", "SUP-001", "day", "Zone A", None),
        ("Tom Bradley", "supervisor", "SUP-002", "day", "Zone B", None),
        ("Angela Foster", "supervisor", "SUP-003", "day", "Zone C", None),
    ]
    for u in operators + supervisors:
        c.execute(
            "INSERT INTO users (name, role, employee_id, shift, zone, experience_level) VALUES (?,?,?,?,?,?)",
            u
        )


def _seed_carriers(c):
    carriers = [
        ("Swift Transport", "SWT"),
        ("Prime Logistics", "PRL"),
        ("FrostLine Carriers", "FLC"),
        ("National Freight", "NTF"),
        ("Express Cold Chain", "ECC"),
    ]
    for name, code in carriers:
        c.execute("INSERT INTO carriers (name, code) VALUES (?,?)", (name, code))


def _seed_knowledge_base(c):
    entries = [
        # Damaged Pallet
        ("Damaged Pallet", "Less than 5% of cases damaged", "damaged,crushed,broken,bent,dented,minor",
         json.dumps([
             "Separate damaged cases from intact ones on the pallet",
             "Count the number of damaged vs intact cases",
             "If damaged cases are ≤5% of total: partial accept the pallet",
             "Set aside damaged cases in the designated damage area",
             "Continue unloading remaining intact product",
             "A discrepancy report will be auto-generated for the damaged cases"
         ]), "high", "Company SOP 4.1 — Damaged Product Receiving", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Damaged Pallet", "More than 5% of cases damaged", "damaged,crushed,destroyed,heavy damage,major,many",
         json.dumps([
             "STOP — Do not unload any more product from this pallet",
             "Leave the damaged pallet on the trailer if possible",
             "This exceeds the acceptable damage threshold (>5%)",
             "Mark the pallet with a REJECT tag from your station",
             "This issue should be escalated to your supervisor for carrier claim",
             "Document the damage in the discrepancy report"
         ]), "high", "Company SOP 4.2 — Major Damage Rejection", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Damaged Pallet", "Packaging is punctured on food items", "punctured,torn,open,exposed,hole,ripped",
         json.dumps([
             "STOP IMMEDIATELY — This is a food safety concern",
             "Do NOT move the product to the warehouse floor",
             "Punctured food packaging = potential contamination risk",
             "Segregate all affected cases in the quarantine area",
             "This requires supervisor authorization for full rejection",
             "Do not attempt to re-package or tape closed"
         ]), "high", "FDA Food Safety Guidelines / Company SOP 4.3", '["Frozen","Refrigerated","Produce"]', '["all"]'),

        # Temperature Deviation
        ("Temperature Deviation", "Temperature within 5°F of threshold (marginal)", "warm,marginal,borderline,close,almost",
         json.dumps([
             "Product temperature is near the threshold — not yet critical",
             "Close the trailer doors to prevent further warming",
             "Re-check temperature in 10 minutes with a probe thermometer",
             "Probe the CENTER of a case, not the edge (edge cases warm faster)",
             "If temp improves or holds: proceed with unloading",
             "If temp continues to rise: escalate to supervisor for rejection decision",
             "Log the initial and re-check readings in the system"
         ]), "high", "Cold Chain SOP 2.1 — Marginal Temperature Protocol", '["Frozen","Refrigerated"]', '["all"]'),

        ("Temperature Deviation", "Temperature more than 5°F above threshold", "hot,too warm,way above,critical temp,exceeds,out of range",
         json.dumps([
             "🚨 CRITICAL — DO NOT UNLOAD any product",
             "Close the trailer doors IMMEDIATELY",
             "Do NOT sign the Bill of Lading (BOL)",
             "This product has exceeded safe temperature thresholds",
             "For frozen product: this may indicate a broken cold chain",
             "For refrigerated: potential bacterial growth risk",
             "Supervisor and Quality Manager are being notified automatically",
             "Wait for supervisor before taking any further action"
         ]), "high", "Cold Chain SOP 2.3 — Critical Temperature Rejection", '["Frozen","Refrigerated"]', '["all"]'),

        ("Temperature Deviation", "Reefer unit not running on trailer", "reefer,not running,off,stopped,unit down,no cooling",
         json.dumps([
             "Check the reefer unit fuel gauge — it may be out of diesel",
             "Check if the reefer unit power switch is in the ON position",
             "Look for error codes on the reefer unit display panel",
             "If fuel is available: try restarting the unit (power cycle)",
             "Wait 15 minutes after restart, then re-check interior temperature",
             "If unit won't restart: do NOT unload — escalate to supervisor",
             "The carrier is responsible for functioning reefer equipment"
         ]), "medium", "Equipment SOP 7.2 — Reefer Troubleshooting", '["Frozen","Refrigerated"]', '["all"]'),

        # SKU Mismatch
        ("SKU Mismatch", "Scanned product doesn't match order", "wrong product,different sku,mismatch,not matching,wrong item",
         json.dumps([
             "STOP loading/unloading this product",
             "Verify the SKU on the physical case label against the order",
             "Check if the product was mis-picked from the warehouse",
             "Do NOT load the wrong product onto the trailer",
             "Notify the pick team to retrieve the correct SKU",
             "If this is an inbound shipment: hold and verify against BOL",
             "Log the mismatch — it will be tracked for pattern analysis"
         ]), "high", "Loading SOP 3.1 — SKU Verification", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("SKU Mismatch", "BOL doesn't match physical product", "bol,bill of lading,paperwork,documentation,paper",
         json.dumps([
             "Do NOT proceed with unloading until verified",
             "Cross-reference the BOL line items with actual pallet labels",
             "Check if this is a multi-stop trailer (product may be for a different stop)",
             "Contact the customer service team to verify the correct order",
             "If the carrier made an error: document and hold for carrier resolution",
             "Take note of all SKUs on the trailer for the discrepancy report"
         ]), "medium", "Receiving SOP 5.2 — BOL Discrepancy", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Barcode Issues
        ("Barcode Issue", "Barcode won't scan — label damaged", "barcode,scan,won't scan,can't scan,damaged label,smudged,torn label",
         json.dumps([
             "Try scanning from a different angle (tilt 15-30 degrees)",
             "If still failing: clean the label surface with a dry cloth",
             "If label is too damaged to scan: manually enter the SKU",
             "The SKU number is printed below the barcode on the case label",
             "Enter the full SKU including dashes (e.g., WMT-FZ-1001)",
             "If the label is completely unreadable: check the BOL for the SKU",
             "This is a standard procedure — no supervisor needed for manual entry"
         ]), "high", "Scan SOP 6.1 — Barcode Troubleshooting", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Barcode Issue", "No label found on case", "no label,missing label,unlabeled,no barcode,blank",
         json.dumps([
             "Check all four sides and top of the case for a label",
             "Some products have labels on the bottom — check there too",
             "If truly no label: check the BOL for expected SKU at this position",
             "Cross-reference product description on BOL with the actual product",
             "If you can identify the product: manually enter the SKU from the BOL",
             "If product cannot be identified: set aside and escalate to supervisor",
             "Do not guess — misidentified product is worse than delayed product"
         ]), "medium", "Scan SOP 6.2 — Missing Label Protocol", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Count Issues
        ("Count Shortage", "Count is within customer tolerance", "short,missing,fewer,less than expected,under count",
         json.dumps([
             "Verify your count is accurate — recount if unsure",
             "The system will check this against the customer's tolerance",
             "If within tolerance: accept the shipment and note the shortage",
             "Sign the BOL with the actual count received (not the expected count)",
             "The shortage will be auto-logged for carrier tracking",
             "No supervisor needed for within-tolerance shortages"
         ]), "high", "Receiving SOP 5.4 — Minor Count Discrepancy", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Count Shortage", "Count exceeds customer tolerance", "major shortage,way under,significantly less,big gap,many missing",
         json.dumps([
             "Verify your count carefully — recount to confirm",
             "This shortage exceeds the customer's acceptable tolerance",
             "Do NOT sign the BOL until this is resolved",
             "Hold the shipment at the dock — do not put away",
             "This needs to be escalated to supervisor for carrier contact",
             "The carrier/shipper will need to account for the missing product",
             "Document the exact counts: expected vs. actual per SKU"
         ]), "high", "Receiving SOP 5.5 — Major Count Discrepancy", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Seal / Trailer Condition
        ("Seal/Trailer Condition", "Trailer seal is broken or missing", "seal,broken seal,missing seal,tampered,no seal,cut",
         json.dumps([
             "🚨 STOP — Do NOT open the trailer doors further",
             "A broken or missing seal is a potential security/tampering issue",
             "Compare the seal number (if present) to the BOL seal number",
             "If seals don't match or seal is missing: do NOT unload",
             "Photograph the seal area if possible",
             "Escalate to supervisor IMMEDIATELY — this is a security concern",
             "Supervisor will need to contact the carrier and determine next steps"
         ]), "high", "Security SOP 8.1 — Seal Verification", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Seal/Trailer Condition", "Trailer interior is dirty or has odor", "dirty,odor,smell,debris,unclean,contaminated,wet floor",
         json.dumps([
             "Do NOT unload food products into a contaminated trailer",
             "Note the type of contamination: debris, liquid, odor, or stains",
             "If loading outbound: request a different trailer from dispatch",
             "If receiving inbound: check if product packaging is contaminated",
             "Sealed cases may be acceptable if outer packaging is clean",
             "Loose or open product must be rejected if trailer is contaminated",
             "Log the trailer condition for carrier quality tracking"
         ]), "medium", "Receiving SOP 1.3 — Trailer Condition Assessment", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Equipment
        ("Equipment Failure", "Scanner is not working", "scanner,not working,dead,broken scanner,won't turn on,frozen",
         json.dumps([
             "Try a soft reset: hold the power button for 10 seconds",
             "Check if the scanner battery is charged (indicator light)",
             "If battery is dead: swap for a charged scanner from the charging station",
             "Charging station is located at Bay 2, near the supervisor office",
             "Backup scanners are on the top shelf of the charging station",
             "If no backup available: you can manually enter SKUs using the tablet",
             "Log an equipment request for a replacement scanner"
         ]), "high", "Equipment SOP 7.1 — Scanner Troubleshooting", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Equipment Failure", "Forklift issue or battery low", "forklift,battery,low battery,won't start,dead,malfunction",
         json.dumps([
             "If battery indicator shows <20%: swap the battery now",
             "Battery swap station is in Dock Area C, Aisle 20",
             "Park the forklift in a safe location before leaving it",
             "Set the parking brake and lower forks to the ground",
             "If forklift has a mechanical issue: do NOT attempt to fix it yourself",
             "Tag the forklift with an OUT OF SERVICE tag",
             "Report via Quick Request for maintenance team dispatch"
         ]), "high", "Equipment SOP 7.3 — Forklift Battery & Maintenance", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Paperwork
        ("Paperwork Mismatch", "BOL information doesn't match order", "bol,paperwork,documentation,order number,wrong order",
         json.dumps([
             "Compare the BOL order number to the system's order number",
             "Check if this is the right trailer for your dock assignment",
             "Verify trailer number on the BOL matches the physical trailer",
             "If it's the wrong trailer: it may have been backed into the wrong dock",
             "Contact dispatch to verify the dock assignment",
             "Do NOT start loading/unloading until paperwork matches",
             "Hold the trailer and notify your supervisor if unresolved"
         ]), "medium", "Receiving SOP 5.1 — Paperwork Verification", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Product Quality
        ("Product Quality Concern", "Product shows signs of thaw/refreeze", "thawed,refrozen,ice crystals,mushy,soft,frost,freezer burn",
         json.dumps([
             "Evidence of thaw/refreeze is a food safety red flag",
             "Check for: ice crystals on packaging, soft/mushy product, discoloration",
             "If multiple cases show signs: this may be a cold chain failure",
             "Segregate affected cases — do NOT mix with good product",
             "Check the trailer temperature log for evidence of temp excursions",
             "This needs supervisor and Quality team review before acceptance",
             "Document which cases/pallets are affected"
         ]), "high", "Quality SOP 9.3 — Thaw/Refreeze Assessment", '["Frozen"]', '["all"]'),

        ("Product Quality Concern", "Produce shows mold, bruising, or pest damage", "mold,moldy,bruised,bruising,pest,insects,bugs,rot,rotten",
         json.dumps([
             "Inspect the full pallet — not just the visible outer cases",
             "If mold/pest is on <10% of product: separate affected cases",
             "If mold/pest is widespread: reject the entire pallet",
             "For pest evidence (insects, droppings): reject immediately",
             "Do NOT move pest-affected product into the warehouse",
             "Notify supervisor and Quality team — pest issues require documentation",
             "Check adjacent pallets for cross-contamination"
         ]), "high", "Quality SOP 9.4 — Produce Quality Inspection", '["Produce"]', '["all"]'),

        # Lot/Expiry
        ("Lot/Expiry Issue", "Product expiry date has already passed", "expired,past date,out of date,old,expiry passed",
         json.dumps([
             "🚨 REJECT — Expired product must NOT be accepted into inventory",
             "Check the expiry date format: MM/DD/YYYY or YYYY-MM-DD",
             "If ANY cases are expired: segregate and reject those cases",
             "Do NOT mix expired cases with valid-date product",
             "This is an automatic rejection — no supervisor override allowed",
             "Document the lot numbers and expiry dates in the discrepancy report",
             "The carrier/vendor will be charged back for expired product"
         ]), "high", "Quality SOP 9.1 — Expired Product Rejection", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Lot/Expiry Issue", "Product expires within 48 hours", "expiring soon,short dated,almost expired,close to expiry,48 hours",
         json.dumps([
             "This product is short-dated but NOT yet expired",
             "Check the customer's short-date acceptance policy:",
             "— Some customers accept short-dated product (check SOP)",
             "— Some customers require minimum 7-14 days remaining shelf life",
             "If customer accepts: proceed but log the short dates",
             "If customer does NOT accept short-dated: hold and escalate",
             "Supervisor will contact the customer for acceptance decision"
         ]), "medium", "Quality SOP 9.2 — Short-Dated Product", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Lot/Expiry Issue", "Lot number doesn't match purchase order", "lot,lot number,wrong lot,lot mismatch,different lot",
         json.dumps([
             "Verify the lot number on the physical case vs. the PO/BOL",
             "Some vendors ship substitute lots — this may be acceptable",
             "Check if the customer requires exact lot matching",
             "If lot tracking is required (see product details): this needs resolution",
             "Contact the vendor/shipper to verify the lot substitution",
             "If acceptable: update the receiving record with the actual lot number",
             "If not acceptable: hold product and escalate for vendor contact"
         ]), "medium", "Quality SOP 9.5 — Lot Number Verification", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        # Additional common scenarios
        ("Barcode Issue", "Scanner reads wrong SKU", "wrong sku,reads different,incorrect scan,scanner error",
         json.dumps([
             "The scanner may be reading an inner-pack barcode instead of the case barcode",
             "Look for the ITF-14 barcode (the case-level barcode) — it's usually the largest one",
             "Do NOT scan the UPC (consumer unit barcode) — scan the outer case barcode",
             "If the case has multiple barcodes: try each one until the correct SKU appears",
             "Verify against the printed SKU text on the label",
             "If still misreading: manually enter the printed SKU number"
         ]), "medium", "Scan SOP 6.3 — Barcode Selection", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Count Shortage", "Overage — received more than expected", "extra,overage,more than expected,too many,over count",
         json.dumps([
             "Verify your count — recount to confirm the overage",
             "Check if extra product belongs to a different order on the same trailer",
             "If it's a multi-stop trailer: the extra may be for another customer",
             "If confirmed overage: accept and note the actual count on the BOL",
             "Log the overage in the system — it will be tracked for billing",
             "Do NOT refuse extra product unless instructed by supervisor",
             "Overages are less critical than shortages but still need documentation"
         ]), "medium", "Receiving SOP 5.6 — Overage Handling", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Equipment Failure", "Dock plate/leveler not working", "dock plate,leveler,dock leveler,ramp,bridge plate",
         json.dumps([
             "Do NOT attempt to drive a forklift across a malfunctioning dock plate",
             "Check if the dock plate hydraulic control is in the correct position",
             "Try the manual release lever (located on the side of the dock plate)",
             "If the plate is stuck in the up position: do NOT force it down",
             "Submit a Quick Request for maintenance team to inspect",
             "Ask supervisor for temporary reassignment to another dock door",
             "Do NOT use makeshift ramps or bridges — safety hazard"
         ]), "high", "Equipment SOP 7.4 — Dock Equipment Safety", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Damaged Pallet", "Pallet wood is broken but product is fine", "broken pallet,wood broken,pallet damage,structural",
         json.dumps([
             "If the product cases are undamaged, the product can still be accepted",
             "Transfer cases from the broken pallet to a good pallet",
             "Good pallets are staged at the pallet stack area (end of each dock row)",
             "Re-stack cases following the customer's load pattern specifications",
             "Note in the discrepancy report: pallet damage only, product intact",
             "This does NOT count toward the damage % threshold",
             "Continue with normal receiving/loading process"
         ]), "high", "Company SOP 4.4 — Pallet-Only Damage", '["Frozen","Refrigerated","Produce","Dry"]', '["all"]'),

        ("Temperature Deviation", "Produce temperature outside optimal range", "produce temp,warm produce,cold produce,chill injury",
         json.dumps([
             "Produce has different temp requirements than frozen/refrigerated",
             "Check the specific product's temperature range in the system",
             "Some produce is damaged by cold (chill injury): bananas, tomatoes, avocados",
             "Some produce needs to be cold: lettuce, berries, broccoli",
             "If temp is within 5°F of the acceptable range: accept with documentation",
             "If temp is clearly outside range: hold and check quality visually",
             "Wilting, discoloration, or mushiness indicates temperature abuse"
         ]), "medium", "Cold Chain SOP 2.5 — Produce Temperature Standards", '["Produce"]', '["all"]'),
    ]

    for entry in entries:
        c.execute(
            """INSERT INTO knowledge_base
               (issue_type, scenario, keywords, resolution_steps, confidence, source_reference,
                applicable_categories, applicable_companies)
               VALUES (?,?,?,?,?,?,?,?)""",
            entry
        )


def _seed_orders(c):
    now = datetime.now()
    orders_data = [
        # (order_number, type, company_id, carrier_id, trailer, bol, dock_door_id, operator_id, status)
        ("ORD-2026-4521", "outbound", 1, 1, "TRL-SW-8842", "BOL-884201", 1, 1, "in_progress"),   # Walmart, Mike, Dock 1
        ("ORD-2026-4522", "inbound", 2, 3, "TRL-FL-2291", "BOL-229103", 3, 2, "in_progress"),    # Costco, Lisa, Dock 3
        ("ORD-2026-4523", "outbound", 3, 2, "TRL-PR-5567", "BOL-556702", 5, 3, "in_progress"),   # Kroger, Carlos, Dock 5
        ("ORD-2026-4524", "inbound", 4, 4, "TRL-NF-3310", "BOL-331004", 7, 4, "in_progress"),    # Target, Jay, Dock 7
        ("ORD-2026-4525", "outbound", 6, 1, "TRL-SW-8850", "BOL-885001", 2, 5, "in_progress"),   # HEB, Tanya, Dock 2
        ("ORD-2026-4526", "inbound", 8, 5, "TRL-EC-1123", "BOL-112305", 6, 6, "in_progress"),    # Whole Foods, Derek, Dock 6
        ("ORD-2026-4527", "outbound", 5, 2, "TRL-PR-5580", "BOL-558002", 9, 7, "in_progress"),   # Sam's Club, Maria, Dock 9
        ("ORD-2026-4528", "inbound", 7, 3, "TRL-FL-2305", "BOL-230503", 10, 8, "in_progress"),   # Publix, Ryan, Dock 10
    ]

    for od in orders_data:
        arrived = now - timedelta(minutes=random.randint(30, 120))
        c.execute(
            """INSERT INTO orders
               (order_number, type, company_id, carrier_id, trailer_number, bol_number,
                dock_door_id, operator_id, status, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (*od, arrived.isoformat())
        )

    # Update dock doors for active orders
    for od in orders_data:
        phase = "loading" if od[1] == "outbound" else "unloading"
        arrived = now - timedelta(minutes=random.randint(30, 120))
        c.execute(
            """UPDATE dock_doors SET status='active', lifecycle_phase=?,
               current_trailer=?, current_order_id=?, current_operator_id=?,
               trailer_arrived_at=?, last_activity_at=?
               WHERE id=?""",
            (phase, od[4], od[6], od[7], arrived.isoformat(), now.isoformat(), od[6])
        )

    # Order items — 2 products per order
    items = [
        (1, 1, 200, 0), (1, 2, 150, 0),     # Walmart: chicken + milk
        (2, 5, 120, 0), (2, 6, 80, 0),       # Costco: salmon + milk
        (3, 9, 300, 0), (3, 10, 180, 0),     # Kroger: pizza + yogurt
        (4, 13, 160, 0), (4, 14, 100, 0),    # Target: shrimp + mozzarella
        (5, 21, 240, 0), (5, 22, 120, 0),    # HEB: fish sticks + ice cream
        (6, 29, 200, 0), (6, 30, 160, 0),    # Whole Foods: broccoli + milk
        (7, 17, 180, 0), (7, 18, 100, 0),    # Sam's Club: wings + cheddar
        (8, 25, 220, 0), (8, 26, 140, 0),    # Publix: meatballs + turkey
    ]
    for oi in items:
        c.execute(
            "INSERT INTO order_items (order_id, product_id, expected_quantity, actual_quantity) VALUES (?,?,?,?)",
            oi
        )


def _seed_historical_issues(c):
    now = datetime.now()
    issue_types = [
        "Damaged Pallet", "Temperature Deviation", "SKU Mismatch",
        "Count Shortage", "Barcode Issue", "Equipment Failure",
        "Seal/Trailer Condition", "Paperwork Mismatch",
        "Product Quality Concern", "Lot/Expiry Issue"
    ]
    severities = ["critical", "high", "medium", "low"]
    statuses = ["self_resolved", "supervisor_resolved", "self_resolved", "self_resolved", "escalated"]
    resolution_types = ["partial_accept", "full_reject", "manual_entry", "temp_recheck_ok", "equipment_swapped", "product_segregated"]

    random.seed(42)
    for i in range(50):
        days_ago = random.randint(1, 30)
        hours_ago = random.randint(0, 23)
        created = now - timedelta(days=days_ago, hours=hours_ago)
        issue_type = random.choice(issue_types)
        dock = random.randint(1, 12)
        operator = random.randint(1, 8)
        company = random.randint(1, 20)
        carrier = random.randint(1, 5)
        product = random.randint(1, 80)
        status = random.choice(statuses)
        severity = random.choice(severities)
        score = random.uniform(2, 25)
        cost = round(random.uniform(0, 2000), 2) if severity in ("critical", "high") else round(random.uniform(0, 500), 2)
        supervisor = random.randint(9, 11) if status == "supervisor_resolved" else None
        resolved = created + timedelta(minutes=random.randint(3, 45))
        escalated = created + timedelta(minutes=random.randint(1, 5)) if status in ("escalated", "supervisor_resolved") else None

        c.execute(
            """INSERT INTO issues
               (order_id, dock_door_id, operator_id, supervisor_id, issue_type, description,
                quick_tags, severity, severity_score, severity_reason, status,
                ai_confidence, resolution_type, resolution_notes,
                product_id, company_id, carrier_id, estimated_cost_impact,
                escalated_at, acknowledged_at, resolved_at, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                None, dock, operator, supervisor, issue_type,
                f"Historical issue #{i+1} — {issue_type} at Dock {dock}",
                json.dumps(random.sample(["Crushed", "Wet", "Torn Label", "Short Count", "Wrong Product", "Bad Odor"], min(3, random.randint(1, 3)))),
                severity, round(score, 1),
                f"Auto-classified: {issue_type} severity based on product and customer context",
                status, random.choice(["high", "medium", "low"]),
                random.choice(resolution_types) if status != "escalated" else None,
                f"Resolved via {'AI guidance' if 'self' in status else 'supervisor intervention'}" if status != "escalated" else None,
                product, company, carrier, cost,
                escalated.isoformat() if escalated else None,
                (escalated + timedelta(minutes=random.randint(1, 10))).isoformat() if escalated and status == "supervisor_resolved" else None,
                resolved.isoformat() if status != "escalated" else None,
                created.isoformat()
            )
        )


def _seed_shift_handoff(c):
    c.execute(
        """INSERT INTO shift_handoffs (supervisor_id, shift, notes, created_at) VALUES (?,?,?,?)""",
        (9, "night", "Night shift completed with 2 minor issues resolved. Dock 3 had a reefer temperature fluctuation on Costco trailer — re-checked and cleared. Dock 10 has a partial unload in progress for Publix — approximately 60% complete. Forklift #4 has a slow hydraulic leak — maintenance has been notified for morning service. All other docks clear.", datetime.now().isoformat())
    )


if __name__ == "__main__":
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
    print(f"Database created and seeded at {DB_PATH}")
