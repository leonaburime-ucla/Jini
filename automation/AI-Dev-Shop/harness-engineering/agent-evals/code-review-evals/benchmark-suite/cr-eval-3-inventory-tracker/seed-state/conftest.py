"""Root conftest -- ensure src/ is importable."""
import sys
from pathlib import Path

# Add seed-state directory to sys.path so `from src.inventory_tracker import ...` works.
sys.path.insert(0, str(Path(__file__).resolve().parent))
