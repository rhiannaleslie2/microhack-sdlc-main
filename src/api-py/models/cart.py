from __future__ import annotations

from pydantic import BaseModel


class CartItem(BaseModel):
    productId: int
    name: str
    imgName: str | None = None
    sku: str
    quantity: int
    unitPrice: float
    lineTotal: float


class Cart(BaseModel):
    cartId: str
    items: list[CartItem]
    itemCount: int
    total: float


class AddCartItemRequest(BaseModel):
    productId: int
    quantity: int


class UpdateCartItemRequest(BaseModel):
    quantity: int
