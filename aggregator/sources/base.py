"""Base class for all job source connectors."""

import logging
import random
import time
from abc import ABC, abstractmethod
from urllib.parse import urlparse

import requests

from aggregator.config.sources import SourceConfig

logger = logging.getLogger(__name__)

# HTTP defaults
DEFAULT_TIMEOUT = 30          # seconds per request
MAX_RETRIES = 3               # attempts for transient errors
RETRY_BACKOFF_BASE = 2.0      # seconds; doubles each retry
RATE_LIMIT_BACKOFF = 60.0     # seconds to wait after a 429
DOMAIN_THROTTLE_SECONDS = 0.4 # minimum delay between requests to same domain

# Realistic desktop browser user agents to bypass Cloudflare/CDN datacenter blocks
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
]

_last_domain_request_times: dict[str, float] = {}


def _throttle_domain(url: str, min_delay: float = DOMAIN_THROTTLE_SECONDS) -> None:
    """Ensure a safe delay between consecutive requests to the same domain."""
    try:
        domain = urlparse(url).netloc
        if not domain:
            return
        now = time.time()
        last = _last_domain_request_times.get(domain, 0.0)
        elapsed = now - last
        if elapsed < min_delay:
            time.sleep(min_delay - elapsed)
        _last_domain_request_times[domain] = time.time()
    except Exception:
        pass


def _calc_jittered_wait(attempt: int, base: float = RETRY_BACKOFF_BASE) -> float:
    """Calculate exponential backoff with full randomized jitter."""
    exp_wait = base ** attempt
    return round(random.uniform(exp_wait * 0.75, exp_wait * 1.5), 2)


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
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        })

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
        """Perform a GET request with timeout, retry, and rate-limit handling."""
        last_error: Exception | None = None

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                _throttle_domain(url)
                response = self.session.get(url, params=params, timeout=timeout)

                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    wait_s = float(retry_after) if retry_after and retry_after.isdigit() else RATE_LIMIT_BACKOFF
                    wait_s += random.uniform(1.0, 4.0)
                    logger.warning(
                        "[%s] Rate limited (429). Waiting %.1fs before one retry.",
                        self.config.name,
                        wait_s,
                    )
                    time.sleep(wait_s)
                    _throttle_domain(url)
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
                wait = _calc_jittered_wait(attempt)
                logger.warning(
                    "[%s] Attempt %d/%d failed (%s). Retrying in %.1fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    type(exc).__name__,
                    wait,
                )
                time.sleep(wait)

            except requests.HTTPError as exc:
                last_error = exc
                wait = _calc_jittered_wait(attempt)
                logger.warning(
                    "[%s] HTTP error on attempt %d/%d: %s. Retrying in %.1fs.",
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
                _throttle_domain(url)
                response = self.session.get(url, params=params, timeout=timeout)

                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    wait_s = float(retry_after) if retry_after and retry_after.isdigit() else RATE_LIMIT_BACKOFF
                    wait_s += random.uniform(1.0, 4.0)
                    logger.warning(
                        "[%s] Rate limited (429). Waiting %.1fs before one retry.",
                        self.config.name,
                        wait_s,
                    )
                    time.sleep(wait_s)
                    _throttle_domain(url)
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
                wait = _calc_jittered_wait(attempt)
                logger.warning(
                    "[%s] Attempt %d/%d failed (%s). Retrying in %.1fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    type(exc).__name__,
                    wait,
                )
                time.sleep(wait)

            except requests.HTTPError as exc:
                last_error = exc
                wait = _calc_jittered_wait(attempt)
                logger.warning(
                    "[%s] HTTP error on attempt %d/%d: %s. Retrying in %.1fs.",
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
                _throttle_domain(url)
                response = self.session.post(url, json=json_data, headers=headers, timeout=timeout)

                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    wait_s = float(retry_after) if retry_after and retry_after.isdigit() else RATE_LIMIT_BACKOFF
                    wait_s += random.uniform(1.0, 4.0)
                    logger.warning(
                        "[%s] Rate limited (429). Waiting %.1fs before one retry.",
                        self.config.name,
                        wait_s,
                    )
                    time.sleep(wait_s)
                    _throttle_domain(url)
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
                wait = _calc_jittered_wait(attempt)
                logger.warning(
                    "[%s] Attempt %d/%d failed (%s). Retrying in %.1fs.",
                    self.config.name,
                    attempt,
                    MAX_RETRIES,
                    type(exc).__name__,
                    wait,
                )
                time.sleep(wait)

            except requests.HTTPError as exc:
                last_error = exc
                wait = _calc_jittered_wait(attempt)
                logger.warning(
                    "[%s] HTTP error on attempt %d/%d: %s. Retrying in %.1fs.",
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

