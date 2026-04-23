from pathlib import Path

import pytest

from vamos_core import DataLoader

REPO_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = REPO_ROOT / "data"


@pytest.fixture(scope="session")
def loader() -> DataLoader:
    return DataLoader(DATA_DIR)
