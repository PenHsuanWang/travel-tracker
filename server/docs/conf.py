"""Sphinx configuration for the Travel Tracker backend."""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend source to the path for ``autodoc`` using a robust method.
SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

project = "Travel Tracker Backend"
author = "PenHsuan Wang"
release = os.getenv("BACKEND_VERSION", "0.1.0")

# See https://www.sphinx-doc.org/en/master/usage/extensions/index.html
extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.autosummary",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
    "sphinx.ext.intersphinx",
    "sphinx_autodoc_typehints",
    "sphinx_rtd_theme",
]

# Add any paths that contain templates here, relative to this directory.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.
# See https://www.sphinx-doc.org/en/master/usage/theming.html
html_theme = "sphinx_rtd_theme"
html_static_path = ["_static"]

# -- Extension options -------------------------------------------------------

autosummary_generate = True
autodoc_member_order = "bysource"

# Use Google-style docstrings.
napoleon_google_docstring = True
napoleon_numpy_docstring = False
napoleon_attr_annotations = True

autodoc_typehints = "description"

# Mock heavy dependencies to speed up build and avoid installation issues.
autodoc_mock_imports = [
    "gpx_track_analyzer", # from git
]


intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
}


rst_epilog = f"\n.. |year| replace:: {datetime.utcnow().year}\n"
