/**
 * Repo in-memory — interface cố định để tuần 3 swap sang Postgres mà KHÔNG sửa service:
 * save(order), findById(id), findByIdempotencyKey(key).
 */
const crypto = require('crypto');

class InMemoryOrderRepo {
  constructor() {
    this.orders = new Map();   // id -> order
    this.idemKeys = new Map(); // idempotencyKey -> orderId
  }

  async save(order, idempotencyKey) {
    const id = order.id || crypto.randomUUID();
    const saved = { ...order, id };
    this.orders.set(id, saved);
    if (idempotencyKey) this.idemKeys.set(idempotencyKey, id);
    return saved;
  }

  async findById(id) {
    return this.orders.get(id) || null;
  }

  async findByIdempotencyKey(key) {
    const id = this.idemKeys.get(key);
    return id ? this.orders.get(id) || null : null;
  }
}

module.exports = { InMemoryOrderRepo };
