import os
from PIL import Image, ImageDraw, ImageFont

def make_icon(size, filename):
    img = Image.new('RGB', (size, size), color='#111118')
    draw = ImageDraw.Draw(img)
    
    circle_margin = int(size * 0.1)
    
    # Draw a blue circle
    draw.ellipse(
        [circle_margin, circle_margin, size - circle_margin, size - circle_margin],
        fill=(37, 99, 235), outline=(13, 71, 161)
    )
    
    text = "ET"
    font_size = int(size * 0.45)
    
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except IOError:
        font = ImageFont.load_default()

    # Draw 'ET' text centered
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        # Fallback for old PIL
        text_settings = draw.textsize(text, font=font)
        text_w = text_settings[0]
        text_h = text_settings[1]
        
    draw.text(
        ((size - text_w) / 2, (size - text_h) / 2 - int(size*0.05)),
        text,
        fill="white",
        font=font
    )
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    img.save(filename)

base_dir = r"d:\new_registro_elettronico\static\icons"
make_icon(192, os.path.join(base_dir, 'icon-192.png'))
make_icon(512, os.path.join(base_dir, 'icon-512.png'))
print("Icons created")
