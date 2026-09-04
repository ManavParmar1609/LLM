import json
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, get_db, dict_row, dict_rows
from ai_engine import classify_severity, find_resolution, chat_response, estimate_cost_impact, check_recurring_issues


# ── WebSocket Manager ──

class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        for ws in self.active[:]:
            try:
                await ws.send_json(message)
            except Exception:
                self.active.remove(ws)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="DockIQ.AI", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Pydantic Models ──

class IssueCreate(BaseModel):
    order_id: Optional[int] = None
    dock_door_id: int
    operator_id: int
    issue_type: str
    description: Optional[str] = ""
    quick_tags: Optional[list[str]] = []
    product_id: Optional[int] = None
    company_id: Optional[int] = None
    carrier_id: Optional[int] = None
    quantity_affected: Optional[int] = 1
    temp_reading: Optional[float] = None
    temp_threshold_max: Optional[float] = None
    count_expected: Optional[int] = None
    count_actual: Optional[int] = None


class IssueResolve(BaseModel):
    resolution_type: str
    resolution_notes: Optional[str] = ""
    resolved_by: str = "worker"


class SupervisorResolve(BaseModel):
    supervisor_id: int
    resolution_type: str
    supervisor_notes: Optional[str] = ""


class InspectionCreate(BaseModel):
    order_id: Optional[int] = None
    dock_door_id: int
    operator_id: int
    seal_condition: str
    interior_cleanliness: str
    interior_temperature: Optional[float] = None
    visible_damage: str
    notes: Optional[str] = ""


class ChatMessage(BaseModel):
    user_id: int
    message: str
    company_id: Optional[int] = None
    product_category: Optional[str] = None


class QuickRequestCreate(BaseModel):
    dock_door_id: Optional[int] = None
    operator_id: int
    request_type: str
    details: Optional[str] = ""


class BroadcastCreate(BaseModel):
    supervisor_id: int
    message: str


class ShiftHandoffCreate(BaseModel):
    supervisor_id: int
    shift: str
    notes: str


class OrderUpdate(BaseModel):
    actual_quantity: int
    product_id: int


class LoadComplete(BaseModel):
    order_id: int
    seal_number: Optional[str] = None
    notes: Optional[str] = ""


# ── API Routes ──

# -- Auth / Users --
@app.get("/api/users")
def get_users(role: Optional[str] = None):
    db = get_db()
    if role:
        rows = db.execute("SELECT * FROM users WHERE role = ?", (role,)).fetchall()
    else:
        rows = db.execute("SELECT * FROM users").fetchall()
    db.close()
    return dict_rows(rows)


@app.get("/api/users/{user_id}")
def get_user(user_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "User not found")
    return dict_row(row)


# -- Companies --
@app.get("/api/companies")
def get_companies():
    db = get_db()
    rows = db.execute("SELECT * FROM companies").fetchall()
    db.close()
    result = []
    for r in dict_rows(rows):
        r["load_pattern"] = json.loads(r["load_pattern"])
        r["sop_rules"] = json.loads(r["sop_rules"])
        result.append(r)
    return result


@app.get("/api/companies/{company_id}")
def get_company(company_id: int):
    db = get_db()
    row = db.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Company not found")
    r = dict_row(row)
    r["load_pattern"] = json.loads(r["load_pattern"])
    r["sop_rules"] = json.loads(r["sop_rules"])
    return r


# -- Products --
@app.get("/api/products")
def get_products(company_id: Optional[int] = None):
    db = get_db()
    if company_id:
        rows = db.execute("SELECT * FROM products WHERE company_id = ?", (company_id,)).fetchall()
    else:
        rows = db.execute("SELECT * FROM products").fetchall()
    db.close()
    return dict_rows(rows)


# -- Dock Doors --
@app.get("/api/docks")
def get_docks():
    db = get_db()
    rows = db.execute("""
        SELECT d.*, u.name as operator_name, o.order_number, o.trailer_number,
               c.name as company_name, o.type as order_type
        FROM dock_doors d
        LEFT JOIN users u ON d.current_operator_id = u.id
        LEFT JOIN orders o ON d.current_order_id = o.id
        LEFT JOIN companies c ON o.company_id = c.id
    """).fetchall()
    db.close()
    return dict_rows(rows)


@app.get("/api/docks/{dock_id}")
def get_dock(dock_id: int):
    db = get_db()
    row = db.execute("""
        SELECT d.*, u.name as operator_name, o.order_number, o.trailer_number,
               c.name as company_name, o.type as order_type
        FROM dock_doors d
        LEFT JOIN users u ON d.current_operator_id = u.id
        LEFT JOIN orders o ON d.current_order_id = o.id
        LEFT JOIN companies c ON o.company_id = c.id
        WHERE d.id = ?
    """, (dock_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Dock not found")
    return dict_row(row)


# -- Carriers --
@app.get("/api/carriers")
def get_carriers():
    db = get_db()
    rows = db.execute("SELECT * FROM carriers").fetchall()
    db.close()
    return dict_rows(rows)


# -- Orders --
@app.get("/api/orders")
def get_orders(status: Optional[str] = None, operator_id: Optional[int] = None):
    db = get_db()
    query = """
        SELECT o.*, c.name as company_name, c.tier as company_tier,
               c.count_tolerance, c.load_pattern, c.sop_rules,
               cr.name as carrier_name, u.name as operator_name,
               d.door_number
        FROM orders o
        JOIN companies c ON o.company_id = c.id
        JOIN carriers cr ON o.carrier_id = cr.id
        LEFT JOIN users u ON o.operator_id = u.id
        LEFT JOIN dock_doors d ON o.dock_door_id = d.id
    """
    params = []
    conditions = []
    if status:
        conditions.append("o.status = ?")
        params.append(status)
    if operator_id:
        conditions.append("o.operator_id = ?")
        params.append(operator_id)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY o.created_at DESC"

    rows = db.execute(query, params).fetchall()
    db.close()
    result = []
    for r in dict_rows(rows):
        if r.get("load_pattern"):
            r["load_pattern"] = json.loads(r["load_pattern"])
        if r.get("sop_rules"):
            r["sop_rules"] = json.loads(r["sop_rules"])
        result.append(r)
    return result


@app.get("/api/orders/{order_id}")
def get_order(order_id: int):
    db = get_db()
    row = db.execute("""
        SELECT o.*, c.name as company_name, c.tier as company_tier,
               c.count_tolerance, c.load_pattern, c.sop_rules,
               cr.name as carrier_name, u.name as operator_name,
               d.door_number
        FROM orders o
        JOIN companies c ON o.company_id = c.id
        JOIN carriers cr ON o.carrier_id = cr.id
        LEFT JOIN users u ON o.operator_id = u.id
        LEFT JOIN dock_doors d ON o.dock_door_id = d.id
        WHERE o.id = ?
    """, (order_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Order not found")
    r = dict_row(row)
    if r.get("load_pattern"):
        r["load_pattern"] = json.loads(r["load_pattern"])
    if r.get("sop_rules"):
        r["sop_rules"] = json.loads(r["sop_rules"])

    # Get order items with product details
    items = db.execute("""
        SELECT oi.*, p.sku, p.name as product_name, p.category, p.weight_per_case,
               p.cases_per_pallet, p.temp_min, p.temp_max, p.is_allergen,
               p.lot_tracking_required, p.case_value
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    """, (order_id,)).fetchall()
    r["items"] = dict_rows(items)
    db.close()
    return r


@app.put("/api/orders/{order_id}/items")
def update_order_item(order_id: int, update: OrderUpdate):
    db = get_db()
    db.execute(
        "UPDATE order_items SET actual_quantity = ?, verified = 1 WHERE order_id = ? AND product_id = ?",
        (update.actual_quantity, order_id, update.product_id)
    )
    db.commit()
    db.close()
    return {"status": "updated"}


@app.post("/api/orders/{order_id}/complete")
async def complete_order(order_id: int, data: LoadComplete):
    db = get_db()
    db.execute(
        "UPDATE orders SET status = 'complete', seal_number = ?, notes = ?, completed_at = ? WHERE id = ?",
        (data.seal_number, data.notes, datetime.now().isoformat(), order_id)
    )
    order = db.execute("SELECT dock_door_id FROM orders WHERE id = ?", (order_id,)).fetchone()
    if order:
        dock_id = dict(order)["dock_door_id"]
        db.execute(
            "UPDATE dock_doors SET lifecycle_phase = 'complete', status = 'idle', last_activity_at = ? WHERE id = ?",
            (datetime.now().isoformat(), dock_id)
        )
    db.commit()
    db.close()
    await manager.broadcast({"type": "order_complete", "order_id": order_id})
    return {"status": "completed"}


# -- Issues --
@app.get("/api/issues")
def get_issues(status: Optional[str] = None, operator_id: Optional[int] = None,
               severity: Optional[str] = None, limit: int = 100):
    db = get_db()
    query = """
        SELECT i.*, u.name as operator_name, s.name as supervisor_name,
               d.door_number, c.name as company_name, p.name as product_name,
               p.sku as product_sku, cr.name as carrier_name
        FROM issues i
        LEFT JOIN users u ON i.operator_id = u.id
        LEFT JOIN users s ON i.supervisor_id = s.id
        LEFT JOIN dock_doors d ON i.dock_door_id = d.id
        LEFT JOIN companies c ON i.company_id = c.id
        LEFT JOIN products p ON i.product_id = p.id
        LEFT JOIN carriers cr ON i.carrier_id = cr.id
    """
    conditions = []
    params = []
    if status:
        if status == "active":
            conditions.append("i.status IN ('escalated', 'resolution_in_progress')")
        else:
            conditions.append("i.status = ?")
            params.append(status)
    if operator_id:
        conditions.append("i.operator_id = ?")
        params.append(operator_id)
    if severity:
        conditions.append("i.severity = ?")
        params.append(severity)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY i.created_at DESC LIMIT ?"
    params.append(limit)

    rows = db.execute(query, params).fetchall()
    db.close()
    result = []
    for r in dict_rows(rows):
        if r.get("quick_tags"):
            try:
                r["quick_tags"] = json.loads(r["quick_tags"])
            except (json.JSONDecodeError, TypeError):
                r["quick_tags"] = []
        else:
            r["quick_tags"] = []
        result.append(r)
    return result


@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: int):
    db = get_db()
    row = db.execute("""
        SELECT i.*, u.name as operator_name, s.name as supervisor_name,
               d.door_number, c.name as company_name, p.name as product_name,
               p.sku as product_sku, cr.name as carrier_name
        FROM issues i
        LEFT JOIN users u ON i.operator_id = u.id
        LEFT JOIN users s ON i.supervisor_id = s.id
        LEFT JOIN dock_doors d ON i.dock_door_id = d.id
        LEFT JOIN companies c ON i.company_id = c.id
        LEFT JOIN products p ON i.product_id = p.id
        LEFT JOIN carriers cr ON i.carrier_id = cr.id
        WHERE i.id = ?
    """, (issue_id,)).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, "Issue not found")
    r = dict_row(row)
    if r.get("quick_tags"):
        try:
            r["quick_tags"] = json.loads(r["quick_tags"])
        except (json.JSONDecodeError, TypeError):
            r["quick_tags"] = []
    if r.get("ai_resolution"):
        try:
            r["ai_resolution"] = json.loads(r["ai_resolution"])
        except (json.JSONDecodeError, TypeError):
            pass
    return r


@app.post("/api/issues")
async def create_issue(issue: IssueCreate):
    db = get_db()

    # Get product and company info for severity classification
    product_category = None
    customer_tier = None
    is_allergen = False
    if issue.product_id:
        prod = db.execute("SELECT * FROM products WHERE id = ?", (issue.product_id,)).fetchone()
        if prod:
            pd = dict(prod)
            product_category = pd["category"]
            is_allergen = bool(pd["is_allergen"])
    if issue.company_id:
        comp = db.execute("SELECT tier FROM companies WHERE id = ?", (issue.company_id,)).fetchone()
        if comp:
            customer_tier = dict(comp)["tier"]

    # Classify severity
    severity, score, reason = classify_severity(
        issue.issue_type, product_category, customer_tier,
        issue.temp_reading, issue.temp_threshold_max,
        issue.count_expected, issue.count_actual,
        is_allergen
    )

    # Get AI resolution
    resolution = find_resolution(
        db, issue.issue_type, issue.description, product_category
    )

    # Estimate cost impact
    cost = 0.0
    if issue.product_id:
        cost = estimate_cost_impact(db, issue.product_id, issue.quantity_affected or 1, issue.issue_type)

    # Check recurring patterns
    patterns = check_recurring_issues(db, issue.issue_type, issue.dock_door_id, issue.carrier_id)

    now = datetime.now().isoformat()
    c = db.cursor()
    c.execute(
        """INSERT INTO issues
           (order_id, dock_door_id, operator_id, issue_type, description, quick_tags,
            severity, severity_score, severity_reason, status, ai_resolution, ai_confidence,
            product_id, company_id, carrier_id, estimated_cost_impact, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (issue.order_id, issue.dock_door_id, issue.operator_id, issue.issue_type,
         issue.description, json.dumps(issue.quick_tags),
         severity, score, reason, "resolution_in_progress",
         json.dumps(resolution), resolution["confidence"],
         issue.product_id, issue.company_id, issue.carrier_id, cost, now)
    )
    issue_id = c.lastrowid

    # Update dock status
    db.execute(
        "UPDATE dock_doors SET status = 'issue', last_activity_at = ? WHERE id = ?",
        (now, issue.dock_door_id)
    )

    db.commit()
    db.close()

    result = {
        "id": issue_id,
        "severity": severity,
        "severity_score": score,
        "severity_reason": reason,
        "ai_resolution": resolution,
        "estimated_cost_impact": cost,
        "recurring_patterns": patterns
    }

    # Broadcast to supervisors
    await manager.broadcast({
        "type": "new_issue",
        "issue": {
            "id": issue_id,
            "issue_type": issue.issue_type,
            "severity": severity,
            "severity_score": score,
            "dock_door_id": issue.dock_door_id,
            "operator_id": issue.operator_id,
            "description": issue.description,
            "created_at": now,
            "estimated_cost_impact": cost,
        }
    })

    return result


@app.put("/api/issues/{issue_id}/self-resolve")
async def self_resolve_issue(issue_id: int, data: IssueResolve):
    db = get_db()
    now = datetime.now().isoformat()
    db.execute(
        """UPDATE issues SET status = 'self_resolved', resolution_type = ?,
           resolution_notes = ?, resolved_at = ? WHERE id = ?""",
        (data.resolution_type, data.resolution_notes, now, issue_id)
    )
    issue = db.execute("SELECT dock_door_id FROM issues WHERE id = ?", (issue_id,)).fetchone()
    if issue:
        dock_id = dict(issue)["dock_door_id"]
        db.execute("UPDATE dock_doors SET status = 'active' WHERE id = ?", (dock_id,))
    db.commit()
    db.close()
    await manager.broadcast({"type": "issue_resolved", "issue_id": issue_id, "method": "self_resolved"})
    return {"status": "self_resolved"}


@app.put("/api/issues/{issue_id}/escalate")
async def escalate_issue(issue_id: int):
    db = get_db()
    now = datetime.now().isoformat()
    db.execute(
        "UPDATE issues SET status = 'escalated', escalated_at = ? WHERE id = ?",
        (now, issue_id)
    )
    issue_row = db.execute("""
        SELECT i.*, d.door_number, u.name as operator_name, c.name as company_name,
               p.name as product_name
        FROM issues i
        LEFT JOIN dock_doors d ON i.dock_door_id = d.id
        LEFT JOIN users u ON i.operator_id = u.id
        LEFT JOIN companies c ON i.company_id = c.id
        LEFT JOIN products p ON i.product_id = p.id
        WHERE i.id = ?
    """, (issue_id,)).fetchone()

    if issue_row:
        dock_id = dict(issue_row)["dock_door_id"]
        status = "critical" if dict(issue_row)["severity"] == "critical" else "issue"
        db.execute("UPDATE dock_doors SET status = ? WHERE id = ?", (status, dock_id))

    db.commit()
    db.close()

    if issue_row:
        await manager.broadcast({
            "type": "issue_escalated",
            "issue": dict(issue_row)
        })

    return {"status": "escalated"}


@app.put("/api/issues/{issue_id}/supervisor-resolve")
async def supervisor_resolve_issue(issue_id: int, data: SupervisorResolve):
    db = get_db()
    now = datetime.now().isoformat()
    db.execute(
        """UPDATE issues SET status = 'supervisor_resolved', supervisor_id = ?,
           resolution_type = ?, supervisor_notes = ?, acknowledged_at = ?, resolved_at = ?
           WHERE id = ?""",
        (data.supervisor_id, data.resolution_type, data.supervisor_notes, now, now, issue_id)
    )
    issue = db.execute("SELECT dock_door_id FROM issues WHERE id = ?", (issue_id,)).fetchone()
    if issue:
        dock_id = dict(issue)["dock_door_id"]
        db.execute("UPDATE dock_doors SET status = 'active' WHERE id = ?", (dock_id,))
    db.commit()
    db.close()
    await manager.broadcast({"type": "issue_resolved", "issue_id": issue_id, "method": "supervisor_resolved"})
    return {"status": "supervisor_resolved"}


# -- Trailer Inspections --
@app.post("/api/inspections")
async def create_inspection(data: InspectionCreate):
    db = get_db()
    overall_pass = (
        data.seal_condition == "intact" and
        data.interior_cleanliness == "clean" and
        data.visible_damage == "none"
    )
    if data.interior_temperature is not None:
        # For reefer trailers, temp should be reasonable
        overall_pass = overall_pass and data.interior_temperature <= 45

    now = datetime.now().isoformat()
    c = db.cursor()
    c.execute(
        """INSERT INTO trailer_inspections
           (order_id, dock_door_id, operator_id, seal_condition, interior_cleanliness,
            interior_temperature, visible_damage, overall_pass, notes, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (data.order_id, data.dock_door_id, data.operator_id, data.seal_condition,
         data.interior_cleanliness, data.interior_temperature, data.visible_damage,
         1 if overall_pass else 0, data.notes, now)
    )
    inspection_id = c.lastrowid

    # Update dock lifecycle
    db.execute(
        "UPDATE dock_doors SET lifecycle_phase = 'inspection', last_activity_at = ? WHERE id = ?",
        (now, data.dock_door_id)
    )
    db.commit()
    db.close()

    return {"id": inspection_id, "overall_pass": overall_pass}


# -- Chat --
@app.post("/api/chat")
def post_chat(data: ChatMessage):
    db = get_db()
    now = datetime.now().isoformat()

    # Save user message
    db.execute(
        "INSERT INTO chat_messages (user_id, role, message, created_at) VALUES (?,?,?,?)",
        (data.user_id, "user", data.message, now)
    )

    # Get AI response
    context = {}
    if data.company_id:
        context["company_id"] = data.company_id
    if data.product_category:
        context["product_category"] = data.product_category

    result = chat_response(db, data.message, context if context else None)

    # Save AI response
    db.execute(
        "INSERT INTO chat_messages (user_id, role, message, source_reference, created_at) VALUES (?,?,?,?,?)",
        (data.user_id, "assistant", result["response"], result.get("source"), now)
    )

    db.commit()
    db.close()
    return result


@app.get("/api/chat/history/{user_id}")
def get_chat_history(user_id: int):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 100",
        (user_id,)
    ).fetchall()
    db.close()
    return dict_rows(rows)


# -- Quick Requests --
@app.get("/api/requests")
def get_requests(status: Optional[str] = None):
    db = get_db()
    if status:
        rows = db.execute("""
            SELECT qr.*, u.name as operator_name, d.door_number
            FROM quick_requests qr
            LEFT JOIN users u ON qr.operator_id = u.id
            LEFT JOIN dock_doors d ON qr.dock_door_id = d.id
            WHERE qr.status = ? ORDER BY qr.created_at DESC
        """, (status,)).fetchall()
    else:
        rows = db.execute("""
            SELECT qr.*, u.name as operator_name, d.door_number
            FROM quick_requests qr
            LEFT JOIN users u ON qr.operator_id = u.id
            LEFT JOIN dock_doors d ON qr.dock_door_id = d.id
            ORDER BY qr.created_at DESC
        """).fetchall()
    db.close()
    return dict_rows(rows)


@app.post("/api/requests")
async def create_request(data: QuickRequestCreate):
    db = get_db()
    now = datetime.now().isoformat()
    c = db.cursor()
    c.execute(
        "INSERT INTO quick_requests (dock_door_id, operator_id, request_type, details, status, created_at) VALUES (?,?,?,?,?,?)",
        (data.dock_door_id, data.operator_id, data.request_type, data.details, "pending", now)
    )
    req_id = c.lastrowid
    db.commit()
    db.close()
    await manager.broadcast({"type": "new_request", "request_id": req_id, "request_type": data.request_type})
    return {"id": req_id, "status": "pending"}


@app.put("/api/requests/{request_id}/fulfill")
async def fulfill_request(request_id: int):
    db = get_db()
    db.execute(
        "UPDATE quick_requests SET status = 'fulfilled', fulfilled_at = ? WHERE id = ?",
        (datetime.now().isoformat(), request_id)
    )
    db.commit()
    db.close()
    return {"status": "fulfilled"}


# -- Broadcasts --
@app.get("/api/broadcasts")
def get_broadcasts():
    db = get_db()
    rows = db.execute("""
        SELECT b.*, u.name as supervisor_name
        FROM broadcasts b JOIN users u ON b.supervisor_id = u.id
        ORDER BY b.created_at DESC LIMIT 20
    """).fetchall()
    db.close()
    return dict_rows(rows)


@app.post("/api/broadcasts")
async def create_broadcast(data: BroadcastCreate):
    db = get_db()
    now = datetime.now().isoformat()
    c = db.cursor()
    c.execute(
        "INSERT INTO broadcasts (supervisor_id, message, created_at) VALUES (?,?,?)",
        (data.supervisor_id, data.message, now)
    )
    broadcast_id = c.lastrowid
    db.commit()
    db.close()
    await manager.broadcast({"type": "broadcast", "message": data.message, "id": broadcast_id})
    return {"id": broadcast_id}


# -- Shift Handoff --
@app.get("/api/shift-handoffs")
def get_handoffs():
    db = get_db()
    rows = db.execute("""
        SELECT sh.*, u.name as supervisor_name
        FROM shift_handoffs sh JOIN users u ON sh.supervisor_id = u.id
        ORDER BY sh.created_at DESC LIMIT 10
    """).fetchall()
    db.close()
    return dict_rows(rows)


@app.post("/api/shift-handoffs")
def create_handoff(data: ShiftHandoffCreate):
    db = get_db()
    now = datetime.now().isoformat()
    db.execute(
        "INSERT INTO shift_handoffs (supervisor_id, shift, notes, created_at) VALUES (?,?,?,?)",
        (data.supervisor_id, data.shift, data.notes, now)
    )
    db.commit()
    db.close()
    return {"status": "created"}


# -- Analytics --
@app.get("/api/analytics/summary")
def get_analytics_summary():
    db = get_db()

    total = db.execute("SELECT COUNT(*) FROM issues").fetchone()[0]
    self_resolved = db.execute("SELECT COUNT(*) FROM issues WHERE status = 'self_resolved'").fetchone()[0]
    escalated = db.execute("SELECT COUNT(*) FROM issues WHERE status IN ('escalated','supervisor_resolved')").fetchone()[0]
    total_cost = db.execute("SELECT COALESCE(SUM(estimated_cost_impact), 0) FROM issues").fetchone()[0]

    # Average resolution time (minutes)
    avg_time = db.execute("""
        SELECT AVG(
            (julianday(resolved_at) - julianday(created_at)) * 24 * 60
        ) FROM issues WHERE resolved_at IS NOT NULL
    """).fetchone()[0]

    # Issues by type
    by_type = db.execute("""
        SELECT issue_type, COUNT(*) as count FROM issues GROUP BY issue_type ORDER BY count DESC
    """).fetchall()

    # Issues by severity
    by_severity = db.execute("""
        SELECT severity, COUNT(*) as count FROM issues GROUP BY severity
    """).fetchall()

    # Issues by dock
    by_dock = db.execute("""
        SELECT d.door_number, COUNT(i.id) as count
        FROM issues i JOIN dock_doors d ON i.dock_door_id = d.id
        GROUP BY d.door_number ORDER BY d.door_number
    """).fetchall()

    # Issues by operator
    by_operator = db.execute("""
        SELECT u.name, COUNT(i.id) as total,
               SUM(CASE WHEN i.status = 'self_resolved' THEN 1 ELSE 0 END) as self_resolved
        FROM issues i JOIN users u ON i.operator_id = u.id
        GROUP BY u.name ORDER BY total DESC
    """).fetchall()

    # Issues by company
    by_company = db.execute("""
        SELECT c.name, COUNT(i.id) as count
        FROM issues i JOIN companies c ON i.company_id = c.id
        GROUP BY c.name ORDER BY count DESC LIMIT 10
    """).fetchall()

    # Issues by carrier
    by_carrier = db.execute("""
        SELECT cr.name, COUNT(i.id) as count
        FROM issues i JOIN carriers cr ON i.carrier_id = cr.id
        GROUP BY cr.name ORDER BY count DESC
    """).fetchall()

    # Issues over time (last 30 days)
    over_time = db.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM issues
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at) ORDER BY date
    """).fetchall()

    db.close()

    return {
        "total_issues": total,
        "self_resolved": self_resolved,
        "escalated": escalated,
        "self_resolution_rate": round(self_resolved / total * 100, 1) if total > 0 else 0,
        "total_cost_impact": round(total_cost, 2),
        "avg_resolution_minutes": round(avg_time, 1) if avg_time else 0,
        "by_type": dict_rows(by_type),
        "by_severity": dict_rows(by_severity),
        "by_dock": dict_rows(by_dock),
        "by_operator": dict_rows(by_operator),
        "by_company": dict_rows(by_company),
        "by_carrier": dict_rows(by_carrier),
        "over_time": dict_rows(over_time),
    }


# -- WebSocket --
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
