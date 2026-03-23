"""
Ensure NLTK stopwords are available before importing nltk.corpus.stopwords.

Render sets NLTK_DATA to /opt/render/nltk_data; build-time downloads may land
elsewhere or be missing. This runs at import time for the API and indexer.
"""
from __future__ import annotations

import os
import ssl


def ensure_stopwords() -> None:
    import nltk

    candidates: list[str] = []
    env_dir = os.environ.get("NLTK_DATA")
    if env_dir:
        candidates.append(env_dir)
    candidates.extend(
        [
            "/opt/render/nltk_data",
            os.path.join(os.path.expanduser("~"), "nltk_data"),
        ]
    )

    for d in candidates:
        if not d:
            continue
        try:
            os.makedirs(d, exist_ok=True)
        except OSError:
            continue
        if os.path.isdir(d) and d not in nltk.data.path:
            nltk.data.path.insert(0, d)

    try:
        from nltk.corpus import stopwords

        stopwords.words("english")
        return
    except LookupError:
        pass

    def _download() -> None:
        for d in list(nltk.data.path):
            if not d or not os.path.isdir(d):
                continue
            nltk.download("stopwords", download_dir=d, quiet=True)

    try:
        _download()
        from nltk.corpus import stopwords

        stopwords.words("english")
        return
    except Exception as first_err:
        last_err = first_err

    # Some environments (local dev) hit SSL issues when downloading corpora.
    prev = ssl._create_default_https_context
    try:
        ssl._create_default_https_context = ssl._create_unverified_context  # type: ignore[method-assign]
        _download()
        from nltk.corpus import stopwords

        stopwords.words("english")
        return
    except Exception as e:
        last_err = e
    finally:
        ssl._create_default_https_context = prev  # type: ignore[method-assign]

    raise RuntimeError(
        "NLTK stopwords corpus is missing and could not be downloaded. "
        "Set NLTK_DATA to a writable directory or run: nltk.download('stopwords')"
    ) from last_err
