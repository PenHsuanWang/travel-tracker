"""Factory helpers that choose the right handler per file extension."""

from __future__ import annotations

from typing import Type

from fastapi import UploadFile

from src.services.data_io_handlers.base_handler import BaseHandler
from src.services.data_io_handlers.csv_handler import CSVHandler
from src.services.data_io_handlers.gpx_handler import GPXHandler
from src.services.data_io_handlers.image_handler import ImageHandler
from src.utils.dbbutler.storage_manager import StorageManager

class HandlerFactory:
    """Create handler instances based on the incoming file extension."""

    handlers: dict[str, Type[BaseHandler]] = {
        'gpx': GPXHandler,
        'csv': CSVHandler,
        'jpg': ImageHandler,
        'jpeg': ImageHandler,
        'png': ImageHandler,
        'gif': ImageHandler,
    }

    @classmethod
    def get_handler(
        cls,
        file_extension: str,
        *,
        storage_manager: StorageManager | None = None,
    ) -> BaseHandler:
        """Instantiate the appropriate handler for ``file_extension``.

        :raises ValueError: When the extension is not mapped to a handler.
        """

        handler_class = cls.handlers.get(file_extension)
        if not handler_class:
            raise ValueError(f"Unsupported file type: {file_extension}")
        if storage_manager is not None:
            return handler_class(storage_manager=storage_manager)
        return handler_class()
