// 🔌 Cấu hình client KafkaJS dùng chung cho admin / producer / consumer.
//
// brokers: danh sách "bootstrap server" — client kết nối vào đây trước, rồi
// Kafka trả về danh sách broker thật (qua advertised listeners). Với lab 1 node,
// localhost:9092 là đủ.

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'kafka-lab',
  brokers: ['localhost:9092'],
  // Chỉ log từ mức WARN trở lên cho output gọn gàng, dễ quan sát.
  logLevel: logLevel.WARN,
});

module.exports = { kafka };
