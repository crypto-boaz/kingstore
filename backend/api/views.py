import json
import re
import secrets
import time
from datetime import timedelta
from decimal import Decimal
from functools import wraps

import bcrypt
import jwt
from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Prefetch, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import (
    Category,
    Customer,
    CustomerRequest,
    Debt,
    DebtStatus,
    Delivery,
    Expense,
    InventoryLog,
    Notification,
    Payment,
    PaymentStatus,
    Product,
    Role,
    Sale,
    SaleItem,
    Supplier,
    User,
)


def json_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def json_error(message, status=400, **extra):
    return JsonResponse({"message": message, **extra}, status=status)


def to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def iso(value):
    return value.isoformat() if value else None


def sign_token(user):
    payload = {
        "id": user.id,
        "email": user.email,
        "username": user.username or user.email,
        "role": user.role,
        "exp": timezone.now() + timedelta(hours=8),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def user_response(user):
    return {"id": user.id, "username": user.username or user.email, "name": user.name, "email": user.email, "role": user.role}


def app_user_from_django_superuser(django_user):
    email = (django_user.email or f"{django_user.username}@django.local").strip().lower()
    name = django_user.get_full_name() or django_user.username
    user = User.objects.filter(Q(username__iexact=django_user.username) | Q(email__iexact=email)).first()
    password_hash = bcrypt.hashpw(secrets.token_urlsafe(32).encode(), bcrypt.gensalt()).decode()
    defaults = {
        "username": django_user.username,
        "name": name,
        "email": email,
        "role": Role.ADMIN,
        "active": True,
    }
    if user:
        for field, value in defaults.items():
            setattr(user, field, value)
        user.save()
        return user
    return User.objects.create(password_hash=password_hash, **defaults)


def login_identifier(body):
    return str(body.get("username") or body.get("email") or body.get("identifier") or "").strip()


def auth_required(roles=None):
    roles = set(roles or [])

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            auth = request.headers.get("Authorization", "")
            token = auth[7:] if auth.startswith("Bearer ") else None
            if not token:
                return json_error("Authentication required", status=401)
            try:
                payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            except jwt.PyJWTError:
                return json_error("Invalid or expired session", status=401)
            if roles and payload.get("role") not in roles:
                return json_error("Insufficient permissions", status=403)
            request.user_payload = payload
            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def category_json(category):
    return {
        "id": category.id,
        "name": category.name,
        "createdAt": iso(category.created_at),
    }


def supplier_json(supplier, include_children=False):
    data = {
        "id": supplier.id,
        "name": supplier.name,
        "contact": supplier.contact,
        "email": supplier.email,
        "address": supplier.address,
        "createdAt": iso(supplier.created_at),
        "updatedAt": iso(supplier.updated_at),
    }
    if include_children:
        data["deliveries"] = [delivery_json(item) for item in supplier.deliveries.all()]
        data["payments"] = [payment_json(item) for item in supplier.payments.all()]
    return data


def product_json(product, include_relations=False):
    data = {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "sku": product.sku or "",
        "serialCode": product.serial_code or "",
        "categoryId": product.category_id,
        "quantity": product.quantity,
        "costPrice": 0,
        "sellingPrice": to_float(product.selling_price),
        "lowStockAt": product.low_stock_at,
        "supplierId": product.supplier_id,
        "createdAt": iso(product.created_at),
        "updatedAt": iso(product.updated_at),
    }
    if include_relations:
        data["category"] = category_json(product.category) if product.category_id else None
        data["supplier"] = supplier_json(product.supplier) if product.supplier_id else None
    return data


def customer_json(customer, include_children=False):
    data = {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "createdAt": iso(customer.created_at),
        "updatedAt": iso(customer.updated_at),
    }
    if include_children:
        data["debts"] = [debt_json(debt) for debt in customer.debts.all()]
        data["sales"] = [sale_json(sale) for sale in customer.sales.all()]
    return data


def sale_item_json(item, include_product=False):
    data = {
        "id": item.id,
        "saleId": item.sale_id,
        "productId": item.product_id,
        "quantity": item.quantity,
        "unitPrice": to_float(item.unit_price),
        "total": to_float(item.total),
    }
    if include_product:
        data["product"] = product_json(item.product)
    return data


def sale_json(sale, include_relations=False):
    data = {
        "id": sale.id,
        "invoiceNo": sale.invoice_no,
        "customerId": sale.customer_id,
        "subtotal": to_float(sale.subtotal),
        "discount": to_float(sale.discount),
        "total": to_float(sale.total),
        "amountPaid": to_float(sale.amount_paid),
        "paymentMethod": sale.payment_method,
        "status": sale.status,
        "createdAt": iso(sale.created_at),
        "updatedAt": iso(sale.updated_at),
    }
    if include_relations:
        data["customer"] = customer_json(sale.customer)
        data["items"] = [sale_item_json(item, include_product=True) for item in sale.items.all()]
    return data


def debt_json(debt, include_relations=False):
    data = {
        "id": debt.id,
        "customerId": debt.customer_id,
        "saleId": debt.sale_id,
        "total": to_float(debt.total),
        "amountPaid": to_float(debt.amount_paid),
        "dueDate": iso(debt.due_date),
        "status": debt.status,
        "createdAt": iso(debt.created_at),
        "updatedAt": iso(debt.updated_at),
    }
    if include_relations:
        data["customer"] = customer_json(debt.customer)
        data["payments"] = [payment_json(payment) for payment in debt.payments.all()]
    return data


def delivery_json(delivery):
    return {
        "id": delivery.id,
        "supplierId": delivery.supplier_id,
        "productName": delivery.product_name,
        "quantity": delivery.quantity,
        "costPrice": to_float(delivery.cost_price),
        "total": to_float(delivery.total),
        "amountPaid": to_float(delivery.amount_paid),
        "deliveredAt": iso(delivery.delivered_at),
    }


def expense_json(expense):
    return {
        "id": expense.id,
        "category": expense.category,
        "description": expense.description,
        "amount": to_float(expense.amount),
        "date": iso(expense.date),
        "createdAt": iso(expense.created_at),
    }


def payment_json(payment):
    return {
        "id": payment.id,
        "customerId": payment.customer_id,
        "supplierId": payment.supplier_id,
        "saleId": payment.sale_id,
        "debtId": payment.debt_id,
        "amount": to_float(payment.amount),
        "method": payment.method,
        "reference": payment.reference,
        "paidAt": iso(payment.paid_at),
    }


def notification_json(notification):
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "priority": notification.priority,
        "readAt": iso(notification.read_at),
        "createdAt": iso(notification.created_at),
    }


def decimal_from_body(body, key, default=None):
    value = body.get(key, default)
    return Decimal(str(value)) if value is not None else None


def parse_datetime(value):
    if not value:
        return None
    parsed = timezone.datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed)


def frontend_id(value, prefix):
    value = str(value or f"{prefix}-{int(time.time() * 1000)}")
    return value[:32]


def frontend_date(value):
    return parse_datetime(value) or timezone.now()


def sync_business_data_to_tables(payload):
    categories = {}
    suppliers = {}
    products = {}
    customers = {}

    def category_for(name):
        name = str(name or "Uncategorized").strip() or "Uncategorized"
        if name not in categories:
            categories[name], _ = Category.objects.get_or_create(name=name)
        return categories[name]

    def supplier_for(name, supplier_id=None, defaults=None):
        name = str(name or "").strip()
        if not name:
            return None
        if name not in suppliers:
            defaults = defaults or {}
            supplier = Supplier.objects.filter(name=name).first()
            if supplier:
                for field, value in defaults.items():
                    setattr(supplier, field, value)
                supplier.save()
            else:
                supplier = Supplier.objects.create(
                    id=frontend_id(supplier_id, "SUP"),
                    name=name,
                    **defaults,
                )
            suppliers[name] = supplier
        return suppliers[name]

    def customer_for(name):
        name = str(name or "Walk-in Customer").strip() or "Walk-in Customer"
        if name not in customers:
            customers[name], _ = Customer.objects.get_or_create(name=name)
        return customers[name]

    for item in payload.get("suppliers", []):
        supplier = supplier_for(
            item.get("name"),
            item.get("id"),
            {
                "contact": item.get("contact") or None,
                "email": item.get("email") or None,
                "address": item.get("address") or None,
            },
        )
        if not supplier:
            continue
        delivery_id = frontend_id(f"DEL-{item.get('id', supplier.id)}", "DEL")
        Delivery.objects.update_or_create(
            id=delivery_id,
            defaults={
                "supplier": supplier,
                "product_name": item.get("product") or "Unspecified product",
                "quantity": int(item.get("quantity") or 0),
                "cost_price": decimal_from_body(item, "costPrice", 0),
                "total": decimal_from_body(item, "total", 0),
                "amount_paid": decimal_from_body(item, "paid", 0),
                "delivered_at": frontend_date(item.get("deliveryDate")),
            },
        )

    for item in payload.get("products", []):
        product_id = frontend_id(item.get("id"), "P")
        serial_code = str(item.get("serialCode") or "").strip() or None
        supplier = supplier_for(item.get("supplier"))
        product = Product.objects.filter(id=product_id).first()
        if product is None and serial_code:
            product = Product.objects.filter(Q(serial_code__iexact=serial_code) | Q(sku__iexact=serial_code)).first()

        defaults = {
            "name": item.get("name") or "Unnamed product",
            "description": item.get("description") or None,
            "sku": serial_code,
            "serial_code": serial_code,
            "category": category_for(item.get("category")),
            "quantity": int(item.get("quantity") or 0),
            "cost_price": Decimal("0"),
            "selling_price": decimal_from_body(item, "unitPrice", 0),
            "low_stock_at": int(item.get("lowStockAt") or 0),
            "supplier": supplier,
        }
        if product is None:
            product = Product.objects.create(id=product_id, **defaults)
        else:
            for field, value in defaults.items():
                setattr(product, field, value)
            product.save()
        products[item.get("id")] = product
        for entry in item.get("transactionHistory", []):
            InventoryLog.objects.update_or_create(
                id=frontend_id(entry.get("id"), "TX"),
                defaults={
                    "product": product,
                    "type": entry.get("type") or "Adjustment",
                    "quantity": int(entry.get("quantity") or 0),
                    "note": entry.get("note") or None,
                    "created_at": frontend_date(entry.get("date")),
                },
            )

    status_map = {"Paid": PaymentStatus.PAID, "Partial": PaymentStatus.PARTIAL, "Unpaid": PaymentStatus.UNPAID}
    for item in payload.get("sales", []):
        sale_id = frontend_id(item.get("id"), "SALE")
        total = decimal_from_body(item, "total", 0)
        paid = decimal_from_body(item, "paid", 0)
        sale, _ = Sale.objects.update_or_create(
            id=sale_id,
            defaults={
                "invoice_no": item.get("id") or sale_id,
                "customer": customer_for(item.get("customer")),
                "subtotal": total,
                "discount": Decimal("0"),
                "total": total,
                "amount_paid": paid,
                "payment_method": item.get("method") or "Cash",
                "status": status_map.get(item.get("status"), PaymentStatus.UNPAID),
                "created_at": frontend_date(item.get("date")),
            },
        )
        product = next((value for value in products.values() if value.name == item.get("product")), None)
        if product:
            quantity = max(1, int(item.get("quantity") or 1))
            SaleItem.objects.update_or_create(
                id=frontend_id(f"ITEM-{sale_id}", "ITEM"),
                defaults={
                    "sale": sale,
                    "product": product,
                    "quantity": quantity,
                    "unit_price": total / quantity,
                    "total": total,
                },
            )

    debt_status_map = {"Current": DebtStatus.CURRENT, "Overdue": DebtStatus.OVERDUE, "Settled": DebtStatus.SETTLED}
    for item in payload.get("debts", []):
        debt, _ = Debt.objects.update_or_create(
            id=frontend_id(item.get("id"), "D"),
            defaults={
                "customer": customer_for(item.get("customer")),
                "total": decimal_from_body(item, "total", 0),
                "amount_paid": decimal_from_body(item, "paid", 0),
                "due_date": frontend_date(item.get("dueDate")),
                "status": debt_status_map.get(item.get("status"), DebtStatus.CURRENT),
            },
        )
        for entry in item.get("paymentHistory", []):
            Payment.objects.update_or_create(
                id=frontend_id(entry.get("id"), "PAY"),
                defaults={
                    "customer": debt.customer,
                    "debt": debt,
                    "amount": decimal_from_body(entry, "amount", 0),
                    "method": entry.get("method") or "Cash",
                    "reference": entry.get("reference") or None,
                    "paid_at": frontend_date(entry.get("date")),
                },
            )

    for item in payload.get("expenses", []):
        Expense.objects.update_or_create(
            id=frontend_id(item.get("id"), "EXP"),
            defaults={
                "category": item.get("category") or "Other",
                "description": item.get("description") or "",
                "amount": decimal_from_body(item, "amount", 0),
                "date": frontend_date(item.get("date")),
            },
        )

    for item in payload.get("customerRequests", []):
        CustomerRequest.objects.update_or_create(
            id=frontend_id(item.get("id"), "REQ"),
            defaults={
                "product_name": item.get("productName") or "Unspecified product",
                "quantity": int(item.get("quantity") or 0),
                "customer_name": item.get("customerName") or None,
                "date_requested": frontend_date(item.get("dateRequested")).date(),
                "notes": item.get("notes") or None,
                "status": item.get("status") or "Open",
            },
        )


def business_data_from_tables():
    product_queryset = Product.objects.select_related("category", "supplier").prefetch_related(
        Prefetch("stock_logs", queryset=InventoryLog.objects.order_by("-created_at"), to_attr="prefetched_stock_logs")
    ).order_by("name")
    products = [
        {
            "id": item.id,
            "serialCode": item.serial_code or "",
            "name": item.name,
            "description": item.description or "",
            "category": item.category.name if item.category_id else "Uncategorized",
            "quantity": item.quantity,
            "unitPrice": to_float(item.selling_price),
            "costPrice": 0,
            "supplier": item.supplier.name if item.supplier_id else "",
            "dateAdded": item.created_at.date().isoformat(),
            "updatedAt": item.updated_at.date().isoformat(),
            "lowStockAt": item.low_stock_at,
            "transactionHistory": [
                {
                    "id": log.id,
                    "type": log.type,
                    "quantity": log.quantity,
                    "note": log.note or "",
                    "date": log.created_at.date().isoformat(),
                }
                for log in getattr(item, "prefetched_stock_logs", [])
            ],
        }
        for item in product_queryset
    ]
    categories = list(Category.objects.order_by("name").values_list("name", flat=True))
    suppliers = []
    for supplier in Supplier.objects.prefetch_related("deliveries").order_by("name"):
        delivery = supplier.deliveries.order_by("-delivered_at").first()
        suppliers.append({
            "id": supplier.id,
            "name": supplier.name,
            "contact": supplier.contact or "",
            "email": supplier.email or "",
            "address": supplier.address or "",
            "product": delivery.product_name if delivery else "",
            "quantity": delivery.quantity if delivery else 0,
            "costPrice": to_float(delivery.cost_price) if delivery else 0,
            "total": to_float(delivery.total) if delivery else 0,
            "paid": to_float(delivery.amount_paid) if delivery else 0,
            "deliveryDate": delivery.delivered_at.date().isoformat() if delivery else timezone.now().date().isoformat(),
            "dueDate": "",
        })
    sales = []
    for sale in Sale.objects.select_related("customer").prefetch_related("items__product").order_by("-created_at"):
        items = list(sale.items.all())
        sales.append({
            "id": sale.invoice_no,
            "customer": sale.customer.name,
            "product": ", ".join(item.product.name for item in items),
            "quantity": sum(item.quantity for item in items),
            "total": to_float(sale.total),
            "paid": to_float(sale.amount_paid),
            "status": sale.status.title().replace("Unpaid", "Unpaid"),
            "date": sale.created_at.date().isoformat(),
            "method": sale.payment_method,
        })
    debts = []
    for debt in Debt.objects.select_related("customer", "sale").prefetch_related("payments", "sale__items__product").order_by("due_date"):
        sale_items = list(debt.sale.items.all()) if debt.sale_id else []
        debts.append({
            "id": debt.id,
            "customer": debt.customer.name,
            "product": ", ".join(item.product.name for item in sale_items),
            "quantity": sum(item.quantity for item in sale_items),
            "total": to_float(debt.total),
            "paid": to_float(debt.amount_paid),
            "dueDate": debt.due_date.date().isoformat(),
            "status": debt.status.title(),
            "paymentHistory": [
                {
                    "id": payment.id,
                    "amount": to_float(payment.amount),
                    "method": payment.method,
                    "date": payment.paid_at.date().isoformat(),
                    "reference": payment.reference or "",
                }
                for payment in debt.payments.order_by("-paid_at")
            ],
        })
    return {
        "products": products,
        "categories": categories,
        "suppliers": suppliers,
        "expenses": [
            {
                "id": item.id,
                "category": item.category,
                "description": item.description,
                "amount": to_float(item.amount),
                "date": item.date.date().isoformat(),
            }
            for item in Expense.objects.order_by("-date")
        ],
        "debts": debts,
        "sales": sales,
        "cart": [],
        "customerRequests": [
            {
                "id": item.id,
                "productName": item.product_name,
                "quantity": item.quantity,
                "customerName": item.customer_name or "",
                "dateRequested": item.date_requested.isoformat(),
                "notes": item.notes or "",
                "status": item.status,
            }
            for item in CustomerRequest.objects.order_by("-date_requested")
        ],
    }


@require_http_methods(["GET"])
def health(_request):
    return JsonResponse({"ok": True, "service": "PayTrack Kings Store Cosmetics API"})


@csrf_exempt
@require_http_methods(["GET", "PUT"])
@auth_required()
def business_snapshot(request):
    if request.method == "GET":
        return JsonResponse({"data": business_data_from_tables(), "updatedAt": timezone.now().isoformat()})

    body = json_body(request)
    payload = body.get("data", body)
    with transaction.atomic():
        sync_business_data_to_tables(payload)
    return JsonResponse({"ok": True, "data": business_data_from_tables(), "updatedAt": timezone.now().isoformat()})


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    body = json_body(request)
    identifier = login_identifier(body)
    password = str(body.get("password", ""))
    if not identifier or not password:
        return json_error("Username and password are required.", status=400)

    django_user = authenticate(request, username=identifier, password=password)
    if django_user and django_user.is_active and django_user.is_superuser:
        user = app_user_from_django_superuser(django_user)
        return JsonResponse({"token": sign_token(user), "user": user_response(user)})

    user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier), active=True).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        return json_error("Invalid username or password", status=401)
    return JsonResponse({
        "token": sign_token(user),
        "user": user_response(user),
    })


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    if not settings.REGISTRATION_ENABLED:
        return json_error("Registration is disabled.", status=403)
    body = json_body(request)
    username = str(body.get("username", "")).strip().lower()
    name = str(body.get("name", "")).strip()
    email = str(body.get("email", "")).strip().lower()
    password = str(body.get("password", ""))
    role = str(body.get("role", Role.STAFF)).upper()
    allowed_roles = {Role.STAFF, Role.ACCOUNTANT, Role.WAREHOUSE}

    if not username:
        return json_error("Username is required.")
    if not re.match(r"^[a-zA-Z0-9_.-]{3,150}$", username):
        return json_error("Username must be 3-150 characters and use only letters, numbers, dots, dashes, or underscores.")
    if not name:
        return json_error("Full name is required.")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return json_error("Enter a valid email address.")
    if len(password) < 8:
        return json_error("Password must be at least 8 characters.")
    if role not in allowed_roles:
        role = Role.STAFF
    if User.objects.filter(username__iexact=username).exists():
        return json_error("An account with this username already exists.", status=409)
    if User.objects.filter(email=email).exists():
        return json_error("An account with this email already exists.", status=409)

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user = User.objects.create(
        username=username,
        name=name,
        email=email,
        password_hash=password_hash,
        role=role,
        active=True,
    )
    return JsonResponse({"token": sign_token(user), "user": user_response(user)}, status=201)


@require_http_methods(["GET"])
@auth_required()
def me(request):
    user = User.objects.filter(id=request.user_payload.get("id"), active=True).first()
    if not user:
        return json_error("Invalid or expired session", status=401)
    return JsonResponse({"user": user_response(user)})


@require_http_methods(["GET"])
@auth_required()
def dashboard(_request):
    products = Product.objects.select_related("category", "supplier").order_by("-updated_at")
    sales = Sale.objects.select_related("customer").prefetch_related("items__product").order_by("-created_at")[:12]
    debts = Debt.objects.select_related("customer").order_by("due_date")
    expenses = Expense.objects.order_by("-date")[:25]
    suppliers = Supplier.objects.order_by("name")
    notifications = Notification.objects.filter(read_at__isnull=True).order_by("-created_at")[:20]
    return JsonResponse({
        "products": [product_json(item, include_relations=True) for item in products],
        "sales": [sale_json(item, include_relations=True) for item in sales],
        "debts": [debt_json(item, include_relations=True) for item in debts],
        "expenses": [expense_json(item) for item in expenses],
        "suppliers": [supplier_json(item) for item in suppliers],
        "notifications": [notification_json(item) for item in notifications],
    })


@csrf_exempt
@require_http_methods(["GET", "POST"])
@auth_required()
def products(request):
    if request.method == "GET":
        queryset = Product.objects.select_related("category", "supplier")
        return JsonResponse([product_json(item, include_relations=True) for item in queryset], safe=False)
    if request.user_payload["role"] not in {"ADMIN", "WAREHOUSE"}:
        return json_error("Insufficient permissions", status=403)
    body = json_body(request)
    product = Product.objects.create(
        name=body["name"],
        description=body.get("description"),
        sku=body.get("sku") or body.get("serialCode") or None,
        serial_code=body.get("serialCode") or None,
        category_id=body["categoryId"],
        quantity=int(body.get("quantity", 0)),
        cost_price=Decimal("0"),
        selling_price=decimal_from_body(body, "sellingPrice", 0),
        low_stock_at=int(body.get("lowStockAt", 20)),
        supplier_id=body.get("supplierId") or None,
    )
    InventoryLog.objects.create(product=product, type="STOCK_IN", quantity=product.quantity, note="Initial stock")
    return JsonResponse(product_json(product), status=201)


@csrf_exempt
@require_http_methods(["PATCH", "DELETE"])
@auth_required(["ADMIN", "WAREHOUSE"])
def product_detail(request, product_id):
    product = Product.objects.get(id=product_id)
    if request.method == "DELETE":
        if request.user_payload["role"] != "ADMIN":
            return json_error("Insufficient permissions", status=403)
        product.delete()
        return JsonResponse({}, status=204)
    body = json_body(request)
    field_map = {
        "name": "name",
        "description": "description",
        "sku": "sku",
        "serialCode": "serial_code",
        "categoryId": "category_id",
        "quantity": "quantity",
        "sellingPrice": "selling_price",
        "lowStockAt": "low_stock_at",
        "supplierId": "supplier_id",
    }
    for body_key, model_key in field_map.items():
        if body_key in body:
            value = body[body_key]
            if body_key in {"sku", "serialCode"} and not value:
                value = None
            setattr(product, model_key, value)
    product.cost_price = Decimal("0")
    product.save()
    return JsonResponse(product_json(product))


@require_http_methods(["GET"])
@auth_required()
def categories(_request):
    return JsonResponse([category_json(item) for item in Category.objects.order_by("name")], safe=False)


@require_http_methods(["GET"])
@auth_required()
def customers(_request):
    queryset = Customer.objects.prefetch_related("debts", "sales").order_by("name")
    return JsonResponse([customer_json(item, include_children=True) for item in queryset], safe=False)


@csrf_exempt
@require_http_methods(["GET", "POST"])
@auth_required()
def sales(request):
    if request.method == "GET":
        queryset = Sale.objects.select_related("customer").prefetch_related("items__product").order_by("-created_at")
        return JsonResponse([sale_json(item, include_relations=True) for item in queryset], safe=False)
    if request.user_payload["role"] not in {"ADMIN", "STAFF"}:
        return json_error("Insufficient permissions", status=403)

    body = json_body(request)
    items = body.get("items", [])
    subtotal = sum(Decimal(str(item["quantity"])) * Decimal(str(item["unitPrice"])) for item in items)
    discount = decimal_from_body(body, "discount", 0)
    amount_paid = decimal_from_body(body, "amountPaid", 0)
    total = subtotal - discount
    status = PaymentStatus.PAID if amount_paid >= total else PaymentStatus.PARTIAL if amount_paid > 0 else PaymentStatus.UNPAID

    with transaction.atomic():
        sale = Sale.objects.create(
            invoice_no=f"INV-{int(time.time() * 1000)}",
            customer_id=body["customerId"],
            subtotal=subtotal,
            discount=discount,
            total=total,
            amount_paid=amount_paid,
            payment_method=body["paymentMethod"],
            status=status,
        )
        for item in items:
            product = Product.objects.select_for_update().get(id=item["productId"])
            quantity = int(item["quantity"])
            unit_price = Decimal(str(item["unitPrice"]))
            SaleItem.objects.create(sale=sale, product=product, quantity=quantity, unit_price=unit_price, total=quantity * unit_price)
            product.quantity -= quantity
            product.save(update_fields=["quantity", "updated_at"])
            InventoryLog.objects.create(product=product, type="STOCK_OUT", quantity=quantity, note=sale.invoice_no)
        if amount_paid < total:
            due_date = parse_datetime(body.get("dueDate")) or timezone.now() + timedelta(days=7)
            Debt.objects.create(customer_id=body["customerId"], sale=sale, total=total, amount_paid=amount_paid, due_date=due_date, status=DebtStatus.CURRENT)
    return JsonResponse(sale_json(Sale.objects.prefetch_related("items").get(id=sale.id), include_relations=True), status=201)


@require_http_methods(["GET"])
@auth_required()
def debts(_request):
    queryset = Debt.objects.select_related("customer").prefetch_related("payments").order_by("due_date")
    return JsonResponse([debt_json(item, include_relations=True) for item in queryset], safe=False)


@csrf_exempt
@require_http_methods(["GET", "POST"])
@auth_required()
def suppliers(request):
    if request.method == "GET":
        queryset = Supplier.objects.prefetch_related("deliveries", "payments").order_by("name")
        return JsonResponse([supplier_json(item, include_children=True) for item in queryset], safe=False)
    if request.user_payload["role"] not in {"ADMIN", "WAREHOUSE"}:
        return json_error("Insufficient permissions", status=403)
    body = json_body(request)
    supplier = Supplier.objects.create(name=body["name"], contact=body.get("contact"), email=body.get("email"), address=body.get("address"))
    return JsonResponse(supplier_json(supplier), status=201)


@csrf_exempt
@require_http_methods(["GET", "POST"])
@auth_required(["ADMIN", "ACCOUNTANT"])
def expenses(request):
    if request.method == "GET":
        return JsonResponse([expense_json(item) for item in Expense.objects.order_by("-date")], safe=False)
    body = json_body(request)
    expense = Expense.objects.create(category=body["category"], description=body["description"], amount=decimal_from_body(body, "amount"), date=parse_datetime(body["date"]))
    return JsonResponse(expense_json(expense), status=201)


@csrf_exempt
@require_http_methods(["POST"])
@auth_required(["ADMIN", "ACCOUNTANT", "STAFF"])
def payments(request):
    body = json_body(request)
    with transaction.atomic():
        payment = Payment.objects.create(
            customer_id=body.get("customerId") or None,
            supplier_id=body.get("supplierId") or None,
            sale_id=body.get("saleId") or None,
            debt_id=body.get("debtId") or None,
            amount=decimal_from_body(body, "amount"),
            method=body["method"],
            reference=body.get("reference"),
        )
        if payment.debt_id:
            debt = Debt.objects.select_for_update().get(id=payment.debt_id)
            debt.amount_paid += payment.amount
            debt.status = DebtStatus.SETTLED if debt.amount_paid >= debt.total else DebtStatus.CURRENT
            debt.save(update_fields=["amount_paid", "status", "updated_at"])
    return JsonResponse(payment_json(payment), status=201)


@require_http_methods(["GET"])
@auth_required()
def notifications(_request):
    return JsonResponse([notification_json(item) for item in Notification.objects.order_by("-created_at")], safe=False)


@require_http_methods(["GET"])
@auth_required(["ADMIN", "ACCOUNTANT"])
def reports(request, report_type):
    return JsonResponse({
        "type": report_type,
        "generatedAt": timezone.now().isoformat(),
        "sales": [sale_json(item, include_relations=True) for item in Sale.objects.select_related("customer").prefetch_related("items")],
        "debts": [debt_json(item, include_relations=True) for item in Debt.objects.select_related("customer")],
        "expenses": [expense_json(item) for item in Expense.objects.all()],
        "inventory": [product_json(item, include_relations=True) for item in Product.objects.select_related("category")],
    })
