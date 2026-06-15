/**
 * Unit test bằng node:test — chạy:  node --test capstone-project/test/
 * Service test với repo in-memory thật (không cần mock vì repo đã là port/adapter).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OrderService } = require('../src/services/order-service');
const { InMemoryOrderRepo } = require('../src/repos/order-repo');
const { ValidationError, NotFoundError } = require('../src/lib/errors');

const makeService = () => new OrderService(new InMemoryOrderRepo());

test('createOrder tính total đúng từ items', async () => {
  const order = await makeService().createOrder({
    customerId: 'c1',
    items: [
      { productId: 'p1', quantity: 2, price: 50000 },
      { productId: 'p2', quantity: 1, price: 30000 },
    ],
  });
  assert.equal(order.total, 130000);
  assert.equal(order.status, 'CREATED');
  assert.ok(order.id);
});

test('createOrder từ chối items rỗng', async () => {
  await assert.rejects(() => makeService().createOrder({ items: [] }), ValidationError);
});

test('createOrder từ chối quantity âm', async () => {
  await assert.rejects(
    () => makeService().createOrder({ items: [{ productId: 'p1', quantity: -1, price: 100 }] }),
    ValidationError,
  );
});

test('cùng idempotency key trả lại order cũ, không tạo trùng', async () => {
  const service = makeService();
  const payload = { items: [{ productId: 'p1', quantity: 1, price: 100 }] };
  const first = await service.createOrder(payload, 'key-1');
  const second = await service.createOrder(payload, 'key-1');
  assert.equal(second.id, first.id);
  assert.equal(second.idempotentReplay, true);
});

test('getOrder ném NotFoundError với id không tồn tại', async () => {
  await assert.rejects(() => makeService().getOrder('nope'), NotFoundError);
});
