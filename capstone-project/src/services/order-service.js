/**
 * Business logic thuần — không biết gì về HTTP hay storage cụ thể.
 * Pattern phỏng vấn hay hỏi: validation, idempotency key, dependency injection qua constructor.
 */
const { ValidationError, NotFoundError } = require('../lib/errors');

class OrderService {
  constructor(orderRepo) {
    this.repo = orderRepo;
  }

  /**
   * Tạo order. Nếu client gửi lại cùng Idempotency-Key (retry vì timeout)
   * thì trả lại order cũ thay vì tạo trùng — xem RAPID-FIRE Q38.
   */
  async createOrder(payload, idempotencyKey) {
    if (idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(idempotencyKey);
      if (existing) return { ...existing, idempotentReplay: true };
    }

    const items = payload?.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('items phải là mảng và không được rỗng');
    }
    for (const it of items) {
      if (!it.productId) throw new ValidationError('mỗi item cần productId');
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
        throw new ValidationError(`quantity của ${it.productId} phải là số nguyên dương`);
      }
      if (typeof it.price !== 'number' || it.price < 0) {
        throw new ValidationError(`price của ${it.productId} phải là số không âm`);
      }
    }

    const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const order = {
      customerId: payload.customerId || 'guest',
      items,
      total,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };
    return this.repo.save(order, idempotencyKey);
    // Tuần 6: sau khi save → publish event OrderCreated lên Kafka (outbox pattern!)
  }

  async getOrder(id) {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundError(`Không tìm thấy order ${id}`);
    return order;
  }
}

module.exports = { OrderService };
