"""Terminal-based IQR outlier detector with a Matplotlib box plot."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # Save charts without opening a GUI window.
import matplotlib.pyplot as plt
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"


def safe_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip()).strip("_")
    return cleaned or "numeric_column"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Detect potential outliers in one numeric CSV column using the 1.5 × IQR rule."
    )
    parser.add_argument(
        "csv_file", nargs="?", default="datasets/employee_salary.csv",
        help="Path to a CSV file (default: datasets/employee_salary.csv)."
    )
    parser.add_argument(
        "--column", "-c", default="Salary_INR",
        help="Numeric column to analyze (default: Salary_INR)."
    )
    parser.add_argument(
        "--output-dir", default="output",
        help="Folder for the plot and outlier CSV (default: output)."
    )
    args = parser.parse_args()

    csv_path = Path(args.csv_file)
    if not csv_path.is_absolute():
        csv_path = (Path.cwd() / csv_path).resolve()
    if not csv_path.exists() or not csv_path.is_file():
        print(f"ERROR: CSV file was not found: {csv_path}", file=sys.stderr)
        return 2

    try:
        data = pd.read_csv(csv_path)
    except Exception as exc:  # Show a useful error instead of a traceback for common CSV issues.
        print(f"ERROR: Could not read the CSV: {exc}", file=sys.stderr)
        return 2

    if data.empty:
        print("ERROR: The CSV contains headers but no data rows.", file=sys.stderr)
        return 2
    if args.column not in data.columns:
        numeric_candidates = list(data.select_dtypes(include="number").columns)
        print(f"ERROR: Column '{args.column}' was not found.", file=sys.stderr)
        print("Available columns: " + ", ".join(map(str, data.columns)))
        if numeric_candidates:
            print("Numeric columns detected: " + ", ".join(map(str, numeric_candidates)))
        print("Tip: pass the exact column name with --column \"Column_Name\".")
        return 2

    numeric = pd.to_numeric(data[args.column], errors="coerce")
    valid = numeric.dropna()
    if len(valid) < 2:
        print(f"ERROR: '{args.column}' needs at least two numeric values; found {len(valid)}.", file=sys.stderr)
        return 2

    q1 = float(valid.quantile(0.25))
    median = float(valid.quantile(0.50))
    q3 = float(valid.quantile(0.75))
    iqr = q3 - q1
    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr
    mask = (numeric < lower_fence) | (numeric > upper_fence)
    outliers = data.loc[mask].copy()
    outliers.insert(0, "CSV_Row", outliers.index + 2)  # Header occupies line 1.
    outliers[args.column] = numeric.loc[mask]

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = (Path.cwd() / output_dir).resolve()
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        chart_path = output_dir / f"boxplot_{safe_filename(args.column)}.png"
        outlier_path = output_dir / f"outliers_{safe_filename(args.column)}.csv"
        outliers.to_csv(outlier_path, index=False)

        fig, ax = plt.subplots(figsize=(7.6, 5.2), dpi=150)
        fig.patch.set_facecolor("#0b1219")
        ax.set_facecolor("#101c26")
        bp = ax.boxplot(
            valid.to_numpy(), vert=True, patch_artist=True, widths=0.38,
            showmeans=True, meanline=False,
            boxprops={"facecolor": "#c1fa68", "edgecolor": "#c1fa68", "alpha": 0.18, "linewidth": 2},
            medianprops={"color": "#ff836c", "linewidth": 2.5},
            whiskerprops={"color": "#6fe1d2", "linewidth": 1.7},
            capprops={"color": "#6fe1d2", "linewidth": 1.7},
            flierprops={"marker": "o", "markerfacecolor": "#ff836c", "markeredgecolor": "#ff836c", "markersize": 6, "alpha": 0.9},
            meanprops={"marker": "D", "markerfacecolor": "#6fe1d2", "markeredgecolor": "#6fe1d2", "markersize": 5},
        )
        ax.set_title(f"Box Plot — {args.column}", color="#edf4f6", fontsize=14, weight="bold", pad=16)
        ax.set_ylabel(args.column, color="#a6b7c1", labelpad=10)
        ax.set_xticks([1], [args.column])
        ax.tick_params(axis="both", colors="#a6b7c1", labelsize=9)
        ax.grid(axis="y", color="#263746", linewidth=0.8, alpha=0.8)
        for spine in ax.spines.values():
            spine.set_color("#263746")
        ax.text(
            0.98, 0.98,
            f"n = {len(valid)}\nOutliers = {int(mask.sum())}\nIQR = {iqr:,.2f}",
            transform=ax.transAxes, ha="right", va="top", fontsize=9, color="#c1fa68",
            bbox={"boxstyle": "round,pad=0.5", "facecolor": "#14212a", "edgecolor": "#344550", "alpha": 0.95},
        )
        fig.tight_layout()
        fig.savefig(chart_path, facecolor=fig.get_facecolor(), bbox_inches="tight")
        plt.close(fig)
    except Exception as exc:
        print(f"ERROR: Could not save results: {exc}", file=sys.stderr)
        return 2

    print("\n" + "=" * 62)
    print("SPECTRA | OUTLIER DETECTION REPORT")
    print("=" * 62)
    print(f"Dataset           : {csv_path.name}")
    print(f"Rows in dataset   : {len(data)}")
    print(f"Column analyzed   : {args.column}")
    print(f"Numeric values    : {len(valid)}")
    print(f"Missing/non-numeric: {len(data) - len(valid)}")
    print("-" * 62)
    print(f"Q1                : {q1:,.2f}")
    print(f"Median            : {median:,.2f}")
    print(f"Q3                : {q3:,.2f}")
    print(f"IQR               : {iqr:,.2f}")
    print(f"Lower fence       : {lower_fence:,.2f}")
    print(f"Upper fence       : {upper_fence:,.2f}")
    print(f"Potential outliers: {int(mask.sum())}")
    print("-" * 62)
    if outliers.empty:
        print("No values fall outside the IQR fences.")
    else:
        for _, row in outliers.iterrows():
            csv_row = int(row["CSV_Row"])
            value = row[args.column]
            side = "below lower fence" if value < lower_fence else "above upper fence"
            print(f"CSV row {csv_row:<5} | {args.column} = {value:,.2f} | {side}")
    print("-" * 62)
    print(f"Box plot saved    : {chart_path}")
    print(f"Outlier CSV saved : {outlier_path}")
    print("Reminder: investigate flagged records; do not remove them automatically.")
    print("=" * 62 + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
