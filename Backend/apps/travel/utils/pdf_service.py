
import logging
import threading
from playwright.sync_api import sync_playwright, Browser, Playwright

logger = logging.getLogger(__name__)

class PDFService:
    """
    Service to handle Playwright browser instance and PDF generation.
    Uses Sync API.
    
    Refactored to support non-Singleton usage for Thread Safety (ThreadPoolExecutor).
    """
    # Singleton storage (Uncomment below line if Singleton is needed in future)
    # _instance = None
    
    def __init__(self, persistent: bool = False):
        """
        Initialize the service.
        
        Args:
            persistent (bool): If True, the browser instance is kept open across calls.
                               If False (default), the browser is closed after each generation.
                               Set to True ONLY if using a global singleton or proper thread management.
        """
        self.persistent = persistent
        self.playwright: Playwright = None
        self.browser: Browser = None
        self._lock = threading.Lock()

    # Uncomment this block to enforce Singleton pattern globally
    # def __new__(cls, *args, **kwargs):
    #     if cls._instance is None:
    #         cls._instance = super(PDFService, cls).__new__(cls)
    #     return cls._instance

    def get_browser(self):
        """
        Returns the browser instance, initializing it if necessary.
        """
        with self._lock:
            # Check if browser is alive
            if self.browser:
                try:
                    if not self.browser.is_connected():
                         logger.warning("Browser disconnected. Re-initializing...")
                         self.browser = None
                except Exception:
                    self.browser = None

            if self.browser is None:
                logger.info("Initializing Playwright browser (Sync)...")
                self.playwright = sync_playwright().start()
                # Launch options optimized for Docker/Server environment
                self.browser = self.playwright.chromium.launch(
                    headless=True,
                    args=[
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-dev-shm-usage",  # Essential for Docker
                        "--disable-gpu",
                        "--font-render-hinting=none", # Better text rendering
                    ]
                )
                logger.info("Playwright browser initialized successfully.")
            return self.browser

    def close(self):
        """
        Closes the browser instance.
        """
        with self._lock:
            if self.browser:
                try:
                    self.browser.close()
                except Exception as e:
                    logger.warning(f"Error closing browser: {e}")
                finally:
                    self.browser = None
                    
            if self.playwright:
                try:
                    self.playwright.stop()
                except Exception as e:
                    logger.warning(f"Error stopping playwright: {e}")
                finally:
                    self.playwright = None
                    
            logger.info("Playwright browser closed.")

    def generate_pdf_from_html(self, html_content: str, pdf_options: dict = None) -> bytes:
        """
        Generates PDF bytes from HTML content.
        
        Args:
            html_content (str): The HTML string to render.
            pdf_options (dict): Options to pass to page.pdf(). 
                                Defaults to A4, print_background=True.
        
        Returns:
            bytes: The generated PDF binary data.
        """
        browser = self.get_browser()
        page = None
        try:
            page = browser.new_page()
            page.set_content(html_content, wait_until="load")
            
            default_options = {
                "format": "A4",
                "print_background": True,
                "margin": {
                    "top": "10mm",
                    "bottom": "10mm",
                    "left": "10mm",
                    "right": "10mm",
                },
                "prefer_css_page_size": True
            }
            
            if pdf_options:
                default_options.update(pdf_options)
            
            pdf_bytes = page.pdf(**default_options)
            return pdf_bytes
            
        except Exception as e:
            logger.error(f"Error generating PDF: {e}")
            raise e
        finally:
            if page:
                try:
                    page.close()
                except Exception:
                    pass
            
            # If NOT persistent, we must close the browser to free resources 
            # and allow the thread to be reused safely.
            if not self.persistent:
                self.close()

# Global instance (optional usage)
# You can use this for Singleton behavior by setting persistent=True
pdf_service = PDFService(persistent=False) 
