import yaml
from PIL import Image
from sklearn.feature_extraction.text import TfidfVectorizer
from litellm_proxy_sdk import Client
from ghostsync_runtime import SyncClient


def bootstrap_service() -> dict[str, object]:
    return {
        "yaml": yaml.safe_load("feature: true"),
        "image": Image.new("RGB", (1, 1)),
        "vectorizer": TfidfVectorizer(),
        "client": Client(),
        "sync": SyncClient(),
    }
