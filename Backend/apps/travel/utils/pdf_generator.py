import io
from reportlab.pdfgen import canvas
from reportlab.lib.colors import black, HexColor
import logging
logger = logging.getLogger(__name__)

def draw_header(c, WIDTH, HEIGHT, data):
    """
    Draws header section of duty slip
    """

    # -------------------------------
    # Layout Settings
    # -------------------------------

    top_margin = 30
    header_height = 50

    start_y = HEIGHT - top_margin
    end_y = start_y - header_height

    left = 20
    right = WIDTH - 20

    row_mid = start_y - (header_height / 2)

    # Column widths (adjust these if needed)
    col1 = 130   # TATA
    col2 = 150   # VEHICLE
    col3 = 40    # TR No
    col4 = 130   # TR value
    col5 = right - left - (col1 + col2 + col3 + col4)

    # X positions
    x1 = left
    x2 = x1 + col1
    x3 = x2 + col2
    x4 = x3 + col3
    x5 = x4 + col4
    x6 = right

    # -------------------------------
    # Draw Lines
    # -------------------------------

    c.setLineWidth(0.3)

    # Outer box
    c.rect(left, end_y, right-left, header_height)

    # Horizontal divider
    # Horizontal divider (starts after col1)
    c.line(x2, row_mid, right, row_mid)

    # Vertical (Divider between Col 1 and Col 2 should be full height)
    c.line(x2, end_y, x2, start_y)

    # Other Verticals (Top Row)
    c.line(x3, row_mid, x3, start_y)
    c.line(x4, row_mid, x4, start_y)
    c.line(x5, row_mid, x5, start_y)

    # Other Verticals (Bottom Row)
    c.line(x3, end_y, x3, row_mid)
    c.line(x4, end_y, x4, row_mid)
    c.line(x5, end_y, x5, row_mid)

    # -------------------------------
    # Text
    # -------------------------------

    # Fonts
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 9)

    # -------- Row 1 --------
    # Company Name (Centered in full height of Col 1)
    c.drawCentredString((x1+x2)/2, (start_y + end_y)/2 - 4, data["company"])

    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString((x2+x3)/2, row_mid+8, "VEHICLE DUTY SLIP")
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString((x3+x4)/2, row_mid+8, "TR No")
    c.drawCentredString((x4+x5)/2, row_mid+8, data["tr_no"])
    
    # Last column small font
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString((x5+x6)/2, row_mid+14, "Pick & Drop / Outstation /")
    c.drawCentredString((x5+x6)/2, row_mid+6, "Local")

    # -------- Row 2 --------
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x2+5, end_y+9, f"Date of Generation: {data['date']}")
    c.drawString(x3+5, end_y+9, "Vertical")
    c.drawCentredString((x4+x5)/2, end_y+9, data["vertical"])
    
    # Location bold and maybe slightly smaller if needed, but 9 might fit now
    c.setFont("Helvetica-Bold", 8) 
    c.drawCentredString((x5+x6)/2, end_y+9, data["location"])
    
    # Return last Y for next section
    return end_y


def draw_trip_details(c, WIDTH, start_y, data):
    """
    Draws the trip details section below the header.
    Returns the Y coordinate where this section ends.
    """
    left = 20
    right = WIDTH - 20
    full_width = right - left
    
    # Dimensions
    h1 = 25 # Row 1 Height
    h2 = 35 # Row 2 Height (Taller for multiline)
    row_height = 30 # For subsequent rows
    
    y1 = start_y
    y2 = y1 - h1
    y3 = y2 - h2
    y4 = y3 - row_height # Row 3
    y5 = y4 - row_height # Row 4
    y6 = y5 - row_height # Row 4
    
    # ---------------------------------------------------------
    # Row 1 Columns (Slip, Vendor, Vehicle No)
    # ---------------------------------------------------------
    
    # Width = 572 (612 - 40)
    c1 = 60
    c2 = 50
    c3 = 75 
    c4 = 220
    c5 = 60
    c6 = full_width - (c1+c2+c3+c4+c5) # Remainder ~77
    
    # X coordinates Row 1
    rx1 = left
    rx2 = rx1 + c1
    rx3 = rx2 + c2
    rx4 = rx3 + c3
    rx5 = rx4 + c4
    rx6 = rx5 + c5
    rx7 = right

    # ---------------------------------------------------------
    # Row 2 Columns (Reporting Person, Mobile, Vehicle Model)
    # ---------------------------------------------------------
    # Reporting Person Name: Needs more space (~140)
    # Mobile No: 10 digits, needs less space (~80)
    # Vehicle Model: Needs more space (~remaining)
    
    d1 = 60
    d2 = 150
    d3 = 75
    d4 = 75
    d5 = 70
    d6 = full_width - (d1+d2+d3+d4+d5) # Remainder ~142
    
    # X coordinates Row 2
    dx1 = left
    dx2 = dx1 + d1
    dx3 = dx2 + d2
    dx4 = dx3 + d3
    dx5 = dx4 + d4
    dx6 = dx5 + d5
    dx7 = right
    
    # Draw Grid for Row 1 & 2
    c.setLineWidth(0.3)
    
    # Horizontals
    c.line(left, y2, right, y2)
    c.line(left, y3, right, y3)
    
    # Vertical borders
    c.line(left, y1, left, y3)
    c.line(right, y1, right, y3)
    
    # Inner Verticals Row 1
    for x in [rx2, rx3, rx4, rx5, rx6]:
        c.line(x, y1, x, y2)

    # Inner Verticals Row 2
    for x in [dx2, dx3, dx4, dx5, dx6]:
        c.line(x, y2, x, y3)
        
    # Text Row 1
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString((rx1+rx2)/2, (y1+y2)/2 - 3, "Slip No.")
    c.drawCentredString((rx3+rx4)/2, (y1+y2)/2 - 3, "Vendor Name")
    c.drawCentredString((rx5+rx6)/2, (y1+y2)/2 - 3, "Vehicle No")
    
    c.setFont("Helvetica", 9)
    c.drawCentredString((rx2+rx3)/2, (y1+y2)/2 - 3, data.get("slip_no", ""))
    c.drawCentredString((rx4+rx5)/2, (y1+y2)/2 - 3, data.get("vendor_name", ""))
    c.drawCentredString((rx6+rx7)/2, (y1+y2)/2 - 3, data.get("vehicle_no", ""))
    
    # Text Row 2
    c.setFont("Helvetica-Bold", 8)
    # Multiline label: Reporting Person Name
    c.drawCentredString((dx1+dx2)/2, y2 - 12, "Reporting")
    c.drawCentredString((dx1+dx2)/2, y2 - 22, "Person Name")
    
    # Multiline label: Reporting Person Mobile No
    c.drawCentredString((dx3+dx4)/2, y2 - 8, "Reporting")
    c.drawCentredString((dx3+dx4)/2, y2 - 18, "Person")
    c.drawCentredString((dx3+dx4)/2, y2 - 28, "Mobile No")

    c.drawCentredString((dx5+dx6)/2, (y2+y3)/2 - 3, "Vehicle Model")
    
    c.setFont("Helvetica", 9)
    c.drawCentredString((dx2+dx3)/2, (y2+y3)/2 - 3, data.get("reporting_person", ""))
    c.drawCentredString((dx4+dx5)/2, (y2+y3)/2 - 3, data.get("reporting_mobile", ""))
    c.drawCentredString((dx6+dx7)/2, (y2+y3)/2 - 3, data.get("vehicle_model", ""))


    # ---------------------------------------------------------
    # Row 3: From/To Date/Time AC
    # ---------------------------------------------------------
    r3_cols = [60, 64, 60, 64, 50, 64, 50, 64, 50, 62] # Sum ~572
    
    r3_x = [left]
    for w in r3_cols:
        r3_x.append(r3_x[-1] + w)
    # Ensure last is exactly right
    r3_x[-1] = right
        
    # Draw Row 3 Box
    c.rect(left, y4, full_width, row_height)
    
    # Vertical lines Row 3
    for x in r3_x[1:-1]:
        c.line(x, y3, x, y4)

    # Text Row 3
    c.setFont("Helvetica-Bold", 8)
    
    c.drawCentredString((r3_x[0]+r3_x[1])/2, (y3+y4)/2 - 3, "From Date")
    c.setFont("Helvetica", 9)
    c.drawCentredString((r3_x[1]+r3_x[2])/2, (y3+y4)/2 - 3, data.get("from_date", ""))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString((r3_x[2]+r3_x[3])/2, (y3+y4)/2 - 3, "From Time")
    c.setFont("Helvetica", 9)
    c.drawCentredString((r3_x[3]+r3_x[4])/2, (y3+y4)/2 - 3, data.get("from_time", ""))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString((r3_x[4]+r3_x[5])/2, (y3+y4)/2 - 3, "To Date")
    c.setFont("Helvetica", 9)
    c.drawCentredString((r3_x[5]+r3_x[6])/2, (y3+y4)/2 - 3, data.get("to_date", ""))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString((r3_x[6]+r3_x[7])/2, (y3+y4)/2 - 3, "To Time")
    c.setFont("Helvetica", 9)
    c.drawCentredString((r3_x[7]+r3_x[8])/2, (y3+y4)/2 - 3, data.get("to_time", ""))
    
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString((r3_x[8]+r3_x[9])/2, y3 - 10, "AC / Non-")
    c.drawCentredString((r3_x[8]+r3_x[9])/2, y3 - 20, "AC")
    c.setFont("Helvetica", 9)
    c.drawCentredString((r3_x[9]+r3_x[10])/2, (y3+y4)/2 - 3, data.get("ac_status", ""))


    # ---------------------------------------------------------
    # Row 4: Reporting Place, Visiting Place
    # ---------------------------------------------------------
    r4_col1 = 80
    r4_col2 = 200
    r4_col3 = 80
    r4_col4 = full_width - (r4_col1 + r4_col2 + r4_col3)
    
    r4_x1 = left
    r4_x2 = r4_x1 + r4_col1
    r4_x3 = r4_x2 + r4_col2
    r4_x4 = r4_x3 + r4_col3
    r4_x5 = right
    
    # Draw Row 4 Box
    c.rect(left, y5, full_width, row_height)
    
    # Vertical lines
    c.line(r4_x2, y4, r4_x2, y5)
    c.line(r4_x3, y4, r4_x3, y5)
    c.line(r4_x4, y4, r4_x4, y5)
    
    # Text Row 4
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString((r4_x1+r4_x2)/2, (y4+y5)/2 - 3, "Reporting Place")
    c.drawCentredString((r4_x3+r4_x4)/2, (y4+y5)/2 - 3, "Visiting Place")
    
    c.setFont("Helvetica", 9)
    c.drawCentredString((r4_x2+r4_x3)/2, (y4+y5)/2 - 3, data.get("reporting_place", ""))
    c.drawCentredString((r4_x4+r4_x5)/2, (y4+y5)/2 - 3, data.get("visiting_place", ""))
    
    return y6


def draw_usage_details(c, WIDTH, start_y):
    """
    Draws the usage details / log sheet table.
    """
    left = 20
    right = WIDTH - 20
    full_width = right - left
    
    # Dimensions
    header_height = 35
    row_height = 30
    footer_height = 60
    
    # Columns: 11 cols
    # S.No, Rep Date, Rep Time, Rel Date, Rel Time, Op KM, Cl KM, Run KM, Gar KM, Tot KM, Sig
    # Est: 30, 55, 45, 55, 45, 50, 50, 50, 40, 40, Rem
    
    c1 = 25 # S. No
    c2 = 60 # Rep Date
    c3 = 45 # Rep Time
    c4 = 55 # Rel Date
    c5 = 45 # Rel Time
    c6 = 50 # Op KM
    c7 = 50 # Cl KM
    c8 = 50 # Run KM
    c9 = 40 # Garage KM
    c10 = 40 # Total KM
    c11 = full_width - (c1+c2+c3+c4+c5+c6+c7+c8+c9+c10) # User Sig ~112
    
    cols = [c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11]
    
    # X Coordinates
    x_coords = [left]
    for w in cols:
        x_coords.append(x_coords[-1] + w)
    x_coords[-1] = right # Ensure exact fit
        
    # Y Coordinates
    y_start = start_y # Gap
    y_header_bottom = y_start - header_height
    
    # Draw Header Row
    c.setLineWidth(0.3)
    c.rect(left, y_header_bottom, full_width, header_height)
    
    # Vertical lines for columns
    for x in x_coords[1:-1]:
        c.line(x, y_start, x, y_header_bottom)
        
    # Header Text
    headers = [
        "S. No.", "Reporting", "Reporting", "Release Date", "Release Time", 
        "Opening KM", "Closing KM", "Running KM", "Garage", "Total KM", "User Signature"
    ]
    # Handle multiline headers
    c.setFont("Helvetica-Bold", 8)
    
    # 1. S. No.
    c.drawCentredString((x_coords[0]+x_coords[1])/2, (y_start+y_header_bottom)/2 - 3, "S. No.")
    
    # 2. Reporting Date (Stacked)
    c.drawCentredString((x_coords[1]+x_coords[2])/2, y_start - 10, "Reporting")
    c.drawCentredString((x_coords[1]+x_coords[2])/2, y_start - 20, "Date")
    
    # 3. Reporting Time (Stacked)
    c.drawCentredString((x_coords[2]+x_coords[3])/2, y_start - 10, "Reporting")
    c.drawCentredString((x_coords[2]+x_coords[3])/2, y_start - 20, "Time")
    
    # 4. Release Date
    c.drawCentredString((x_coords[3]+x_coords[4])/2, y_start - 10, "Release")
    c.drawCentredString((x_coords[3]+x_coords[4])/2, y_start - 20, "Date")
    
    # 5. Release Time (Stacked/Single?) Image says Release Time single line? It fits?
    c.drawCentredString((x_coords[4]+x_coords[5])/2, y_start - 10, "Release")
    c.drawCentredString((x_coords[4]+x_coords[5])/2, y_start - 20, "Time")
    
    # 6. Opening KM
    c.drawCentredString((x_coords[5]+x_coords[6])/2, (y_start+y_header_bottom)/2 - 3, "Opening KM")
    
    # 7. Closing KM
    c.drawCentredString((x_coords[6]+x_coords[7])/2, (y_start+y_header_bottom)/2 - 3, "Closing KM")
    
    # 8. Running KM
    c.drawCentredString((x_coords[7]+x_coords[8])/2, (y_start+y_header_bottom)/2 - 3, "Running KM")
    
    # 9. Garage KM (Stacked)
    c.drawCentredString((x_coords[8]+x_coords[9])/2, y_start - 10, "Garage")
    c.drawCentredString((x_coords[8]+x_coords[9])/2, y_start - 20, "KM")
    
    # 10. Total KM
    c.drawCentredString((x_coords[9]+x_coords[10])/2, (y_start+y_header_bottom)/2 - 3, "Total KM")
    
    # 11. User Signature
    c.drawCentredString((x_coords[10]+x_coords[11])/2, (y_start+y_header_bottom)/2 - 3, "User Signature")
    
    
    # Draw 4 Rows
    current_y = y_header_bottom
    for i in range(1, 5):
        bottom_y = current_y - row_height
        c.rect(left, bottom_y, full_width, row_height)
        
        # Vertical lines
        for x in x_coords[1:-1]:
            c.line(x, current_y, x, bottom_y)
            
        # S. No
        c.setFont("Helvetica-Bold", 9)
        c.drawCentredString((x_coords[0]+x_coords[1])/2, (current_y+bottom_y)/2 - 3, str(i))
        
        current_y = bottom_y

    # Footer Row (Signatures)
    footer_bottom = current_y - footer_height
    c.rect(left, footer_bottom, full_width, footer_height )
    
    footer_cols = [
        x_coords[0],   # left border
        x_coords[2],   # after S.No
        x_coords[4],   # after Release Time
        x_coords[6],   # after Running KM
        x_coords[8],  # after Total KM
        x_coords[10],  # after User Signature
        x_coords[-1],  # right border
    ]

    # Draw vertical lines
    for x in footer_cols[1:-1]:
        c.line(x, current_y, x, footer_bottom)

    # Texts
    c.setFont("Helvetica-Bold", 9)
    center_y = footer_bottom + (footer_height) / 2
    line_gap = 10

    # 1. Details of Visiting Place (col 1–5)
    mid_x1 = (footer_cols[0] + footer_cols[1]) / 2
    details = ["Details", "of", "Visiting", "Place"]
    start_y = center_y + (1.5 * line_gap)

    for i, t in enumerate(details):
        c.drawCentredString(mid_x1, start_y - (i * line_gap), t)

    # 2. Vendor Signature (col 5–8)
    mid_x2 = (footer_cols[2] + footer_cols[3]) / 2
    vendor = ["Vendor", "Signature"]
    start_y2 = center_y + (0.5 * line_gap)

    for i, t in enumerate(vendor):
        c.drawCentredString(mid_x2, start_y2 - (i * line_gap), t)

    # 3. User Signature (col 8–11)
    mid_x3 = (footer_cols[4] + footer_cols[5]) / 2
    user = ["WPE Officer", "Signature"]
    start_y3 = center_y + (0.5 * line_gap)

    for i, t in enumerate(user):
        c.drawCentredString(mid_x3, start_y3 - (i * line_gap), t)
    
    return footer_bottom

def draw_feedback_header(c, left, current_y, full_width, row_height):
    # Colors
    light_gray = HexColor("#E6E6E6")

    # Column widths
    feedback_col = 100
    text_col = full_width - feedback_col
    bottom = current_y - row_height

    # Left cell
    c.setFillColor(light_gray)
    c.rect(left, bottom, feedback_col, row_height, fill=1, stroke=0)

    # Right cell
    c.rect(left + feedback_col, bottom, text_col, row_height, fill=1, stroke=0)

    # Border
    c.setStrokeColor(black)
    c.setLineWidth(0.3)

    # Outer border
    c.rect(left, bottom, full_width, row_height, fill=0)

    # Vertical divider
    c.line(left + feedback_col, bottom, left + feedback_col, bottom + row_height)

    center_y = bottom + (row_height / 2) - 4
    # Left text
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(left + (feedback_col / 2), center_y, "Feedback")

    # Right text
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0, 0, 0)
    text = "Please cross ✖ the items which were not found in working condition in the vehicle"
    c.drawString(left + feedback_col + 10, center_y, text)

    return bottom

def draw_feedback_checklist(c, left, current_y, full_width):
    """
    Draws the feedback checklist with checkboxes for vehicle inspection items.
    """
    # Row height
    row_height = 30
    checkbox_size = 12
    
    # Define 3 rows with 3 columns each
    # Row 1: Speedometer | Windshield Wiper | Other Points of Concern
    # Row 2: Head Lights & Indicators | Cleanliness | Timely Reporting
    # Row 3: Air Conditioner | Seat Belts | Commercial Vehicle
    
    # Column widths - 3 equal sections
    col_width = full_width / 3
    
    # X coordinates
    x1 = left
    x2 = x1 + col_width
    x3 = x2 + col_width
    x4 = left + full_width
    
    # Y coordinates for 3 rows
    y1 = current_y
    y2 = y1 - row_height
    y3 = y2 - row_height
    y4 = y3 - row_height
    
    c.setLineWidth(0.3)
    c.setStrokeColor(black)
    
    # Draw outer border
    c.rect(left, y4, full_width, row_height * 3, fill=0)
    
    # Draw horizontal lines
    c.line(left, y2, x4, y2)
    c.line(left, y3, x4, y3)
    
    # Draw vertical lines (full height)
    c.line(x2, y1, x2, y4)
    c.line(x3, y1, x3, y4)
    
    # Helper function to draw checkbox and label
    def draw_checkbox_item(x_start, x_end, y_top, y_bottom, label, large_box=False):
        center_y = (y_top + y_bottom) / 2
        
        if large_box:
            # For "Other Points of Concern" and "Any Other concern, please mention"
            # Draw larger checkbox on left
            checkbox_x = x_start + 15
            checkbox_y = center_y - (checkbox_size / 2)
            c.rect(checkbox_x, checkbox_y, checkbox_size, checkbox_size, fill=0)
            
            # Draw text on right side with wrapping
            text_x = checkbox_x + checkbox_size + 8
            c.setFont("Helvetica", 8)
            # Split label into lines if needed
            if label == "Any Other concern, please mention":
                c.drawString(text_x, center_y + 5, "Any Other concern,")
                c.drawString(text_x, center_y - 5, "please mention")
            else:
                c.drawString(text_x, center_y - 3, label)
        else:
            # Regular items - checkbox on left, label on right
            checkbox_x = x_start + 10
            checkbox_y = center_y - (checkbox_size / 2)
            c.rect(checkbox_x, checkbox_y, checkbox_size, checkbox_size, fill=0)
            
            # Label
            text_x = checkbox_x + checkbox_size + 5
            c.setFont("Helvetica", 8)
            c.drawString(text_x, center_y - 3, label)
    
    # Row 1
    draw_checkbox_item(x1, x2, y1, y2, "Speedometer")
    draw_checkbox_item(x2, x3, y1, y2, "Windshield Wiper")
    draw_checkbox_item(x3, x4, y1, y2, "Other Points of Concern:", large_box=True)
    
    # Row 2
    draw_checkbox_item(x1, x2, y2, y3, "Head Lights & Indicators")
    draw_checkbox_item(x2, x3, y2, y3, "Cleanliness")
    draw_checkbox_item(x3, x4, y2, y3, "Timely Reporting")
    
    # Row 3
    draw_checkbox_item(x1, x2, y3, y4, "Air Conditioner")
    draw_checkbox_item(x2, x3, y3, y4, "Seat Belts")
    draw_checkbox_item(x3, x4, y3, y4, "Commercial Vehicle")
    
    return y4

def draw_note_section(c, left, current_y, full_width, data):
    """
    Draws the Note section with requester details and special instructions.
    """
    # Colors
    light_gray = HexColor("#ffffff")
    
    # Row heights
    row1_height = 25  # Note row
    row2_height = 40  # Special Instruction row
    
    # Column widths for Row 1
    # Note | Rate as per TSF | Requester Name | Name Value | Requester Mobile | Mobile Value
    col1 = 40   # Note
    col2 = 140  # Rate as per TSF Vehicle Contract
    col3 = 90  # Requester Name
    col4 = 140  # Name Value
    col5 = 100  # Requester Mobile No
    col6 = full_width - (col1 + col2 + col3 + col4 + col5)  # Mobile Value
    
    # X coordinates for Row 1
    x1 = left
    x2 = x1 + col1
    x3 = x2 + col2
    x4 = x3 + col3
    x5 = x4 + col4
    x6 = x5 + col5
    x7 = left + full_width
    
    # Y coordinates
    y1 = current_y
    y2 = y1 - row1_height
    y3 = y2 - row2_height
    
    c.setLineWidth(0.3)
    c.setStrokeColor(black)
    
    # ===== Row 1: Note and Requester Details =====
    
    # Draw cells with gray background for labels
    c.setFillColor(light_gray)
    c.rect(x1, y2, col1, row1_height, fill=1, stroke=0)  # Note
    c.rect(x3, y2, col3, row1_height, fill=1, stroke=0)  # Requester Name
    c.rect(x5, y2, col5, row1_height, fill=1, stroke=0)  # Requester Mobile No
    
    # Draw outer border for Row 1
    c.rect(x1, y2, full_width, row1_height, fill=0)
    
    # Draw vertical dividers for Row 1
    c.line(x2, y1, x2, y2)
    c.line(x3, y1, x3, y2)
    c.line(x4, y1, x4, y2)
    c.line(x5, y1, x5, y2)
    c.line(x6, y1, x6, y2)
    
    # Text for Row 1
    center_y1 = y2 + (row1_height / 2) - 3
    
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString((x1 + x2) / 2, center_y1, "Note")
    
    c.setFont("Helvetica", 8)
    c.drawCentredString((x2 + x3) / 2, center_y1, "Rate as per TSF Vehicle Contract")
    
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString((x3 + x4) / 2, center_y1, "Requester Name")
    
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString((x4 + x5) / 2, center_y1, data.get("requester_name", ""))
    
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString((x5 + x6) / 2, center_y1, "Requester Mobile No")
    
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString((x6 + x7) / 2, center_y1, data.get("requester_mobile", ""))
    
    # ===== Row 2: Special Instruction =====
    
    # Draw cell with gray background
    c.setFillColor(light_gray)
    c.rect(x1, y3, full_width, row2_height, fill=1, stroke=0)
    
    # Draw border for Row 2
    c.setStrokeColor(black)
    c.rect(x1, y3, full_width, row2_height, fill=0)
    
    # Text for Row 2
    center_y2 = y3 + (row2_height / 2) - 3
    
    c.setFont("Helvetica-Bold", 9)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString((x1 + x2) - 10, center_y2, "Special Instruction")
    
    return y3

def generate_duty_slip_pdf(booking):
    """
    Generate duty slip PDF from booking object with dynamic data
    """
    from django.utils import timezone
    
    WIDTH = 612
    HEIGHT = 800

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(WIDTH, HEIGHT))

    # Background
    c.setFillColorRGB(1,1,1)
    c.rect(0,0,WIDTH,HEIGHT,fill=1,stroke=0)

    # -------------------------
    # Extract Data from Booking
    # -------------------------
    
    # TR Number
    tr_no = ""
    try:
        if booking.trip_details and booking.trip_details.travel_application:
            tr_no = booking.trip_details.travel_application.get_travel_request_id()
    except:
        pass
    
    # Date of Generation
    date_gen = timezone.now().strftime("%d %B %Y")
    
    # Vertical (Department)
    vertical = ""
    try:
        vertical = (
            booking.trip_details.travel_application.general_ledger.vertical_name
        )
    except:
        pass
    
    vendor_name = ""
    try:
        # Get the active assignment for this booking (OneToOne)
        assigned = getattr(booking, 'assignment', None)
        if assigned and assigned.assigned_to:
            profile = getattr(assigned.assigned_to, 'booking_agent_profile', None)
            if profile:
                vendor_name = profile.organization_name
    except Exception as e:
        logger.error(f"Error fetching vendor name: {e}")
        
    # Slip Number
    slip_no = f"DS/{booking.id:04d}"

    # Location (From -> To)
    location = ""
    try:
        details = booking.booking_details
        from_loc = details.get("from_location_name", "") or details.get("from_location", "")
        to_loc = details.get("to_location_name", "") or details.get("to_location", "")
        
        parts = [p for p in [from_loc, to_loc] if p]
        location = " to ".join(parts)
    except Exception as e:
        logger.error(f"Error fetching location: {e}")
    
    # Vehicle Model
    vehicle_model = ""
    try:
        assigned = booking.assignment
        if assigned and assigned.requested_vehicle_type:
            vehicle_model = assigned.requested_vehicle_type.name or ""
    except:
        pass
    
    # Reporting Person
    reporting_person = ""
    reporting_mobile = ""
    
    # Requester / Applicant Details
    requester_name = ""
    requester_mobile = ""
    try:
        emp = booking.trip_details.travel_application.employee
        requester_name = ((emp.first_name or "") + " " + (emp.last_name or "")).strip()
        requester_mobile = emp.mobile_no or ""
    except:
        pass
    
    # Booking Details
    bd = booking.booking_details or {}
    from_date = str(bd.get("start_date") or "")
    from_time = str(bd.get("start_time") or "")
    to_date = str(bd.get("end_date") or "")
    to_time = str(bd.get("end_time") or "")
    
    # Places
    reporting_place = str(bd.get("from_location_name") or bd.get("report_at") or "")
    visiting_place = str(bd.get("to_location_name") or bd.get("drop_location") or "")
    
    # Vehicle Number (usually blank for new bookings)
    vehicle_no = ""
    
    # AC Status
    ac_status = ""
    
    # -------------------------
    # Prepare Data Dictionaries
    # -------------------------
    
    header_data = {
        "company": "TATA STEEL FOUNDATION",
        "tr_no": tr_no,
        "date": date_gen,
        "vertical": vertical,
        "location": location,
    }
    
    trip_data = {
        "slip_no": slip_no,
        "vendor_name": vendor_name,
        "vehicle_no": vehicle_no,
        "reporting_person": reporting_person,
        "reporting_mobile": reporting_mobile,
        "vehicle_model": vehicle_model,
        "from_date": from_date,
        "from_time": from_time,
        "to_date": to_date,
        "to_time": to_time,
        "ac_status": ac_status,
        "reporting_place": reporting_place,
        "visiting_place": visiting_place,
        "requester_name": requester_name,
        "requester_mobile": requester_mobile
    }

    # -------------------------
    # Draw PDF Sections
    # -------------------------
    
    # Draw header
    current_y = draw_header(c, WIDTH, HEIGHT, header_data)
    
    # Draw Trip Details
    current_y = draw_trip_details(c, WIDTH, current_y, trip_data)
    
    # Draw Usage Details (Log Sheet)
    current_y = draw_usage_details(c, WIDTH, current_y)

    # Draw Feedback Header
    current_y = draw_feedback_header(c, 20, current_y, WIDTH - 40, 30)
    
    # Draw Feedback Checklist
    current_y = draw_feedback_checklist(c, 20, current_y, WIDTH - 40)
    
    # Draw Note Section
    current_y = draw_note_section(c, 20, current_y, WIDTH - 40, trip_data)

    # Finalize PDF
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer

