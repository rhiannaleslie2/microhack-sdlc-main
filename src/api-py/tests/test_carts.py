from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    db_file = tmp_path / "carts.db"
    monkeypatch.setenv("DB_FILE", str(db_file))
    with TestClient(app) as test_client:
        yield test_client


def test_cart_add_update_remove_and_discounted_total(client: TestClient) -> None:
    created = client.post("/api/carts")
    assert created.status_code == 201
    cart_id = created.json()["cartId"]
    assert created.json()["items"] == []
    assert created.json()["total"] == 0

    added = client.post(
        f"/api/carts/{cart_id}/items",
        json={"productId": 1, "quantity": 2},
    )
    assert added.status_code == 200
    assert added.json()["itemCount"] == 2
    assert added.json()["items"][0]["unitPrice"] == 97.49
    assert added.json()["items"][0]["lineTotal"] == 194.98
    assert added.json()["total"] == 194.98

    incremented = client.post(
        f"/api/carts/{cart_id}/items",
        json={"productId": 1, "quantity": 1},
    )
    assert incremented.json()["items"][0]["quantity"] == 3
    assert incremented.json()["total"] == 292.47

    updated = client.put(
        f"/api/carts/{cart_id}/items/1",
        json={"quantity": 1},
    )
    assert updated.json()["itemCount"] == 1
    assert updated.json()["total"] == 97.49

    removed = client.delete(f"/api/carts/{cart_id}/items/1")
    assert removed.status_code == 204
    assert client.get(f"/api/carts/{cart_id}").json()["items"] == []


def test_cart_is_persisted_between_api_sessions(client: TestClient) -> None:
    created = client.post("/api/carts").json()
    cart_id = created["cartId"]
    client.post(
        f"/api/carts/{cart_id}/items",
        json={"productId": 3, "quantity": 2},
    )

    with TestClient(app) as restarted_client:
        persisted = restarted_client.get(f"/api/carts/{cart_id}")

    assert persisted.status_code == 200
    assert persisted.json()["items"][0]["quantity"] == 2
    assert persisted.json()["total"] == 179.98


def test_cart_validates_quantity_and_product(client: TestClient) -> None:
    cart_id = client.post("/api/carts").json()["cartId"]

    invalid_quantity = client.post(
        f"/api/carts/{cart_id}/items",
        json={"productId": 1, "quantity": 0},
    )
    assert invalid_quantity.status_code == 400

    missing_product = client.post(
        f"/api/carts/{cart_id}/items",
        json={"productId": 9999, "quantity": 1},
    )
    assert missing_product.status_code == 404

    missing_cart = client.get("/api/carts/not-a-cart")
    assert missing_cart.status_code == 404


def test_cart_rejects_updates_to_missing_items(client: TestClient) -> None:
    cart_id = client.post("/api/carts").json()["cartId"]
    response = client.put(
        f"/api/carts/{cart_id}/items/1",
        json={"quantity": 1},
    )
    assert response.status_code == 404
