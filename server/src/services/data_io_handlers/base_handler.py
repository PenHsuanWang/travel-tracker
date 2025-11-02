# src/services/data_io_handlers/base_handler.py

from abc import ABC, abstractmethod
from fastapi import UploadFile
from typing import Union
from src.models.file_metadata import HandlerResult

class BaseHandler(ABC):
    """
    Abstract base class for file handlers.
    """
    @abstractmethod
    def handle(self, file: UploadFile) -> Union[str, HandlerResult]:
        """
        Handle the uploaded file.

        :param file: The uploaded file.
        :return: The file path where the file is stored (legacy) or HandlerResult with metadata.
        """
        pass
