from bs4 import BeautifulSoup
import fitz
from ghostsync_runtime import SyncClient


def bootstrap() -> dict[str, object]:
    return {
        "html": BeautifulSoup("<p>ok</p>", "html.parser"),
        "pdf": fitz.open(),
        "sync": SyncClient(),
    }
