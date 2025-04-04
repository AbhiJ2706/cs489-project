"""
Centralized logging configuration for the application.
"""

import logging

# Configure logging once for the whole application
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def get_logger(name):
    """
    Get a logger with the specified name, properly configured.
    
    Args:
        name: The name of the logger, typically __name__ from the calling module
        
    Returns:
        A configured logger instance
    """
    return logging.getLogger(name)
