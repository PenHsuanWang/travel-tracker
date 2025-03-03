# src/services/data_io_handlers/handler_factory.py

from fastapi import UploadFile
from src.services.data_io_handlers.base_handler import BaseHandler
from src.services.data_io_handlers.gpx_handler import GPXHandler
from src.services.data_io_handlers.csv_handler import CSVHandler
from src.services.data_io_handlers.image_handler import ImageHandler

class HandlerFactory:
    """
    Factory to create appropriate handlers based on file type.
    """
    handlers = {
        'gpx': GPXHandler,
        'csv': CSVHandler,
        'jpg': ImageHandler,
        'jpeg': ImageHandler,
        'png': ImageHandler,
        'gif': ImageHandler
    }

    @classmethod
    def get_handler(cls, file_extension: str) -> BaseHandler:
        """
        Get the appropriate handler for the given file extension.

        :param file_extension: The file extension.
        :return: The handler instance.
        :raises ValueError: If the file extension is not supported.
        """
        handler_class = cls.handlers.get(file_extension)
        if not handler_class:
            raise ValueError(f"Unsupported file type: {file_extension}")
        return handler_class()
