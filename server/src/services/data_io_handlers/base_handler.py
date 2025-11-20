# src/services/data_io_handlers/base_handler.py

from abc import ABC, abstractmethod
from fastapi import UploadFile
from typing import Union, Optional
from src.models.file_metadata import HandlerResult

class BaseHandler(ABC):
    """
    Abstract base class for file handlers.
    """
    @abstractmethod
    def handle(self, file: UploadFile, trip_id: Optional[str] = None) -> Union[str, HandlerResult]:
        """
        Handle the uploaded file.

        :param file: The uploaded file.
        :param trip_id: Optional ID of the trip this file belongs to.
        :return: The result of handling the file (path or HandlerResult).
        """
        pass
