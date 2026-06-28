#!/usr/bin/env python3
"""Utility script to clear runtime data for the AI Hiring System.

This script will:
- call the application's `clear_all_data()` to wipe DB tables
- remove files inside dataset, sample_resumes and uploads directories

Run from the repository (or from `backend`) with: `python backend/scripts/clear_all_data.py`
"""
import argparse
import os
import shutil
import sys


def _add_backend_to_path():
    # ensure we can import app package from backend
    this_dir = os.path.dirname(__file__)
    backend_root = os.path.abspath(os.path.join(this_dir, os.pardir))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


def empty_dir_contents(target_dir: str):
    if not os.path.exists(target_dir):
        print(f"Skipping missing: {target_dir}")
        return 0
    removed = 0
    for name in os.listdir(target_dir):
        path = os.path.join(target_dir, name)
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            removed += 1
        except Exception as e:
            print(f"Failed to remove {path}: {e}")
    print(f"Cleared {removed} items from {target_dir}")
    return removed


def main(remove_db=False, remove_candidates_only=False):
    _add_backend_to_path()

    try:
        from app.db import clear_all_data, clear_candidate_data, BASE_DIR, DATA_DIR
    except Exception as e:
        print("Failed to import app.db. Ensure you run this from the repository root or backend folder.")
        raise

    if remove_candidates_only:
        print("Clearing candidate-only data...")
        try:
            res = clear_candidate_data()
            print("Candidate data cleared.")
        except Exception as e:
            print(f"Candidate clear failed: {e}")
    else:
        print("Wiping database tables...")
        try:
            res = clear_all_data()
            print("DB cleared.")
        except Exception as e:
            print(f"DB clear failed: {e}")

    # directories to clear
    targets = [
        os.path.join(DATA_DIR, "datasets"),
        os.path.join(DATA_DIR, "sample_resumes"),
        os.path.join(BASE_DIR, "uploads"),
    ]

    for t in targets:
        empty_dir_contents(t)

    if remove_db:
        db_file = os.path.join(DATA_DIR, "app.db")
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
                print(f"Removed DB file: {db_file}")
            except Exception as e:
                print(f"Failed to remove DB file: {e}")

    print("Done. Note: code and question files are not modified.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clear app data and files")
    parser.add_argument("--remove-db", action="store_true", help="Also remove the sqlite DB file (app.db)")
    parser.add_argument("--candidates-only", action="store_true", help="Clear only candidate-related data and files")
    args = parser.parse_args()
    main(remove_db=args.remove_db, remove_candidates_only=args.candidates_only)
