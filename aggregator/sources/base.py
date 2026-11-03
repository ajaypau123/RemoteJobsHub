"""Base class for all job source connectors."""

import logging
import time
from abc import ABC, abstractmethod

import requests

from aggregator.config.sources import SourceConfig

logger = logging.getLogger(__name__)

# HTTP defaults
DEFAULT_TIMEOUT = 30          # seconds per request
MAX_RETRIES = 3               # attempts for transient errors
RETRY_BACKOFF_BASE = 2.0      # seconds; doubles each retry
RATE_LIMIT_BACKOFF = 60.0     # seconds to wait after a 429


class SourceError(Exception):
    """Raised when a source connector encounters an unrecoverable error."""


class BaseJobSource(ABC):
    """Abstract base class that all source connectors must implement.

    Adding a new source:
      1. Create a new module in aggregator/sources/
      2. Subclass BaseJobSource
      3. Implement collect_jobs()
      4. Add a SourceConfig entry in aggregator/config/sources.py
      5. Register the connector in aggregator/main.py

    No changes to the core pipeline (normalizer / validator / deduplicator)
    are required.
    """

    def __init__(self, config: SourceConfig) -> None:
        self.config = config
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    # ──────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────

    @abstractmethod
    def collect_jobs(self) -> list[dict]:
        """Collect raw job records from this source.

        Returns a list of raw dicts as returned by the API.  The records
        are later passed through the common normalizer.
        """

    # ──────────────────────────────────────────────────────────────────────
    # Shared HTTP helper
    # ──────────────────────────────────────────────────────────────────────

    def _get(
        self,
        url: str,
        params: dict | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> dict | list:
        """Perform a GET request with timeout, retry, and rate-limit handling.

        Retries on:
          - Connection / timeout errors
          - HTTP 5xx (server-side transient errors)

        Does NOT retry on:
          - HTTP 4xx (client errors — bad credentials, not found, etc.)
          - HTTP 429 (rate limited) — backs off once then raises SourceError

        Returns the parsed JSON body.
        """
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.session.get(url, params=params, timeout=timeout)

                if response.status_code == 429:
                    logger.warning(
                        "[%s] Rate limited (429). Waiting %.0fs before one retry.",
                        self.config.name,
                        RATE_LIMIT_BACKOFF,
                    )
                    time.sleep(RATE_LIMIT_BACKOFF)
                    # One final attempt after back-off
                    response = self.session.get(url, params=params, timeout=timeout)
                    if response.status_code == 429:
                        raise SourceError(
                            f"[{self.config.name}] Still rate limited after back-off. "
                            "Skipping source to respect API limits."
                        )

                if 400 <= response.status_code < 500:
                    raise SourceError(
                        f"[{self.config.name}] HTTP {response.status_code} "
                        f"for {url!r}. Check credentials / URL."
                    )

                response.raise_for_status()
                return response.json()

            except SourceError:
                raise  # propagate immediately — do not retry client errors

            except (requests.ConnectionError, requests.Timeout) as exc:
                last_error = exc
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "[%s] Attempt %d/%d failed (%s). Retrying in %.0fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    type(exc).__name__,
                    wait,
                )
                time.sleep(wait)

            except requests.HTTPError as exc:
                last_error = exc
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "[%s] HTTP error on attempt %d/%d: %s. Retrying in %.0fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    exc,
                    wait,
                )
                time.sleep(wait)

        raise SourceError(
            f"[{self.config.name}] Failed after {MAX_RETRIES} attempts: {last_error}"
        )

    def _get_text(
        self,
        url: str,
        params: dict | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> str:
        """Perform a GET request and return the raw response text (for RSS/XML)."""
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.session.get(url, params=params, timeout=timeout)

                if response.status_code == 429:
                    logger.warning(
                        "[%s] Rate limited (429). Waiting %.0fs before one retry.",
                        self.config.name,
                        RATE_LIMIT_BACKOFF,
                    )
                    time.sleep(RATE_LIMIT_BACKOFF)
                    response = self.session.get(url, params=params, timeout=timeout)
                    if response.status_code == 429:
                        raise SourceError(
                            f"[{self.config.name}] Still rate limited after back-off."
                        )

                if 400 <= response.status_code < 500:
                    raise SourceError(
                        f"[{self.config.name}] HTTP {response.status_code} for {url!r}."
                    )

                response.raise_for_status()
                return response.text

            except SourceError:
                raise

            except (requests.ConnectionError, requests.Timeout) as exc:
                last_error = exc
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "[%s] Attempt %d/%d failed (%s). Retrying in %.0fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    type(exc).__name__,
                    wait,
                )
                time.sleep(wait)

            except requests.HTTPError as exc:
                last_error = exc
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "[%s] HTTP error on attempt %d/%d: %s. Retrying in %.0fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    exc,
                    wait,
                )
                time.sleep(wait)

        raise SourceError(
            f"[{self.config.name}] Failed after {MAX_RETRIES} attempts: {last_error}"
        )

    def _post(
        self,
        url: str,
        json_data: dict | list | None = None,
        headers: dict | None = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> dict | list:
        """Perform a POST request with timeout, retry, and rate-limit handling."""
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = self.session.post(url, json=json_data, headers=headers, timeout=timeout)

                if response.status_code == 429:
                    logger.warning(
                        "[%s] Rate limited (429). Waiting %.0fs before one retry.",
                        self.config.name,
                        RATE_LIMIT_BACKOFF,
                    )
                    time.sleep(RATE_LIMIT_BACKOFF)
                    response = self.session.post(url, json=json_data, headers=headers, timeout=timeout)
                    if response.status_code == 429:
                        raise SourceError(
                            f"[{self.config.name}] Still rate limited after back-off."
                        )

                if 400 <= response.status_code < 500:
                    raise SourceError(
                        f"[{self.config.name}] HTTP {response.status_code} for {url!r}."
                    )

                response.raise_for_status()
                return response.json()

            except SourceError:
                raise

            except (requests.ConnectionError, requests.Timeout) as exc:
                last_error = exc
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "[%s] Attempt %d/%d failed (%s). Retrying in %.0fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    type(exc).__name__,
                    wait,
                )
                time.sleep(wait)

            except requests.HTTPError as exc:
                last_error = exc
                wait = RETRY_BACKOFF_BASE ** attempt
                logger.warning(
                    "[%s] HTTP error on attempt %d/%d: %s. Retrying in %.0fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    exc,
                    wait,
                )
                time.sleep(wait)

        raise SourceError(
            f"[{self.config.name}] Failed after {MAX_RETRIES} attempts: {last_error}"
        )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<{type(self).__name__} source={self.config.name!r}>"

