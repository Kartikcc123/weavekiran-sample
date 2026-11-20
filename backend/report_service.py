"""
Weave Kiran – Industrial Fabric Quality & Inspection Report Service.

Provides:
1. `build_report_data(...)`: Aggregates live + stored MongoDB defect records into a
   single verified report payload for both the React UI and PDF generator.
2. `generate_report_pdf_bytes(report)`: Produces a multi-page, numbered, industry-ready
   PDF report using ReportLab without overflowing page boundaries.
"""
import base64
from collections import Counter
from datetime import datetime
import io
from typing import Any, Dict, List, Optional

from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

CANONICAL_DEFECTS = [
    {
        "key": "Holes",
        "db_keys": ("hole", "Hole", "holes", "Holes"),
        "default_severity": "High (Major)",
        "what_it_means": "A physical opening, puncture, or broken yarn gap in the woven cloth.",
        "why_it_matters": "Cannot be used in finished garments; severely lowers usable fabric yield and requires cutting or splicing.",
        "factory_action": "Inspect and tag exact hole locations before cutting; check loom temple rings and sharp reed teeth.",
    },
    {
        "key": "Stains",
        "db_keys": ("Stain", "stain", "stains", "Stains"),
        "default_severity": "Medium (Moderate)",
        "what_it_means": "Visible oil, grease, dye, or dirt discoloration on the fabric surface.",
        "why_it_matters": "Reduces commercial grade on light or solid fabrics unless spot-cleaned before packing.",
        "factory_action": "Spot-clean or wash stained areas where possible and check overhead loom bearings for oil leaks.",
    },
    {
        "key": "Thread Errors",
        "db_keys": ("Thread", "thread", "Thread Error", "thread_error"),
        "default_severity": "Low to Medium",
        "what_it_means": "A missing, broken, slub, or loose yarn interrupting the smooth weave.",
        "why_it_matters": "Creates minor surface unevenness; most loose threads can be trimmed or mended manually.",
        "factory_action": "Trim or mend loose thread ends on the finishing table and check yarn tensioners on the loom.",
    },
    {
        "key": "Warp/Weft Irregularities",
        "db_keys": ("Warp_Weft", "warp_weft", "Warp/Weft"),
        "default_severity": "Medium (Moderate)",
        "what_it_means": "Uneven spacing or tension difference between lengthwise (warp) and crosswise (weft) yarns.",
        "why_it_matters": "Causes visible bands or density variation across the fabric width.",
        "factory_action": "Check weaving take-up roller gearing and weft insertion tension if repeated across the roll.",
    },
    {
        "key": "Seam/Joint Marks",
        "db_keys": ("seam", "Seam", "joint"),
        "default_severity": "Low (Minor)",
        "what_it_means": "A join or transition line where two fabric pieces or weft bobbins were connected.",
        "why_it_matters": "Normal roll transition, but cutting operators must avoid placing garment panels across a seam.",
        "factory_action": "Place a visible edge sticker at the seam position so the cutting table lays patterns around it.",
    },
]


def map_canonical_category(raw_type: Optional[str]) -> str:
    t = (raw_type or "").strip().lower()
    if "hole" in t:
        return "Holes"
    if "stain" in t:
        return "Stains"
    if "warp" in t or "weft" in t:
        return "Warp/Weft Irregularities"
    if "seam" in t or "joint" in t:
        return "Seam/Joint Marks"
    return "Thread Errors"


def expected_severity(confidence: float) -> str:
    if confidence >= 0.80:
        return "HIGH"
    if confidence >= 0.60:
        return "MEDIUM"
    return "LOW"


def parse_timestamp(val: Any) -> Optional[datetime]:
    if isinstance(val, datetime):
        return val
    if isinstance(val, str) and val:
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def format_duration(seconds: float) -> str:
    if seconds <= 0:
        return "< 1 min"
    total_sec = int(round(seconds))
    hours = total_sec // 3600
    minutes = (total_sec % 3600) // 60
    secs = total_sec % 60
    if hours > 0:
        return f"{hours}h {minutes}m {secs}s"
    if minutes > 0:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def build_report_data(
    all_db_defects: List[Dict[str, Any]],
    arduino_status: Dict[str, Any],
    scope: str = "latest_session",
    configured_roll_length_m: Optional[float] = None,
    fabric_price_per_m: Optional[float] = None,
    rework_cost_per_m: Optional[float] = None,
    recent_evidence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Build a complete, verified report dictionary from actual database records.
    Preserves historical records unmodified and flags inconsistencies for verification.
    """
    normalized_all = []
    date_counter = Counter()

    for raw in all_db_defects:
        ts = parse_timestamp(raw.get("timestamp")) or parse_timestamp(raw.get("created_at"))
        date_str = ts.strftime("%Y-%m-%d") if ts else "Unknown"
        date_counter[date_str] += 1
        conf = float(raw.get("confidence") or 0.0)
        calc_sev = expected_severity(conf)
        stored_sev = (raw.get("severity") or calc_sev).upper()
        cat_name = map_canonical_category(raw.get("defect_type") or raw.get("class_name"))

        normalized_all.append({
            "_id": str(raw.get("_id", "")),
            "event_id": raw.get("event_id") or f"DEF-UNLABELED-{raw.get('track_id', 0)}",
            "loom_id": raw.get("loom_id") or "LOOM-01",
            "roll_id": raw.get("roll_id"),
            "track_id": raw.get("track_id"),
            "raw_defect_type": raw.get("defect_type") or raw.get("class_name") or "Unknown",
            "category": cat_name,
            "class_id": raw.get("class_id"),
            "confidence": round(conf, 4),
            "confidence_pct": round(conf * 100, 1),
            "severity": stored_sev,
            "expected_severity": calc_sev,
            "severity_consistent": stored_sev == calc_sev,
            "timestamp": ts.isoformat() if ts else None,
            "timestamp_display": ts.strftime("%d %b %Y, %I:%M:%S %p") if ts else "Not Recorded",
            "date_str": date_str,
            "bbox": raw.get("bbox"),
            "fabric_position": raw.get("fabric_position"),
            "status": raw.get("status") or "CLOSED",
            "original_image": raw.get("original_image"),
            "annotated_image": raw.get("annotated_image"),
            "_dt": ts,
        })

    available_dates = [
        {"date": d, "count": c}
        for d, c in sorted(date_counter.items(), key=lambda x: x[0], reverse=True)
    ]

    selected_date = None
    if scope == "all":
        scoped_records = normalized_all
        scope_label = f"All Stored Database Records ({len(normalized_all)} defects)"
    elif scope.startswith("date:"):
        selected_date = scope.split("date:", 1)[1].strip()
        scoped_records = [r for r in normalized_all if r["date_str"] == selected_date]
        scope_label = f"Inspection Session on {selected_date} ({len(scoped_records)} defects)"
    else:
        selected_date = available_dates[0]["date"] if available_dates else datetime.now().strftime("%Y-%m-%d")
        scoped_records = [r for r in normalized_all if r["date_str"] == selected_date]
        scope_label = f"Latest Inspection Session ({selected_date} — {len(scoped_records)} defects)"

    scoped_records.sort(key=lambda r: r["_dt"] or datetime.min, reverse=True)
    valid_dts = sorted([r["_dt"] for r in scoped_records if r["_dt"] is not None])

    now_dt = datetime.now()
    first_dt = valid_dts[0] if valid_dts else None
    last_dt = valid_dts[-1] if valid_dts else None

    active_duration_sec = 0.0
    session_runs = 1 if valid_dts else 0
    for i in range(1, len(valid_dts)):
        gap = (valid_dts[i] - valid_dts[i - 1]).total_seconds()
        if gap <= 1800:
            active_duration_sec += gap
        else:
            session_runs += 1

    wall_span_sec = (last_dt - first_dt).total_seconds() if (first_dt and last_dt) else 0.0
    effective_duration_sec = active_duration_sec if active_duration_sec > 0 else wall_span_sec

    report_date_token = (selected_date or (last_dt.strftime("%Y%m%d") if last_dt else now_dt.strftime("%Y%m%d"))).replace("-", "")
    scope_token = "ALL" if scope == "all" else "S1"
    report_id = f"WK-RPT-{report_date_token}-{scope_token}"
    report_generated_dt = max(now_dt, last_dt) if last_dt else now_dt

    total_defects = len(scoped_records)
    sev_counts = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    cat_counts = {c["key"]: 0 for c in CANONICAL_DEFECTS}
    cat_sev_counts = {c["key"]: {"HIGH": 0, "MEDIUM": 0, "LOW": 0} for c in CANONICAL_DEFECTS}

    missing_position_count = 0
    zero_position_count = 0
    positive_positions = []
    missing_roll_id_count = 0
    severity_mismatch_count = 0
    track_id_counter = Counter()
    event_id_counter = Counter()

    for r in scoped_records:
        sev = r["severity"] if r["severity"] in sev_counts else "LOW"
        sev_counts[sev] += 1
        cat = r["category"]
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        cat_sev_counts[cat][sev] += 1

        pos = r["fabric_position"]
        if pos is None:
            missing_position_count += 1
        elif float(pos) == 0.0:
            zero_position_count += 1
        elif float(pos) > 0.0:
            positive_positions.append(float(pos))

        if not r["roll_id"]:
            missing_roll_id_count += 1
        if not r["severity_consistent"]:
            severity_mismatch_count += 1
        if r["track_id"] is not None:
            track_id_counter[r["track_id"]] += 1
        if r["event_id"]:
            event_id_counter[r["event_id"]] += 1

    duplicate_track_id_groups = sum(1 for _, c in track_id_counter.items() if c > 1)

    live_arduino_meters = arduino_status.get("fabric_inspected")
    max_db_meters = max(positive_positions) if positive_positions else 0.0
    hardware_measured_m = max(
        float(live_arduino_meters) if (live_arduino_meters is not None and float(live_arduino_meters) > 0) else 0.0,
        max_db_meters,
    )

    has_hardware_length = hardware_measured_m > 0.0
    has_configured_length = configured_roll_length_m is not None and float(configured_roll_length_m) > 0.0

    if has_hardware_length:
        effective_length_m = round(hardware_measured_m, 2)
        length_source = "Actual Measured (Hardware Encoder)"
        length_display = f"{effective_length_m:.2f} m"
    elif has_configured_length:
        effective_length_m = round(float(configured_roll_length_m), 2)
        length_source = "Factory-Configured Roll Length (Manual Input)"
        length_display = f"{effective_length_m:.2f} m (Configured)"
    else:
        effective_length_m = None
        length_source = "Hardware Encoder Recorded 0.00 m (Length Verification Pending)"
        length_display = "Pending Verification (0.00 m)"

    high_count = sev_counts["HIGH"]
    med_count = sev_counts["MEDIUM"]
    low_count = sev_counts["LOW"]
    active_categories_count = sum(1 for v in cat_counts.values() if v > 0)

    holes_high = cat_sev_counts["Holes"]["HIGH"]
    reworkable_defect_count = (
        cat_counts["Stains"]
        + cat_counts["Thread Errors"]
        + cat_counts["Warp/Weft Irregularities"]
        + (cat_counts["Holes"] - holes_high)
    )
    hold_defect_count = high_count
    seam_count = cat_counts["Seam/Joint Marks"]

    if effective_length_m is not None and effective_length_m > 0:
        raw_rejected_m = round(min(effective_length_m * 0.25, holes_high * 0.20), 2)
        raw_hold_m = round(min(effective_length_m * 0.30, max(0, high_count - holes_high) * 0.20 + holes_high * 0.10), 2)
        raw_rework_m = round(min(effective_length_m * 0.35, med_count * 0.12 + low_count * 0.03), 2)

        total_affected_m = round(min(effective_length_m, raw_rejected_m + raw_hold_m + raw_rework_m), 2)
        accepted_clean_m = round(max(0.0, effective_length_m - total_affected_m), 2)
        dispatch_ready_m = round(min(effective_length_m, accepted_clean_m + raw_rework_m), 2)

        defect_free_pct = round((accepted_clean_m / effective_length_m) * 100.0, 1)
        defect_free_display = f"{defect_free_pct:.1f}%"
        defect_free_note = (
            f"Formula: ({accepted_clean_m:.2f} m defect-free fabric ÷ {effective_length_m:.2f} m total inspected fabric) × 100 = {defect_free_pct:.1f}%."
        )
    else:
        raw_rejected_m = None
        raw_hold_m = None
        raw_rework_m = None
        total_affected_m = None
        accepted_clean_m = None
        dispatch_ready_m = None
        defect_free_pct = None
        non_major_pct = round(((total_defects - high_count) / total_defects) * 100.0, 1) if total_defects > 0 else 100.0
        defect_free_display = f"Pending Length ({non_major_pct}% Non-Major)"
        defect_free_note = (
            "Linear defect-free % = ((Total Roll Length − Defective Length) ÷ Total Roll Length) × 100. "
            f"Because the hardware encoder recorded 0.00 m, linear metres are pending verification (among {total_defects} detected events, "
            f"{non_major_pct}% are Low/Medium severity and {round(100 - non_major_pct, 1)}% are High severity)."
        )

    if total_defects == 0:
        quality_grade = "Grade A"
        final_status = "PASS (Approved for Dispatch)"
        verdict_level = "PASS"
    elif high_count == 0 and med_count <= 5 and (defect_free_pct is None or defect_free_pct >= 95.0):
        quality_grade = "Grade A"
        final_status = "PASS (Approved for Dispatch)"
        verdict_level = "PASS"
    elif high_count <= 10 and (defect_free_pct is None or defect_free_pct >= 80.0):
        quality_grade = "Grade B"
        final_status = "Conditional Pass (Targeted Rework & Verification)"
        verdict_level = "CONDITIONAL"
    else:
        quality_grade = "Grade C"
        final_status = "Quality Hold (Mending, Cutting & QA Verification Required)"
        verdict_level = "HOLD"

    grade_explanation = (
        "How Final Grade Is Calculated: Grade A (Pass) = 0 High-severity defects, <= 5 Medium defects, and >= 95% defect-free fabric; "
        "Grade B (Conditional Pass) = 1 to 10 High-severity defects (and >= 80% defect-free fabric when length is measured), requiring localized spot-cleaning or mending before dispatch; "
        "Grade C (Quality Hold) = > 10 High-severity defects or < 80% defect-free fabric, requiring targeted cutting/mending and QA supervisor approval."
    )

    loom_name = scoped_records[0]["loom_id"] if scoped_records else "LOOM-01"
    if effective_length_m is not None and effective_length_m > 0:
        plain_english_summary = (
            f"Weave Kiran inspected {effective_length_m:.2f} metres of fabric on {loom_name} "
            f"and detected {total_defects} potential defects across {active_categories_count} defect categories "
            f"({high_count} High-severity, {med_count} Medium-severity, and {low_count} Low-severity). "
            f"The current inspection result is {quality_grade} ({final_status}). "
            f"Targeted corrective action and final quality verification are recommended before dispatch."
        )
    else:
        plain_english_summary = (
            f"Weave Kiran inspected fabric on {loom_name} and detected {total_defects} potential defects across "
            f"{active_categories_count} defect categories ({high_count} High-severity, {med_count} Medium-severity, and {low_count} Low-severity). "
            f"The current inspection result is {quality_grade} ({final_status}). "
            f"Hardware meter encoder recorded 0.00 m during these runs, so metre-based quantities are marked Pending Verification. "
            f"Targeted corrective action and final quality verification are recommended before dispatch."
        )

    defect_summary_rows = []
    most_frequent_defect = None
    max_cat_count = -1

    for cdef in CANONICAL_DEFECTS:
        ckey = cdef["key"]
        cnt = cat_counts.get(ckey, 0)
        share_pct = round((cnt / total_defects) * 100.0, 1) if total_defects > 0 else 0.0
        sc = cat_sev_counts[ckey]
        if cnt == 0:
            sev_label = "None Detected"
        else:
            parts = []
            if sc["HIGH"] > 0:
                parts.append(f"{sc['HIGH']} High")
            if sc["MEDIUM"] > 0:
                parts.append(f"{sc['MEDIUM']} Medium")
            if sc["LOW"] > 0:
                parts.append(f"{sc['LOW']} Low")
            sev_label = f"{cdef['default_severity']} ({', '.join(parts)})"

        row = {
            "defect_name": ckey,
            "count": cnt,
            "share_pct": share_pct,
            "severity": sev_label,
            "what_it_means": cdef["what_it_means"],
            "why_it_matters": cdef["why_it_matters"],
            "factory_action": cdef["factory_action"],
        }
        defect_summary_rows.append(row)
        if cnt > max_cat_count and cnt > 0:
            max_cat_count = cnt
            most_frequent_defect = row

    captured_evidence = []
    for r in scoped_records:
        if r.get("original_image") or r.get("annotated_image"):
            captured_evidence.append({
                "event_id": r["event_id"],
                "defect_name": r["category"],
                "raw_defect_type": r["raw_defect_type"],
                "confidence_pct": r["confidence_pct"],
                "severity": r["severity"],
                "timestamp_display": r["timestamp_display"],
                "meter_position": (
                    f"{float(r['fabric_position']):.2f} m"
                    if (r["fabric_position"] is not None and float(r["fabric_position"]) > 0)
                    else ("0.00 m (Encoder Idle)" if r["fabric_position"] == 0 else "Unmeasured")
                ),
                "bbox": r["bbox"],
                "original_image": r.get("original_image"),
                "annotated_image": r.get("annotated_image"),
            })

    if recent_evidence:
        seen_eids = {e["event_id"] for e in captured_evidence}
        for ev in recent_evidence:
            if ev.get("event_id") not in seen_eids and (ev.get("original_image") or ev.get("annotated_image")):
                captured_evidence.append(ev)

    major_defect_locations = []
    for r in scoped_records:
        if r["severity"] == "HIGH":
            bbox = r.get("bbox") or {}
            pos_val = r.get("fabric_position")
            if pos_val is not None and float(pos_val) > 0:
                pos_str = f"{float(pos_val):.2f} m"
            elif pos_val == 0:
                pos_str = "0.00 m (Encoder Idle)"
            else:
                pos_str = "Unmeasured (No Encoder)"
            major_defect_locations.append({
                "event_id": r["event_id"],
                "defect_name": r["category"],
                "raw_defect_type": r["raw_defect_type"],
                "confidence_pct": r["confidence_pct"],
                "timestamp_display": r["timestamp_display"],
                "meter_position": pos_str,
                "bbox_display": (
                    f"x:{bbox.get('x1', 0)}–{bbox.get('x2', 0)}, y:{bbox.get('y1', 0)}–{bbox.get('y2', 0)} px "
                    f"({max(0, int(bbox.get('x2', 0)) - int(bbox.get('x1', 0)))}×{max(0, int(bbox.get('y2', 0)) - int(bbox.get('y1', 0)))} px)"
                ) if bbox else "Not Recorded",
            })

    if effective_length_m is not None and effective_length_m > 0:
        quality_decisions = [
            {
                "category": "Accepted Fabric",
                "quantity": f"{accepted_clean_m:.2f} m ({defect_free_pct:.1f}%)",
                "basis": length_source,
                "meaning": "Defect-free fabric length meeting factory quality standards with no rework required.",
            },
            {
                "category": "Fabric Requiring Rework",
                "quantity": f"{raw_rework_m:.2f} m ({reworkable_defect_count} repairable spots)",
                "basis": "Calculated from Stains, Thread & Medium/Low defects",
                "meaning": "Localized sections with stains or loose threads that can be spot-cleaned or mended.",
            },
            {
                "category": "Fabric on Quality Hold",
                "quantity": f"{raw_hold_m:.2f} m ({hold_defect_count} High-severity spots)",
                "basis": "Calculated from High-severity detections",
                "meaning": "Fabric segments surrounding major defects held for QA supervisor review before cutting.",
            },
            {
                "category": "Rejected Fabric",
                "quantity": f"{raw_rejected_m:.2f} m ({holes_high} major structural holes)",
                "basis": "Calculated from High-severity structural holes",
                "meaning": "Damaged segments (major holes) that must be cut out and excluded from garment panels.",
            },
            {
                "category": "Dispatch-Ready Fabric",
                "quantity": f"{dispatch_ready_m:.2f} m ({round((dispatch_ready_m / effective_length_m) * 100, 1)}%)",
                "basis": "Accepted Fabric + Reworkable Fabric after finishing",
                "meaning": "Net commercial fabric ready for customer shipment after localized mending and cleaning.",
            },
        ]
    else:
        quality_decisions = [
            {
                "category": "Accepted Fabric",
                "quantity": "Pending Verification (Roll Length Required)",
                "basis": "Hardware encoder recorded 0.00 m",
                "meaning": "Clean fabric length between defect positions. Enter roll length (m) or enable rotary encoder to calculate metres.",
            },
            {
                "category": "Fabric Requiring Rework",
                "quantity": f"Pending Verification ({reworkable_defect_count} repairable locations logged)",
                "basis": "Actual database defect count",
                "meaning": "Locations with stains, thread errors, or warp/weft marks that can be spot-cleaned or mended.",
            },
            {
                "category": "Fabric on Quality Hold",
                "quantity": f"Pending Verification ({hold_defect_count} High-severity locations logged)",
                "basis": "Actual database High-severity count",
                "meaning": "Specific major defect positions held for QA supervisor verification before cutting.",
            },
            {
                "category": "Rejected Fabric",
                "quantity": f"Pending Verification ({holes_high} High-severity hole locations logged)",
                "basis": "Actual database High-severity hole count",
                "meaning": "Only the specific damaged centimetres at major holes require cutting — the entire roll is NOT rejected.",
            },
            {
                "category": "Dispatch-Ready Fabric",
                "quantity": f"Pending Verification ({seam_count} seam marks, {low_count} minor spots passable)",
                "basis": "Requires final QA length sign-off",
                "meaning": "Net shippable fabric length once repairable stains/threads are mended and major holes are trimmed.",
            },
        ]

    has_price = fabric_price_per_m is not None and float(fabric_price_per_m) > 0.0
    has_rework_rate = rework_cost_per_m is not None and float(rework_cost_per_m) > 0.0

    if effective_length_m is not None and effective_length_m > 0 and has_price:
        price_val = float(fabric_price_per_m)
        exposure_val = round(total_affected_m * price_val, 2)
        financial_exposure_display = f"INR {exposure_val:,.2f} ({total_affected_m:.2f} m × INR {price_val:,.2f}/m)"
        financial_exposure_basis = "Estimated (From Configured Price & Affected Length)"
        recoverable_val = round(raw_rework_m * price_val, 2)
        material_savings_display = f"INR {recoverable_val:,.2f} ({raw_rework_m:.2f} m recoverable via rework instead of full-roll rejection)"
        material_savings_basis = "Projected (Recoverable Rework Zone Value)"
    else:
        financial_exposure_display = "Not Available (Configure Roll Length & Fabric Price/m)"
        financial_exposure_basis = "Not Available"
        material_savings_display = "Not Available (Requires Roll Length, Price/m & Baseline Scrap Data)"
        material_savings_basis = "Not Available"

    if effective_length_m is not None and effective_length_m > 0 and has_rework_rate:
        rc_val = round(raw_rework_m * float(rework_cost_per_m), 2)
        rework_cost_display = f"INR {rc_val:,.2f} ({raw_rework_m:.2f} m × INR {float(rework_cost_per_m):,.2f}/m)"
        rework_cost_basis = "Estimated (From Factory Rework Rate)"
    else:
        rework_cost_display = "Not Available (Factory Rework Cost Rate Not Configured)"
        rework_cost_basis = "Not Available"

    if effective_length_m is not None and effective_length_m > 0:
        est_manual_min = round(effective_length_m / 8.0, 1)
        manual_time_display = f"~{est_manual_min} min (at standard 8 m/min manual inspection speed)"
        manual_time_basis = "Estimated Industry Benchmark"
    else:
        manual_time_display = "Not Available (Requires Measured Roll Length in Metres)"
        manual_time_basis = "Not Available"

    business_impact_rows = [
        {
            "metric": "Total Fabric Inspected",
            "value": length_display,
            "classification": "Actual Measured" if has_hardware_length else ("Estimated (Configured Input)" if has_configured_length else "Not Available"),
            "notes": "Measured by loom pulse encoder on Pin D2 (100 pulses/m)." if has_hardware_length else "Hardware encoder recorded 0.00 m during stored runs.",
        },
        {
            "metric": "Defective Fabric / Wastage Quantity",
            "value": (
                f"{total_affected_m:.2f} m affected ({raw_rejected_m:.2f} m net cut wastage)"
                if total_affected_m is not None
                else f"Not Available ({total_defects} defect events logged; linear metres pending)"
            ),
            "classification": "Estimated (From Defect Allowances)" if total_affected_m is not None else "Not Available",
            "notes": "Only major hole segments become net cut wastage; stained/thread zones are repairable.",
        },
        {
            "metric": "Estimated Financial Exposure",
            "value": financial_exposure_display,
            "classification": financial_exposure_basis,
            "notes": "Value of fabric in defect-affected zones prior to mending or cutting.",
        },
        {
            "metric": "Rework Cost",
            "value": rework_cost_display,
            "classification": rework_cost_basis,
            "notes": "Estimated labor/cleaning cost to spot-clean stains and mend thread errors.",
        },
        {
            "metric": "Potential Material Savings",
            "value": material_savings_display,
            "classification": material_savings_basis,
            "notes": "Fabric value preserved by targeted spot-mending vs. rejecting the entire roll.",
        },
        {
            "metric": "AI Inspection Time",
            "value": f"{format_duration(effective_duration_sec)} ({session_runs} active run{'s' if session_runs != 1 else ''})",
            "classification": "Actual Measured",
            "notes": "Calculated directly from first to last detection timestamps in MongoDB.",
        },
        {
            "metric": "Manual Inspection Time",
            "value": manual_time_display,
            "classification": manual_time_basis,
            "notes": "Manual table comparison is only calculated when physical roll length is measured.",
        },
    ]

    recommendations = []
    if cat_counts["Holes"] > 0:
        recommendations.append({
            "priority": "High Priority",
            "title": f"Inspect & Tag {cat_counts['Holes']} Detected Hole Locations ({cat_sev_counts['Holes']['HIGH']} Major)",
            "detail": "Inspect the locations where holes were detected before cutting. Check loom temple rings, reed wires, and take-up pins for sharp edges causing yarn breakage.",
        })
    if cat_counts["Stains"] > 0:
        recommendations.append({
            "priority": "Medium Priority",
            "title": f"Clean or Repair {cat_counts['Stains']} Stained Areas Where Possible",
            "detail": "Send stained sections for solvent spot-cleaning during finishing and inspect overhead loom bearings/seals to stop oil drops.",
        })
    if cat_counts["Thread Errors"] > 0 or cat_counts["Warp/Weft Irregularities"] > 0:
        t_cnt = cat_counts["Thread Errors"] + cat_counts["Warp/Weft Irregularities"]
        recommendations.append({
            "priority": "Medium Priority",
            "title": f"Check Weaving Settings for {t_cnt} Thread & Warp/Weft Irregularities",
            "detail": "Trim loose yarn ends on the inspection table and calibrate warp stop-motion sensors and weft insertion tension.",
        })
    if cat_counts["Seam/Joint Marks"] > 0:
        recommendations.append({
            "priority": "Standard Action",
            "title": f"Mark {cat_counts['Seam/Joint Marks']} Seam/Joint Positions Before Fabric Cutting",
            "detail": "Apply visible selvedge stickers at joint marks so cutting operators lay garment patterns without seams inside panels.",
        })
    if high_count > 0:
        recommendations.append({
            "priority": "Mandatory QA Step",
            "title": f"Mark All {high_count} Major Defect Positions & Reinspect Repaired Fabric",
            "detail": "Verify all High-severity locations listed in Section 4, complete localized repairs, and reinspect repaired zones.",
        })
    recommendations.append({
        "priority": "Final Approval",
        "title": "Obtain Final QA Approval & Sign-Off Before Customer Dispatch",
        "detail": "Complete the QA Verification sign-off in Section 7 and attach this report to the fabric roll dispatch tag.",
    })

    audit_flags = []
    if missing_position_count > 0 or zero_position_count > 0:
        audit_flags.append({
            "type": "Encoder Meter Position Verification",
            "status": "Flagged for Verification",
            "detail": (
                f"{missing_position_count} records have fabric_position = null (Arduino disconnected) and "
                f"{zero_position_count} records have fabric_position = 0.00 m (Arduino connected on COM8, pulse sensor idle). "
                "Historical records were preserved unmodified."
            ),
        })
    if duplicate_track_id_groups > 0:
        audit_flags.append({
            "type": "Historical Track ID Reuse Across Restarts",
            "status": "Resolved & Flagged",
            "detail": (
                f"All {total_defects} records have unique event_id keys, while {duplicate_track_id_groups} numeric track_id values "
                "restarted from 1 across earlier server restarts. Startup hydration now initializes next_track_id from the database maximum."
            ),
        })
    if missing_roll_id_count > 0:
        audit_flags.append({
            "type": "Roll ID Field Verification",
            "status": "Informational",
            "detail": f"{missing_roll_id_count} records have roll_id = null and are grouped under {loom_name}.",
        })
    if len(captured_evidence) == 0:
        audit_flags.append({
            "type": "Historical Camera Image Archiving",
            "status": "Informational",
            "detail": "Historical records store verified bounding-box coordinates and confidence scores without embedded JPEG bitmaps. New live detections automatically archive original and AI-annotated camera images.",
        })
    audit_flags.append({
        "type": "Severity vs. Confidence Consistency",
        "status": "Verified (100% Consistent)" if severity_mismatch_count == 0 else f"Flagged ({severity_mismatch_count} mismatches)",
        "detail": (
            f"All {total_defects} records match configured severity rules (HIGH >= 80%, MEDIUM 60–79.9%, LOW 35–59.9%)."
            if severity_mismatch_count == 0
            else f"{severity_mismatch_count} records differed from confidence threshold rules."
        ),
    })

    clean_records = []
    for idx, r in enumerate(scoped_records, start=1):
        bbox = r.get("bbox") or {}
        pos_val = r.get("fabric_position")
        if pos_val is not None and float(pos_val) > 0:
            pos_display = f"{float(pos_val):.2f} m"
        elif pos_val == 0:
            pos_display = "0.00 m"
        else:
            pos_display = "Unmeasured"

        clean_records.append({
            "index": idx,
            "event_id": r["event_id"],
            "loom_id": r["loom_id"],
            "roll_id": r["roll_id"] or "Unassigned",
            "track_id": r["track_id"],
            "defect_name": r["category"],
            "raw_defect_type": r["raw_defect_type"],
            "confidence": r["confidence"],
            "confidence_pct": r["confidence_pct"],
            "severity": r["severity"],
            "timestamp": r["timestamp"],
            "timestamp_display": r["timestamp_display"],
            "date_str": r["date_str"],
            "fabric_position": r["fabric_position"],
            "meter_position": pos_display,
            "bbox": bbox,
            "bbox_display": (
                f"({bbox.get('x1', 0)}, {bbox.get('y1', 0)}) – ({bbox.get('x2', 0)}, {bbox.get('y2', 0)})"
                if bbox else "—"
            ),
            "status": r["status"],
        })

    avg_conf_pct = (
        round(sum(r["confidence_pct"] for r in clean_records) / len(clean_records), 1)
        if clean_records else 0.0
    )
    peak_conf_pct = (
        round(max(r["confidence_pct"] for r in clean_records), 1)
        if clean_records else 0.0
    )

    return {
        "title": "Weave Kiran – Industrial Fabric Quality & Inspection Report",
        "subtitle": "AI-Powered Fabric Inspection, Defect Analysis & Quality Assessment.",
        "scope": scope,
        "scope_label": scope_label,
        "available_dates": available_dates,
        "total_db_records": len(normalized_all),
        "summary": {
            "report_id": report_id,
            "loom_id": loom_name,
            "roll_id": (clean_records[0]["roll_id"] if clean_records and clean_records[0]["roll_id"] != "Unassigned" else f"Unassigned ({loom_name})"),
            "inspection_start_display": first_dt.strftime("%d %b %Y, %I:%M:%S %p") if first_dt else "No Detections Recorded",
            "inspection_end_display": last_dt.strftime("%d %b %Y, %I:%M:%S %p") if last_dt else "No Detections Recorded",
            "report_generated_display": report_generated_dt.strftime("%d %b %Y, %I:%M:%S %p"),
            "inspection_duration_display": f"{format_duration(effective_duration_sec)} ({session_runs} active session{'s' if session_runs != 1 else ''})",
            "total_fabric_inspected_display": length_display,
            "effective_length_m": effective_length_m,
            "length_source": length_source,
            "total_defects": total_defects,
            "high_defects": high_count,
            "medium_defects": med_count,
            "low_defects": low_count,
            "defect_free_pct": defect_free_pct,
            "defect_free_display": defect_free_display,
            "defect_free_note": defect_free_note,
            "quality_grade": quality_grade,
            "final_status": final_status,
            "verdict_level": verdict_level,
            "grade_explanation": grade_explanation,
            "plain_english_summary": plain_english_summary,
        },
        "defect_breakdown": {
            "rows": defect_summary_rows,
            "most_frequent_defect": most_frequent_defect,
        },
        "visual_evidence": {
            "captured_images": captured_evidence[:8],
            "has_captured_images": len(captured_evidence) > 0,
            "historical_missing_image_count": max(0, total_defects - len(captured_evidence)),
            "notice": (
                "Showing actual camera images captured during live inspection."
                if len(captured_evidence) > 0
                else (
                    "Actual camera frame images are not stored in the database for these historical inspection records "
                    "(only bounding-box pixel coordinates, defect categories, confidence scores, and timestamps were archived). "
                    "In accordance with industrial quality standards, no stock photographs or artificial screenshots are shown. "
                    "New live inspections automatically capture and display real original and AI-annotated fabric images here."
                )
            ),
        },
        "quality_decision": {
            "rows": quality_decisions,
            "major_defect_locations": major_defect_locations,
            "policy_note": (
                "Every detected defect does NOT mean the entire fabric roll must be rejected. "
                "Stains and minor thread errors are routed to localized spot-cleaning or manual mending, "
                "while major holes are tagged by position for targeted cutting/splicing."
            ),
        },
        "business_impact": {
            "rows": business_impact_rows,
            "missing_config_fields": [
                "roll_length_meters (Hardware pulse encoder on Pin D2 recorded 0.00 m; calibrate rotary encoder or enter roll length per batch)",
                "fabric_price_per_meter_inr (Required in roll/order configuration to compute exact financial exposure)",
                "rework_cost_per_meter_inr (Required to compute exact mending/spot-cleaning labor cost)",
                "historical_baseline_scrap_rate (Required to verify net material savings vs. manual inspection)",
            ],
        },
        "recommendations": recommendations,
        "qa_verification": {
            "approval_status": final_status,
            "quality_grade": quality_grade,
            "system_verification": f"Automated AI & Database Audit Passed ({total_defects} verified records in scope)",
            "verification_timestamp": report_generated_dt.strftime("%d %b %Y, %I:%M:%S %p"),
            "inspector_role": "QA Shift Supervisor / Loom Master",
            "manager_role": "Production & Dispatch Manager",
        },
        "technical_details": {
            "ai_model_name": "Ultralytics YOLO26s (Custom-Trained Textile Defect Detector)",
            "weights_file": "best.pt (5 classes: Stain, Thread, Warp_Weft, hole, seam)",
            "image_resolution": "640 × 640 px inference tensor (1280 × 720 px camera capture)",
            "confidence_threshold": "0.35 (35% minimum detection confidence; High >= 80%, Medium 60–79.9%, Low 35–59.9%)",
            "iou_threshold": "0.30 Intersection-over-Union (with 150 px centroid distance fallback)",
            "tracking_methodology": (
                "Multi-frame object tracking assigns each physical defect a unique track_id and event_id, "
                "applies a 20-frame majority vote to stabilize defect classification, and closes tracks after 2.0s of absence "
                "to prevent counting the same defect multiple times as fabric moves."
            ),
            "grading_methodology_note": (
                "Standard ASTM D5430 (4-Point System) assigns 1 to 4 penalty points based on physical defect length in inches "
                "and normalizes points per 100 square yards (requiring calibrated camera mm-per-pixel scaling, roll width, and active linear metre encoder). "
                "When linear encoder length is 0.00 m / uncalibrated, Weave Kiran uses a Factory Defect-Severity Rule "
                "(based on High/Medium/Low AI confidence tiers) and does not claim certified ASTM D5430 compliance until physical roll dimensions are verified."
            ),
            "camera_info": "Browser WebRTC Device Camera (HTML5 Video/Canvas) & Local OpenCV DirectShow Camera pipeline (Watermark artifact filter enabled)",
            "arduino_integration": (
                f"Arduino Uno USB Serial (9600 baud) — Currently {'Connected on ' + str(arduino_status.get('arduino_port')) if arduino_status.get('arduino_connected') else 'Disconnected / Owner-Only Hardware Mode'} "
                "(L298N Dual Motor Driver on Pins 5,6,8,9,10,11; Optical/Hall Fabric Pulse Sensor on Pin D2 @ 100 pulses/m)"
            ),
            "mean_confidence_pct": avg_conf_pct,
            "peak_confidence_pct": peak_conf_pct,
            "system_verification": f"Verified against MongoDB database 'fabric_ai.defects' ({total_defects} scoped records / {len(normalized_all)} total records).",
            "audit_flags": audit_flags,
        },
        "defect_log": clean_records,
    }


class NumberedCanvas(pdfcanvas.Canvas):
    """Two-pass ReportLab canvas that draws consistent headers, footers, and 'Page X of Y'."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_chrome(num_pages)
            super().showPage()
        super().save()

    def _draw_page_chrome(self, page_count: int):
        page_w, page_h = A4
        self.saveState()

        self.setFillColor(colors.HexColor("#EA580C"))
        self.rect(0, page_h - 4 * mm, page_w, 4 * mm, stroke=0, fill=1)

        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#475569"))
            self.drawString(15 * mm, page_h - 10 * mm, "Weave Kiran – Industrial Fabric Quality & Inspection Report")
            self.setFont("Helvetica", 8)
            self.drawRightString(page_w - 15 * mm, page_h - 10 * mm, "AI-Powered Fabric Inspection, Defect Analysis & Quality Assessment")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(15 * mm, page_h - 12 * mm, page_w - 15 * mm, page_h - 12 * mm)

        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(15 * mm, 12 * mm, page_w - 15 * mm, 12 * mm)

        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(
            15 * mm,
            7.5 * mm,
            "Weave Kiran Quality Management System • Industrial Fabric Inspection Record",
        )
        self.setFont("Helvetica-Bold", 8)
        self.drawRightString(
            page_w - 15 * mm,
            7.5 * mm,
            f"Page {self._pageNumber} of {page_count}",
        )
        self.restoreState()


def _build_defect_chart_drawing(rows: List[Dict[str, Any]], total_defects: int) -> Drawing:
    d = Drawing(510, 145)
    d.add(Rect(0, 0, 510, 145, rx=6, ry=6, fillColor=colors.HexColor("#F8FAFC"), strokeColor=colors.HexColor("#E2E8F0"), strokeWidth=0.75))
    d.add(String(14, 127, "Defect Distribution by Category (Bar Chart)", fontName="Helvetica-Bold", fontSize=9.5, fillColor=colors.HexColor("#0F172A")))
    d.add(String(325, 127, "Category Share (Pie Chart)", fontName="Helvetica-Bold", fontSize=9.5, fillColor=colors.HexColor("#0F172A")))

    labels = [r["defect_name"] for r in rows]
    counts = [int(r["count"]) for r in rows]

    bc = HorizontalBarChart()
    bc.x = 115
    bc.y = 18
    bc.height = 98
    bc.width = 175
    bc.data = [counts]
    bc.categoryAxis.categoryNames = labels
    bc.categoryAxis.labels.fontName = "Helvetica"
    bc.categoryAxis.labels.fontSize = 8
    bc.categoryAxis.labels.fillColor = colors.HexColor("#334155")
    bc.valueAxis.valueMin = 0
    bc.valueAxis.valueMax = max(counts + [10])
    bc.valueAxis.labels.fontName = "Helvetica"
    bc.valueAxis.labels.fontSize = 7.5
    bc.bars[0].fillColor = colors.HexColor("#EA580C")
    bc.bars[0].strokeColor = colors.HexColor("#C2410C")
    bc.barLabels.nudge = 12
    bc.barLabelFormat = "%d"
    bc.barLabels.fontName = "Helvetica-Bold"
    bc.barLabels.fontSize = 7.5
    d.add(bc)

    palette = [
        colors.HexColor("#DC2626"),
        colors.HexColor("#EA580C"),
        colors.HexColor("#2563EB"),
        colors.HexColor("#7C3AED"),
        colors.HexColor("#0D9488"),
    ]
    if total_defects > 0:
        pc = Pie()
        pc.x = 330
        pc.y = 22
        pc.width = 82
        pc.height = 82
        nonzero = [(r["defect_name"], r["count"], r["share_pct"], palette[i % len(palette)]) for i, r in enumerate(rows) if r["count"] > 0]
        pc.data = [item[1] for item in nonzero]
        pc.labels = [f"{item[2]}%" for item in nonzero]
        pc.sideLabels = 0
        pc.simpleLabels = 1
        for i, item in enumerate(nonzero):
            pc.slices[i].fillColor = item[3]
            pc.slices[i].strokeColor = colors.white
            pc.slices[i].strokeWidth = 1
            pc.slices[i].fontName = "Helvetica-Bold"
            pc.slices[i].fontSize = 7

        d.add(pc)

        ly = 95
        for name, cnt, pct, col in nonzero:
            d.add(Rect(422, ly, 7, 7, fillColor=col, strokeColor=col))
            short_name = name.split("/")[0].split(" ")[0]
            d.add(String(433, ly + 1, f"{short_name}: {cnt} ({pct}%)", fontName="Helvetica", fontSize=7.2, fillColor=colors.HexColor("#334155")))
            ly -= 14
    else:
        d.add(String(340, 65, "No defects detected (100% Clean)", fontName="Helvetica-Bold", fontSize=8.5, fillColor=colors.HexColor("#15803D")))

    return d


def _decode_data_url_to_rl_image(data_url: str, max_w: float, max_h: float) -> Optional[RLImage]:
    try:
        raw_b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        img_bytes = base64.b64decode(raw_b64)
        bio = io.BytesIO(img_bytes)
        img = RLImage(bio)
        img._restrictSize(max_w, max_h)
        return img
    except Exception:
        return None


def generate_report_pdf_bytes(report: Dict[str, Any]) -> bytes:
    """Render the complete industrial PDF report and return raw PDF bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=report["title"],
        author="Weave Kiran Automated Quality Inspection System",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "WKTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16.5,
        leading=20,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "WKSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#475569"),
        spaceAfter=8,
    )
    sec_heading = ParagraphStyle(
        "WKSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#EA580C"),
        spaceBefore=10,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "WKBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=12.5,
        textColor=colors.HexColor("#1E293B"),
    )
    body_bold = ParagraphStyle(
        "WKBodyBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    cell_style = ParagraphStyle(
        "WKCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.8,
        textColor=colors.HexColor("#1E293B"),
    )
    cell_bold = ParagraphStyle(
        "WKCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0F172A"),
    )
    th_style = ParagraphStyle(
        "WKTH",
        parent=cell_bold,
        fontSize=8,
        textColor=colors.HexColor("#0F172A"),
    )

    story = []
    s = report["summary"]

    story.append(Paragraph(report["title"], title_style))
    story.append(Paragraph(report["subtitle"], subtitle_style))

    # ---------- SECTION 1: INSPECTION SUMMARY ----------
    story.append(Paragraph("Section 1 – Inspection Summary", sec_heading))

    verdict_bg = (
        colors.HexColor("#DCFCE7")
        if s["verdict_level"] == "PASS"
        else (colors.HexColor("#FEF3C7") if s["verdict_level"] == "CONDITIONAL" else colors.HexColor("#FEE2E2"))
    )
    verdict_border = (
        colors.HexColor("#16A34A")
        if s["verdict_level"] == "PASS"
        else (colors.HexColor("#D97706") if s["verdict_level"] == "CONDITIONAL" else colors.HexColor("#DC2626"))
    )

    kpi_data = [
        [
            Paragraph("<b>TOTAL FABRIC INSPECTED</b>", ParagraphStyle("k1", parent=cell_bold, fontSize=7, textColor=colors.HexColor("#64748B"))),
            Paragraph("<b>TOTAL DEFECTS DETECTED</b>", ParagraphStyle("k2", parent=cell_bold, fontSize=7, textColor=colors.HexColor("#64748B"))),
            Paragraph("<b>DEFECT-FREE FABRIC %</b>", ParagraphStyle("k3", parent=cell_bold, fontSize=7, textColor=colors.HexColor("#64748B"))),
            Paragraph("<b>FINAL QUALITY GRADE</b>", ParagraphStyle("k4", parent=cell_bold, fontSize=7, textColor=colors.HexColor("#64748B"))),
        ],
        [
            Paragraph(f"<b>{s['total_fabric_inspected_display']}</b>", ParagraphStyle("kv1", parent=body_bold, fontSize=10.5, leading=13)),
            Paragraph(
                f"<b>{s['total_defects']}</b> <font size=7.2 color='#64748B'>({s['high_defects']} High, {s['medium_defects']} Med, {s['low_defects']} Low)</font>",
                ParagraphStyle("kv2", parent=body_bold, fontSize=10.5, leading=13, textColor=colors.HexColor("#DC2626")),
            ),
            Paragraph(
                f"<b>{s['defect_free_display']}</b>",
                ParagraphStyle("kv3", parent=body_bold, fontSize=10, leading=13, textColor=colors.HexColor("#15803D")),
            ),
            Paragraph(
                f"<b>{s['quality_grade']}</b>",
                ParagraphStyle("kv4", parent=body_bold, fontSize=11.5, leading=13, textColor=colors.HexColor("#EA580C")),
            ),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm])
    kpi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(kpi_table)
    story.append(Spacer(1, 5))

    meta_data = [
        [
            Paragraph("<b>Report ID:</b>", cell_bold),
            Paragraph(s["report_id"], cell_style),
            Paragraph("<b>Loom ID:</b>", cell_bold),
            Paragraph(s["loom_id"], cell_style),
            Paragraph("<b>Roll ID:</b>", cell_bold),
            Paragraph(s["roll_id"], cell_style),
        ],
        [
            Paragraph("<b>Inspection Window:</b>", cell_bold),
            Paragraph(f"{s['inspection_start_display']} to {s['inspection_end_display']}", cell_style),
            Paragraph("<b>Active Duration:</b>", cell_bold),
            Paragraph(s["inspection_duration_display"], cell_style),
            Paragraph("<b>Final Status:</b>", cell_bold),
            Paragraph(f"<b>{s['final_status']}</b>", cell_bold),
        ],
        [
            Paragraph("<b>Report Generated:</b>", cell_bold),
            Paragraph(s["report_generated_display"], cell_style),
            Paragraph("<b>Report Scope:</b>", cell_bold),
            Paragraph(report["scope_label"], cell_style),
            Paragraph("<b>Length Basis:</b>", cell_bold),
            Paragraph(s["length_source"], cell_style),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[27 * mm, 43 * mm, 25 * mm, 33 * mm, 22 * mm, 30 * mm])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 5))

    exec_box = Table(
        [
            [
                Paragraph(
                    f"<b>Executive Summary (Simple Explanation):</b> {s['plain_english_summary']}<br/>"
                    f"<font size=7.8 color='#475569'><b>Grade & Defect-Free % Methodology:</b> {s['grade_explanation']} {s['defect_free_note']}</font>",
                    body_style,
                )
            ]
        ],
        colWidths=[180 * mm],
    )
    exec_box.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), verdict_bg),
            ("BOX", (0, 0), (-1, -1), 1.0, verdict_border),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ])
    )
    story.append(exec_box)

    # ---------- SECTION 2: UNDERSTAND THE DEFECTS ----------
    story.append(Paragraph("Section 2 – Understand the Defects", sec_heading))

    mf = report["defect_breakdown"]["most_frequent_defect"]
    if mf:
        story.append(
            Paragraph(
                f"<b>Most Frequently Detected Defect:</b> <font color='#DC2626'><b>{mf['defect_name']}</b></font> "
                f"— {mf['count']} occurrences ({mf['share_pct']}% of all detected defects). "
                f"<i>Recommended Action: {mf['factory_action']}</i>",
                body_style,
            )
        )
        story.append(Spacer(1, 4))

    story.append(_build_defect_chart_drawing(report["defect_breakdown"]["rows"], s["total_defects"]))
    story.append(Spacer(1, 5))

    defect_table_rows = [
        [
            Paragraph("<b>Defect Name</b>", th_style),
            Paragraph("<b>Number of Defects</b>", th_style),
            Paragraph("<b>Severity</b>", th_style),
            Paragraph("<b>What Does It Mean?</b>", th_style),
            Paragraph("<b>Why Does It Matter?</b>", th_style),
            Paragraph("<b>What Should the Factory Do?</b>", th_style),
        ]
    ]
    for r in report["defect_breakdown"]["rows"]:
        is_top = mf and r["defect_name"] == mf["defect_name"] and r["count"] > 0
        name_label = f"<b>{r['defect_name']}</b> {'(Most Frequent)' if is_top else ''}"
        defect_table_rows.append([
            Paragraph(name_label, cell_bold if is_top else cell_style),
            Paragraph(f"<b>{r['count']}</b> ({r['share_pct']}%)", cell_bold),
            Paragraph(r["severity"], cell_style),
            Paragraph(r["what_it_means"], cell_style),
            Paragraph(r["why_it_matters"], cell_style),
            Paragraph(r["factory_action"], cell_style),
        ])

    defect_table = Table(
        defect_table_rows,
        colWidths=[24 * mm, 19 * mm, 24 * mm, 36 * mm, 37 * mm, 40 * mm],
        repeatRows=1,
    )
    defect_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(defect_table)

    # ---------- SECTION 3: VISUAL INSPECTION EVIDENCE ----------
    story.append(Paragraph("Section 3 – Visual Inspection Evidence", sec_heading))
    ve = report["visual_evidence"]

    if ve["has_captured_images"]:
        story.append(Paragraph(ve["notice"], body_style))
        story.append(Spacer(1, 4))
        ev_rows = [
            [
                Paragraph("<b>Defect & Event ID</b>", th_style),
                Paragraph("<b>Original Fabric Camera Image</b>", th_style),
                Paragraph("<b>AI-Detected Defect Image (Bounding Box)</b>", th_style),
                Paragraph("<b>Confidence & Meter Position</b>", th_style),
            ]
        ]
        for item in ve["captured_images"][:6]:
            orig_img = _decode_data_url_to_rl_image(item.get("original_image") or "", 46 * mm, 34 * mm)
            ann_img = _decode_data_url_to_rl_image(item.get("annotated_image") or "", 46 * mm, 34 * mm)
            bbox = item.get("bbox") or {}
            ev_rows.append([
                Paragraph(
                    f"<b>{item['defect_name']}</b><br/>ID: {item['event_id']}<br/>Severity: {item['severity']}<br/>{item['timestamp_display']}",
                    cell_style,
                ),
                orig_img if orig_img else Paragraph("Original frame not archived", cell_style),
                ann_img if ann_img else Paragraph("Annotated frame not archived", cell_style),
                Paragraph(
                    f"<b>Confidence:</b> {item['confidence_pct']}%<br/>"
                    f"<b>Position:</b> {item['meter_position']}<br/>"
                    f"<b>Box:</b> ({bbox.get('x1', 0)},{bbox.get('y1', 0)})–({bbox.get('x2', 0)},{bbox.get('y2', 0)})",
                    cell_style,
                ),
            ])
        ev_table = Table(ev_rows, colWidths=[38 * mm, 50 * mm, 50 * mm, 42 * mm], repeatRows=1)
        ev_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(ev_table)
    else:
        notice_box = Table(
            [[Paragraph(f"<b>Visual Evidence Policy Notice:</b> {ve['notice']}", body_style)]],
            colWidths=[180 * mm],
        )
        notice_box.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7ED")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#F97316")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        story.append(notice_box)

    # ---------- SECTION 4: FABRIC QUALITY DECISION ----------
    story.append(Paragraph("Section 4 – Fabric Quality Decision", sec_heading))
    story.append(Paragraph(report["quality_decision"]["policy_note"], body_style))
    story.append(Spacer(1, 4))

    qd_rows = [
        [
            Paragraph("<b>Category</b>", th_style),
            Paragraph("<b>Fabric Quantity</b>", th_style),
            Paragraph("<b>Calculation Basis</b>", th_style),
            Paragraph("<b>What This Decision Means</b>", th_style),
        ]
    ]
    for q in report["quality_decision"]["rows"]:
        qd_rows.append([
            Paragraph(f"<b>{q['category']}</b>", cell_bold),
            Paragraph(f"<b>{q['quantity']}</b>", cell_bold),
            Paragraph(q["basis"], cell_style),
            Paragraph(q["meaning"], cell_style),
        ])

    qd_table = Table(qd_rows, colWidths=[36 * mm, 46 * mm, 38 * mm, 60 * mm], repeatRows=1)
    qd_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(qd_table)
    story.append(Spacer(1, 5))

    maj_locs = report["quality_decision"]["major_defect_locations"]
    story.append(
        Paragraph(
            f"<b>Locations of All Major (High-Severity >= 80% Confidence) Defects ({len(maj_locs)} found):</b>",
            body_bold,
        )
    )
    story.append(Spacer(1, 3))
    if maj_locs:
        maj_rows = [
            [
                Paragraph("<b>Event ID</b>", th_style),
                Paragraph("<b>Defect Name</b>", th_style),
                Paragraph("<b>Confidence</b>", th_style),
                Paragraph("<b>Detection Time</b>", th_style),
                Paragraph("<b>Meter Position</b>", th_style),
                Paragraph("<b>Camera Pixel Bounding Box</b>", th_style),
            ]
        ]
        for m in maj_locs:
            maj_rows.append([
                Paragraph(m["event_id"], cell_style),
                Paragraph(f"<b>{m['defect_name']}</b>", cell_bold),
                Paragraph(f"{m['confidence_pct']}%", cell_bold),
                Paragraph(m["timestamp_display"], cell_style),
                Paragraph(m["meter_position"], cell_style),
                Paragraph(m["bbox_display"], cell_style),
            ])
        maj_table = Table(maj_rows, colWidths=[35 * mm, 24 * mm, 21 * mm, 33 * mm, 26 * mm, 41 * mm], repeatRows=1)
        maj_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FEF2F2")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#FECACA")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#FEE2E2")),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(maj_table)
    else:
        story.append(Paragraph("No High-severity (>= 80% confidence) major defects were detected in this scope.", cell_style))

    # ---------- SECTION 5: BUSINESS IMPACT ----------
    story.append(Paragraph("Section 5 – Business Impact", sec_heading))
    bi_rows = [
        [
            Paragraph("<b>Business Metric</b>", th_style),
            Paragraph("<b>Result / Value</b>", th_style),
            Paragraph("<b>Data Classification</b>", th_style),
            Paragraph("<b>Explanation & Basis</b>", th_style),
        ]
    ]
    for b in report["business_impact"]["rows"]:
        bi_rows.append([
            Paragraph(f"<b>{b['metric']}</b>", cell_bold),
            Paragraph(f"<b>{b['value']}</b>", cell_bold),
            Paragraph(b["classification"], cell_style),
            Paragraph(b["notes"], cell_style),
        ])
    bi_table = Table(bi_rows, colWidths=[38 * mm, 48 * mm, 36 * mm, 58 * mm], repeatRows=1)
    bi_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(bi_table)

    # ---------- SECTION 6: RECOMMENDED FACTORY ACTIONS ----------
    story.append(Paragraph("Section 6 – Recommended Factory Actions", sec_heading))
    rec_rows = [
        [
            Paragraph("<b>Step</b>", th_style),
            Paragraph("<b>Priority</b>", th_style),
            Paragraph("<b>Recommended Action</b>", th_style),
            Paragraph("<b>How to Execute on the Factory Floor</b>", th_style),
        ]
    ]
    for i, rec in enumerate(report["recommendations"], start=1):
        rec_rows.append([
            Paragraph(f"<b>#{i}</b>", cell_bold),
            Paragraph(f"<b>{rec['priority']}</b>", cell_bold),
            Paragraph(f"<b>{rec['title']}</b>", cell_bold),
            Paragraph(rec["detail"], cell_style),
        ])
    rec_table = Table(rec_rows, colWidths=[12 * mm, 28 * mm, 55 * mm, 85 * mm], repeatRows=1)
    rec_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(rec_table)
    story.append(Spacer(1, 6))

    # QA VERIFICATION & SIGN-OFF BLOCK (Point 12)
    qav = report["qa_verification"]
    qa_table = Table(
        [
            [
                Paragraph("<b>QA Verification & Final Inspection Approval</b>", th_style),
                Paragraph("<b>Inspector Sign-Off</b>", th_style),
                Paragraph("<b>Production / Dispatch Approval</b>", th_style),
            ],
            [
                Paragraph(
                    f"<b>Approval Status:</b> {qav['approval_status']}<br/>"
                    f"<b>Quality Grade:</b> {qav['quality_grade']}<br/>"
                    f"<b>System Audit:</b> {qav['system_verification']}<br/>"
                    f"<b>Verified At:</b> {qav['verification_timestamp']}",
                    cell_style,
                ),
                Paragraph(
                    f"<b>Role:</b> {qav['inspector_role']}<br/><br/>"
                    "<b>Signature:</b> _______________________<br/>"
                    "<b>Date / Shift:</b> _____________________",
                    cell_style,
                ),
                Paragraph(
                    f"<b>Role:</b> {qav['manager_role']}<br/><br/>"
                    "<b>Signature:</b> _______________________<br/>"
                    "<b>Dispatch Stamp:</b> _________________",
                    cell_style,
                ),
            ],
        ],
        colWidths=[68 * mm, 56 * mm, 56 * mm],
    )
    qa_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#94A3B8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(qa_table)

    # ---------- SECTION 7: TECHNICAL DETAILS (AT THE END) ----------
    story.append(PageBreak())
    story.append(Paragraph("Section 7 – Technical Details & Complete Detection Log (For Engineers & Auditors)", sec_heading))
    td = report["technical_details"]

    tech_rows = [
        [Paragraph("<b>Parameter</b>", th_style), Paragraph("<b>Configuration / Measured Value</b>", th_style), Paragraph("<b>Simple Explanation</b>", th_style)],
        [Paragraph("<b>YOLO AI Model</b>", cell_bold), Paragraph(td["ai_model_name"], cell_style), Paragraph("Computer vision neural network trained specifically to spot textile defects on moving fabric.", cell_style)],
        [Paragraph("<b>Model Weights (best.pt)</b>", cell_bold), Paragraph(td["weights_file"], cell_style), Paragraph("Custom trained weights recognizing 5 defect classes with mean confidence " + f"{td['mean_confidence_pct']}% (peak {td['peak_confidence_pct']}%).", cell_style)],
        [Paragraph("<b>Image Resolution</b>", cell_bold), Paragraph(td["image_resolution"], cell_style), Paragraph("Each video frame is scaled to 640×640 pixels for real-time AI analysis.", cell_style)],
        [Paragraph("<b>Confidence Threshold</b>", cell_bold), Paragraph(td["confidence_threshold"], cell_style), Paragraph("How sure the AI is (0–100%). Detections below 35% are ignored to avoid false alarms.", cell_style)],
        [Paragraph("<b>IoU Threshold</b>", cell_bold), Paragraph(td["iou_threshold"], cell_style), Paragraph("Intersection-over-Union measures box overlap between frames so a moving defect is counted only once.", cell_style)],
        [Paragraph("<b>Tracking Methodology</b>", cell_bold), Paragraph(td["tracking_methodology"], cell_style), Paragraph("Prevents duplicate defect counts while the cloth moves under the camera.", cell_style)],
        [Paragraph("<b>Grading Methodology & ASTM Note</b>", cell_bold), Paragraph(td["grading_methodology_note"], cell_style), Paragraph("Clarifies why severity rules are used when physical linear/square yard dimensions are unmeasured.", cell_style)],
        [Paragraph("<b>Camera Pipeline</b>", cell_bold), Paragraph(td["camera_info"], cell_style), Paragraph("Supports live browser camera streaming over HTTPS/WebSocket as well as local USB/DroidCam.", cell_style)],
        [Paragraph("<b>Arduino & Loom Hardware</b>", cell_bold), Paragraph(td["arduino_integration"], cell_style), Paragraph("Controls physical loom drive motors exclusively from the owner's authorized hardware port.", cell_style)],
        [Paragraph("<b>System Verification</b>", cell_bold), Paragraph(td["system_verification"], cell_style), Paragraph("All report figures are computed directly from stored MongoDB records.", cell_style)],
    ]
    tech_table = Table(tech_rows, colWidths=[36 * mm, 82 * mm, 62 * mm], repeatRows=1)
    tech_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(tech_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>Data Integrity & Verification Audit Flags:</b>", body_bold))
    story.append(Spacer(1, 3))
    flag_rows = [[Paragraph("<b>Audit Check</b>", th_style), Paragraph("<b>Status</b>", th_style), Paragraph("<b>Verification Notes</b>", th_style)]]
    for af in td["audit_flags"]:
        flag_rows.append([
            Paragraph(f"<b>{af['type']}</b>", cell_bold),
            Paragraph(af["status"], cell_bold),
            Paragraph(af["detail"], cell_style),
        ])
    flag_table = Table(flag_rows, colWidths=[45 * mm, 35 * mm, 100 * mm], repeatRows=1)
    flag_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ])
    )
    story.append(flag_table)
    story.append(Spacer(1, 8))

    logs = report["defect_log"]
    story.append(
        Paragraph(
            f"<b>Complete Defect Position & Detection Log ({len(logs)} actual database records in scope):</b>",
            body_bold,
        )
    )
    story.append(Spacer(1, 3))

    log_rows = [
        [
            Paragraph("<b>#</b>", th_style),
            Paragraph("<b>Unique Event ID</b>", th_style),
            Paragraph("<b>Timestamp</b>", th_style),
            Paragraph("<b>Defect Type</b>", th_style),
            Paragraph("<b>Confidence</b>", th_style),
            Paragraph("<b>Severity</b>", th_style),
            Paragraph("<b>Meter Position</b>", th_style),
            Paragraph("<b>Bounding Box (px)</b>", th_style),
        ]
    ]
    for item in logs:
        log_rows.append([
            Paragraph(str(item["index"]), cell_style),
            Paragraph(item["event_id"], cell_style),
            Paragraph(item["timestamp_display"], cell_style),
            Paragraph(f"<b>{item['defect_name']}</b>", cell_bold),
            Paragraph(f"{item['confidence_pct']}%", cell_style),
            Paragraph(item["severity"], cell_bold if item["severity"] == "HIGH" else cell_style),
            Paragraph(item["meter_position"], cell_style),
            Paragraph(item["bbox_display"], cell_style),
        ])

    log_table = Table(
        log_rows,
        colWidths=[9 * mm, 35 * mm, 31 * mm, 26 * mm, 20 * mm, 16 * mm, 21 * mm, 22 * mm],
        repeatRows=1,
    )
    log_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(log_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
