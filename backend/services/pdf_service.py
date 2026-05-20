import os
import base64
from datetime import datetime
from io import BytesIO
import logging

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

logger = logging.getLogger(__name__)

class PDFService:
    def __init__(self):
        self.styles = getSampleStyleSheet() if REPORTLAB_AVAILABLE else None
        if REPORTLAB_AVAILABLE:
            self.styles.add(ParagraphStyle(
                name='Justify',
                parent=self.styles['Normal'],
                alignment=TA_JUSTIFY,
                fontSize=10,
                leading=14,
                spaceAfter=10
            ))
            self.styles.add(ParagraphStyle(
                name='HeadingCentered',
                parent=self.styles['Heading1'],
                alignment=TA_CENTER,
                spaceAfter=20
            ))
            self.styles.add(ParagraphStyle(
                name='SmallGrey',
                parent=self.styles['Normal'],
                fontSize=8,
                textColor=colors.grey,
                alignment=TA_CENTER
            ))

    def generate_agreement_pdf(self, user_data, signature_base64, agreement_text):
        """
        Generate a signed agreement PDF with professional table-based layout
        """
        if not REPORTLAB_AVAILABLE:
            logger.error("ReportLab not installed. Cannot generate PDF.")
            return None

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, 
                                rightMargin=50, leftMargin=50, 
                                topMargin=50, bottomMargin=50)
        
        elements = []

        def get_signature_table():
            # Prepare Company Side
            company_col = []
            company_col.append(Paragraph("<b>For Company</b>", self.styles['Normal']))
            company_col.append(Spacer(1, 0.1 * inch))
            try:
                import urllib.request
                stamp_url = "https://i.imgur.com/7bQ6p2v.png"
                stamp_data = urllib.request.urlopen(stamp_url).read()
                stamp_img = Image(BytesIO(stamp_data))
                stamp_img.drawWidth = 1.2 * inch
                stamp_img.drawHeight = 0.8 * inch
                company_col.append(stamp_img)
            except:
                company_col.append(Spacer(1, 0.8 * inch))
            company_col.append(Paragraph("<b>Shivam Julka</b>", self.styles['Normal']))
            company_col.append(Paragraph("CMO / Co-founder", self.styles['Normal']))
            company_col.append(Paragraph(f"Date: {datetime.now().strftime('%Y-%m-%d')}", self.styles['Normal']))

            # Prepare Publisher Side
            publisher_col = []
            publisher_col.append(Paragraph("<b>For Publisher</b>", self.styles['Normal']))
            publisher_col.append(Spacer(1, 0.1 * inch))
            try:
                if "," in signature_base64:
                    encoded = signature_base64.split(",", 1)[1]
                else:
                    encoded = signature_base64
                img_data = base64.b64decode(encoded)
                sig_img = Image(BytesIO(img_data))
                aspect = sig_img.imageWidth / sig_img.imageHeight
                sig_img.drawWidth = 1.8 * inch
                sig_img.drawHeight = (1.8 * inch) / aspect
                publisher_col.append(sig_img)
            except:
                publisher_col.append(Spacer(1, 0.8 * inch))
            publisher_col.append(Paragraph(f"<b>{user_data.get('firstName', '')} {user_data.get('lastName', '')}</b>", self.styles['Normal']))
            publisher_col.append(Paragraph("Authorized Representative", self.styles['Normal']))
            publisher_col.append(Paragraph(f"Date: {datetime.now().strftime('%Y-%m-%d')}", self.styles['Normal']))

            # Combine into Table
            data = [[company_col, publisher_col]]
            t = Table(data, colWidths=[3 * inch, 3 * inch])
            t.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 0),
                ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ]))
            return t

        # 1. Main Title
        elements.append(Paragraph("<b>PUBLISHER AGREEMENT</b>", self.styles['HeadingCentered']))
        
        # Details
        details = f"""
        This Agreement (the "Agreement"), is entered into and made effective as of <b>{datetime.now().strftime('%B %d, %Y')}</b> (the "Effective Date"), by and between:<br/><br/>
        <b>SURVTIT MARKET RESEARCH SURVEY LLP</b>, a Limited Liability Partnership duly incorporated under the laws of India (LLPIN: ACB-8160, PAN: AFAFS9301P, TAN: MRTS28234D), with its address at 11/1117/48, Mehndi Sarai, Jankipuram Police Station, Saharanpur-247001, Uttar Pradesh, India (<b>"Company"</b>), of the one part;<br/><br/>
        AND<br/><br/>
        <b>{user_data.get('firstName', '')} {user_data.get('lastName', '')}</b>, an individual residing at <b>{user_data.get('address', 'N/A')}</b> (hereinafter referred to as the <b>"Publisher"</b>), of the other part;<br/><br/>
        (Hereinafter collectively referred to as "the Parties" and individually as a "Party").
        """
        elements.append(Paragraph(details, self.styles['Justify']))

        # Agreement Body Parts
        parts = agreement_text.split("EXHIBIT A — MUTUAL NON-DISCLOSURE AGREEMENT")
        agreement_body = parts[0]
        nda_body = parts[1] if len(parts) > 1 else ""

        # Process Agreement Body
        blocks = agreement_body.split('\n\n')
        for block in blocks:
            text = block.strip()
            if not text or "PUBLISHER AGREEMENT" in text or "entered into and made effective" in text: continue
            
            # Special handling for DEFINITIONS table
            if "1. DEFINITIONS" in text:
                elements.append(Paragraph("<b>1. DEFINITIONS</b>", self.styles['Heading2']))
                # Extract definitions from AGREEMENT_TEXT format
                # The format in agreement_content.py is "Term" Definition
                lines = text.split('\n')
                table_data = [['Term', 'Definition']]
                for line in lines:
                    if '"' in line:
                        term = line.split('"')[1]
                        defn = line.split('"')[-1].strip()
                        table_data.append([Paragraph(f"<b>{term}</b>", self.styles['Normal']), Paragraph(defn, self.styles['Normal'])])
                
                if len(table_data) > 1:
                    dt = Table(table_data, colWidths=[1.5 * inch, 4.5 * inch])
                    dt.setStyle(TableStyle([
                        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
                        ('TEXTCOLOR', (0,0), (-1,0), colors.black),
                        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                        ('BOTTOMPADDING', (0,0), (-1,0), 12),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
                        ('VALIGN', (0,0), (-1,-1), 'TOP'),
                    ]))
                    elements.append(dt)
                    elements.append(Spacer(1, 0.2 * inch))
                continue

            # Standard Paragraph
            style = self.styles['Justify']
            if (text.isupper() and len(text) < 100) or (text[0].isdigit() and '.' in text[:5]):
                style = self.styles['Heading2']
                text = f"<b>{text}</b>"
            
            import re
            text = re.sub(r'^(\d+\.\d+)', r'<b>\1</b>', text)
            elements.append(Paragraph(text.replace('\n', '<br/>'), style))

        # Agreement Signatures
        elements.append(Spacer(1, 0.3 * inch))
        elements.append(Paragraph("<b>19. SIGNATURES</b>", self.styles['Heading2']))
        elements.append(Paragraph("IN WITNESS WHEREOF, the Parties hereto, each by a duly authorised officer, have caused this Agreement to be executed on the last date written below.", self.styles['Normal']))
        elements.append(Spacer(1, 0.2 * inch))
        elements.append(get_signature_table())

        # NDA Section
        if nda_body:
            elements.append(PageBreak())
            elements.append(Paragraph("<center><b>Exhibit A Attached Below</b></center>", self.styles['Normal']))
            elements.append(Spacer(1, 0.5 * inch))
            elements.append(Paragraph("<b>MUTUAL NON-DISCLOSURE AGREEMENT</b>", self.styles['HeadingCentered']))
            
            blocks = nda_body.split('\n\n')
            for block in blocks:
                text = block.strip()
                if not text: continue
                style = self.styles['Justify']
                if (text.isupper() and len(text) < 100) or (text[0].isdigit() and '.' in text[:5]):
                    style = self.styles['Heading2']
                    text = f"<b>{text}</b>"
                
                import re
                text = re.sub(r'^(\d+\.\d+)', r'<b>\1</b>', text)
                elements.append(Paragraph(text.replace('\n', '<br/>'), style))

            # NDA Signatures
            elements.append(Spacer(1, 0.3 * inch))
            elements.append(Paragraph("<b>16. SIGNATURES</b>", self.styles['Heading2']))
            elements.append(Paragraph("IN WITNESS WHEREOF, the Parties hereto have caused this NDA Agreement to be executed on the last date written below.", self.styles['Normal']))
            elements.append(Spacer(1, 0.2 * inch))
            elements.append(get_signature_table())
            
            elements.append(Spacer(1, 0.5 * inch))
            elements.append(Paragraph("<b>End of Document</b>", self.styles['SmallGrey']))

        doc.build(elements)
        buffer.seek(0)
        return buffer

    def save_pdf_to_file(self, buffer, filename):
        """Save PDF buffer to a file in the uploads directory"""
        upload_dir = os.path.join(os.getcwd(), 'uploads', 'agreements')
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
            
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, 'wb') as f:
            f.write(buffer.getvalue())
            
        return filepath
