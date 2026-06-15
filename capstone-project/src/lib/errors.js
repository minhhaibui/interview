/** Error có statusCode để HTTP layer map thẳng sang response — service không biết gì về HTTP riêng lẻ. */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

class NotFoundError extends AppError {
  constructor(message) { super(message, 404); }
}

module.exports = { AppError, ValidationError, NotFoundError };
