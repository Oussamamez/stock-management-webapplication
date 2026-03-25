import io
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models import Invoice, InvoiceStatus, Order, OrderItem, Product, Customer
from ..schemas import InvoiceCreate, InvoiceOut, InvoiceStatusUpdate
from ..auth import get_current_user

router = APIRouter()


def generate_invoice_number(db: Session) -> str:
    count = db.query(Invoice).count() + 1
    return f"INV-{count:04d}"


def load_invoice(db: Session, invoice_id: int):
    return (
        db.query(Invoice)
        .options(
            joinedload(Invoice.order).joinedload(Order.customer),
            joinedload(Invoice.order).joinedload(Order.items).joinedload(OrderItem.product),
        )
        .filter(Invoice.id == invoice_id)
        .first()
    )


@router.get("", response_model=List[InvoiceOut])
def list_invoices(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Invoice).options(
        joinedload(Invoice.order).joinedload(Order.customer),
        joinedload(Invoice.order).joinedload(Order.items).joinedload(OrderItem.product),
    )
    if status:
        try:
            q = q.filter(Invoice.status == InvoiceStatus(status))
        except ValueError:
            pass
    return q.order_by(Invoice.created_at.desc()).all()


@router.post("", response_model=InvoiceOut)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if db.query(Invoice).filter(Invoice.order_id == data.order_id).first():
        raise HTTPException(status_code=400, detail="Invoice already exists for this order")

    subtotal = float(order.total_amount)
    tax_amount = round(subtotal * data.tax_rate / 100, 2)
    total = round(subtotal + tax_amount, 2)

    invoice = Invoice(
        invoice_number=generate_invoice_number(db),
        order_id=data.order_id,
        tax_rate=data.tax_rate,
        due_date=data.due_date,
        notes=data.notes,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return load_invoice(db, invoice.id)


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    invoice = load_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}/status", response_model=InvoiceOut)
def update_invoice_status(invoice_id: int, data: InvoiceStatusUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = data.status
    db.commit()
    return load_invoice(db, invoice_id)


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    invoice = load_invoice(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm, leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Header
    header_style = ParagraphStyle("header", fontSize=28, fontName="Helvetica-Bold", textColor=colors.HexColor("#4F46E5"))
    story.append(Paragraph("StockFlow", header_style))
    story.append(Spacer(1, 0.3*cm))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#4F46E5")))
    story.append(Spacer(1, 0.5*cm))

    # Invoice title + number
    title_style = ParagraphStyle("title", fontSize=20, fontName="Helvetica-Bold", textColor=colors.HexColor("#111827"))
    story.append(Paragraph(f"INVOICE #{invoice.invoice_number}", title_style))
    story.append(Spacer(1, 0.3*cm))

    # Meta info
    meta_data = [
        ["Invoice Number:", invoice.invoice_number, "Status:", invoice.status.value.upper()],
        ["Issued Date:", invoice.issued_date.strftime("%B %d, %Y"), "Order Number:", invoice.order.order_number],
        ["Due Date:", invoice.due_date.strftime("%B %d, %Y") if invoice.due_date else "N/A", "", ""],
    ]
    meta_table = Table(meta_data, colWidths=[4*cm, 6*cm, 4*cm, 4*cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#374151")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.8*cm))

    # Bill To
    customer = invoice.order.customer
    bill_style = ParagraphStyle("bill", fontSize=10, fontName="Helvetica-Bold", textColor=colors.HexColor("#4F46E5"))
    story.append(Paragraph("BILL TO", bill_style))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(customer.name, styles["Normal"]))
    if customer.email:
        story.append(Paragraph(customer.email, styles["Normal"]))
    if customer.phone:
        story.append(Paragraph(customer.phone, styles["Normal"]))
    if customer.address:
        story.append(Paragraph(customer.address, styles["Normal"]))
    if customer.city:
        story.append(Paragraph(f"{customer.city}, {customer.country or ''}", styles["Normal"]))
    story.append(Spacer(1, 0.8*cm))

    # Items table
    items_header = [["#", "Product", "SKU", "Qty", "Unit Price", "Total"]]
    items_data = []
    for i, item in enumerate(invoice.order.items, 1):
        items_data.append([
            str(i),
            item.product.name,
            item.product.sku,
            str(item.quantity),
            f"${float(item.unit_price):.2f}",
            f"${float(item.total_price):.2f}",
        ])
    table_data = items_header + items_data
    items_table = Table(table_data, colWidths=[1*cm, 7*cm, 3*cm, 1.5*cm, 2.5*cm, 3*cm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 0.8*cm))

    # Totals
    totals_data = [
        ["", "Subtotal:", f"${float(invoice.subtotal):.2f}"],
        ["", f"Tax ({float(invoice.tax_rate):.1f}%):", f"${float(invoice.tax_amount):.2f}"],
        ["", "TOTAL:", f"${float(invoice.total):.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[9*cm, 5*cm, 4*cm])
    totals_table.setStyle(TableStyle([
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 2), (2, 2), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTSIZE", (1, 2), (2, 2), 12),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("TEXTCOLOR", (1, 2), (2, 2), colors.HexColor("#4F46E5")),
        ("LINEABOVE", (1, 2), (2, 2), 1.5, colors.HexColor("#4F46E5")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_table)

    if invoice.notes:
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph("Notes", bill_style))
        story.append(Paragraph(invoice.notes, styles["Normal"]))

    # Footer
    story.append(Spacer(1, 2*cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#D1D5DB")))
    story.append(Spacer(1, 0.3*cm))
    footer_style = ParagraphStyle("footer", fontSize=8, textColor=colors.HexColor("#9CA3AF"), alignment=TA_CENTER)
    story.append(Paragraph("Thank you for your business! Generated by StockFlow.", footer_style))

    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={invoice.invoice_number}.pdf"},
    )
