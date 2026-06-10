from decimal import Decimal

from django.db import models
from django.utils import timezone


def cuid() -> str:
    return f"c{timezone.now().strftime('%Y%m%d%H%M%S%f')}"


class Role(models.TextChoices):
    ADMIN = "ADMIN", "Admin"
    STAFF = "STAFF", "Staff"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"
    WAREHOUSE = "WAREHOUSE", "Warehouse"


class PaymentStatus(models.TextChoices):
    PAID = "PAID", "Paid"
    PARTIAL = "PARTIAL", "Partial"
    UNPAID = "UNPAID", "Unpaid"


class DebtStatus(models.TextChoices):
    CURRENT = "CURRENT", "Current"
    OVERDUE = "OVERDUE", "Overdue"
    SETTLED = "SETTLED", "Settled"


class BaseModel(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=cuid, editable=False)

    class Meta:
        abstract = True


class User(BaseModel):
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255, db_column="passwordHash")
    role = models.CharField(max_length=20, choices=Role, default=Role.STAFF)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "User"

    def __str__(self) -> str:
        return self.username or self.email


class Category(BaseModel):
    name = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Category"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Supplier(BaseModel):
    name = models.CharField(max_length=255)
    contact = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "Supplier"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(BaseModel):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    sku = models.CharField(max_length=255, unique=True, blank=True, null=True)
    serial_code = models.CharField("barcode", max_length=255, unique=True, blank=True, null=True, db_column="serialCode")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products", db_column="categoryId")
    quantity = models.IntegerField(default=0)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), db_column="costPrice")
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, db_column="sellingPrice")
    low_stock_at = models.IntegerField(default=20, db_column="lowStockAt")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, blank=True, null=True, related_name="products", db_column="supplierId")
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "Product"

    def __str__(self) -> str:
        return self.name


class Customer(BaseModel):
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "Customer"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Sale(BaseModel):
    invoice_no = models.CharField(max_length=255, unique=True, db_column="invoiceNo")
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="sales", db_column="customerId")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    total = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), db_column="amountPaid")
    payment_method = models.CharField(max_length=255, db_column="paymentMethod")
    status = models.CharField(max_length=20, choices=PaymentStatus, default=PaymentStatus.UNPAID)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "Sale"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.invoice_no


class SaleItem(BaseModel):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items", db_column="saleId")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items", db_column="productId")
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, db_column="unitPrice")
    total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "SaleItem"


class Debt(BaseModel):
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="debts", db_column="customerId")
    sale = models.OneToOneField(Sale, on_delete=models.SET_NULL, blank=True, null=True, related_name="debt", db_column="saleId")
    total = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), db_column="amountPaid")
    due_date = models.DateTimeField(db_column="dueDate")
    status = models.CharField(max_length=20, choices=DebtStatus, default=DebtStatus.CURRENT)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "Debt"
        ordering = ["due_date"]


class Delivery(BaseModel):
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="deliveries", db_column="supplierId")
    product_name = models.CharField(max_length=255, db_column="productName")
    quantity = models.IntegerField()
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, db_column="costPrice")
    total = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), db_column="amountPaid")
    delivered_at = models.DateTimeField(db_column="deliveredAt")

    class Meta:
        db_table = "Delivery"


class Expense(BaseModel):
    category = models.CharField(max_length=255)
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateTimeField()
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Expense"
        ordering = ["-date"]


class Payment(BaseModel):
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, blank=True, null=True, related_name="payments", db_column="customerId")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, blank=True, null=True, related_name="payments", db_column="supplierId")
    sale = models.ForeignKey(Sale, on_delete=models.SET_NULL, blank=True, null=True, related_name="payments", db_column="saleId")
    debt = models.ForeignKey(Debt, on_delete=models.SET_NULL, blank=True, null=True, related_name="payments", db_column="debtId")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=255)
    reference = models.CharField(max_length=255, blank=True, null=True)
    paid_at = models.DateTimeField(default=timezone.now, db_column="paidAt")

    class Meta:
        db_table = "Payment"


class InventoryLog(BaseModel):
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_logs", db_column="productId")
    type = models.CharField(max_length=255)
    quantity = models.IntegerField()
    note = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "InventoryLog"


class Report(BaseModel):
    type = models.CharField(max_length=255)
    title = models.CharField(max_length=255)
    payload = models.JSONField()
    generated_by = models.CharField(max_length=255, blank=True, null=True, db_column="generatedBy")
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Report"


class Notification(BaseModel):
    title = models.CharField(max_length=255)
    message = models.TextField()
    type = models.CharField(max_length=255)
    priority = models.CharField(max_length=255, default="Normal")
    read_at = models.DateTimeField(blank=True, null=True, db_column="readAt")
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")

    class Meta:
        db_table = "Notification"
        ordering = ["-created_at"]


class CustomerRequest(BaseModel):
    product_name = models.CharField(max_length=255, db_column="productName")
    quantity = models.IntegerField()
    customer_name = models.CharField(max_length=255, blank=True, null=True, db_column="customerName")
    date_requested = models.DateField(db_column="dateRequested")
    notes = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default="Open")
    created_at = models.DateTimeField(default=timezone.now, db_column="createdAt")
    updated_at = models.DateTimeField(auto_now=True, db_column="updatedAt")

    class Meta:
        db_table = "CustomerRequest"
        ordering = ["-date_requested"]
