"""Tests for source configuration."""

import pytest
from aggregator.config.sources import SOURCES, SOURCES_BY_NAME, KNOWN_SOURCE_NAMES, SourceConfig


class TestSourceConfig:
    def test_all_sources_have_required_fields(self):
        for src in SOURCES:
            assert src.name, "Source must have a name"
            assert src.api_url, f"{src.name}: api_url is required"
            assert src.permission_status in (
                "APPROVED", "REVIEW_REQUIRED", "DENIED"
            ), f"{src.name}: invalid permission_status"
            assert src.terms_url, f"{src.name}: terms_url is required"

    def test_only_approved_and_enabled_pass_filter(self):
        usable = [s for s in SOURCES if s.is_usable()]
        for src in usable:
            assert src.permission_status == "APPROVED"
            assert src.enabled is True

    def test_review_required_is_not_usable(self):
        src = SourceConfig(
            name="Test",
            api_url="https://example.com",
            permission_status="REVIEW_REQUIRED",
            enabled=True,
            notes="",
            terms_url="https://example.com/terms",
            requires_api_key=False,
        )
        assert not src.is_usable()

    def test_disabled_approved_is_not_usable(self):
        src = SourceConfig(
            name="Test",
            api_url="https://example.com",
            permission_status="APPROVED",
            enabled=False,
            notes="",
            terms_url="https://example.com/terms",
            requires_api_key=False,
        )
        assert not src.is_usable()

    def test_approved_enabled_is_usable(self):
        src = SourceConfig(
            name="Test",
            api_url="https://example.com",
            permission_status="APPROVED",
            enabled=True,
            notes="",
            terms_url="https://example.com/terms",
            requires_api_key=False,
        )
        assert src.is_usable()

    def test_sources_by_name_lookup(self):
        for name, src in SOURCES_BY_NAME.items():
            assert src.name == name

    def test_known_source_names_matches_sources(self):
        assert KNOWN_SOURCE_NAMES == {s.name for s in SOURCES}

    def test_arbeitnow_is_review_required_and_disabled(self):
        """Arbeitnow must stay disabled pending commercial terms clarification."""
        src = SOURCES_BY_NAME.get("Arbeitnow")
        assert src is not None, "Arbeitnow must be in registry"
        assert src.permission_status == "REVIEW_REQUIRED"
        assert src.enabled is False

    def test_free_sources_require_no_api_key(self):
        no_key_sources = {"Remotive", "Jobicy", "Himalayas"}
        for name in no_key_sources:
            src = SOURCES_BY_NAME.get(name)
            if src:
                assert not src.requires_api_key, f"{name} should not require an API key"
