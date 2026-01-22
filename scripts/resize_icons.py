from PIL import Image
import os

# Source image path (generated artifact)
source_path = r"C:/Users/amine/.gemini/antigravity/brain/948764df-d899-4fc4-a721-611972fd843d/pj_scraper_icon_1769079345791.png"
target_dir = r"c:/Users/amine/SCRAP/pj_chrome_ext"

sizes = [16, 32, 48, 128]

if not os.path.exists(source_path):
    print(f"Error: Source image not found at {source_path}")
    # Fallback to local file if artifact path is issue (unlikely but good practice)
    exit(1)

try:
    with Image.open(source_path) as img:
        for size in sizes:
            # Resize with high quality resampling
            # Use param 1 (LANCZOS) if Image.Resampling is not available in older PIL versions, but typically safe now.
            try:
                resample = Image.Resampling.LANCZOS
            except AttributeError:
                resample = Image.LANCZOS
                
            resized_img = img.resize((size, size), resample)
            filename = f"icon{size}.png"
            target_path = os.path.join(target_dir, filename)
            resized_img.save(target_path, "PNG")
            print(f"Saved {target_path}")
    print("Success: All icons generated.")
except ImportError:
    print("Error: PIL (Pillow) is not installed. Please run 'pip install Pillow'")
except Exception as e:
    print(f"Error processing images: {e}")
