"""
Production-ready logging configuration for Optileno.
Structured JSON logging with proper levels, correlation IDs, and security filtering.
"""

import logging
import logging.config
import json
import sys
import traceback
from datetime import datetime
from typing import Any, Dict
from pathlib import Path

from backend.app.config import settings

class SecurityFilter(logging.Filter):
    """Filter to mask sensitive information in logs"""
    
    SENSITIVE_FIELDS = {
        'password', 'token', 'api_key', 'secret', 'authorization',
        'credit_card', 'ssn', 'email', 'phone', 'address'
    }
    
    def filter(self, record: logging.LogRecord) -> bool:
        # Mask sensitive data in the message
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            record.msg = self._mask_sensitive_data(record.msg)
        
        # Mask sensitive data in extra fields
        for key, value in record.__dict__.items():
            if isinstance(value, str):
                record.__dict__[key] = self._mask_sensitive_data(value)
        
        return True
    
    def _mask_sensitive_data(self, text: str) -> str:
        """Mask sensitive information in text"""
        import re
        
        for field in self.SENSITIVE_FIELDS:
            # Pattern to match field: value
            pattern = rf'({field}[\'"]?\s*[:=]\s*[\'"]?)([^\'"\s,}}]+)'
            text = re.sub(pattern, lambda m: f"{m.group(1)}***MASKED***", text, flags=re.IGNORECASE)
        
        return text

class JSONFormatter(logging.Formatter):
    """Structured JSON formatter for production logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'thread': record.thread,
            'process': record.process,
        }
        
        # Add exception information if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }
        
        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in {
                'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                'filename', 'module', 'lineno', 'funcName', 'created',
                'msecs', 'relativeCreated', 'thread', 'threadName',
                'processName', 'process', 'getMessage', 'exc_info',
                'exc_text', 'stack_info'
            }:
                log_entry[key] = value
        
        # Add correlation ID if available
        if hasattr(record, 'correlation_id'):
            log_entry['correlation_id'] = record.correlation_id
        
        return json.dumps(log_entry, default=str, ensure_ascii=False)

class ContextualLogger:
    """Logger with automatic context injection"""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.context = {}
    
    def set_context(self, **kwargs):
        """Set context for all log messages"""
        self.context.update(kwargs)
    
    def _log_with_context(self, level: int, message: str, **kwargs):
        """Log with automatic context injection"""
        extra = {**self.context, **kwargs}
        self.logger.log(level, message, extra=extra)
    
    def debug(self, message: str, **kwargs):
        self._log_with_context(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        self._log_with_context(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self._log_with_context(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, **kwargs):
        self._log_with_context(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        self._log_with_context(logging.CRITICAL, message, **kwargs)

def setup_logging():
    """Configure logging based on environment"""
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Base configuration
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'filters': {
            'security': {
                '()': SecurityFilter,
            },
        },
        'formatters': {
            'json': {
                '()': JSONFormatter,
            },
            'detailed': {
                'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s - %(module)s:%(funcName)s:%(lineno)d',
                'datefmt': '%Y-%m-%d %H:%M:%S'
            },
            'simple': {
                'format': '%(levelname)s - %(message)s'
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': 'INFO',
                'formatter': 'json' if settings.ENVIRONMENT == 'production' else 'simple',
                'filters': ['security'],
                'stream': sys.stdout
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'DEBUG',
                'formatter': 'json',
                'filters': ['security'],
                'filename': log_dir / 'optileno.log',
                'maxBytes': 50 * 1024 * 1024,  # 50MB
                'backupCount': 5,
                'encoding': 'utf8'
            },
            'error_file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'ERROR',
                'formatter': 'json',
                'filters': ['security'],
                'filename': log_dir / 'errors.log',
                'maxBytes': 10 * 1024 * 1024,  # 10MB
                'backupCount': 5,
                'encoding': 'utf8'
            }
        },
        'loggers': {
            '': {  # Root logger
                'level': 'DEBUG',
                'handlers': ['console', 'file', 'error_file']
            },
            'uvicorn': {
                'level': 'INFO',
                'handlers': ['console', 'file'],
                'propagate': False
            },
            'uvicorn.access': {
                'level': 'INFO',
                'handlers': ['console', 'file'],
                'propagate': False
            },
            'sqlalchemy.engine': {
                'level': 'WARNING',
                'handlers': ['file'],
                'propagate': False
            },
            'redis': {
                'level': 'WARNING',
                'handlers': ['file'],
                'propagate': False
            }
        }
    }
    
    # Apply configuration
    logging.config.dictConfig(config)
    
    # Log startup
    logger = logging.getLogger(__name__)
    logger.info(
        "Logging system initialized",
        extra={
            "environment": settings.ENVIRONMENT,
            "log_level": "DEBUG",
            "format": "json" if settings.ENVIRONMENT == "production" else "simple"
        }
    )

def get_logger(name: str) -> ContextualLogger:
    """Get a contextual logger instance"""
    return ContextualLogger(name)

# Performance monitoring decorator
def log_performance(logger_name: str = __name__):
    """Decorator to log function performance"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger = get_logger(logger_name)
            start_time = datetime.utcnow()
            
            try:
                result = func(*args, **kwargs)
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                logger.info(
                    f"Function {func.__name__} completed successfully",
                    extra={
                        "function": func.__name__,
                        "duration_seconds": duration,
                        "success": True
                    }
                )
                
                return result
                
            except Exception as e:
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                logger.error(
                    f"Function {func.__name__} failed with error: {str(e)}",
                    extra={
                        "function": func.__name__,
                        "duration_seconds": duration,
                        "success": False,
                        "error_type": type(e).__name__
                    },
                    exc_info=True
                )
                
                raise
        
        return wrapper
    return decorator

# Request logging middleware
async def log_request_middleware(request, call_next):
    """Middleware to log all requests with correlation ID"""
    import uuid
    
    correlation_id = str(uuid.uuid4())
    
    # Add correlation ID to request state
    request.state.correlation_id = correlation_id
    
    # Log request start
    logger = get_logger("request")
    logger.info(
        f"Request started: {request.method} {request.url.path}",
        extra={
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client_ip": request.client.host if request.client else None
        }
    )
    
    try:
        response = await call_next(request)
        
        # Log request completion
        logger.info(
            f"Request completed: {request.method} {request.url.path}",
            extra={
                "correlation_id": correlation_id,
                "status_code": response.status_code,
                "success": response.status_code < 400
            }
        )
        
        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response
        
    except Exception as e:
        # Log request error
        logger.error(
            f"Request failed: {request.method} {request.url.path}",
            extra={
                "correlation_id": correlation_id,
                "error": str(e),
                "error_type": type(e).__name__
            },
            exc_info=True
        )
        raise
