"""Best-effort image variant generator for thumbnails and previews.

This service is feature-flagged via the IMAGE_VARIANTS_ENABLED env var and
is designed to be non-fatal: failures to generate variants will be logged and
reported via status fields but will not block the upload flow.
"""

import logging
import os
from datetime import datetime, timezone
from io import BytesIO
from typing import Dict, Optional, Tuple

from PIL import Image, ImageOps  # type: ignore[import-not-found]

from src.utils.adapter_factory import AdapterFactory
from src.utils.dbbutler.storage_manager import StorageManager


class ImageVariantService:
    """Generate size- and format-optimized image variants.

    Variants are generated using the following defaults:
    - thumb:   max width 400px
    - preview: max width 800px
    Formats are attempted in priority order: AVIF → WebP → JPEG.
    """

    def __init__(self, storage_manager: Optional[StorageManager] = None) -> None:
        self.logger = logging.getLogger(__name__)
        self.enabled = os.getenv("IMAGE_VARIANTS_ENABLED", "true").lower() != "false"
        self.storage_manager = storage_manager or StorageManager()
        self.format_priority = ["avif", "webp", "jpeg"]
        self.target_widths = {"thumb": 400, "preview": 800}

        if "minio" not in self.storage_manager.adapters:
            try:
                minio_adapter = AdapterFactory.create_minio_adapter()
                self.storage_manager.add_adapter("minio", minio_adapter)
            except Exception as exc:  # pragma: no cover - defensive guard
                self.logger.warning("MinIO adapter not initialized for variants: %s", exc)

    def generate_variants(self, object_key: str, bucket: str = "images") -> Dict[str, object]:
        """Generate variants for an existing object.

        Returns a payload describing generated keys, formats, status, and timestamp.
        Errors are swallowed and reported via status to keep uploads non-fatal.
        """
        if not self.enabled:
            return {"status": "disabled", "thumb_keys": {}, "preview_keys": {}, "formats": [], "generated_at": None}

        minio = self.storage_manager.adapters.get("minio")
        if not minio:
            return {"status": "storage_unavailable", "thumb_keys": {}, "preview_keys": {}, "formats": [], "generated_at": None}

        try:
            original_bytes = self.storage_manager.load_data("minio", object_key, bucket=bucket)
        except Exception as exc:  # pragma: no cover - defensive guard
            self.logger.error("Failed to load original for variants: %s", exc, exc_info=True)
            return {"status": "load_failed", "thumb_keys": {}, "preview_keys": {}, "formats": [], "generated_at": None}

        if not original_bytes:
            return {"status": "missing_original", "thumb_keys": {}, "preview_keys": {}, "formats": [], "generated_at": None}

        try:
            base_image = Image.open(BytesIO(original_bytes))
        except Exception as exc:
            self.logger.warning("Pillow could not open original for variants (%s): %s", object_key, exc)
            return {"status": "unreadable", "thumb_keys": {}, "preview_keys": {}, "formats": [], "generated_at": None}

        # Normalize orientation using EXIF
        try:
            base_image = ImageOps.exif_transpose(base_image)
        except Exception:
            pass

        exif_bytes = base_image.info.get("exif")
        thumb_keys: Dict[str, str] = {}
        preview_keys: Dict[str, str] = {}
        formats = set()

        for variant_name, max_width in self.target_widths.items():
            resized = self._resize_image(base_image, max_width)
            for fmt in self.format_priority:
                encoded = self._encode_variant(resized, fmt, exif_bytes)
                if not encoded:
                    continue
                variant_key = f"{object_key}.__{variant_name}.{self._extension_for(fmt)}"
                try:
                    self.storage_manager.save_data(
                        variant_key,
                        encoded,
                        adapter_name="minio",
                        bucket=bucket,
                    )
                    target = thumb_keys if variant_name == "thumb" else preview_keys
                    target[fmt] = variant_key
                    formats.add(fmt)
                except Exception as exc:  # pragma: no cover - defensive guard
                    self.logger.warning("Failed to persist %s variant (%s): %s", fmt, variant_key, exc)
                    continue

        status = "generated" if (thumb_keys or preview_keys) else "skipped"
        return {
            "status": status,
            "thumb_keys": thumb_keys,
            "preview_keys": preview_keys,
            "formats": sorted(formats),
            "generated_at": datetime.now(timezone.utc),
        }

    def _resize_image(self, image: Image.Image, max_width: int) -> Image.Image:
        if image.width <= max_width:
            return image.copy()
        ratio = max_width / float(image.width)
        new_size = (max_width, max(1, int(image.height * ratio)))
        resampling = getattr(Image, "Resampling", Image)
        return image.resize(new_size, resampling.LANCZOS)

    def _encode_variant(self, image: Image.Image, fmt: str, exif_bytes: Optional[bytes]) -> Optional[bytes]:
        fmt_upper = fmt.upper()
        try:
            prepared = self._prepare_image_mode(image, fmt_upper)
            buffer = BytesIO()
            save_kwargs = {"format": fmt_upper}
            if fmt_upper == "JPEG":
                save_kwargs.update({"quality": 82, "optimize": True})
                if exif_bytes:
                    save_kwargs["exif"] = exif_bytes
            elif fmt_upper == "WEBP":
                save_kwargs.update({"quality": 82, "method": 6})
                if exif_bytes:
                    save_kwargs["exif"] = exif_bytes
            elif fmt_upper == "AVIF":
                save_kwargs.update({"quality": 82})
                if exif_bytes:
                    save_kwargs["exif"] = exif_bytes

            prepared.save(buffer, **save_kwargs)
            return buffer.getvalue()
        except Exception as exc:
            self.logger.debug("Failed to encode %s variant: %s", fmt_upper, exc)
            return None

    def _prepare_image_mode(self, image: Image.Image, fmt_upper: str) -> Image.Image:
        if fmt_upper == "JPEG" and image.mode not in ("RGB", "L"):
            return image.convert("RGB")
        if fmt_upper in {"WEBP", "AVIF"} and image.mode == "P":
            return image.convert("RGBA")
        return image

    def _extension_for(self, fmt: str) -> str:
        return {
            "jpeg": "jpg",
            "jpg": "jpg",
            "webp": "webp",
            "avif": "avif",
        }.get(fmt.lower(), fmt.lower())
