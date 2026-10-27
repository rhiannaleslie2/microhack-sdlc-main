from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

import aiosqlite

from database.sqlite import get_connection
from models.cart import Cart, CartItem
from utils.errors import DatabaseException, NotFoundException, ValidationException


class CartsRepository:
    async def create(self) -> Cart:
        cart_id = str(uuid4())
        async with get_connection() as connection:
            await connection.execute("INSERT INTO carts (cart_id) VALUES (?);", (cart_id,))
            await connection.commit()
            cart = await self._find(connection, cart_id)
        if cart is None:
            raise DatabaseException("Failed to retrieve created Cart")
        return cart

    async def find_by_id(self, cart_id: str) -> Cart | None:
        async with get_connection() as connection:
            return await self._find(connection, cart_id)

    async def add_item(self, cart_id: str, product_id: int, quantity: int) -> Cart:
        if quantity <= 0:
            raise ValidationException("quantity must be greater than zero")

        async with get_connection() as connection:
            await self._ensure_cart(connection, cart_id)
            cursor = await connection.execute(
                "SELECT 1 FROM products WHERE product_id = ?;",
                (product_id,),
            )
            if await cursor.fetchone() is None:
                raise NotFoundException("Product", product_id)

            await connection.execute(
                """
                INSERT INTO cart_items (cart_id, product_id, quantity)
                VALUES (?, ?, ?)
                ON CONFLICT (cart_id, product_id)
                DO UPDATE SET quantity = cart_items.quantity + excluded.quantity;
                """,
                (cart_id, product_id, quantity),
            )
            await connection.commit()
            cart = await self._find(connection, cart_id)

        if cart is None:
            raise DatabaseException("Failed to retrieve updated Cart")
        return cart

    async def update_item(self, cart_id: str, product_id: int, quantity: int) -> Cart:
        if quantity <= 0:
            raise ValidationException("quantity must be greater than zero")

        async with get_connection() as connection:
            await self._ensure_cart(connection, cart_id)
            cursor = await connection.execute(
                "SELECT 1 FROM cart_items WHERE cart_id = ? AND product_id = ?;",
                (cart_id, product_id),
            )
            if await cursor.fetchone() is None:
                raise NotFoundException("Cart item", f"{cart_id}/{product_id}")

            await connection.execute(
                "UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?;",
                (quantity, cart_id, product_id),
            )
            await connection.commit()
            cart = await self._find(connection, cart_id)

        if cart is None:
            raise DatabaseException("Failed to retrieve updated Cart")
        return cart

    async def remove_item(self, cart_id: str, product_id: int) -> None:
        async with get_connection() as connection:
            await self._ensure_cart(connection, cart_id)
            cursor = await connection.execute(
                "SELECT 1 FROM cart_items WHERE cart_id = ? AND product_id = ?;",
                (cart_id, product_id),
            )
            if await cursor.fetchone() is None:
                raise NotFoundException("Cart item", f"{cart_id}/{product_id}")

            await connection.execute(
                "DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?;",
                (cart_id, product_id),
            )
            await connection.commit()

    @staticmethod
    async def _ensure_cart(connection: aiosqlite.Connection, cart_id: str) -> None:
        cursor = await connection.execute("SELECT 1 FROM carts WHERE cart_id = ?;", (cart_id,))
        if await cursor.fetchone() is None:
            raise NotFoundException("Cart", cart_id)

    @staticmethod
    async def _find(connection: aiosqlite.Connection, cart_id: str) -> Cart | None:
        cursor = await connection.execute("SELECT 1 FROM carts WHERE cart_id = ?;", (cart_id,))
        if await cursor.fetchone() is None:
            return None

        cursor = await connection.execute(
            """
            SELECT ci.product_id, ci.quantity, p.name, p.img_name, p.sku, p.price,
                   COALESCE(p.discount, 0) AS discount
            FROM cart_items ci
            JOIN products p ON p.product_id = ci.product_id
            WHERE ci.cart_id = ?
            ORDER BY ci.product_id;
            """,
            (cart_id,),
        )
        rows = await cursor.fetchall()

        items: list[CartItem] = []
        total_cents = 0
        item_count = 0
        for row in rows:
            price = Decimal(str(row["price"]))
            discount = Decimal(str(row["discount"]))
            if price < 0 or discount < 0 or discount > 1:
                raise DatabaseException(f"Product {row['product_id']} has invalid cart pricing")

            unit_cents = int(
                (price * (Decimal("1") - discount) * 100).quantize(
                    Decimal("1"), rounding=ROUND_HALF_UP
                )
            )
            quantity = int(row["quantity"])
            line_cents = unit_cents * quantity
            total_cents += line_cents
            item_count += quantity
            items.append(
                CartItem(
                    productId=row["product_id"],
                    name=row["name"],
                    imgName=row["img_name"],
                    sku=row["sku"],
                    quantity=quantity,
                    unitPrice=unit_cents / 100,
                    lineTotal=line_cents / 100,
                )
            )

        return Cart(
            cartId=cart_id,
            items=items,
            itemCount=item_count,
            total=total_cents / 100,
        )
