
import logging
import threading
from playwright.sync_api import sync_playwright, Browser, Playwright

logger = logging.getLogger(__name__)

class PDFService:
    """
    Singleton service to handle Playwright browser instance and PDF generation.
    Uses Sync API to avoid asyncio loop mismatch issues in Celery.
    """
    _instance = None
    _playwright: Playwright = None
    _browser: Browser = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PDFService, cls).__new__(cls)
        return cls._instance

    @classmethod
    def get_browser(cls):
        """
        Returns the global browser instance, initializing it if necessary.
        """
        with cls._lock:
            # Check if browser is alive
            if cls._browser:
                try:
                    if not cls._browser.is_connected():
                         logger.warning("Browser disconnected. Re-initializing...")
                         cls._browser = None
                except Exception:
                    cls._browser = None

            if cls._browser is None:
                logger.info("Initializing Playwright browser (Sync)...")
                cls._playwright = sync_playwright().start()
                # Launch options optimized for Docker/Server environment
                cls._browser = cls._playwright.chromium.launch(
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
            return cls._browser

    @classmethod
    def close(cls):
        """
        Closes the global browser instance.
        """
        with cls._lock:
            if cls._browser:
                cls._browser.close()
                cls._browser = None
            if cls._playwright:
                cls._playwright.stop()
                cls._playwright = None
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
            # If generation fails, it might be a browser issue. Close it to be safe.
            # self.close() # Optional: aggressive recovery
            raise e
        finally:
            if page:
                page.close()

# Global instance
pdf_service = PDFService()
