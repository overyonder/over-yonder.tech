#!/usr/bin/env python3
"""Audit the deployed Over Yonder sites against their shared SEO contract."""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable


USER_AGENT = "over-yonder-seo-audit/1.0 (+https://over-yonder.tech/)"
MAX_BODY_BYTES = 12 * 1024 * 1024
DEFAULT_TIMEOUT = 20.0
HTML_TYPES = ("text/html", "application/xhtml+xml")
IMAGE_TYPES = ("image/",)


@dataclass(frozen=True)
class Response:
    requested_url: str
    final_url: str
    status: int
    headers: dict[str, str]
    body: bytes

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").split(";", 1)[0].strip().lower()


@dataclass
class Finding:
    level: str
    site: str
    subject: str
    message: str


@dataclass
class PageData:
    lang: str = ""
    charset: str = ""
    titles: list[str] = field(default_factory=list)
    descriptions: list[str] = field(default_factory=list)
    canonicals: list[str] = field(default_factory=list)
    h1s: list[str] = field(default_factory=list)
    ids: set[str] = field(default_factory=set)
    links: list[str] = field(default_factory=list)
    icons: list[str] = field(default_factory=list)
    meta: dict[str, list[str]] = field(default_factory=dict)
    json_ld: list[str] = field(default_factory=list)


class SEOHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.data = PageData()
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._script_type = ""
        self._svg_depth = 0

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key.lower(): (value or "").strip() for key, value in attrs}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        values = self._attrs(attrs)
        if tag == "svg":
            self._svg_depth += 1
        element_id = values.get("id")
        if element_id:
            self.data.ids.add(element_id)

        if tag == "html":
            self.data.lang = values.get("lang", "")
        elif tag == "meta":
            if values.get("charset"):
                self.data.charset = values["charset"]
            key = (values.get("name") or values.get("property") or "").lower()
            content = values.get("content", "")
            if key:
                self.data.meta.setdefault(key, []).append(content)
            if key == "description":
                self.data.descriptions.append(content)
            if values.get("http-equiv", "").lower() == "content-type" and not self.data.charset:
                match = re.search(r"charset=([^;\s]+)", content, re.I)
                if match:
                    self.data.charset = match.group(1)
        elif tag == "link":
            rels = {part.lower() for part in values.get("rel", "").split()}
            href = values.get("href", "")
            if "canonical" in rels:
                self.data.canonicals.append(href)
            if rels.intersection({"icon", "shortcut", "apple-touch-icon"}) and href:
                self.data.icons.append(href)
        elif tag == "a" and values.get("href"):
            self.data.links.append(values["href"])

        if tag == "title" and self._svg_depth == 0:
            self._capture = tag
            self._buffer = []
        elif tag == "h1":
            self._capture = tag
            self._buffer = []
        elif tag == "script" and values.get("type", "").lower() == "application/ld+json":
            self._capture = "json-ld"
            self._script_type = values["type"]
            self._buffer = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._capture == tag and tag in {"title", "h1"}:
            value = " ".join("".join(self._buffer).split())
            (self.data.titles if tag == "title" else self.data.h1s).append(value)
            self._capture = None
            self._buffer = []
        elif self._capture == "json-ld" and tag == "script":
            self.data.json_ld.append("".join(self._buffer).strip())
            self._capture = None
            self._script_type = ""
            self._buffer = []
        if tag == "svg" and self._svg_depth:
            self._svg_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        return None


class Auditor:
    def __init__(self, timeout: float, github_annotations: bool) -> None:
        self.timeout = timeout
        self.github_annotations = github_annotations
        self.findings: list[Finding] = []
        self.cache: dict[tuple[str, bool], Response] = {}
        self.following_opener = urllib.request.build_opener()
        self.direct_opener = urllib.request.build_opener(NoRedirect)
        self.known_hosts: set[str] = set()
        self.pages: dict[str, PageData] = {}

    def finding(self, level: str, site: str, subject: str, message: str) -> None:
        self.findings.append(Finding(level, site, subject, message))

    def fetch(self, url: str, follow_redirects: bool = True) -> Response:
        key = (url, follow_redirects)
        if key in self.cache:
            return self.cache[key]
        request = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xml,text/plain,*/*;q=0.8"},
        )
        opener = self.following_opener if follow_redirects else self.direct_opener
        try:
            with opener.open(request, timeout=self.timeout) as raw:
                body = raw.read(MAX_BODY_BYTES + 1)
                if len(body) > MAX_BODY_BYTES:
                    raise ValueError(f"response exceeds {MAX_BODY_BYTES} bytes")
                response = Response(
                    url,
                    raw.geturl(),
                    raw.status,
                    {key.lower(): value for key, value in raw.headers.items()},
                    body,
                )
        except urllib.error.HTTPError as error:
            body = error.read(MAX_BODY_BYTES + 1)
            response = Response(
                url,
                error.geturl(),
                error.code,
                {key.lower(): value for key, value in error.headers.items()},
                body,
            )
        self.cache[key] = response
        return response

    @staticmethod
    def canonical_page_url(base_url: str, path: str) -> str:
        return urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/")) if path != "/" else base_url.rstrip("/") + "/"

    @staticmethod
    def parse_html(body: bytes) -> PageData:
        parser = SEOHTMLParser()
        parser.feed(body.decode("utf-8", errors="replace"))
        return parser.data

    @staticmethod
    def schema_types(documents: Iterable[str]) -> set[str]:
        found: set[str] = set()

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                type_value = value.get("@type")
                if isinstance(type_value, str):
                    found.add(type_value)
                elif isinstance(type_value, list):
                    found.update(item for item in type_value if isinstance(item, str))
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        for document in documents:
            try:
                visit(json.loads(document))
            except json.JSONDecodeError:
                found.add("__INVALID_JSON__")
        return found

    def check_asset(self, site: str, page_url: str, label: str, href: str, image: bool = False) -> None:
        asset_url = urllib.parse.urljoin(page_url, href)
        parsed = urllib.parse.urlsplit(asset_url)
        if parsed.scheme != "https":
            self.finding("error", site, page_url, f"{label} must use HTTPS: {asset_url}")
            return
        try:
            response = self.fetch(asset_url)
        except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
            self.finding("error", site, page_url, f"{label} could not be fetched: {asset_url} ({error})")
            return
        if response.status != 200:
            self.finding("error", site, page_url, f"{label} returned HTTP {response.status}: {asset_url}")
        elif image and not response.content_type.startswith(IMAGE_TYPES):
            self.finding("error", site, page_url, f"{label} is not served as an image: {asset_url}")

    def check_page(self, site: dict[str, Any], page: dict[str, Any]) -> None:
        name = site["name"]
        url = self.canonical_page_url(site["base_url"], page["path"])
        try:
            response = self.fetch(url)
        except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
            self.finding("error", name, url, f"page could not be fetched: {error}")
            return

        if response.status != 200:
            self.finding("error", name, url, f"expected HTTP 200, received {response.status}")
            return
        if response.final_url != url:
            self.finding("error", name, url, f"canonical page redirects to {response.final_url}")
        if response.content_type not in HTML_TYPES:
            self.finding("error", name, url, f"unexpected content type {response.content_type or '(missing)'}")
            return
        if "noindex" in response.headers.get("x-robots-tag", "").lower():
            self.finding("error", name, url, "indexable page sends X-Robots-Tag: noindex")

        data = self.parse_html(response.body)
        self.pages[url] = data
        if data.lang.lower() != "en":
            self.finding("error", name, url, f"expected <html lang=\"en\">, found {data.lang or '(missing)'}")
        if data.charset.lower().replace("-", "") != "utf8":
            self.finding("error", name, url, f"expected UTF-8 charset declaration, found {data.charset or '(missing)'}")
        if len(data.titles) != 1 or not data.titles[0]:
            self.finding("error", name, url, f"expected one non-empty <title>, found {len(data.titles)}")
        else:
            length = len(data.titles[0])
            if length < 15 or length > 65:
                self.finding("warning", name, url, f"title length is {length} characters; review its search-result presentation")
        if len(data.descriptions) != 1 or not data.descriptions[0]:
            self.finding("error", name, url, f"expected one non-empty meta description, found {len(data.descriptions)}")
        else:
            length = len(data.descriptions[0])
            if length < 70 or length > 170:
                self.finding("warning", name, url, f"description length is {length} characters; review its search-result presentation")
        if data.canonicals != [url]:
            self.finding("error", name, url, f"expected one canonical equal to {url}, found {data.canonicals or '(missing)'}")
        if len(data.h1s) != 1 or not data.h1s[0]:
            self.finding("error", name, url, f"expected one non-empty H1, found {len(data.h1s)}")
        if len(data.meta.get("viewport", [])) != 1:
            self.finding("error", name, url, "expected one viewport meta tag")
        robots = ",".join(data.meta.get("robots", [])).lower()
        if "noindex" in robots:
            self.finding("error", name, url, "indexable page contains meta robots noindex")

        required_meta = {
            "og:title": data.titles[0] if len(data.titles) == 1 else None,
            "og:description": data.descriptions[0] if len(data.descriptions) == 1 else None,
            "og:url": url,
            "og:type": None,
            "og:image": None,
            "twitter:card": None,
        }
        for key, expected in required_meta.items():
            values = [value for value in data.meta.get(key, []) if value]
            if len(values) != 1:
                self.finding("error", name, url, f"expected one non-empty {key} value, found {len(values)}")
            elif expected is not None and values[0] != expected:
                self.finding("error", name, url, f"{key} should match {expected!r}, found {values[0]!r}")
        if data.meta.get("og:image"):
            self.check_asset(name, url, "Open Graph image", data.meta["og:image"][0], image=True)
        if not data.icons:
            self.finding("error", name, url, "no favicon or touch icon is declared")
        else:
            self.check_asset(name, url, "icon", data.icons[0], image=True)

        types = self.schema_types(data.json_ld)
        if "__INVALID_JSON__" in types:
            self.finding("error", name, url, "JSON-LD contains invalid JSON")
        required_types = set(page.get("schema", []))
        missing_types = sorted(required_types - types)
        if missing_types:
            self.finding("error", name, url, f"missing JSON-LD type(s): {', '.join(missing_types)}")

    def check_http_redirect(self, site: dict[str, Any]) -> None:
        base = urllib.parse.urlsplit(site["base_url"])
        http_url = urllib.parse.urlunsplit(("http", base.netloc, "/", "", ""))
        expected = site["base_url"].rstrip("/") + "/"
        try:
            response = self.fetch(http_url, follow_redirects=False)
        except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
            self.finding("error", site["name"], http_url, f"HTTP endpoint could not be fetched: {error}")
            return
        location = urllib.parse.urljoin(http_url, response.headers.get("location", ""))
        if response.status not in {301, 308} or location != expected:
            self.finding("error", site["name"], http_url, f"expected permanent redirect to {expected}; received HTTP {response.status} -> {location or '(no location)'}")

    def check_robots(self, site: dict[str, Any]) -> None:
        name = site["name"]
        url = site["base_url"].rstrip("/") + "/robots.txt"
        expected_sitemap = site["base_url"].rstrip("/") + "/sitemap.xml"
        try:
            response = self.fetch(url)
        except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
            self.finding("error", name, url, f"robots.txt could not be fetched: {error}")
            return
        if response.status != 200 or response.content_type != "text/plain":
            self.finding("error", name, url, f"expected HTTP 200 text/plain, received {response.status} {response.content_type}")
            return
        text = response.body.decode("utf-8", errors="replace")
        blocks = re.split(r"\n\s*\n", text)
        wildcard_blocked = any(
            re.search(r"(?im)^user-agent:\s*\*\s*$", block)
            and re.search(r"(?im)^disallow:\s*/\s*$", block)
            for block in blocks
        )
        if wildcard_blocked:
            self.finding("error", name, url, "robots.txt blocks all search crawling")
        sitemap_values = re.findall(r"(?im)^sitemap:\s*(\S+)\s*$", text)
        if expected_sitemap not in sitemap_values:
            self.finding("error", name, url, f"robots.txt does not declare {expected_sitemap}")

    def check_sitemap(self, site: dict[str, Any]) -> None:
        name = site["name"]
        url = site["base_url"].rstrip("/") + "/sitemap.xml"
        expected = {self.canonical_page_url(site["base_url"], page["path"]) for page in site["pages"]}
        try:
            response = self.fetch(url)
        except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
            self.finding("error", name, url, f"sitemap could not be fetched: {error}")
            return
        if response.status != 200 or response.content_type not in {"application/xml", "text/xml"}:
            self.finding("error", name, url, f"expected HTTP 200 XML, received {response.status} {response.content_type}")
            return
        if not response.body.strip():
            self.finding("error", name, url, "sitemap is empty")
            return
        try:
            root = ET.fromstring(response.body)
        except ET.ParseError as error:
            self.finding("error", name, url, f"sitemap XML is invalid: {error}")
            return
        locations = {element.text.strip() for element in root.iter() if element.tag.rsplit("}", 1)[-1] == "loc" and element.text}
        missing = sorted(expected - locations)
        unexpected = sorted(locations - expected)
        if missing:
            self.finding("error", name, url, f"sitemap omits configured page(s): {', '.join(missing)}")
        if unexpected:
            self.finding("error", name, url, f"sitemap includes unconfigured page(s): {', '.join(unexpected)}")

    def check_excluded(self, site: dict[str, Any]) -> None:
        for path in site.get("excluded", []):
            url = self.canonical_page_url(site["base_url"], path)
            try:
                response = self.fetch(url)
            except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
                self.finding("warning", site["name"], url, f"excluded URL could not be checked: {error}")
                continue
            if response.status in {404, 410}:
                continue
            header_noindex = "noindex" in response.headers.get("x-robots-tag", "").lower()
            meta_noindex = False
            if response.status == 200 and response.content_type in HTML_TYPES:
                data = self.parse_html(response.body)
                meta_noindex = "noindex" in ",".join(data.meta.get("robots", [])).lower()
            if not (header_noindex or meta_noindex):
                self.finding("error", site["name"], url, f"excluded URL is indexable (HTTP {response.status})")

    def check_links(self) -> None:
        checked: set[str] = set()
        for page_url, data in self.pages.items():
            site_name = urllib.parse.urlsplit(page_url).netloc
            for href in data.links:
                if not href or href.startswith(("mailto:", "tel:", "javascript:", "data:")):
                    continue
                target = urllib.parse.urljoin(page_url, href)
                parsed = urllib.parse.urlsplit(target)
                if parsed.scheme not in {"http", "https"} or parsed.netloc not in self.known_hosts:
                    continue
                if parsed.path.startswith("/cdn-cgi/"):
                    continue
                if parsed.scheme == "http":
                    self.finding("error", site_name, page_url, f"internal link uses HTTP: {target}")
                fetch_url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, ""))
                if fetch_url in checked:
                    continue
                checked.add(fetch_url)
                try:
                    response = self.fetch(fetch_url)
                except (urllib.error.URLError, TimeoutError, socket.timeout, ValueError) as error:
                    self.finding("error", site_name, page_url, f"connected-site link failed: {target} ({error})")
                    continue
                if response.status < 200 or response.status >= 400:
                    self.finding("error", site_name, page_url, f"connected-site link returned HTTP {response.status}: {target}")

    def check_duplicates(self, sites: list[dict[str, Any]]) -> None:
        for site in sites:
            urls = [self.canonical_page_url(site["base_url"], page["path"]) for page in site["pages"]]
            for label, values in (
                ("title", [(url, self.pages[url].titles[0]) for url in urls if url in self.pages and len(self.pages[url].titles) == 1]),
                ("description", [(url, self.pages[url].descriptions[0]) for url in urls if url in self.pages and len(self.pages[url].descriptions) == 1]),
            ):
                counts = Counter(value for _, value in values if value)
                for url, value in values:
                    if value and counts[value] > 1:
                        self.finding("error", site["name"], url, f"duplicate {label}: {value!r}")

    def audit(self, config: dict[str, Any]) -> int:
        sites = config.get("sites")
        if not isinstance(sites, list) or not sites:
            raise ValueError("configuration must contain a non-empty sites array")
        self.known_hosts = {urllib.parse.urlsplit(site["base_url"]).netloc for site in sites}
        for site in sites:
            for page in site["pages"]:
                self.check_page(site, page)
            self.check_http_redirect(site)
            self.check_robots(site)
            self.check_sitemap(site)
            self.check_excluded(site)
        self.check_duplicates(sites)
        self.check_links()
        return self.report(sites)

    def report(self, sites: list[dict[str, Any]]) -> int:
        errors = sum(finding.level == "error" for finding in self.findings)
        warnings = sum(finding.level == "warning" for finding in self.findings)
        summary_rows: list[tuple[str, int, int]] = []
        for site in sites:
            site_findings = [finding for finding in self.findings if finding.site == site["name"] or finding.site == urllib.parse.urlsplit(site["base_url"]).netloc]
            site_errors = sum(finding.level == "error" for finding in site_findings)
            site_warnings = sum(finding.level == "warning" for finding in site_findings)
            summary_rows.append((site["name"], site_errors, site_warnings))
            print(f"\n{site['name']}")
            print("-" * len(site["name"]))
            if not site_findings:
                print("PASS")
            for finding in site_findings:
                marker = "ERROR" if finding.level == "error" else "WARN"
                print(f"{marker} {finding.subject}: {finding.message}")
                if self.github_annotations:
                    annotation = "error" if finding.level == "error" else "warning"
                    message = f"{finding.site}: {finding.subject}: {finding.message}"
                    escaped = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
                    print(f"::{annotation}::{escaped}")
        print(f"\nSEO audit: {errors} error(s), {warnings} warning(s), {len(self.pages)} page(s) parsed")
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a", encoding="utf-8") as summary:
                summary.write("# SEO audit\n\n")
                summary.write("| Site | Errors | Warnings |\n|---|---:|---:|\n")
                for name, site_errors, site_warnings in summary_rows:
                    summary.write(f"| {name} | {site_errors} | {site_warnings} |\n")
                summary.write(f"\nParsed {len(self.pages)} configured page(s).\n")
        return 1 if errors else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        type=Path,
        default=Path(__file__).with_name("seo-sites.json"),
        help="site inventory JSON (default: tools/seo-sites.json)",
    )
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="per-request timeout in seconds")
    parser.add_argument(
        "--github-annotations",
        action="store_true",
        default=os.environ.get("GITHUB_ACTIONS") == "true",
        help="emit GitHub Actions error and warning annotations",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        return Auditor(args.timeout, args.github_annotations).audit(config)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"seo audit configuration error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
