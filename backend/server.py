"""
Server entry point
Imports the FastAPI app from app.main
"""

from app.main import main_app as app

__all__ = ['app']
