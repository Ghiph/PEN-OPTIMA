from __future__ import annotations

import io
import json
import math
import os
import re
import sqlite3
from datetime import datetime
from typing import Optional, List, Tuple, Dict

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio
from plotly.subplots import make_subplots
import streamlit as st

APP_TITLE = "PEN-OPTIMA | Penobscot Digital Field Optimization Dashboard"
DB_PATH = os.getenv("PENOPTIMA_DB", "pen_optima.db")
SAMPLE_DIR = "sample_data"
MMSTB_FACTOR = 6.2898 / 1_000_000.0

st.set_page_config(page_title="PEN-OPTIMA", page_icon="🛢️", layout="wide")

# Cohesive blue + yellow Plotly theme used across all charts.
PEN_COLORWAY = ["#2563EB", "#F5B301", "#14375E", "#5B8DEF", "#E08A00", "#9DB8E8"]
pio.templates["pen"] = pio.templates["plotly_white"]
pio.templates["pen"].layout.colorway = PEN_COLORWAY
pio.templates["pen"].layout.font.family = "Inter, Segoe UI, sans-serif"
pio.templates["pen"].layout.font.color = "#102A43"
pio.templates["pen"].layout.title.font.color = "#102A43"
pio.templates.default = "pen"
px.defaults.color_discrete_sequence = PEN_COLORWAY

CUSTOM_CSS = """
<style>
:root {
  --pen-navy: #102A43;
  --pen-blue: #2563EB;
  --pen-blue-dark: #1D4FD7;
  --pen-yellow: #F5B301;
  --pen-border: #E3E9F2;
  --pen-muted: #5B6B82;
}

/* ---- base layout ---- */
[data-testid="stHeader"] {background: transparent;}
[data-testid="stDecoration"] {display: none;}
html, body, [class*="css"] {font-family: "Inter", "Segoe UI", system-ui, sans-serif;}
.block-container {padding-top: 1.4rem; padding-bottom: 2.5rem; max-width: 1400px;}
.stApp {background: #F7F9FC;}

/* ---- headings ---- */
h1, h2, h3, h4 {color: var(--pen-navy); font-weight: 800; letter-spacing: -0.01em;}
[data-testid="stMarkdownContainer"] h1 {
  border-bottom: 3px solid var(--pen-yellow);
  padding-bottom: .35rem; display: inline-block; margin-bottom: .6rem;
}

/* ---- sidebar: deep navy with yellow accents ---- */
[data-testid="stSidebar"] {
  background: linear-gradient(180deg, #0B2239 0%, #14375E 100%);
  border-right: 1px solid rgba(255,255,255,.06);
}
[data-testid="stSidebar"] * {color: #DCE6F2 !important;}
[data-testid="stSidebar"] h1 {
  color: var(--pen-yellow) !important; font-size: 1.5rem; letter-spacing: .04em;
  border: none; padding: 0;
}
[data-testid="stSidebar"] [data-testid="stCaptionContainer"] * {color: #9DB2CC !important;}

/* nav radio styled as a menu */
[data-testid="stSidebar"] [role="radiogroup"] {gap: 2px;}
[data-testid="stSidebar"] [role="radiogroup"] label {
  padding: .5rem .7rem; border-radius: 9px; margin: 0; transition: all .15s ease;
  font-weight: 500;
}
[data-testid="stSidebar"] [role="radiogroup"] label:hover {background: rgba(255,255,255,.07);}
[data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) {
  background: rgba(245,179,1,.16);
  box-shadow: inset 3px 0 0 var(--pen-yellow);
}
[data-testid="stSidebar"] [role="radiogroup"] label:has(input:checked) p {
  color: #FFFFFF !important; font-weight: 700;
}

/* ---- KPI cards ---- */
.kpi-card {
  padding: 1rem 1.15rem; border-radius: 14px; background: #FFFFFF;
  border: 1px solid var(--pen-border); border-top: 3px solid var(--pen-yellow);
  box-shadow: 0 1px 4px rgba(16,42,67,.06); height: 100%;
}
.kpi-title {font-size: .74rem; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; color: var(--pen-muted); margin-bottom: .35rem;}
.kpi-value {font-size: 1.5rem; font-weight: 800; color: var(--pen-navy); margin: 0; line-height: 1.15;}
.kpi-note {font-size: .76rem; color: #7A8AA0; margin-top: .35rem;}

/* ---- metric widgets as cards ---- */
[data-testid="stMetric"] {
  background: #FFFFFF; border: 1px solid var(--pen-border);
  border-left: 3px solid var(--pen-blue); border-radius: 12px;
  padding: .7rem .9rem; box-shadow: 0 1px 3px rgba(16,42,67,.05);
}
[data-testid="stMetricLabel"] p {color: var(--pen-muted); font-weight: 600;}
[data-testid="stMetricValue"] {color: var(--pen-navy);}

/* ---- info boxes ---- */
.blue-box, .warn-box, .green-box {padding: .85rem 1.1rem; border-radius: 12px; line-height: 1.5;}
.blue-box {border-left: 4px solid var(--pen-blue); background: #EEF3FB; color: var(--pen-navy);}
.warn-box {border-left: 4px solid var(--pen-yellow); background: #FEF7E6; color: #6B4E00;}
.green-box {border-left: 4px solid #1F9D6B; background: #E9F7F1; color: #0C5C3F;}

/* ---- buttons ---- */
.stButton > button, .stDownloadButton > button {
  border-radius: 10px; font-weight: 600; border: 1px solid var(--pen-border);
  transition: all .15s ease;
}
.stButton > button[kind="primary"] {background: var(--pen-blue); border: none;}
.stButton > button[kind="primary"]:hover {background: var(--pen-blue-dark);}
.stDownloadButton > button {background: #FFFFFF; color: var(--pen-blue); border: 1px solid var(--pen-blue);}
.stDownloadButton > button:hover {background: var(--pen-blue); color: #FFFFFF;}

/* ---- tabs ---- */
.stTabs [data-baseweb="tab-list"] {gap: 4px; border-bottom: 1px solid var(--pen-border);}
.stTabs [data-baseweb="tab"] {font-weight: 600; color: var(--pen-muted);}
.stTabs [aria-selected="true"] {color: var(--pen-blue) !important;}

/* ---- dataframes ---- */
[data-testid="stDataFrame"] {border: 1px solid var(--pen-border); border-radius: 10px;}
hr {border-color: var(--pen-border);}
</style>
"""
st.markdown(CUSTOM_CSS, unsafe_allow_html=True)

# ============================================================
# SQLite helpers
# ============================================================

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        )
        """
    )
    return conn


def sanitize_table_name(name: str) -> str:
    name = os.path.splitext(os.path.basename(str(name)))[0]
    name = re.sub(r"[^0-9a-zA-Z_]+", "_", name).strip("_").lower()
    if not name:
        name = "table"
    if name[0].isdigit():
        name = f"t_{name}"
    return name[:72]


def save_df(table_name: str, df: pd.DataFrame, if_exists: str = "replace") -> str:
    table_name = sanitize_table_name(table_name)
    conn = get_conn()
    df.to_sql(table_name, conn, if_exists=if_exists, index=False)
    conn.execute(
        "INSERT OR REPLACE INTO app_metadata(key, value, updated_at) VALUES (?, ?, ?)",
        (f"table:{table_name}", json.dumps({"rows": int(len(df)), "columns": list(df.columns)}), datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()
    return table_name


def read_table(table_name: str) -> pd.DataFrame:
    conn = get_conn()
    df = pd.read_sql_query(f'SELECT * FROM "{table_name}"', conn)
    conn.close()
    return df


def list_tables(prefix: Optional[str] = None) -> List[str]:
    conn = get_conn()
    q = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    rows = [r[0] for r in conn.execute(q).fetchall()]
    conn.close()
    rows = [r for r in rows if r != "app_metadata"]
    if prefix:
        rows = [r for r in rows if r.startswith(prefix)]
    return rows


def delete_table(table_name: str) -> None:
    conn = get_conn()
    conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
    conn.execute("DELETE FROM app_metadata WHERE key=?", (f"table:{table_name}",))
    conn.commit()
    conn.close()

# ============================================================
# Data parsers
# ============================================================

def parse_las_text(text: str) -> Tuple[pd.DataFrame, str]:
    """Small LAS 2.0 parser; enough for Penobscot demo without external dependency."""
    lines = text.splitlines()
    well_name = "unknown_well"
    for line in lines:
        s = line.strip()
        if s.upper().startswith("WELL"):
            before_comment = s.split(":")[0]
            if "." in before_comment:
                val = before_comment.split(".", 1)[1].strip()
                if val:
                    well_name = val.split()[0].replace("-", "_")
            break

    curve_start = None
    ascii_start = None
    for i, line in enumerate(lines):
        s = line.strip().lower()
        if s.startswith("~curve"):
            curve_start = i
        if s.startswith("~ascii"):
            ascii_start = i
            break
    if curve_start is None or ascii_start is None:
        raise ValueError("LAS file tidak memiliki section ~Curve atau ~Ascii yang valid.")

    curves = []
    for line in lines[curve_start + 1:ascii_start]:
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("~"):
            continue
        mnemonic = re.split(r"[\.\s]", s, maxsplit=1)[0].strip()
        if mnemonic:
            curves.append(mnemonic.replace("__", "_"))

    rows = []
    for line in lines[ascii_start + 1:]:
        s = line.strip()
        if not s or s.startswith("#") or s.startswith("~"):
            continue
        parts = re.split(r"\s+", s)
        if len(parts) < len(curves):
            continue
        try:
            rows.append([float(x) for x in parts[:len(curves)]])
        except ValueError:
            continue

    df = pd.DataFrame(rows, columns=curves)
    df = df.replace([-999.25, -999.0], np.nan)
    rename = {
        "DEPT": "Depth", "CALI_DA": "CALI", "CALI__DA": "CALI", "GRS": "GR", "GRS_DA": "GR",
        "RESM_DA": "RESM", "RHOB_DA": "RHOB", "NPHI_DA": "NPHI", "DT_DA": "DT",
        "VCL_DA": "VCL", "PHIE_DA": "PHIE", "PHIT_DA": "PHIT",
    }
    df = df.rename(columns=rename)
    df["Well"] = well_name.replace("_", "-")
    return df, well_name


def parse_las_upload(uploaded_file) -> Tuple[pd.DataFrame, str]:
    raw = uploaded_file.read()
    text = raw.decode("utf-8", errors="ignore")
    return parse_las_text(text)


def parse_partition_table(file_like, source_name: str = "partition") -> pd.DataFrame:
    cols = [
        "Zone", "Segment", "Area_m2", "Mean_Thickness_m", "GeomVolume_m3", "NetVolume_m3",
        "PoreVolume_rm3", "HCPV_rm3", "STOIIP_sm3", "RecOil_sm3",
    ]
    df = pd.read_csv(file_like, header=None, names=cols)
    for c in cols[2:]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    df["STOIIP_MMSTB"] = df["STOIIP_sm3"] * MMSTB_FACTOR
    df["RecOil_MMSTB"] = df["RecOil_sm3"] * MMSTB_FACTOR
    df["Source"] = source_name
    return df


def parse_extoil_table(file_like, source_name: str = "extoil") -> pd.DataFrame:
    cols = [
        "Zone", "Segment", "Area_m2", "Mean_Thickness_m", "Porosity", "Bo_rm3_sm3",
        "Oil_Density_kg_m3", "OilNetVolume_m3", "STOIIP_Mass_kg", "Oil_Saturation",
    ]
    df = pd.read_csv(file_like, header=None, names=cols)
    for c in cols[2:]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    df["Source"] = source_name
    return df


def parse_boundary_file(file_like) -> pd.DataFrame:
    return pd.read_csv(file_like, sep=r"\s+", header=None, names=["X", "Y", "Z"])


def parse_marker_file(file_like) -> pd.DataFrame:
    return pd.read_csv(file_like, sep="\t")


def parse_generic_spatial(uploaded_file) -> pd.DataFrame:
    name = uploaded_file.name.lower()
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return pd.read_excel(uploaded_file)
    try:
        return pd.read_csv(uploaded_file)
    except Exception:
        uploaded_file.seek(0)
        return pd.read_csv(uploaded_file, sep=r"\s+|\t", engine="python")

# ============================================================
# Property QC / Blocked Wells Statistics parser
# ============================================================

# Header tokens that should be recognised as a column name (not data) when the
# first line of a one-column file is non-numeric.
KNOWN_HEADER_KEYWORDS = {
    "vsh", "vcl", "phie", "phit", "ntg", "net", "poro", "porosity", "perm", "permeability",
    "k", "sw", "so", "swt", "facies", "lithology", "litho", "rock", "rocktype", "rock_type",
    "zone", "class", "code", "flag", "indicator", "property", "value",
    "x", "y", "z", "depth", "md", "tvd", "tvdss", "dept", "easting", "northing", "elevation",
}

CONTINUOUS_NAME_HINTS = ("vsh", "vcl", "phie", "phit", "ntg", "poro", "perm", "sw", "so", "net", "k_")
DISCRETE_NAME_HINTS = ("lith", "facies", "rock", "zone", "flag", "code", "class", "type", "indicator")


def infer_property_name(filename: str) -> str:
    base = os.path.splitext(os.path.basename(str(filename)))[0]
    base = re.sub(r"[^0-9a-zA-Z]+", "_", base).strip("_")
    return base.upper() if base else "PROPERTY"


def _is_number(token: str) -> bool:
    try:
        float(str(token).strip())
        return True
    except (TypeError, ValueError):
        return False


def parse_property_text(text: str, filename: str) -> pd.DataFrame:
    """Parse a tNavigator Blocked Wells Statistics export.

    Supports:
      * one column with a header (e.g. ``VSH``)
      * one column without a header (property name inferred from filename)
      * comma-separated or whitespace-separated data
      * multi-column spatial files (X, Y, Z, property, ...)
      * discrete lithology as numeric codes or text labels
    """
    raw_lines = [ln for ln in text.splitlines() if ln.strip() != ""]
    # drop common comment lines
    raw_lines = [ln for ln in raw_lines if not ln.lstrip().startswith(("#", "//", "--"))]
    if not raw_lines:
        return pd.DataFrame()

    use_comma = "," in raw_lines[0]

    def split_line(line: str) -> List[str]:
        if use_comma:
            return [t.strip() for t in line.split(",") if t.strip() != ""]
        return line.split()

    rows = [split_line(ln) for ln in raw_lines]
    rows = [r for r in rows if r]
    if not rows:
        return pd.DataFrame()

    first = rows[0]
    rest = rows[1:]

    first_all_num = all(_is_number(t) for t in first)
    if first_all_num:
        header_present = False
    else:
        rest_first_numeric = bool(rest) and all(_is_number(r[0]) for r in rest)
        if rest_first_numeric:
            # text header sitting on top of numeric data
            header_present = True
        else:
            # textual data (e.g. lithology labels) -> only a header if the first
            # token clearly looks like a column name
            header_present = first[0].strip().lower() in KNOWN_HEADER_KEYWORDS

    if header_present:
        columns = [c.strip() for c in first]
        data_rows = rest
    else:
        ncol = len(first)
        if ncol == 1:
            columns = [infer_property_name(filename)]
        else:
            columns = [f"col{i + 1}" for i in range(ncol)]
        data_rows = rows

    width = len(columns)
    norm = [(r + [None] * width)[:width] for r in data_rows]
    df = pd.DataFrame(norm, columns=columns)

    # Convert mostly-numeric columns to numeric, leave categorical text alone.
    for c in df.columns:
        conv = pd.to_numeric(df[c], errors="coerce")
        non_null = df[c].notna().sum()
        if non_null and conv.notna().sum() >= 0.8 * non_null:
            df[c] = conv
    return df


def parse_property_upload(uploaded_file) -> pd.DataFrame:
    raw = uploaded_file.read()
    text = raw.decode("utf-8", errors="ignore") if isinstance(raw, (bytes, bytearray)) else str(raw)
    return parse_property_text(text, uploaded_file.name)


def detect_spatial_columns(df: pd.DataFrame) -> Dict[str, object]:
    lower = {str(c).lower(): c for c in df.columns}

    def find(options) -> Optional[str]:
        for key in options:
            if key in lower:
                return lower[key]
        return None

    x = find(["x", "easting", "x_m", "xcoord", "x_coord", "coord_x"])
    y = find(["y", "northing", "y_m", "ycoord", "y_coord", "coord_y"])
    z = find(["z", "z_tvdss_m", "z_m", "elevation"])
    depth = find(["depth", "md", "tvd", "tvdss", "dept", "z_tvdss_m"])
    has_xy = x is not None and y is not None
    has_3d = has_xy and z is not None
    return {
        "x": x, "y": y, "z": z, "depth": depth,
        "has_xy": has_xy, "has_3d": has_3d, "has_depth": depth is not None,
    }


def detect_property_kind(series: pd.Series, name: str) -> str:
    """Return 'continuous' or 'discrete' as a best-guess default (user can override)."""
    nl = str(name).lower()
    if any(k in nl for k in DISCRETE_NAME_HINTS):
        return "discrete"
    if any(k in nl for k in CONTINUOUS_NAME_HINTS):
        return "continuous"
    s = pd.to_numeric(series, errors="coerce")
    if s.notna().sum() == 0:
        return "discrete"
    nonnull = s.dropna()
    if len(nonnull) and nonnull.nunique() <= 8 and np.allclose(nonnull, nonnull.round()):
        return "discrete"
    return "continuous"


def continuous_qc_stats(series: pd.Series) -> Dict[str, float]:
    s = pd.to_numeric(series, errors="coerce")
    missing = int(s.isna().sum())
    s = s.dropna()
    count = int(len(s))
    if count == 0:
        return {"count": 0, "missing": missing, "min": float("nan"), "max": float("nan"),
                "mean": float("nan"), "median": float("nan"), "variance": float("nan"),
                "std": float("nan"), "p10": float("nan"), "p50": float("nan"),
                "p90": float("nan"), "iqr": float("nan"), "cv": float("nan")}
    variance = float(s.var(ddof=1)) if count > 1 else 0.0
    std = float(s.std(ddof=1)) if count > 1 else 0.0
    mean = float(s.mean())
    q1, q3 = float(s.quantile(0.25)), float(s.quantile(0.75))
    return {
        "count": count, "missing": missing,
        "min": float(s.min()), "max": float(s.max()),
        "mean": mean, "median": float(s.median()),
        "variance": variance, "std": std,
        "p10": float(s.quantile(0.10)), "p50": float(s.quantile(0.50)), "p90": float(s.quantile(0.90)),
        "iqr": q3 - q1,
        "cv": (std / mean) if mean != 0 else float("nan"),
    }


def suggested_nuggets(sill: float) -> Dict[str, float]:
    return {"low": 0.05 * sill, "medium": 0.10 * sill, "high": 0.15 * sill}


def interpret_property(name: str, series: pd.Series) -> Optional[Dict[str, object]]:
    """Property-specific quality interpretation for VSH / PHIE / NTG."""
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        return None
    n = len(s)
    nl = str(name).lower()

    if "vsh" in nl or "vcl" in nl:
        low = float((s < 0.35).mean())
        mod = float(((s >= 0.35) & (s < 0.60)).mean())
        high = float((s >= 0.60).mean())
        return {
            "title": f"{name} (shale volume) interpretation",
            "fractions": {"Low VSH (<0.35)": low, "Moderate (0.35–0.60)": mod, "High (≥0.60)": high},
            "note": "Lower-VSH intervals are more reservoir-prone. Cleaner sand corresponds to lower shale volume.",
        }
    if "phie" in nl or "phit" in nl or "poro" in nl:
        poor = float((s < 0.05).mean())
        fair = float(((s >= 0.05) & (s < 0.10)).mean())
        good = float((s >= 0.10).mean())
        return {
            "title": f"{name} (effective porosity) interpretation",
            "fractions": {"Poor (<0.05)": poor, "Fair (0.05–0.10)": fair, "Good (≥0.10)": good},
            "note": "Use PHIE ≥ 0.05 as a practical reservoir-screening threshold.",
        }
    if "ntg" in nl or nl == "net":
        near_binary = bool(np.all(np.isin(np.round(s.to_numpy(), 6), [0.0, 1.0]))) or (s.between(0, 1).mean() > 0.95)
        net_fraction = float(s.mean())
        return {
            "title": f"{name} (net-to-gross) interpretation",
            "fractions": {"Net / reservoir": net_fraction, "Non-net": max(0.0, 1.0 - net_fraction)},
            "note": ("Values are near 0/1, behaving as a reservoir indicator. " if near_binary
                     else "Treated as a net fraction. ") + f"Net fraction (mean NTG) ≈ {net_fraction:.3f}.",
            "indicator": near_binary,
        }
    return None

# ============================================================
# Sample data
# ============================================================

def seed_sample_data() -> List[str]:
    loaded: List[str] = []

    final_path = os.path.join(SAMPLE_DIR, "final_low_base_high_volumetric_table.csv")
    if os.path.exists(final_path):
        loaded.append(save_df("scenario_final_low_base_high", pd.read_csv(final_path)))

    for well_file in ["B-41.las", "L-30.las"]:
        path = os.path.join(SAMPLE_DIR, well_file)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                df, well_name = parse_las_text(f.read())
            loaded.append(save_df(f"welllog_{well_name}", df))

    marker = os.path.join(SAMPLE_DIR, "Marker_Pe2.txt")
    if os.path.exists(marker):
        loaded.append(save_df("markers_penobscot", pd.read_csv(marker, sep="\t")))

    boundary = os.path.join(SAMPLE_DIR, "PenobscotBoundary_1.txt")
    if os.path.exists(boundary):
        loaded.append(save_df("boundary_penobscot", parse_boundary_file(boundary)))

    demo_vario = os.path.join(SAMPLE_DIR, "demo_variogram_points.csv")
    if os.path.exists(demo_vario):
        loaded.append(save_df("vario_demo_penobscot_blocked_points", pd.read_csv(demo_vario)))

    partition_files = {
        "vol_partition_shallow_base": "partitionshallowbase.txt",
        "vol_partition_horc_base": "partitionhorcpacakgebase.txt",
        "vol_partition_hord_base": "partitionhordpackagebase.txt",
        "vol_partition_shallow_low": "partition_shallow_low.txt",
        "vol_partition_horc_low": "partition_HORC_low.txt",
        "vol_partition_hord_low": "partition_HORD_low.txt",
        "vol_partition_shallow_high": "Vol_Partition_Shallow_high.txt",
        "vol_partition_horc_high": "Vol_Partition_HORC_high.txt",
        "vol_partition_hord_high": "Vol_Partition_HORD_high.txt",
    }
    for table, fname in partition_files.items():
        path = os.path.join(SAMPLE_DIR, fname)
        if os.path.exists(path):
            loaded.append(save_df(table, parse_partition_table(path, table)))
    return loaded

# ============================================================
# General analytics / plots
# ============================================================

def scenario_fallback() -> pd.DataFrame:
    return pd.DataFrame({
        "Case": ["Low / Conservative", "Base / Most Defensible", "High / Upside"],
        "Contact": ["Shallow OWC", "Hor_C OWC", "Hor_D OWC"],
        "Sw": [0.70, 0.60, 0.50],
        "So": [0.30, 0.40, 0.50],
        "Bo (rm³/sm³)": [1.30, 1.20, 1.10],
        "RF": [0.20, 0.30, 0.40],
        "STOIIP (MMSTB)": [154.04, 512.42, 4307.57],
        "Recoverable Oil (MMSTB)": [30.81, 153.73, 1723.03],
        "Interpretation": ["Conservative", "Main development basis", "Aggressive upside"],
    })


def get_scenario_df() -> pd.DataFrame:
    tables = list_tables("scenario_")
    if tables:
        df = read_table(tables[0])
        if "STOIIP (MMSTB)" in df.columns:
            return df
    return scenario_fallback()


def make_scenario_chart(df_scen: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    fig.add_bar(name="STOIIP", x=df_scen["Case"], y=df_scen["STOIIP (MMSTB)"], text=df_scen["STOIIP (MMSTB)"].round(2), textposition="outside")
    fig.add_bar(name="Recoverable Oil", x=df_scen["Case"], y=df_scen["Recoverable Oil (MMSTB)"], text=df_scen["Recoverable Oil (MMSTB)"].round(2), textposition="outside")
    fig.update_layout(barmode="group", title="Low–Base–High Volumetric Range", yaxis_title="Volume (MMSTB)", height=430, margin=dict(t=60, b=20))
    return fig


def plot_well_log(df: pd.DataFrame, markers: Optional[pd.DataFrame] = None, well_name: Optional[str] = None) -> go.Figure:
    depth_col = "Depth" if "Depth" in df.columns else df.columns[0]
    plot_df = df.dropna(subset=[depth_col]).sort_values(depth_col)
    fig = make_subplots(rows=1, cols=4, shared_yaxes=True, horizontal_spacing=0.025, subplot_titles=("GR / VCL", "Resistivity", "Density–Neutron", "PHIE / NTG"))
    if "GR" in plot_df.columns:
        fig.add_trace(go.Scatter(x=plot_df["GR"], y=plot_df[depth_col], mode="lines", name="GR"), row=1, col=1)
    if "VCL" in plot_df.columns:
        fig.add_trace(go.Scatter(x=plot_df["VCL"] * 150, y=plot_df[depth_col], mode="lines", name="VCL x150"), row=1, col=1)
    if "RESM" in plot_df.columns:
        res = plot_df["RESM"].replace(0, np.nan)
        fig.add_trace(go.Scatter(x=res, y=plot_df[depth_col], mode="lines", name="RESM"), row=1, col=2)
        fig.update_xaxes(type="log", row=1, col=2)
    if "RHOB" in plot_df.columns:
        fig.add_trace(go.Scatter(x=plot_df["RHOB"], y=plot_df[depth_col], mode="lines", name="RHOB"), row=1, col=3)
    if "NPHI" in plot_df.columns:
        fig.add_trace(go.Scatter(x=plot_df["NPHI"], y=plot_df[depth_col], mode="lines", name="NPHI"), row=1, col=3)
    if "PHIE" in plot_df.columns:
        fig.add_trace(go.Scatter(x=plot_df["PHIE"], y=plot_df[depth_col], mode="lines", name="PHIE"), row=1, col=4)
    if "NTG" in plot_df.columns:
        fig.add_trace(go.Scatter(x=plot_df["NTG"], y=plot_df[depth_col], mode="lines", name="NTG"), row=1, col=4)

    if markers is not None and "MD" in markers.columns:
        mdf = markers.copy()
        if well_name and "Well" in mdf.columns:
            mdf = mdf[mdf["Well"].astype(str).str.contains(str(well_name).replace("_", "-"), case=False, na=False)]
        for _, row in mdf.iterrows():
            try:
                y = float(row["MD"])
            except Exception:
                continue
            for c in range(1, 5):
                fig.add_hline(y=y, line_dash="dash", opacity=0.28, row=1, col=c)
    fig.update_yaxes(autorange="reversed", title_text="Depth / MD (m)", row=1, col=1)
    fig.update_layout(height=680, title=f"Integrated Well Log Panel: {well_name or ''}", legend_orientation="h", margin=dict(t=80, b=20))
    return fig


def rank_segments(df_part: pd.DataFrame) -> pd.DataFrame:
    df = df_part.copy()
    df = df[(df["Segment"].astype(str).str.lower() != "total") & (df["Zone"].astype(str).str.lower() != "total")]
    if df.empty:
        return df
    grouped = df.groupby(["Zone", "Segment"], as_index=False).agg(
        Area_m2=("Area_m2", "sum"),
        Mean_Thickness_m=("Mean_Thickness_m", "mean"),
        HCPV_rm3=("HCPV_rm3", "sum"),
        STOIIP_MMSTB=("STOIIP_MMSTB", "sum"),
        RecOil_MMSTB=("RecOil_MMSTB", "sum"),
    )
    for col in ["HCPV_rm3", "STOIIP_MMSTB", "RecOil_MMSTB", "Mean_Thickness_m"]:
        maxv = grouped[col].max()
        grouped[f"n_{col}"] = grouped[col] / maxv if maxv else 0
    grouped["Priority_Score"] = (
        0.35 * grouped["n_HCPV_rm3"] +
        0.30 * grouped["n_STOIIP_MMSTB"] +
        0.20 * grouped["n_RecOil_MMSTB"] +
        0.15 * grouped["n_Mean_Thickness_m"]
    ) * 100
    grouped["Recommended_Action"] = np.where(grouped["Priority_Score"] >= 70, "Primary target", np.where(grouped["Priority_Score"] >= 40, "Secondary target", "Monitor/appraise"))
    return grouped.sort_values("Priority_Score", ascending=False)

# ============================================================
# Variogram assistant
# ============================================================

def spherical_model(h: np.ndarray, nugget: float, sill: float, range_: float) -> np.ndarray:
    h = np.asarray(h, dtype=float)
    if range_ <= 0:
        return np.full_like(h, np.nan, dtype=float)
    hr = np.clip(h / range_, 0, None)
    gamma = nugget + (sill - nugget) * (1.5 * hr - 0.5 * hr**3)
    gamma = np.where(h >= range_, sill, gamma)
    return gamma


def _pair_arrays(df: pd.DataFrame, xcol: str, ycol: str, zcol: str, pcol: str, max_pairs: int, seed: int = 42):
    data = df[[xcol, ycol, zcol, pcol]].apply(pd.to_numeric, errors="coerce").dropna()
    if len(data) < 6:
        raise ValueError("Data valid terlalu sedikit. Minimal sekitar 6 titik dengan X/Y/Z/property lengkap.")
    if len(data) > 1800:
        data = data.sample(1800, random_state=seed)
    arr = data[[xcol, ycol, zcol, pcol]].to_numpy(float)
    n = len(arr)
    total_pairs = n * (n - 1) // 2
    rng = np.random.default_rng(seed)
    if total_pairs <= max_pairs:
        i, j = np.triu_indices(n, k=1)
    else:
        i = rng.integers(0, n, size=max_pairs)
        j = rng.integers(0, n, size=max_pairs)
        mask = i != j
        i, j = i[mask], j[mask]
    dx = arr[j, 0] - arr[i, 0]
    dy = arr[j, 1] - arr[i, 1]
    dz = arr[j, 2] - arr[i, 2]
    dp = arr[j, 3] - arr[i, 3]
    semivar = 0.5 * dp**2
    return dx, dy, dz, semivar, data[pcol].to_numpy(float)


def experimental_variogram_direction(
    dx: np.ndarray,
    dy: np.ndarray,
    dz: np.ndarray,
    semivar: np.ndarray,
    direction: str,
    azimuth_deg: float,
    lag_size: float,
    max_range: float,
    max_perp: float,
    max_vertical_tol: float,
    min_pairs: int = 8,
) -> pd.DataFrame:
    az = math.radians(azimuth_deg)
    ux, uy = math.sin(az), math.cos(az)  # azimuth 0 = north/Y, 90 = east/X
    px, py = math.sin(az + math.pi / 2), math.cos(az + math.pi / 2)
    lateral = np.sqrt(dx**2 + dy**2)

    if direction.lower() == "vertical":
        h = np.abs(dz)
        mask = (h > 0) & (h <= max_range) & (lateral <= max_perp)
    else:
        proj = np.abs(dx * ux + dy * uy)
        perp = np.abs(dx * px + dy * py)
        h = proj
        mask = (h > 0) & (h <= max_range) & (perp <= max_perp) & (np.abs(dz) <= max_vertical_tol)

    h = h[mask]
    g = semivar[mask]
    if len(h) == 0:
        return pd.DataFrame(columns=["Lag", "Distance", "Gamma", "Pairs"])

    bins = np.arange(0, max_range + lag_size, lag_size)
    if len(bins) < 3:
        bins = np.linspace(0, max_range, 8)
    idx = np.digitize(h, bins) - 1
    rows = []
    for b in range(1, len(bins)):
        m = idx == b
        if m.sum() >= min_pairs:
            rows.append({"Lag": b, "Distance": float(np.mean(h[m])), "Gamma": float(np.mean(g[m])), "Pairs": int(m.sum())})
    return pd.DataFrame(rows)


def estimate_variogram_params(exp_df: pd.DataFrame, property_values: np.ndarray, property_type: str) -> Dict[str, float | str]:
    vals = property_values[np.isfinite(property_values)]
    if len(vals) < 2:
        variance = np.nan
    elif property_type == "Binary / Netpay":
        p = np.mean(vals > 0.5)
        variance = p * (1 - p)
    else:
        variance = float(np.var(vals, ddof=1))
    if not np.isfinite(variance) or variance <= 0:
        variance = 1e-6

    if exp_df.empty:
        return {"Variance": variance, "Nugget": 0.0, "Sill": variance, "Range": np.nan, "Confidence": "Low", "Bins": 0, "Pairs": 0}

    exp = exp_df.dropna(subset=["Distance", "Gamma"]).sort_values("Distance")
    first_gamma = float(exp["Gamma"].iloc[0])
    empirical_max = float(exp["Gamma"].max())

    sill = max(variance, min(empirical_max, variance * 1.35))
    if property_type == "Binary / Netpay":
        sill = variance
    nugget = max(0.0, min(first_gamma, sill * 0.25))

    threshold = nugget + 0.95 * (sill - nugget)
    reached = exp[exp["Gamma"] >= threshold]
    if not reached.empty:
        range_est = float(reached["Distance"].iloc[0])
    else:
        range_est = float(exp["Distance"].iloc[-1])
    range_est = max(range_est, float(exp["Distance"].min()))

    bins = len(exp)
    pairs = int(exp["Pairs"].sum())
    if bins >= 8 and pairs >= 200:
        conf = "High"
    elif bins >= 5 and pairs >= 80:
        conf = "Medium"
    else:
        conf = "Low"
    return {"Variance": variance, "Nugget": nugget, "Sill": sill, "Range": range_est, "Confidence": conf, "Bins": bins, "Pairs": pairs}


def plot_variogram(exp_df: pd.DataFrame, params: Dict[str, float | str], title: str) -> go.Figure:
    fig = go.Figure()
    if exp_df is not None and not exp_df.empty:
        fig.add_trace(go.Bar(x=exp_df["Distance"], y=exp_df["Gamma"], name="Experimental", opacity=0.55, customdata=exp_df[["Pairs"]], hovertemplate="h=%{x:.1f}<br>γ=%{y:.4f}<br>pairs=%{customdata[0]}<extra></extra>"))
        max_h = max(float(exp_df["Distance"].max()), float(params.get("Range", 1) or 1))
    else:
        max_h = float(params.get("Range", 1) or 1)
    h = np.linspace(0, max_h * 1.15, 120)
    model = spherical_model(h, float(params.get("Nugget", 0)), float(params.get("Sill", 1)), float(params.get("Range", max_h)))
    fig.add_trace(go.Scatter(x=h, y=model, mode="lines", name="Spherical model"))
    fig.add_hline(y=float(params.get("Sill", 1)), line_dash="dot", annotation_text=f"Sill {float(params.get('Sill', 1)):.4f}")
    fig.add_vline(x=float(params.get("Range", max_h) or max_h), line_dash="dash", annotation_text=f"Range {float(params.get('Range', max_h) or max_h):.1f}")
    fig.update_layout(title=title, xaxis_title="Lag distance (m)", yaxis_title="Semivariance", height=330, margin=dict(t=50, b=25))
    return fig


def variogram_recommendation_text(prop: str, params: pd.DataFrame, property_type: str) -> str:
    if params.empty:
        return "No valid variogram recommendation could be produced because the experimental variogram is empty."
    main = params[params["Direction"] == "Main"]
    normal = params[params["Direction"] == "Normal"]
    vertical = params[params["Direction"] == "Vertical"]
    main_range = float(main["Range_m"].iloc[0]) if not main.empty and pd.notna(main["Range_m"].iloc[0]) else np.nan
    normal_range = float(normal["Range_m"].iloc[0]) if not normal.empty and pd.notna(normal["Range_m"].iloc[0]) else np.nan
    vertical_range = float(vertical["Range_m"].iloc[0]) if not vertical.empty and pd.notna(vertical["Range_m"].iloc[0]) else np.nan
    sill = float(main["Sill"].iloc[0]) if not main.empty else float(params["Sill"].median())
    nugget = float(main["Nugget"].iloc[0]) if not main.empty else float(params["Nugget"].median())
    anis = main_range / normal_range if np.isfinite(main_range) and np.isfinite(normal_range) and normal_range > 0 else np.nan
    lines = []
    lines.append(f"Property **{prop}** is treated as **{property_type}**. Suggested tNavigator model: **Spherical**.")
    lines.append(f"Use variance/sill around **{sill:.4f}** and nugget around **{nugget:.4f}** as a first-pass model. Adjust manually if the experimental variogram is sparse.")
    if np.isfinite(anis):
        lines.append(f"Estimated horizontal anisotropy ratio main/normal ≈ **{anis:.2f}**. This can guide major/minor ranges in tNavigator.")
    if np.isfinite(vertical_range):
        lines.append(f"Vertical range is estimated at **{vertical_range:.1f} m**. Keep vertical continuity conservative if well control is sparse.")
    lines.append("Use this as a **QC and first-pass parameter assistant**, not as a blind replacement for geological judgement. Cross-check with depositional direction, fault compartmentalization, and blocked-well statistics.")
    return "\n\n".join(lines)

# ============================================================
# Pages
# ============================================================

def kpi_card(title: str, value: str, note: str = "") -> None:
    st.markdown(f"""
    <div class='kpi-card'>
      <div class='kpi-title'>{title}</div>
      <div class='kpi-value'>{value}</div>
      <div class='kpi-note'>{note}</div>
    </div>
    """, unsafe_allow_html=True)


def page_home() -> None:
    st.title(APP_TITLE)
    st.caption("Streamlit + SQLite prototype. Firebase removed. Built as an industry-style digital decision-support dashboard for Penobscot field optimization.")

    if not list_tables():
        st.warning("Database is empty. Load sample Penobscot data to start the demo.")
        if st.button("🚀 Load sample Penobscot data", type="primary"):
            loaded = seed_sample_data()
            st.success(f"Loaded {len(loaded)} tables.")
            st.rerun()

    df = get_scenario_df()
    part_tables = list_tables("vol_partition_horc_base") or list_tables("vol_partition_")
    ranked = pd.DataFrame()
    if part_tables:
        try:
            ranked = rank_segments(read_table(part_tables[0]))
        except Exception:
            ranked = pd.DataFrame()

    c1, c2, c3, c4 = st.columns(4)
    with c1: kpi_card("Base STOIIP", f"{df.iloc[1]['STOIIP (MMSTB)']:.2f} MMSTB", "Hor_C OWC / development basis")
    with c2: kpi_card("Base Recoverable", f"{df.iloc[1]['Recoverable Oil (MMSTB)']:.2f} MMSTB", "RF 30% scenario")
    with c3: kpi_card("Dominant Zone", "Zone_1", "Hor_C base mostly supported by Zone_1")
    with c4:
        seg = ranked.iloc[0]["Segment"] if not ranked.empty else "Segment 3"
        kpi_card("Priority Segment", str(seg), "Initial development target")

    st.subheader("Model QC Status")
    scen_loaded = bool(list_tables("scenario_"))
    part_loaded = bool(list_tables("vol_partition_"))
    prop_loaded = bool(list_tables("property_qc_"))
    spatial_loaded = False
    for t in list_tables("vario_"):
        try:
            if detect_spatial_columns(read_table(t))["has_xy"]:
                spatial_loaded = True
                break
        except Exception:
            continue

    def status_badge(flag: bool) -> str:
        return "✅ Loaded" if flag else "❌ Missing"

    q1, q2, q3, q4 = st.columns(4)
    with q1: kpi_card("Volumetric scenarios", status_badge(scen_loaded))
    with q2: kpi_card("Zone–segment partition", status_badge(part_loaded))
    with q3: kpi_card("Property distribution QC", status_badge(prop_loaded))
    with q4: kpi_card("Spatial variogram data", "✅ Available" if spatial_loaded else "⚠️ Missing (use Property QC)")

    left, right = st.columns([1.15, 1.0])
    with left:
        st.plotly_chart(make_scenario_chart(df), use_container_width=True)
    with right:
        st.subheader("Industry-style Decision Panel")
        st.markdown("""
        <div class='blue-box'>
        <b>Concept:</b> This page adapts the layout idea of an integrated subsurface dashboard: field summary, well-log evidence, volumetric uncertainty, segment ranking, and risk notes in one interface. No external branding or third-party screenshots are used.
        </div>
        """, unsafe_allow_html=True)
        st.write("")
        if not ranked.empty:
            st.dataframe(ranked[["Zone", "Segment", "STOIIP_MMSTB", "RecOil_MMSTB", "Priority_Score", "Recommended_Action"]].head(5), use_container_width=True, hide_index=True)
        st.markdown("""
        **Decision logic**  
        1. Develop/appraise **Hor_C / Zone_1 / Segment 3** first.  
        2. Expand laterally to **Segment 1–2** after appraisal.  
        3. Treat **Hor_D / Zone_2 / Segment 2** as high-side appraisal, not immediate base case.
        """)


def page_data_center() -> None:
    st.title("📥 Data Center")
    st.write("Upload LAS, marker, boundary, tNavigator volumetric output, and spatial property tables into SQLite.")

    with st.expander("Load sample data", expanded=False):
        if st.button("Load all sample data"):
            loaded = seed_sample_data()
            st.success(f"Loaded {len(loaded)} tables.")
            st.write(loaded)

    tab_las, tab_tnav, tab_prop, tab_spatial, tab_aux, tab_manage = st.tabs(
        ["LAS Well Logs", "tNavigator Volumetric", "Property QC / Blocked Statistics", "Spatial / Variogram Data", "Markers / Boundary", "Manage DB"]
    )

    with tab_las:
        files = st.file_uploader("Upload .las files", type=["las"], accept_multiple_files=True)
        if files and st.button("Save LAS to SQLite"):
            for f in files:
                df, well_name = parse_las_upload(f)
                table = save_df(f"welllog_{well_name}", df)
                st.success(f"{f.name} → {table} ({len(df):,} rows)")

    with tab_tnav:
        data_type = st.radio("Table type", ["Partition table", "Extended oil table", "Final scenario CSV"], horizontal=True)
        files = st.file_uploader("Upload .txt/.csv volumetric tables", type=["txt", "csv"], accept_multiple_files=True, key="tnav")
        if files and st.button("Save volumetric tables"):
            for f in files:
                if data_type == "Partition table":
                    df = parse_partition_table(f, f.name)
                    table = save_df(f"vol_partition_{f.name}", df)
                elif data_type == "Extended oil table":
                    df = parse_extoil_table(f, f.name)
                    table = save_df(f"vol_extoil_{f.name}", df)
                else:
                    df = pd.read_csv(f)
                    table = save_df(f"scenario_{f.name}", df)
                st.success(f"{f.name} → {table} ({len(df):,} rows)")

    with tab_prop:
        st.markdown(
            "Upload **one-column** property files exported from tNavigator **Blocked Wells Statistics** "
            "(e.g. `vsh.txt`, `phie.txt`, `ntg.txt`, `lithology.txt`). Files with or without a header, "
            "comma- or whitespace-separated, are supported. Saved with the `property_qc_` prefix for the "
            "Property QC & Variogram Readiness page."
        )
        prop_files = st.file_uploader("Upload property .txt/.csv files", type=["txt", "csv"], accept_multiple_files=True, key="propqc")
        if prop_files:
            for f in prop_files:
                try:
                    f.seek(0)
                    preview = parse_property_upload(f)
                    st.caption(f"Preview `{f.name}` → columns: {', '.join(map(str, preview.columns))} ({len(preview):,} rows)")
                    st.dataframe(preview.head(20), use_container_width=True)
                except Exception as e:
                    st.error(f"Preview failed for {f.name}: {e}")
            if st.button("Save property-only files"):
                for f in prop_files:
                    try:
                        f.seek(0)
                        df = parse_property_upload(f)
                        table = save_df(f"property_qc_{f.name}", df)
                        st.success(f"{f.name} → {table} ({len(df):,} rows)")
                    except Exception as e:
                        st.error(f"Failed to save {f.name}: {e}")

    with tab_spatial:
        st.markdown("Upload blocked-well statistics or grid-property sample exported from tNavigator. Required for full directional variogram: X, Y, Z/TVDSS, and one property column such as PHIE, NTG, VSH, or Netpay.")
        files = st.file_uploader("Upload spatial CSV/TXT/XLSX", type=["csv", "txt", "xlsx", "xls"], accept_multiple_files=True, key="spatial")
        if files and st.button("Save spatial property tables"):
            for f in files:
                df = parse_generic_spatial(f)
                table = save_df(f"vario_{f.name}", df)
                st.success(f"{f.name} → {table} ({len(df):,} rows)")
        if st.button("Load demo variogram points only"):
            path = os.path.join(SAMPLE_DIR, "demo_variogram_points.csv")
            if os.path.exists(path):
                table = save_df("vario_demo_penobscot_blocked_points", pd.read_csv(path))
                st.success(f"Loaded {table}")

    with tab_aux:
        aux_type = st.radio("Auxiliary type", ["Marker", "Boundary"], horizontal=True)
        aux_files = st.file_uploader("Upload file", type=["txt", "csv"], accept_multiple_files=True, key="aux")
        if aux_files and st.button("Save auxiliary data"):
            for f in aux_files:
                if aux_type == "Marker":
                    df = parse_marker_file(f)
                    table = save_df(f"markers_{f.name}", df)
                else:
                    df = parse_boundary_file(f)
                    table = save_df(f"boundary_{f.name}", df)
                st.success(f"{f.name} → {table} ({len(df):,} rows)")

    with tab_manage:
        tables = list_tables()
        st.write(f"SQLite DB: `{DB_PATH}`")
        st.dataframe(pd.DataFrame({"tables": tables}), use_container_width=True)
        selected = st.selectbox("Preview table", [""] + tables)
        if selected:
            df = read_table(selected)
            st.write(f"Rows: {len(df):,} | Columns: {len(df.columns)}")
            st.dataframe(df.head(250), use_container_width=True)
            st.download_button("Download table as CSV", df.to_csv(index=False).encode("utf-8"), file_name=f"{selected}.csv")
            if st.button("Delete selected table"):
                delete_table(selected)
                st.warning(f"Deleted {selected}")
                st.rerun()


def page_well_logs() -> None:
    st.title("🪨 Well Log & Reservoir Panel")
    tables = list_tables("welllog_")
    if not tables:
        st.warning("No well log table. Upload LAS or load sample data.")
        return
    selected = st.selectbox("Well log table", tables)
    df = read_table(selected)
    # pandas 3.x / Arrow may load all-null or text-stored SQLite columns as string
    # dtype; coerce log curves back to numeric so stats and plots work.
    for c in df.columns:
        if c != "Well":
            df[c] = pd.to_numeric(df[c], errors="coerce")
    marker_tables = list_tables("markers_")
    markers = read_table(marker_tables[0]) if marker_tables else None
    well_name = df["Well"].dropna().iloc[0] if "Well" in df.columns and df["Well"].notna().any() else selected
    if "Depth" not in df.columns:
        st.error("Depth column not found in this well log table.")
        return
    min_depth, max_depth = float(df["Depth"].min()), float(df["Depth"].max())
    depth_range = st.slider("Depth interval (m)", min_depth, max_depth, (min_depth, max_depth))
    df_view = df[(df["Depth"] >= depth_range[0]) & (df["Depth"] <= depth_range[1])]
    st.plotly_chart(plot_well_log(df_view, markers, well_name), use_container_width=True)

    c1, c2, c3, c4 = st.columns(4)
    if "PHIE" in df_view.columns:
        c1.metric("Avg PHIE", f"{df_view['PHIE'].mean():.3f}")
    if "VCL" in df_view.columns:
        c2.metric("Avg VCL", f"{df_view['VCL'].mean():.3f}")
    if "NTG" in df_view.columns:
        c3.metric("Avg NTG", f"{df_view['NTG'].mean():.3f}")
    if "RESM" in df_view.columns:
        c4.metric("Median RESM", f"{df_view['RESM'].median():.2f}")
    with st.expander("Data preview"):
        st.dataframe(df_view.head(500), use_container_width=True)


def page_volumetrics() -> None:
    st.title("📊 Volumetric Scenario Cockpit")
    df = get_scenario_df()
    st.plotly_chart(make_scenario_chart(df), use_container_width=True)
    st.dataframe(df, use_container_width=True, hide_index=True)
    st.markdown("""
    <div class='green-box'>
    <b>Base-case decision:</b> Hor_C is retained as the most defensible development basis. Hor_D remains an upside appraisal case because its volume is strongly controlled by deeper contact and reservoir-quality uncertainty.
    </div>
    """, unsafe_allow_html=True)


def page_zone_segment() -> None:
    st.title("🧭 Zone–Segment Development Ranking")
    part_tables = list_tables("vol_partition_")
    if not part_tables:
        st.warning("No partition table. Upload/seed tNavigator partition output.")
        return
    selected = st.selectbox("Partition table", part_tables, index=part_tables.index("vol_partition_horc_base") if "vol_partition_horc_base" in part_tables else 0)
    df = read_table(selected)
    total = df[(df["Zone"].astype(str).str.lower() == "total") & (df["Segment"].astype(str).str.lower() == "total")]
    if not total.empty:
        row = total.iloc[0]
        c1, c2, c3 = st.columns(3)
        c1.metric("Total STOIIP", f"{row['STOIIP_MMSTB']:.2f} MMSTB")
        c2.metric("Recoverable Oil", f"{row['RecOil_MMSTB']:.2f} MMSTB")
        c3.metric("Mean Thickness", f"{row['Mean_Thickness_m']:.2f} m")
    ranked = rank_segments(df)
    if ranked.empty:
        st.warning("No valid zone-segment rows.")
        return
    top_n = st.slider("Top segments", 5, 20, 10)
    st.dataframe(ranked.head(top_n), use_container_width=True, hide_index=True)
    fig = px.bar(ranked.head(top_n), x="Segment", y="Priority_Score", color="Zone", title="Development Priority Score by Zone–Segment")
    st.plotly_chart(fig, use_container_width=True)
    fig2 = px.scatter(ranked.head(30), x="STOIIP_MMSTB", y="RecOil_MMSTB", size="HCPV_rm3", color="Zone", hover_data=["Segment", "Priority_Score", "Recommended_Action"], title="Risk/Reward Screening: STOIIP vs Recoverable Oil")
    st.plotly_chart(fig2, use_container_width=True)


def render_availability_status(df: pd.DataFrame, spatial: Dict[str, object]) -> None:
    st.subheader("Data availability status")
    prop_cols = [c for c in df.columns if c not in (spatial["x"], spatial["y"], spatial["z"], spatial["depth"])]
    prop_available = len(prop_cols) >= 1
    full_vario = bool(spatial["has_3d"])
    vert_vario = bool(spatial["has_depth"])

    def yn(flag: bool) -> str:
        return "✅ Yes" if flag else "❌ No"

    c1, c2, c3, c4, c5 = st.columns(5)
    with c1: kpi_card("Property-only data", yn(prop_available))
    with c2: kpi_card("Spatial X/Y columns", yn(bool(spatial["has_xy"])))
    with c3: kpi_card("Depth column", yn(vert_vario))
    with c4: kpi_card("Full directional variogram", yn(full_vario))
    with c5: kpi_card("Vertical variogram", yn(vert_vario))

    if not full_vario:
        st.markdown(
            "<div class='warn-box'><b>Directional range cannot be calculated</b> because X/Y/Z or depth "
            "columns are missing. Main, normal, and vertical ranges must be treated as geological assumptions "
            "or estimated from a spatial blocked-well / grid export.</div>",
            unsafe_allow_html=True,
        )


def continuous_property_qc(prop: str, series: pd.Series) -> None:
    stats = continuous_qc_stats(series)
    if stats["count"] == 0:
        st.error(f"No numeric values found in '{prop}'. If this is a lithology/category, switch the property type to Discrete.")
        return

    sill = stats["variance"] if np.isfinite(stats["variance"]) and stats["variance"] > 0 else 0.0

    st.subheader(f"Statistical QC — {prop}")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Count", f"{stats['count']:,}")
    m2.metric("Missing", f"{stats['missing']:,}")
    m3.metric("Mean", f"{stats['mean']:.4f}")
    m4.metric("Median (P50)", f"{stats['median']:.4f}")
    m5, m6, m7, m8 = st.columns(4)
    m5.metric("Std dev", f"{stats['std']:.4f}")
    m6.metric("Sample variance (sill est.)", f"{stats['variance']:.4f}")
    m7.metric("P10", f"{stats['p10']:.4f}")
    m8.metric("P90", f"{stats['p90']:.4f}")

    stats_rows = [
        ("count", stats["count"]), ("missing", stats["missing"]),
        ("min", stats["min"]), ("max", stats["max"]),
        ("mean", stats["mean"]), ("median", stats["median"]),
        ("sample_variance", stats["variance"]), ("std_dev", stats["std"]),
        ("P10", stats["p10"]), ("P50", stats["p50"]), ("P90", stats["p90"]),
        ("IQR", stats["iqr"]), ("coef_variation", stats["cv"]),
        ("initial_sill_estimate", sill),
    ]
    stats_df = pd.DataFrame(stats_rows, columns=["metric", "value"])
    with st.expander("Full statistics table", expanded=False):
        st.dataframe(stats_df, use_container_width=True, hide_index=True)

    st.markdown(
        "<div class='warn-box'><b>Directional range cannot be calculated</b> because X/Y/Z or depth columns "
        "are missing from this one-column property file. Main, normal, and vertical ranges below are "
        "geological assumptions, not values computed from the data.</div>",
        unsafe_allow_html=True,
    )

    # ---- editable tNavigator initial parameter card ----
    st.subheader("tNavigator initial parameter card (editable)")
    nug = suggested_nuggets(sill)
    cc1, cc2 = st.columns(2)
    with cc1:
        st.text_input("Variogram type", value="Spherical", disabled=True, key=f"vtype_{prop}")
        st.number_input("Sill (sample variance)", value=float(round(sill, 6)), format="%.6f", disabled=True, key=f"sill_{prop}")
        nugget_choice = st.radio(
            "Nugget as % of sill",
            ["5% (low)", "10% (medium)", "15% (high)"],
            index=1, horizontal=True, key=f"nugchoice_{prop}",
        )
        pct = {"5% (low)": 0.05, "10% (medium)": 0.10, "15% (high)": 0.15}[nugget_choice]
        nugget = pct * sill
        st.caption(f"Suggested nuggets — low: {nug['low']:.6f} · medium: {nug['medium']:.6f} · high: {nug['high']:.6f}")
        st.metric("Selected nugget", f"{nugget:.6f}")
    with cc2:
        main_range = st.number_input("Main range (m) — assumption", value=2200.0, min_value=0.0, step=100.0, key=f"mr_{prop}")
        normal_range = st.number_input("Normal range (m) — assumption", value=1000.0, min_value=0.0, step=100.0, key=f"nr_{prop}")
        vertical_range = st.number_input("Vertical range (m) — assumption", value=50.0, min_value=0.0, step=5.0, key=f"vr_{prop}")
        main_azimuth = st.number_input("Main azimuth (deg)", value=99.0, step=1.0, key=f"az_{prop}")
    st.caption("Note: Range values are assumptions, not calculated from one-column property data.")

    # ---- distribution plots ----
    st.subheader("Distribution QC plots")
    s_clean = pd.to_numeric(series, errors="coerce").dropna()
    p1, p2 = st.columns(2)
    with p1:
        st.plotly_chart(px.histogram(s_clean, nbins=40, title=f"Histogram — {prop}").update_layout(showlegend=False, height=330, xaxis_title=prop), use_container_width=True)
    with p2:
        st.plotly_chart(px.box(s_clean, title=f"Boxplot — {prop}").update_layout(showlegend=False, height=330, yaxis_title=prop), use_container_width=True)

    sorted_vals = np.sort(s_clean.to_numpy(float))
    ecdf_y = np.arange(1, len(sorted_vals) + 1) / len(sorted_vals)
    ecdf_fig = go.Figure(go.Scatter(x=sorted_vals, y=ecdf_y, mode="lines", name="ECDF"))
    ecdf_fig.update_layout(title=f"Cumulative distribution (ECDF) — {prop}", xaxis_title=prop, yaxis_title="Cumulative probability", height=330)
    st.plotly_chart(ecdf_fig, use_container_width=True)

    # ---- property quality interpretation ----
    interp = interpret_property(prop, series)
    if interp:
        st.subheader("Property quality interpretation")
        frac_df = pd.DataFrame({"Category": list(interp["fractions"].keys()),
                                "Fraction": [round(v, 4) for v in interp["fractions"].values()]})
        ic1, ic2 = st.columns([1, 1.1])
        with ic1:
            st.dataframe(frac_df, use_container_width=True, hide_index=True)
        with ic2:
            st.plotly_chart(px.bar(frac_df, x="Category", y="Fraction", title=interp["title"]).update_layout(height=300), use_container_width=True)
        st.markdown(f"<div class='blue-box'>{interp['note']}</div>", unsafe_allow_html=True)
    else:
        st.info("No property-specific interpretation rule for this name. Showing generic distribution QC and sill estimate only.")

    # ---- copyable tNavigator recommendation ----
    st.subheader("tNavigator recommendation (copyable)")
    rec_text = (
        f"Property: {prop}\n"
        f"Variogram type: Spherical\n"
        f"Statistical sill estimate: {sill:.6f}\n"
        f"Suggested nugget: {nugget:.6f}\n"
        f"Main range: {main_range:.0f} m (assumption)\n"
        f"Normal range: {normal_range:.0f} m (assumption)\n"
        f"Vertical range: {vertical_range:.0f} m (assumption)\n"
        f"Main azimuth: {main_azimuth:.0f} degrees\n"
        f"Note: Ranges are not calculated from this one-column property file."
    )
    st.code(rec_text, language="text")

    d1, d2 = st.columns(2)
    with d1:
        st.download_button("⬇️ Download property QC summary (CSV)", stats_df.to_csv(index=False).encode("utf-8"),
                           file_name=f"property_qc_{prop}.csv", mime="text/csv")
    with d2:
        st.download_button("⬇️ Download tNavigator recommendation (TXT)", rec_text.encode("utf-8"),
                           file_name=f"tnav_recommendation_{prop}.txt", mime="text/plain")


def discrete_property_qc(prop: str, series: pd.Series) -> None:
    st.markdown(
        "<div class='warn-box'><b>Lithology is categorical.</b> Use indicator variogram logic, not continuous "
        "variogram logic. Variance-based sill only applies after converting a class into a 0/1 indicator.</div>",
        unsafe_allow_html=True,
    )
    s = series.dropna()
    # represent numeric codes and text labels consistently as strings
    if pd.api.types.is_numeric_dtype(s):
        s = s.map(lambda v: str(int(v)) if float(v).is_integer() else str(v))
    else:
        s = s.astype(str).str.strip()

    if s.empty:
        st.error(f"No values found in '{prop}'.")
        return

    vc = s.value_counts()
    prop_df = pd.DataFrame({"Class": vc.index.astype(str), "Count": vc.to_numpy()})
    prop_df["Proportion"] = (prop_df["Count"] / prop_df["Count"].sum()).round(4)

    st.subheader(f"Class distribution — {prop}")
    cc1, cc2 = st.columns([1, 1])
    with cc1:
        st.dataframe(prop_df, use_container_width=True, hide_index=True)
        st.plotly_chart(px.bar(prop_df, x="Class", y="Count", title=f"Value counts — {prop}").update_layout(height=320), use_container_width=True)
    with cc2:
        st.plotly_chart(px.pie(prop_df, names="Class", values="Count", title=f"Proportions — {prop}").update_layout(height=360), use_container_width=True)

    st.subheader("Indicator variogram option")
    treat = st.checkbox("Treat as indicator (select a reservoir class)", key=f"ind_{prop}")
    rec_text = None
    summary_df = prop_df
    if treat:
        res_class = st.selectbox("Reservoir class", list(prop_df["Class"]), key=f"resclass_{prop}")
        indicator = (s.astype(str) == str(res_class)).astype(int)
        frac = float(indicator.mean())
        ind_var = float(indicator.var(ddof=1)) if len(indicator) > 1 else 0.0

        ic1, ic2, ic3 = st.columns(3)
        ic1.metric("Reservoir class", str(res_class))
        ic2.metric("Reservoir fraction", f"{frac:.4f}")
        ic3.metric("Indicator sill estimate", f"{ind_var:.6f}")

        st.markdown(
            "<div class='warn-box'>Indicator sill ≈ p·(1−p). Directional/vertical ranges still cannot be "
            "calculated from a one-column file and must be treated as assumptions.</div>",
            unsafe_allow_html=True,
        )

        rec_text = (
            f"Property: {prop} (indicator for class '{res_class}')\n"
            f"Variogram type: Spherical (indicator)\n"
            f"Reservoir fraction: {frac:.4f}\n"
            f"Indicator sill estimate: {ind_var:.6f}\n"
            f"Suggested nugget: {0.10 * ind_var:.6f}\n"
            f"Main range: 2200 m (assumption)\n"
            f"Normal range: 1000 m (assumption)\n"
            f"Vertical range: 50 m (assumption)\n"
            f"Main azimuth: 99 degrees\n"
            f"Note: Ranges are not calculated from this one-column lithology file."
        )
        st.subheader("tNavigator indicator recommendation (copyable)")
        st.code(rec_text, language="text")
        summary_df = prop_df.assign(reservoir_class=str(res_class), reservoir_fraction=round(frac, 4),
                                    indicator_sill=round(ind_var, 6))

    d1, d2 = st.columns(2)
    with d1:
        st.download_button("⬇️ Download class summary (CSV)", summary_df.to_csv(index=False).encode("utf-8"),
                           file_name=f"property_qc_{prop}_classes.csv", mime="text/csv")
    with d2:
        if rec_text:
            st.download_button("⬇️ Download indicator recommendation (TXT)", rec_text.encode("utf-8"),
                               file_name=f"tnav_indicator_{prop}.txt", mime="text/plain")


def property_only_qc_mode(df: pd.DataFrame, source_name: str) -> None:
    spatial = detect_spatial_columns(df)
    candidate_cols = [c for c in df.columns if c not in (spatial["x"], spatial["y"], spatial["z"], spatial["depth"])]
    if not candidate_cols:
        candidate_cols = list(df.columns)

    default_prop = candidate_cols[0]
    # prefer a column whose name matches the source/file name when available
    for c in candidate_cols:
        if str(c).lower() in str(source_name).lower():
            default_prop = c
            break
    prop = st.selectbox("Property column", candidate_cols, index=candidate_cols.index(default_prop))
    series = df[prop]

    default_kind = detect_property_kind(series, prop)
    kind = st.radio(
        "Property type",
        ["Continuous", "Discrete / categorical"],
        index=0 if default_kind == "continuous" else 1,
        horizontal=True,
        help="Auto-detected from the property name and values. Override if needed (e.g. force NTG to continuous).",
    )
    if kind == "Continuous":
        continuous_property_qc(prop, series)
    else:
        discrete_property_qc(prop, series)


def spatial_variogram_mode(df: pd.DataFrame, spatial: Dict[str, object]) -> None:
    if not spatial["has_3d"]:
        st.info(
            "Only a depth column was detected (no full X/Y/Z). Full directional variogram is not possible. "
            "A depth column alone supports vertical-trend QC; use Property-only QC for sill/nugget estimation, "
            "and export X/Y/Z blocked-well data for full directional ranges."
        )
        return

    st.success("Full X/Y/Z detected — experimental directional variogram is available.")
    cols = list(df.columns)
    numeric_cols = [c for c in cols if pd.api.types.is_numeric_dtype(df[c])]
    xcol, ycol, zcol = spatial["x"], spatial["y"], spatial["z"]

    with st.sidebar.expander("Variogram settings", expanded=True):
        p_candidates = [c for c in numeric_cols if c not in (xcol, ycol, zcol)] or cols
        pcol = st.selectbox("Property", p_candidates, index=p_candidates.index("Netpay") if "Netpay" in p_candidates else 0)
        property_type = st.radio("Property type", ["Continuous", "Binary / Netpay"], index=1 if str(pcol).lower() in ["netpay", "facies"] else 0)
        azimuth = st.number_input("Main azimuth (degree, 0=N, 90=E)", value=99.0, step=1.0)
        lag_size = st.number_input("Lag size (m)", value=200.0, min_value=1.0, step=50.0)
        max_range_h = st.number_input("Horizontal max range (m)", value=3500.0, min_value=100.0, step=100.0)
        max_range_v = st.number_input("Vertical max range (m)", value=900.0, min_value=10.0, step=50.0)
        max_perp = st.number_input("Directional bandwidth / lateral tolerance (m)", value=750.0, min_value=1.0, step=50.0)
        vertical_tol = st.number_input("Max vertical tolerance for horizontal directions (m)", value=250.0, min_value=1.0, step=25.0)
        min_pairs = st.number_input("Minimum pairs per bin", value=8, min_value=1, step=1)
        max_pairs = st.number_input("Maximum sampled pairs", value=90000, min_value=5000, step=5000)

    with st.expander("Spatial data preview", expanded=False):
        st.dataframe(df.head(300), use_container_width=True)
        fig_map = px.scatter(df.sample(min(len(df), 2000), random_state=1), x=xcol, y=ycol, color=pcol, hover_data=[zcol], title=f"Spatial distribution of {pcol}")
        fig_map.update_layout(height=430, yaxis=dict(scaleanchor="x", scaleratio=1))
        st.plotly_chart(fig_map, use_container_width=True)

    if st.button("🧠 Calculate variogram recommendation", type="primary"):
        try:
            dx, dy, dz, semivar, vals = _pair_arrays(df, xcol, ycol, zcol, pcol, int(max_pairs))
            directions = [
                ("Main", azimuth, max_range_h, max_perp, vertical_tol),
                ("Normal", azimuth + 90.0, max_range_h, max_perp, vertical_tol),
                ("Vertical", azimuth, max_range_v, max_perp, vertical_tol),
            ]
            all_params, exp_store = [], {}
            for direction, azi, maxr, bw, vt in directions:
                exp_df = experimental_variogram_direction(dx, dy, dz, semivar, "Vertical" if direction == "Vertical" else "Horizontal", azi, lag_size if direction != "Vertical" else max(10.0, lag_size / 5), maxr, bw, vt, int(min_pairs))
                params = estimate_variogram_params(exp_df, vals, property_type)
                all_params.append({
                    "Direction": direction,
                    "Azimuth_deg": azi % 180 if direction != "Vertical" else "Vertical",
                    "Range_m": params["Range"], "Sill": params["Sill"], "Nugget": params["Nugget"],
                    "Variance": params["Variance"], "Bins": params["Bins"], "Pairs": params["Pairs"],
                    "Confidence": params["Confidence"],
                })
                exp_store[direction] = (exp_df, params)
            st.session_state["vario_params_df"] = pd.DataFrame(all_params)
            st.session_state["vario_exp_store"] = exp_store
            st.session_state["vario_prop"] = pcol
            st.session_state["vario_property_type"] = property_type
            st.session_state["vario_azimuth"] = azimuth
        except Exception as e:
            st.error(f"Variogram calculation failed: {e}")

    if "vario_params_df" in st.session_state:
        params_df = st.session_state["vario_params_df"]
        exp_store = st.session_state.get("vario_exp_store", {})
        pcol_run = st.session_state.get("vario_prop", pcol)
        ptype_run = st.session_state.get("vario_property_type", property_type)
        azimuth_run = float(st.session_state.get("vario_azimuth", azimuth))

        st.subheader("Recommended tNavigator parameters (calculated from spatial data)")
        shown = params_df.copy()
        for c in ["Range_m", "Sill", "Nugget", "Variance"]:
            shown[c] = pd.to_numeric(shown[c], errors="coerce").round(4)
        st.dataframe(shown, use_container_width=True, hide_index=True)

        c1, c2, c3 = st.columns(3)
        with c1: st.plotly_chart(plot_variogram(*exp_store.get("Main"), title="Main Direction Variogram"), use_container_width=True)
        with c2: st.plotly_chart(plot_variogram(*exp_store.get("Normal"), title="Normal Direction Variogram"), use_container_width=True)
        with c3: st.plotly_chart(plot_variogram(*exp_store.get("Vertical"), title="Vertical Direction Variogram"), use_container_width=True)

        st.subheader("Interpretation Assistant")
        st.markdown(variogram_recommendation_text(pcol_run, params_df, ptype_run))

        main = params_df[params_df["Direction"] == "Main"].iloc[0]
        normal = params_df[params_df["Direction"] == "Normal"].iloc[0]
        vertical = params_df[params_df["Direction"] == "Vertical"].iloc[0]
        st.code(
            f"""Property: {pcol_run}
Variogram type: Spherical
Variance/Sill: {float(main['Sill']):.4f}
Nugget effect: {float(main['Nugget']):.4f}
Main range: {float(main['Range_m']):.1f} m (calculated)
Normal range: {float(normal['Range_m']):.1f} m (calculated)
Vertical range: {float(vertical['Range_m']):.1f} m (calculated)
Main azimuth: {azimuth_run:.1f} degrees
Note: Ranges are calculated from spatial X/Y/Z data.""",
            language="text",
        )
        st.download_button("Download variogram recommendation CSV", params_df.to_csv(index=False).encode("utf-8"), file_name=f"variogram_recommendation_{pcol_run}.csv")


def page_property_qc() -> None:
    st.title("📐 Property QC & Variogram Readiness")
    st.markdown("""
    <div class='blue-box'>
    This module performs <b>honest</b> property-distribution QC. From one-column tNavigator Blocked Wells Statistics
    (e.g. VSH, PHIE, NTG, Lithology) it estimates a statistical <b>sill</b> from sample variance and suggests a
    nugget range. It does <b>not</b> claim to calculate directional ranges unless real X/Y/Z or depth data are provided.
    </div>
    """, unsafe_allow_html=True)

    prop_tables = list_tables("property_qc_")
    spatial_tables = list_tables("vario_")
    all_tables = prop_tables + spatial_tables

    up = st.file_uploader("Upload a property file (.txt/.csv) for instant QC", type=["txt", "csv"], key="qc_upload")
    df: Optional[pd.DataFrame] = None
    source_name = "property"

    if up is not None:
        try:
            df = parse_property_upload(up)
            source_name = infer_property_name(up.name)
            st.success(f"Loaded {up.name}: {len(df):,} rows · columns: {', '.join(map(str, df.columns))}")
            if st.button("💾 Save this file to SQLite (property_qc_ prefix)"):
                table = save_df(f"property_qc_{up.name}", df)
                st.success(f"Saved as `{table}`.")
                st.rerun()
        except Exception as e:
            st.error(f"Could not parse {up.name}: {e}")
            return
    elif all_tables:
        selected = st.selectbox("Select a saved table", all_tables)
        df = read_table(selected)
        source_name = selected
    else:
        st.warning("No property or spatial table found. Upload a one-column tNavigator export above, or go to "
                   "Data Center → Property QC / Blocked Statistics.")
        return

    if df is None or df.empty:
        st.error("The selected/uploaded file contains no readable data.")
        return

    with st.expander("Data preview", expanded=False):
        st.dataframe(df.head(300), use_container_width=True)

    spatial = detect_spatial_columns(df)
    render_availability_status(df, spatial)

    mode2_available = bool(spatial["has_3d"] or spatial["has_depth"])
    if mode2_available:
        mode = st.radio("Analysis mode", ["Property-only QC", "Spatial variogram"], horizontal=True)
    else:
        mode = "Property-only QC"
        st.caption("Mode: Property-only QC (no spatial/depth columns detected).")

    st.divider()
    if mode == "Spatial variogram" and mode2_available:
        spatial_variogram_mode(df, spatial)
    else:
        property_only_qc_mode(df, source_name)


def page_field_map() -> None:
    st.title("🗺️ Field Boundary / Spatial View")
    tables = list_tables("boundary_")
    if not tables:
        st.warning("No boundary table. Upload PenobscotBoundary_1.txt or load sample data.")
        return
    selected = st.selectbox("Boundary table", tables)
    df = read_table(selected)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df["X"], y=df["Y"], mode="lines+markers", fill="toself", name="Penobscot Boundary"))
    fig.update_layout(title="Penobscot Boundary", xaxis_title="X", yaxis_title="Y", height=620, yaxis=dict(scaleanchor="x", scaleratio=1))
    st.plotly_chart(fig, use_container_width=True)


def page_development_plan() -> None:
    st.title("🚀 Future Development Plan")
    st.markdown("""
    <div class='blue-box'>
    <b>PEN-OPTIMA Development Concept:</b> a digital decision-support dashboard that integrates well-log interpretation, static model outputs, volumetric scenarios, variogram QC, zone–segment ranking, and future production surveillance.
    </div>
    """, unsafe_allow_html=True)
    c1, c2, c3 = st.columns(3)
    with c1:
        st.subheader("Phase 1")
        st.write("**Target:** Hor_C / Zone_1 / Segment 3")
        st.write("**Action:** appraisal-confirmed initial development")
        st.success("Most defensible first target")
    with c2:
        st.subheader("Phase 2")
        st.write("**Target:** Hor_C Segment 1–2")
        st.write("**Action:** lateral expansion after appraisal")
        st.info("Expand after continuity improves")
    with c3:
        st.subheader("Phase 3")
        st.write("**Target:** Hor_D / Zone_2 / Segment 2")
        st.write("**Action:** deep upside appraisal")
        st.warning("High-side upside, not immediate base case")

    st.subheader("Property QC & Variogram Readiness")
    st.markdown("""
    <div class='blue-box'>
    PEN-OPTIMA supports property-model QC by using exported one-column tNavigator statistics for distribution
    analysis and sill estimation. Full directional variogram recommendation requires additional X/Y/Z or depth
    data. This makes the workflow transparent and prevents overclaiming when raw spatial blocked-well data are
    unavailable.
    </div>
    """, unsafe_allow_html=True)
    st.code(
        """tNavigator Blocked Wells Statistics
  ↓ export one-column property: VSH, PHIE, NTG, Lithology
PEN-OPTIMA Property QC & Variogram Readiness
  ↓ distribution QC + statistical sill (sample variance) + nugget range
Recommended tNavigator input:
  - sill / variance        (calculated from the property)
  - nugget effect          (5% / 10% / 15% of sill)
  - main / normal / vertical range   (ASSUMPTION — needs X/Y/Z or depth)
  ↓ only if X/Y/Z or depth exported
Full directional/vertical experimental variogram (calculated ranges)
  ↓
Property Modeling QC → Volumetric Scenario Cockpit → Development Ranking""",
        language="text",
    )

# ============================================================
# Main routing
# ============================================================

st.sidebar.title("PEN-OPTIMA")
st.sidebar.caption("Penobscot Field Optimization")
menu = st.sidebar.radio(
    "Menu",
    [
        "🏠 Executive Dashboard",
        "📥 Data Center",
        "🪨 Well Logs",
        "📊 Volumetrics",
        "🧭 Zone–Segment Ranking",
        "📐 Property QC & Variogram Readiness",
        "🗺️ Field Map",
        "🚀 Development Plan",
    ],
)

if menu == "🏠 Executive Dashboard":
    page_home()
elif menu == "📥 Data Center":
    page_data_center()
elif menu == "🪨 Well Logs":
    page_well_logs()
elif menu == "📊 Volumetrics":
    page_volumetrics()
elif menu == "🧭 Zone–Segment Ranking":
    page_zone_segment()
elif menu == "📐 Property QC & Variogram Readiness":
    page_property_qc()
elif menu == "🗺️ Field Map":
    page_field_map()
elif menu == "🚀 Development Plan":
    page_development_plan()
